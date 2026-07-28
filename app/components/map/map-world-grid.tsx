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
  Camera,
  Color,
  LineSegments,
  Object3D,
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

function calculateViewportOverlayPosition(
  _object: Object3D,
  _camera: Camera,
  size: { width: number; height: number },
) {
  return [
    size.width / 2,
    size.height / 2,
  ];
}

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
              "#352b21",
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
      // MapControls can move the camera earlier in the same frame. Refresh
      // its inverse matrix before projecting the grid so every DOM overlay
      // follows the drag immediately instead of using the previous pose.
      camera.updateMatrixWorld();

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
        (longitude, index) => (
          <ViewportCoordinateLabel
            key={`longitude-${longitude}`}
            axis="longitude"
            index={index}
            worldPosition={[
              xForLongitude(
                longitude,
              ),
              GRID_Y,
              0,
            ]}
            neighborWorldPosition={[
              xForLongitude(
                longitudes[
                  index < longitudes.length - 1
                    ? index + 1
                    : index - 1
                ],
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
        (latitude, index) => (
          <ViewportCoordinateLabel
            key={`latitude-${latitude}`}
            axis="latitude"
            index={index}
            worldPosition={[
              0,
              GRID_Y,
              zForLatitude(latitude),
            ]}
            neighborWorldPosition={[
              0,
              GRID_Y,
              zForLatitude(
                latitudes[
                  index < latitudes.length - 1
                    ? index + 1
                    : index - 1
                ],
              ),
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
    camera.updateMatrixWorld();

    const horizontalInset = topBandRef.current?.offsetLeft ?? 0;
    const horizontalExtent = topBandRef.current?.clientWidth ?? size.width;
    const verticalInset = leftBandRef.current?.offsetTop ?? 0;
    const verticalExtent = leftBandRef.current?.clientHeight ?? size.height;

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
      const left = Math.max(
        0,
        Math.min(start, end) - horizontalInset,
      );
      const right = Math.min(
        horizontalExtent,
        Math.max(start, end) - horizontalInset,
      );

      for (const element of elements) {
        if (!element) continue;
        element.hidden = right <= 0 || left >= horizontalExtent;
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
      const top = Math.max(
        0,
        Math.min(start, end) - verticalInset,
      );
      const bottom = Math.min(
        verticalExtent,
        Math.max(start, end) - verticalInset,
      );

      for (const element of elements) {
        if (!element) continue;
        element.hidden = bottom <= 0 || top >= verticalExtent;
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
    <Html
      fullscreen
      calculatePosition={calculateViewportOverlayPosition}
      zIndexRange={[6, 6]}
      style={{ pointerEvents: "none" }}
    >
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
  index,
  worldPosition,
  neighborWorldPosition,
  label,
}: {
  axis: "latitude" | "longitude";
  index: number;
  worldPosition:
    [number, number, number];
  neighborWorldPosition:
    [number, number, number];
  label: string;
}) {
  const labelRef =
    useRef<HTMLSpanElement>(null);
  const projected = useMemo(
    () => new Vector3(),
    [],
  );
  const projectedNeighbor = useMemo(
    () => new Vector3(),
    [],
  );

  useFrame(
    ({ camera, size }) => {
      const element =
        labelRef.current;
      if (!element) return;

      camera.updateMatrixWorld();

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
      projectedNeighbor
        .set(...neighborWorldPosition)
        .project(camera);
      const neighborScreenPosition =
        axis === "longitude"
          ? (
              projectedNeighbor.x *
                0.5 +
              0.5
            ) * size.width
          : (
              -projectedNeighbor.y *
                0.5 +
              0.5
            ) * size.height;
      const currentScreenPosition =
        axis === "longitude"
          ? screenX
          : screenY;
      const projectedSpacing =
        Math.abs(
          neighborScreenPosition -
          currentScreenPosition,
        );
      const labelStride =
        Math.max(
          1,
          Math.ceil(
            52 /
              Math.max(
                projectedSpacing,
                1,
              ),
          ),
        );
      const map =
        element.closest(
          ".interactive-map",
        );
      const mapBounds =
        map?.getBoundingClientRect();
      const leftBandBounds =
        map
          ?.querySelector(
            ".map-coordinate-band.left-band",
          )
          ?.getBoundingClientRect();
      const rightBandBounds =
        map
          ?.querySelector(
            ".map-coordinate-band.right-band",
          )
          ?.getBoundingClientRect();
      const longitudeLabelHalfWidth =
        Math.max(
          22,
          label.length * 4.5 +
            12,
        );
      const longitudeMinX =
        mapBounds &&
        leftBandBounds
          ? leftBandBounds.right -
            mapBounds.left +
            longitudeLabelHalfWidth
          : 24;
      const longitudeMaxX =
        mapBounds &&
        rightBandBounds
          ? rightBandBounds.left -
            mapBounds.left -
            longitudeLabelHalfWidth
          : size.width - 24;
      const onScreen =
        axis === "longitude"
          ? screenX >=
              longitudeMinX &&
            screenX <=
              longitudeMaxX
          : screenY >= 24 &&
            screenY <=
              size.height - 24;

      element.hidden =
        !onScreen ||
        index % labelStride !== 0 ||
        projected.z < -1 ||
        projected.z > 1;

      if (element.hidden) {
        return;
      }

      if (
        axis === "longitude"
      ) {
        element.style.left =
          `${screenX}px`;
      } else {
        element.style.top =
          `${screenY}px`;
      }

      const elementBounds =
        element.getBoundingClientRect();
      const collisionSelectors = [
        ".map-navigation-cluster",
        ".map-title-group",
        ".nation-global-controls",
        ".nation-atlas-toggle",
      ];
      const collidesWithOverlay =
        collisionSelectors.some(
          (selector) => {
            const overlay =
              map?.querySelector(
                selector,
              );
            if (!overlay) return false;
            const bounds =
              overlay.getBoundingClientRect();
            const clearance = 6;
            return !(
              elementBounds.right <
                bounds.left -
                  clearance ||
              elementBounds.left >
                bounds.right +
                  clearance ||
              elementBounds.bottom <
                bounds.top -
                  clearance ||
              elementBounds.top >
                bounds.bottom +
                  clearance
            );
          },
        );

      element.hidden =
        collidesWithOverlay;
    },
  );

  return (
    <Html
      fullscreen
      calculatePosition={calculateViewportOverlayPosition}
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
