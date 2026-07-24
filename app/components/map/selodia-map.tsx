"use client";

import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Html, MapControls } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { MapControls as MapControlsImpl } from "three-stdlib";
import {
  CanvasTexture,
  Color,
  DoubleSide,
  LinearFilter,
  ShaderMaterial,
  SRGBColorSpace,
  CatmullRomCurve3,
  TextureLoader,
  Vector3,
  Vector2,
  MOUSE,
  TOUCH,
  MathUtils,
} from "three";
import { selodiaMap, type MapCoordinates, type MapPlace } from "../../data/maps";
import NeoclassicalMapFrame from "./neoclassical-map-frame";

const MAP_WIDTH = 17.6;
const MAP_HEIGHT = 9.9;

function coordinateToPosition(
  longitude: number,
  latitude: number,
  span: MapCoordinates,
) {
  const x = ((longitude - span.west) / (span.east - span.west) - 0.5) * MAP_WIDTH;
  const z = ((span.north - latitude) / (span.north - span.south) - 0.5) * MAP_HEIGHT;
  return [x, 0.72, z] as const;
}

function PlaceMarker({ place }: { place: MapPlace }) {
  const position = coordinateToPosition(
    place.longitude,
    place.latitude,
    selodiaMap.coordinates,
  );

  return (
    <group position={position}>
      <mesh castShadow>
        <coneGeometry args={[0.11, 0.42, 6]} />
        <meshStandardMaterial color={selodiaMap.palette.accent} roughness={0.7} />
      </mesh>
      <Html center distanceFactor={7} position={[0, 0.45, 0]}>
        <div className="map-place-label">
          <small>{place.kind}</small>
          <strong>{place.name}</strong>
          <p>{place.description}</p>
        </div>
      </Html>
    </group>
  );
}

function River({
  river,
}: {
  river: (typeof selodiaMap.rivers)[number];
}) {
  const curve = useMemo(
    () =>
      new CatmullRomCurve3(
        river.points.map(([longitude, latitude, elevation]) => {
          const [x, , z] = coordinateToPosition(
            longitude,
            latitude,
            selodiaMap.coordinates,
          );
          return new Vector3(x, elevation + 0.035, z);
        }),
      ),
    [river],
  );

  return (
    <mesh>
      <tubeGeometry args={[curve, 64, 0.022, 6, false]} />
      <meshStandardMaterial
        color="#7fc6ce"
        emissive="#276d7d"
        emissiveIntensity={0.25}
        roughness={0.45}
      />
    </mesh>
  );
}

const seaVertexShader = `
  uniform float uTime;
  varying float vWave;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 transformed = position;
    float wave = sin(position.x * 1.25 + uTime * .55) * .035;
    wave += cos(position.y * 1.7 - uTime * .38) * .025;
    wave += sin((position.x + position.y) * 2.4 + uTime * .24) * .012;
    transformed.z += wave;
    vWave = wave;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  }
`;

const seaFragmentShader = `
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform float uTime;
  varying float vWave;
  varying vec2 vUv;
  void main() {
    float band = smoothstep(-.06, .07, vWave);
    float shimmer = sin((vUv.x + vUv.y) * 90.0 + uTime * .7) * .018;
    vec3 color = mix(uDeep, uShallow, band + shimmer + .22);
    gl_FragColor = vec4(color, .96);
  }
`;

function AnimatedSea({ parchment }: { parchment: boolean }) {
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDeep: { value: new Color(selodiaMap.palette.seaDeep) },
      uShallow: { value: new Color(selodiaMap.palette.seaShallow) },
    }),
    [],
  );

  useFrame((state) => {
    if (!material.current) return;
    material.current.uniforms.uTime.value = state.clock.elapsedTime;
    material.current.uniforms.uDeep.value.set(parchment ? "#756b5a" : selodiaMap.palette.seaDeep);
    material.current.uniforms.uShallow.value.set(parchment ? "#a99b80" : selodiaMap.palette.seaShallow);
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]} receiveShadow>
      <planeGeometry args={[MAP_WIDTH + 18, MAP_HEIGHT + 14, 160, 96]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={seaVertexShader}
        fragmentShader={seaFragmentShader}
        transparent
        side={DoubleSide}
      />
    </mesh>
  );
}

