export const waterParticleDebugVertexShader = /* glsl */ `
  uniform sampler2D uPositionTexture;
  uniform sampler2D uVelocityTexture;

  uniform vec2 uPlaneSize;
  uniform float uSurfaceOffset;
  uniform float uPointSize;

  attribute vec2 particleUv;

  varying float vCollisionEnergy;
  varying float vCoastContact;
  varying float vSpeed;

  void main() {
    vec4 positionState =
      texture2D(
        uPositionTexture,
        particleUv
      );

    vec4 velocityState =
      texture2D(
        uVelocityTexture,
        particleUv
      );

    vec2 mapUv =
      positionState.xy;

    vec3 localPosition = vec3(
      (mapUv.x - 0.5) * uPlaneSize.x,
      uSurfaceOffset,
      (0.5 - mapUv.y) * uPlaneSize.y
    );

    vCollisionEnergy =
      velocityState.z;

    vCoastContact =
      velocityState.w;

    vSpeed =
      length(
        velocityState.xy
      );

    vec4 viewPosition =
      modelViewMatrix *
      vec4(localPosition, 1.0);

    gl_Position =
      projectionMatrix *
      viewPosition;

    float perspectiveScale =
      clamp(
        8.0 /
        max(
          -viewPosition.z,
          0.1
        ),
        0.55,
        2.4
      );

    gl_PointSize =
      uPointSize *
      perspectiveScale;
  }
`;

export const waterParticleDebugFragmentShader = /* glsl */ `
  uniform float uOpacity;

  varying float vCollisionEnergy;
  varying float vCoastContact;
  varying float vSpeed;

  void main() {
    vec2 centered =
      gl_PointCoord - 0.5;

    float distanceFromCenter =
      length(centered);

    if (distanceFromCenter > 0.5) {
      discard;
    }

    float softEdge =
      1.0 -
      smoothstep(
        0.32,
        0.5,
        distanceFromCenter
      );

    vec3 freeColor =
      vec3(0.08, 0.72, 0.86);

    vec3 coastColor =
      vec3(0.12, 0.96, 0.72);

    vec3 impactColor =
      vec3(1.0, 0.96, 0.82);

    vec3 color =
      mix(
        freeColor,
        coastColor,
        clamp(
          vCoastContact,
          0.0,
          1.0
        )
      );

    color =
      mix(
        color,
        impactColor,
        clamp(
          vCollisionEnergy,
          0.0,
          1.0
        )
      );

    float speedAlpha =
      smoothstep(
        0.001,
        0.035,
        vSpeed
      );

    gl_FragColor = vec4(
      color,
      softEdge *
      uOpacity *
      mix(
        0.42,
        1.0,
        speedAlpha
      )
    );
  }
`;
