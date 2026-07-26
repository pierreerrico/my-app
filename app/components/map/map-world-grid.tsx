"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  BufferGeometry,
  Color,
  LineSegments,
  ShaderMaterial,
  Vector2,
  Vector3,
} from "three";

import {
  formatCoordinate,
  valuesWithinBounds,
} from "../../data/maps/geography";
import type {
  DerivedMapGeometry,
} from "../../data/maps/types";

const GRID_STEP_DEGREES = 1;
const GRID_SUBDIVISIONS = 2;
const GRID_Y = 0.24;
const GRID_EXTENSION_SPANS = 2;
const MAX_LABEL_MASKS = 64;

const gridVertexShader = /* glsl */ `
  void main() {
    gl_Position =
      projectionMatrix *
      modelViewMatrix *
      vec4(position, 1.0);
  }
`;

const gridFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform int uMaskCount;
  uniform vec2 uMaskCenters[${MAX_LABEL_MASKS}];
  uniform float uMaskRadius;

  void main() {
    for (
      int index = 0;
      index < ${MAX_LABEL_MASKS};
      index++
    ) {
      if (index >= uMaskCount) {
        break;
      }

      if (
        distance(
          gl_FragCoord.xy,
          uMaskCenters[index]
        ) < uMaskRadius
      ) {
        discard;
      }
    }

    gl_FragColor =
      vec4(uColor, uOpacity);
  }
