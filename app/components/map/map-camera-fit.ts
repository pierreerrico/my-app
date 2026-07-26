const VERTICAL_FIT_WEIGHT = 0.68;
const FIT_MARGIN = 1.015;
const VERTICAL_FOV = Math.PI / 4;

type StaticMapFitInput = {
  viewportWidth: number;
  viewportHeight: number;
  usableWidth: number;
  usableHeight: number;
  planeWidth: number;
  planeHeight: number;
};

export function resolveStaticMapFit({
  viewportWidth,
  viewportHeight,
  usableWidth,
  usableHeight,
  planeWidth,
  planeHeight,
}: StaticMapFitInput) {
  const safeViewportWidth = Math.max(viewportWidth, 1);
  const safeViewportHeight = Math.max(viewportHeight, 1);
  const viewportAspect = safeViewportWidth / safeViewportHeight;
  const halfFovTangent = Math.tan(VERTICAL_FOV / 2);

  const heightFitDistance =
    planeHeight /
    (
      2 *
      halfFovTangent *
      (usableHeight / safeViewportHeight)
    );
  const widthFitDistance =
    planeWidth /
    (
      2 *
      halfFovTangent *
      viewportAspect *
      (usableWidth / safeViewportWidth)
    );
  const containFitDistance = Math.max(
    heightFitDistance,
    widthFitDistance,
  );
  const distance =
    (
      containFitDistance +
      (heightFitDistance - containFitDistance) *
        VERTICAL_FIT_WEIGHT
    ) *
    FIT_MARGIN;

  return {
    distance,
    pixelsPerPlaneUnit:
      safeViewportHeight /
      (2 * halfFovTangent * distance),
  };
}