function Terrain({ parchment }: { parchment: boolean }) {
  const [surface, elevation, normal, landMask] = useLoader(TextureLoader, [
    selodiaMap.texture,
    selodiaMap.heightmap,
    selodiaMap.normalMap ?? selodiaMap.heightmap,
    selodiaMap.landMask ?? selodiaMap.heightmap,
  ]);

  const surfaceTexture = useMemo(() => {
    const texture = surface.clone();
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }, [surface]);

  const elevationTexture = useMemo(() => {
    const texture = elevation.clone();
    texture.minFilter = LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }, [elevation]);

  const normalTexture = useMemo(() => {
    const texture = normal.clone();
    texture.minFilter = LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }, [normal]);

  const landMaskTexture = useMemo(() => {
    const texture = landMask.clone();
    texture.minFilter = LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }, [landMask]);

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      castShadow
    >
      <planeGeometry args={[MAP_WIDTH, MAP_HEIGHT, 256, 144]} />
      <meshStandardMaterial
        map={parchment ? undefined : surfaceTexture}
        color={parchment ? "#a18e6d" : "#ffffff"}
        displacementMap={elevationTexture}
        displacementScale={1.25}
        displacementBias={-0.015}
        normalMap={normalTexture}
        normalScale={new Vector2(0.72, 0.72)}
        alphaMap={landMaskTexture}
        alphaTest={0.035}
        roughness={0.82}
        metalness={0}
      />
    </mesh>
  );
}

function LoadingTerrain() {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 2;
    const context = canvas.getContext("2d");
    if (context) {
      context.fillStyle = "#d8c8a9";
      context.fillRect(0, 0, 2, 2);
    }
    return new CanvasTexture(canvas);
  }, []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[MAP_WIDTH, MAP_HEIGHT]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}