`;

/**
 * Reticolo geografico appartenente al piano della carta.
 *
 * Non è un overlay della viewport: ogni linea e ogni punto di ancoraggio
 * delle etichette è espresso nelle stesse coordinate locali del terreno.
 */
export function MapWorldGrid({
  geometry,
  visible,
}: {
  geometry: DerivedMapGeometry;
  visible: boolean;
}) {
  const lineMeshRef =
    useRef<LineSegments>(null);
  const longitudeSpan =
    geometry.bounds.east -
    geometry.bounds.west;
  const latitudeSpan =
    geometry.bounds.north -
    geometry.bounds.south;

  const extendedBounds = useMemo(
    () => ({
      west:
        geometry.bounds.west -
        longitudeSpan *
          GRID_EXTENSION_SPANS,
      east:
        geometry.bounds.east +
        longitudeSpan *
          GRID_EXTENSION_SPANS,
      north:
        geometry.bounds.north +
        latitudeSpan *
          GRID_EXTENSION_SPANS,
      south:
        geometry.bounds.south -
        latitudeSpan *
          GRID_EXTENSION_SPANS,
    }),
    [
      geometry.bounds.east,
      geometry.bounds.north,
      geometry.bounds.south,
      geometry.bounds.west,
      latitudeSpan,
      longitudeSpan,
    ],
  );

  const longitudes = useMemo(
    () =>
      valuesWithinBounds(
        extendedBounds.west,
        extendedBounds.east,
        GRID_STEP_DEGREES,
      ),
    [
      extendedBounds.east,
      extendedBounds.west,
    ],
  );

  const latitudes = useMemo(
    () =>
      valuesWithinBounds(
        extendedBounds.south,
        extendedBounds.north,
        GRID_STEP_DEGREES,
      ),
    [
      extendedBounds.north,
      extendedBounds.south,
    ],
  );
  const subdivisionStep =
    GRID_STEP_DEGREES /
    GRID_SUBDIVISIONS;
  const longitudeSubdivisions = useMemo(
    () =>
      valuesWithinBounds(
        extendedBounds.west,
        extendedBounds.east,
        subdivisionStep,
      ),
    [
      extendedBounds.east,
      extendedBounds.west,
      subdivisionStep,
    ],
  );
  const latitudeSubdivisions = useMemo(
    () =>
      valuesWithinBounds(
        extendedBounds.south,
        extendedBounds.north,
        subdivisionStep,
      ).reverse(),
    [
      extendedBounds.north,
      extendedBounds.south,
      subdivisionStep,
    ],
  );

  const xForLongitude =
    useCallback(
      (longitude: number) =>
        ((longitude -
          geometry.bounds.west) /
          longitudeSpan -
          0.5) *
        geometry.planeWidth,
      [
        geometry.bounds.west,
        geometry.planeWidth,
        longitudeSpan,
      ],
    );

  const zForLatitude =
    useCallback(
      (latitude: number) =>
        ((geometry.bounds.north -
          latitude) /
          latitudeSpan -
          0.5) *
        geometry.planeHeight,
      [
        geometry.bounds.north,
        geometry.planeHeight,
        latitudeSpan,
      ],
    );

  const lineGeometry = useMemo(() => {
    const points: Vector3[] = [];
    const extendedWest =
      xForLongitude(
        extendedBounds.west,
      );
    const extendedEast =
      xForLongitude(
        extendedBounds.east,
      );
    const extendedNorth =
      zForLatitude(
        extendedBounds.north,
      );
    const extendedSouth =
      zForLatitude(
        extendedBounds.south,
      );

    for (const longitude of longitudes) {
      const x =
        ((longitude -
          geometry.bounds.west) /
          longitudeSpan -
          0.5) *
        geometry.planeWidth;

      points.push(
        new Vector3(
          x,
          GRID_Y,
          extendedNorth,
        ),
        new Vector3(
          x,
          GRID_Y,
          extendedSouth,
        ),
      );
    }

    for (const latitude of latitudes) {
      const z =
        ((geometry.bounds.north -
          latitude) /
          latitudeSpan -
          0.5) *
        geometry.planeHeight;

      points.push(
        new Vector3(
          extendedWest,
          GRID_Y,
          z,
        ),
        new Vector3(
          extendedEast,
          GRID_Y,
          z,
        ),
      );
    }

    return new BufferGeometry()
      .setFromPoints(points);
  }, [
    geometry.bounds.north,
    geometry.bounds.west,
    geometry.planeHeight,
    geometry.planeWidth,
    extendedBounds.east,
    extendedBounds.north,
    extendedBounds.south,
    extendedBounds.west,
    latitudeSpan,
    latitudes,
    longitudeSpan,
    longitudes,
    xForLongitude,
    zForLatitude,
  ]);

  const lineMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader:
          gridVertexShader,
        fragmentShader:
          gridFragmentShader,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uColor: {
            value: new Color(
              "#b69a67",
            ),
          },
          uOpacity: {
            value: 0.5,
          },
          uMaskCount: {
            value: 0,
          },
          uMaskCenters: {
            value: Array.from(
              {
                length:
                  MAX_LABEL_MASKS,
              },
              () => new Vector2(),
            ),
          },
          uMaskRadius: {
            value: 15,
          },
        },
      }),
    [],
  );

  const projectionPoint =
    useMemo(
      () => new Vector3(),
      [],
    );

  useFrame(
    ({
      camera,
      gl,
      size,
    }) => {
      const activeMaterial =
        lineMeshRef.current
          ?.material as
          | ShaderMaterial
          | undefined;
      if (!activeMaterial) {
        return;
      }

      if (!visible) {
        activeMaterial.uniforms
          .uMaskCount.value = 0;
        return;
      }

      const pixelRatio =
        gl.getPixelRatio();
      const shortSide = Math.min(
        size.width,
        size.height,
      );
      const bottomEdgeOffset = Math.min(
        98,
        Math.max(
          76,
          shortSide * 0.09,
        ),
      );
      const rightEdgeOffset = Math.min(
        110,
        Math.max(
          82,
          shortSide * 0.1,
        ),
      );
      const maskCenters =
        activeMaterial.uniforms
          .uMaskCenters
          .value as Vector2[];
      let maskCount = 0;

      for (
        const longitude of
          longitudes
      ) {
        projectionPoint
          .set(
            xForLongitude(
              longitude,
            ),
            GRID_Y,
            0,
          )
          .project(camera);
        const screenX =
          (projectionPoint.x *
            0.5 +
            0.5) *
          size.width;

        if (
          screenX < 24 ||
          screenX >
            size.width - 24 ||
          maskCount >=
            MAX_LABEL_MASKS
        ) {
          continue;
        }

        maskCenters[
          maskCount
        ].set(
          screenX * pixelRatio,
          bottomEdgeOffset *
            pixelRatio,
        );
        maskCount += 1;
      }

      for (
        const latitude of
          latitudes
      ) {
        projectionPoint
          .set(
            0,
            GRID_Y,
            zForLatitude(latitude),
          )
          .project(camera);
        const screenY =
          (-projectionPoint.y *
            0.5 +
            0.5) *
          size.height;

        if (
          screenY < 24 ||
          screenY >
            size.height - 24 ||
          maskCount >=
            MAX_LABEL_MASKS
        ) {
          continue;
        }

        maskCenters[
          maskCount
        ].set(
          (size.width -
            rightEdgeOffset) *
            pixelRatio,
          (size.height -
            screenY) *
            pixelRatio,
        );
        maskCount += 1;
      }

      activeMaterial.uniforms
        .uMaskCount.value =
        maskCount;
      activeMaterial.uniforms
        .uMaskRadius.value =
        15 * pixelRatio;
    },
  );

  useEffect(
    () => () => {
      lineGeometry.dispose();
      lineMaterial.dispose();
    },
    [
      lineGeometry,
      lineMaterial,
    ],
  );

  return (
    <group
      renderOrder={1200}
      visible={visible}
    >
      <lineSegments
        ref={lineMeshRef}
        geometry={lineGeometry}
        material={lineMaterial}
        frustumCulled={false}
        renderOrder={1200}
      />

      {visible ? (
        <ViewportCoordinateBands
          longitudes={longitudeSubdivisions}
          latitudes={latitudeSubdivisions}
          xForLongitude={xForLongitude}
          zForLatitude={zForLatitude}
        />
      ) : null}

      {visible
        ? longitudes.map(
        (longitude) => (
          <ViewportCoordinateLabel
            key={`longitude-${longitude}`}
            axis="longitude"
            worldPosition={[
              xForLongitude(
                longitude,
              ),
              GRID_Y,
              0,
            ]}
            label={formatCoordinate(
              longitude,
              "longitude",
            )}
          />
        ),
      )
        : null}

      {visible
        ? latitudes.map(
        (latitude) => (
          <ViewportCoordinateLabel
            key={`latitude-${latitude}`}
            axis="latitude"
            worldPosition={[
              0,
              GRID_Y,
              zForLatitude(latitude),
            ]}
            label={formatCoordinate(
              latitude,
              "latitude",
            )}
          />
        ),
      )
        : null}
    </group>
  );
}

function ViewportCoordinateBands({
  longitudes,
  latitudes,
  xForLongitude,
  zForLatitude,
}: {
  longitudes: number[];
  latitudes: number[];
  xForLongitude: (longitude: number) => number;
  zForLatitude: (latitude: number) => number;
}) {
  const topBandsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const bottomBandsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const leftBandsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const rightBandsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const topBandRef = useRef<HTMLDivElement>(null);
  const bottomBandRef = useRef<HTMLDivElement>(null);
  const leftBandRef = useRef<HTMLDivElement>(null);
  const rightBandRef = useRef<HTMLDivElement>(null);
  const projectedStart = useMemo(() => new Vector3(), []);
  const projectedEnd = useMemo(() => new Vector3(), []);

  useFrame(({ camera, size }) => {
    const frameInset =
      Math.min(
        58,
        Math.max(
          38,
          Math.min(size.width, size.height) * 0.054,
        ),
      ) + 3;

    if (topBandRef.current) {
      topBandRef.current.style.top = `${frameInset}px`;
    }
    if (bottomBandRef.current) {
      bottomBandRef.current.style.bottom = `${frameInset}px`;
    }
    if (leftBandRef.current) {
      leftBandRef.current.style.left = `${frameInset}px`;
    }
    if (rightBandRef.current) {
      rightBandRef.current.style.right = `${frameInset}px`;
    }

    for (let index = 0; index < longitudes.length - 1; index += 1) {
      const elements = [
        topBandsRef.current[index],
        bottomBandsRef.current[index],
      ];

      projectedStart
        .set(xForLongitude(longitudes[index]), GRID_Y, 0)
        .project(camera);
      projectedEnd
        .set(xForLongitude(longitudes[index + 1]), GRID_Y, 0)
        .project(camera);

      const start = (projectedStart.x * 0.5 + 0.5) * size.width;
      const end = (projectedEnd.x * 0.5 + 0.5) * size.width;
      const left = Math.max(0, Math.min(start, end));
      const right = Math.min(size.width, Math.max(start, end));

      for (const element of elements) {
        if (!element) continue;
        element.hidden = right <= 0 || left >= size.width;
        element.style.left = `${left}px`;
        element.style.width = `${Math.max(0, right - left)}px`;
      }
    }

    for (let index = 0; index < latitudes.length - 1; index += 1) {
      const elements = [
        leftBandsRef.current[index],
        rightBandsRef.current[index],
      ];

      projectedStart
        .set(0, GRID_Y, zForLatitude(latitudes[index]))
        .project(camera);
      projectedEnd
        .set(0, GRID_Y, zForLatitude(latitudes[index + 1]))
        .project(camera);

      const start = (-projectedStart.y * 0.5 + 0.5) * size.height;
      const end = (-projectedEnd.y * 0.5 + 0.5) * size.height;
      const top = Math.max(0, Math.min(start, end));
      const bottom = Math.min(size.height, Math.max(start, end));

      for (const element of elements) {
        if (!element) continue;
        element.hidden = bottom <= 0 || top >= size.height;
        element.style.top = `${top}px`;
        element.style.height = `${Math.max(0, bottom - top)}px`;
      }
    }
  });

  const longitudeBand = (
    side: "top" | "bottom",
    refs: React.MutableRefObject<(HTMLSpanElement | null)[]>,
    bandRef: React.RefObject<HTMLDivElement | null>,
  ) => (
    <div
      ref={bandRef}
      className={`map-coordinate-band longitude-band ${side}-band`}
    >
      {longitudes.slice(0, -1).map((longitude, index) => (
        <span
          key={`${side}-longitude-band-${longitude}`}
          ref={(element) => {
            refs.current[index] = element;
          }}
          className={index % 2 === 0 ? "is-dark" : "is-light"}
        />
      ))}
    </div>
  );

  const latitudeBand = (
    side: "left" | "right",
    refs: React.MutableRefObject<(HTMLSpanElement | null)[]>,
    bandRef: React.RefObject<HTMLDivElement | null>,
  ) => (
    <div
      ref={bandRef}
      className={`map-coordinate-band latitude-band ${side}-band`}
    >
      {latitudes.slice(0, -1).map((latitude, index) => (
        <span
          key={`${side}-latitude-band-${latitude}`}
          ref={(element) => {
            refs.current[index] = element;
          }}
          className={index % 2 === 0 ? "is-dark" : "is-light"}
        />
      ))}
    </div>
  );

  return (
    <Html fullscreen zIndexRange={[6, 6]} style={{ pointerEvents: "none" }}>
      <div className="map-coordinate-bands" aria-hidden="true">
        {longitudeBand("top", topBandsRef, topBandRef)}
        {longitudeBand("bottom", bottomBandsRef, bottomBandRef)}
        {latitudeBand("left", leftBandsRef, leftBandRef)}
        {latitudeBand("right", rightBandsRef, rightBandRef)}
      </div>
    </Html>
  );
}

function ViewportCoordinateLabel({
  axis,
  worldPosition,
  label,
}: {
  axis: "latitude" | "longitude";
  worldPosition:
    [number, number, number];
  label: string;
}) {
  const labelRef =
    useRef<HTMLSpanElement>(null);
  const projected = useMemo(
    () => new Vector3(),
    [],
  );

  useFrame(
    ({ camera, size }) => {
      const element =
        labelRef.current;
      if (!element) return;

      projected
        .set(...worldPosition)
        .project(camera);

      const screenX =
        (projected.x * 0.5 +
          0.5) *
        size.width;
      const screenY =
        (-projected.y * 0.5 +
          0.5) *
        size.height;
      const onScreen =
        axis === "longitude"
          ? screenX >= 24 &&
            screenX <=
              size.width - 24
          : screenY >= 24 &&
            screenY <=
              size.height - 24;

      element.hidden =
        !onScreen ||
        projected.z < -1 ||
        projected.z > 1;

      if (
        axis === "longitude"
      ) {
        element.style.left =
          `${screenX}px`;
      } else {
        element.style.top =
          `${screenY}px`;
      }
    },
  );

  return (
    <Html
      fullscreen
      zIndexRange={[7, 7]}
      style={{
        pointerEvents: "none",
      }}
    >
      <span
        ref={labelRef}
        className={`map-world-coordinate-label ${axis}`}
        data-label={label}
      >
        {label}
      </span>
    </Html>
  );
}