function Scene({
  zoomLevel,
  onRotationAvailable,
  resetNorthSignal,
}: {
  zoomLevel: number;
  onRotationAvailable: (available: boolean) => void;
  resetNorthSignal: number;
}) {
  const controls = useRef<MapControlsImpl>(null);
  const rotationAvailable = useRef(false);
  const recentering = useRef(false);

  useEffect(() => {
    if (!controls.current || resetNorthSignal === 0) return;
    recentering.current = true;
  }, [resetNorthSignal]);

  useFrame(({ camera, size }) => {
    if (!controls.current) return;
    const verticalFov = MathUtils.degToRad(45);
    const viewportAspect = Math.max(size.width / Math.max(size.height, 1), 0.1);
    /*
     * A zoom statico la carta deve rientrare nella parte realmente visibile
     * della tavola, non soltanto nel canvas. La cornice usa in CSS lo stesso
     * clamp basato sul lato corto; aggiungiamo un piccolo margine ottico per
     * evitare che coste e isole tocchino il filetto interno.
     */
    const shortSide = Math.min(size.width, size.height);
    const frameDepth = MathUtils.clamp(shortSide * 0.054, 38, 58);
    const safeInset = frameDepth + 10;
    const usableWidth = Math.max(size.width - safeInset * 2, size.width * 0.5);
    const usableHeight = Math.max(size.height - safeInset * 2, size.height * 0.5);
    const usableWidthRatio = usableWidth / Math.max(size.width, 1);
    const usableHeightRatio = usableHeight / Math.max(size.height, 1);
    const fitMapHeight =
      MAP_HEIGHT / (2 * Math.tan(verticalFov / 2) * usableHeightRatio);
    const fitMapWidth =
      MAP_WIDTH /
      (2 * Math.tan(verticalFov / 2) * viewportAspect * usableWidthRatio);
    const staticFitDistance = Math.max(fitMapHeight, fitMapWidth) * 1.02;
    const desiredDistances = [staticFitDistance, 7.8, 3.45];
    const desiredPolarAngles = [0.001, 0.43, 1.05];
    const currentDistance = controls.current.getDistance();
    const nextDistance = MathUtils.lerp(
      currentDistance,
      desiredDistances[zoomLevel],
      0.095,
    );
    const currentPolar = controls.current.getPolarAngle();
    const nextPolar = MathUtils.lerp(
      currentPolar,
      desiredPolarAngles[zoomLevel],
      0.095,
    );
    const offset = camera.position
      .clone()
      .sub(controls.current.target)
      .setLength(nextDistance);
    camera.position.copy(controls.current.target).add(offset);

    const canRotate = zoomLevel === 2;
    controls.current.enableRotate = canRotate;
    controls.current.enablePan = zoomLevel > 0;
    controls.current.setPolarAngle(nextPolar);
    if (!canRotate) {
      const azimuth = controls.current.getAzimuthalAngle();
      const shortestTurn = Math.atan2(Math.sin(-azimuth), Math.cos(-azimuth));
      controls.current.setAzimuthalAngle(azimuth + shortestTurn * 0.105);
    }
    if (zoomLevel === 0 || recentering.current) {
      controls.current.target.lerp(new Vector3(0, 0, 0), 0.095);
    }

    const panLimits = [
      { x: 0, z: 0 },
      { x: 4.6, z: 2.1 },
      { x: 7.5, z: 3.7 },
    ][zoomLevel];
    const boundedTarget = controls.current.target.clone();
    boundedTarget.x = MathUtils.clamp(boundedTarget.x, -panLimits.x, panLimits.x);
    boundedTarget.z = MathUtils.clamp(boundedTarget.z, -panLimits.z, panLimits.z);
    const panCorrection = boundedTarget.clone().sub(controls.current.target);
    if (panCorrection.lengthSq() > 0) {
      controls.current.target.copy(boundedTarget);
      camera.position.add(panCorrection);
    }
    if (recentering.current) {
      const azimuth = controls.current.getAzimuthalAngle();
      const shortestTurn = Math.atan2(Math.sin(-azimuth), Math.cos(-azimuth));
      controls.current.setAzimuthalAngle(azimuth + shortestTurn * 0.105);
      if (Math.abs(shortestTurn) < 0.002 && controls.current.target.length() < 0.01) {
        recentering.current = false;
      }
    }

    if (rotationAvailable.current !== canRotate) {
      rotationAvailable.current = canRotate;
      onRotationAvailable(canRotate);
    }
  });

  return (
    <>
      <color attach="background" args={["#102f3d"]} />
      <fog attach="fog" args={["#102f3d", 15, 31]} />
      <ambientLight intensity={1.25} />
      <directionalLight
        castShadow
        position={[-6, 10, 5]}
        intensity={2.25}
        color="#ffe0ae"
      />
      <hemisphereLight args={["#b8dbe0", "#785b3b", 0.75]} />
      <AnimatedSea parchment={zoomLevel === 0} />
      <Suspense fallback={<LoadingTerrain />}>
        <Terrain parchment={zoomLevel === 0} />
      </Suspense>
      {selodiaMap.places.map((place) => (
        <PlaceMarker place={place} key={place.id} />
      ))}
      {zoomLevel > 0 &&
        selodiaMap.rivers.map((river) => <River river={river} key={river.id} />)}
      <MapControls
        ref={controls}
        makeDefault
        enablePan
        enableRotate={false}
        enableZoom={false}
        minDistance={3.2}
        maxDistance={15.4}
        minPolarAngle={0.001}
        maxPolarAngle={1.075}
        enableDamping
        dampingFactor={0.08}
        screenSpacePanning={false}
        mouseButtons={{
          LEFT: MOUSE.PAN,
          MIDDLE: MOUSE.DOLLY,
          RIGHT: MOUSE.ROTATE,
        }}
        touches={{
          ONE: TOUCH.PAN,
          TWO: TOUCH.DOLLY_ROTATE,
        }}
        target={[0, 0, 0]}
      />
    </>
  );
}

export default function SelodiaInteractiveMap() {
  const [zoomLevel, setZoomLevel] = useState(0);
  const [rotationAvailable, setRotationAvailable] = useState(false);
  const [resetNorthSignal, setResetNorthSignal] = useState(0);
  const lastWheel = useRef(0);

  function changeZoom(direction: 1 | -1) {
    const now = Date.now();
    if (now - lastWheel.current < 320) return;
    lastWheel.current = now;
    setZoomLevel((level) => Math.min(2, Math.max(0, level + direction)));
  }

  return (
    <div
      className={`interactive-map zoom-level-${zoomLevel}`}
      onWheel={(event) => {
        event.preventDefault();
        changeZoom(event.deltaY < 0 ? 1 : -1);
      }}
    >
      <div className="cartographic-sheet">
        <Canvas
          shadows
          dpr={[1, 1.6]}
          camera={{
            position: [0, 15.15, 0.01],
            fov: 45,
            near: 0.1,
            far: 100,
          }}
          gl={{ antialias: true }}
          resize={{ debounce: { scroll: 0, resize: 0 } }}
        >
          <Scene
            zoomLevel={zoomLevel}
            onRotationAvailable={setRotationAvailable}
            resetNorthSignal={resetNorthSignal}
          />
        </Canvas>
        <NeoclassicalMapFrame />
        <svg className="coordinate-grid" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true">
        <g className="grid-lines">
          {[197, 500, 803].map((x) => <line x1={x} y1="0" x2={x} y2="620" key={`x-${x}`} />)}
          {[155, 465].map((y) => <line x1="0" y1={y} x2="1000" y2={y} key={`y-${y}`} />)}
        </g>
        <g className="grid-labels">
          <text x="120" y="582">1,65° O</text>
          <text x="310" y="582">0,82° O</text>
          <text x="500" y="582">0°</text>
          <text x="690" y="582">0,82° E</text>
          <text x="880" y="582">1,65° E</text>
          <text x="902" y="66">38,5° N</text>
          <text x="902" y="190">38° N</text>
          <text x="902" y="314">37,5° N</text>
          <text x="902" y="438">37° N</text>
          <text x="902" y="562">36,5° N</text>
        </g>
        </svg>
        <div className="coordinate-labels" aria-hidden="true">
          <span className="longitude is-west">1° O</span>
          <span className="longitude is-zero">0°</span>
          <span className="longitude is-east">1° E</span>
          <span className="latitude is-north">38° N</span>
          <span className="latitude is-south">37° N</span>
        </div>
        <div className="map-title-group" aria-hidden="true">
          <div className="map-title-laurel" />
          <svg className="map-title-cartouche" viewBox="0 0 420 94">
            <path d="M48 18H372L402 47L372 76H48L18 47Z" />
            <path d="M52 25H368L389 47L368 69H52L31 47Z" />
            <path d="M72 18C61 4 48 4 39 14M348 18C359 4 372 4 381 14M72 76C61 90 48 90 39 80M348 76C359 90 372 90 381 80" />
            <text x="210" y="54">ARCONTATO DI SELÒDIA</text>
          </svg>
        </div>
        <svg className="map-scale-ornament" viewBox="0 0 220 52" aria-label="Scala cartografica">
        <path d="M10 18H210M10 12V26M60 12V26M110 12V26M160 12V26M210 12V26" />
        <path d="M10 32H210" />
        <text x="10" y="47">0</text>
        <text x="58" y="47">150</text>
        <text x="105" y="47">300</text>
        <text x="154" y="47">450</text>
        <text x="197" y="47">600 km</text>
        </svg>
      </div>
      {rotationAvailable && (
        <button
          className="compass-control"
          type="button"
          onClick={() => setResetNorthSignal((value) => value + 1)}
          aria-label="Riallinea la carta verso nord"
          title="Riallinea il nord"
        >
          <span>N</span>
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <path d="M50 5L61 39L95 50L61 61L50 95L39 61L5 50L39 39Z" />
            <path d="M50 16L55 45L84 50L55 55L50 84L45 55L16 50L45 45Z" />
            <circle cx="50" cy="50" r="9" />
          </svg>
        </button>
      )}
    </div>
  );
}
