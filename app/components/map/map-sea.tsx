"use client";

import {
  useFrame,
  useLoader,
} from "@react-three/fiber";
import {
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  ClampToEdgeWrapping,
  Color,
  DoubleSide,
  LinearFilter,
  NearestFilter,
  NoColorSpace,
  RepeatWrapping,
  ShaderMaterial,
  Texture,
  TextureLoader,
  Vector2,
  Vector3,
} from "three";

import type {
  DerivedMapGeometry,
  NationMapConfig,
} from "../../data/maps/types";

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;

    vec4 worldPosition =
      modelMatrix *
      vec4(
        position,
        1.0
      );

    vWorldPosition =
      worldPosition.xyz;

    gl_Position =
      projectionMatrix *
      viewMatrix *
      worldPosition;
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform float uParchment;

  uniform float uSurfaceSpeed;
  uniform float uSurfaceStrength;

  uniform float uNormalScaleA;
  uniform float uNormalScaleB;

  uniform float uNormalStrengthA;
  uniform float uNormalStrengthB;

  uniform vec2 uNormalSpeedA;
  uniform vec2 uNormalSpeedB;

  uniform float uNormalRotationA;
  uniform float uNormalRotationB;

  uniform vec3 uSunDirection;
  uniform vec3 uSunColor;

  uniform float uSpecularStrength;
  uniform float uSpecularPower;

  uniform float uFresnelStrength;
  uniform float uFresnelPower;

  uniform float uWhitecapStrength;
  uniform float uWhitecapThreshold;

  uniform float uCoastWidth;

  uniform float uFoamWidth;
  uniform float uFoamStrength;
  uniform float uFoamScale;
  uniform float uFoamSpeed;
  uniform float uFoamBreakup;

  uniform vec3 uDeepColor;
  uniform vec3 uMidColor;
  uniform vec3 uShallowColor;
  uniform vec3 uFoamColor;

  uniform sampler2D uWaterNormalA;
  uniform sampler2D uWaterNormalB;
  uniform sampler2D uCurrentMap;

  uniform float uCurrentAdvection;
  uniform float uCurrentDirectionInfluence;
  uniform float uCurrentSpeedInfluence;
  uniform float uCurrentTurbulenceStrength;
  uniform vec2 uCurrentMapTexelSize;

  uniform sampler2D uCoastDistance;
  uniform sampler2D uLandMask;

  uniform vec2 uLandMaskTexelSize;

  varying vec2 vUv;
  varying vec3 vWorldPosition;

  const float TWO_PI =
    6.28318530718;

  const float LOOP_DURATION =
    32.0;

  float clamp01(
    float value
  ) {
    return clamp(
      value,
      0.0,
      1.0
    );
  }

  float smootherStep(
    float edgeStart,
    float edgeEnd,
    float value
  ) {
    float denominator =
      max(
        edgeEnd - edgeStart,
        0.00001
      );

    float normalizedValue =
      clamp01(
        (
          value -
          edgeStart
        ) /
        denominator
      );

    return (
      normalizedValue *
      normalizedValue *
      normalizedValue *
      (
        normalizedValue *
        (
          normalizedValue * 6.0 -
          15.0
        ) +
        10.0
      )
    );
  }

  float hash(
    vec2 point
  ) {
    return fract(
      sin(
        dot(
          point,
          vec2(
            127.1,
            311.7
          )
        )
      ) *
      43758.5453123
    );
  }

  float noise(
    vec2 point
  ) {
    vec2 cell =
      floor(point);

    vec2 local =
      fract(point);

    local =
      local *
      local *
      (
        3.0 -
        2.0 *
        local
      );

    float a =
      hash(cell);

    float b =
      hash(
        cell +
        vec2(
          1.0,
          0.0
        )
      );

    float c =
      hash(
        cell +
        vec2(
          0.0,
          1.0
        )
      );

    float d =
      hash(
        cell +
        vec2(
          1.0,
          1.0
        )
      );

    return mix(
      mix(
        a,
        b,
        local.x
      ),
      mix(
        c,
        d,
        local.x
      ),
      local.y
    );
  }

  float fbm(
    vec2 point
  ) {
    float result =
      0.0;

    float amplitude =
      0.5;

    result +=
      noise(point) *
      amplitude;

    point =
      point * 2.03 +
      vec2(
        13.7,
        7.1
      );

    amplitude *=
      0.5;

    result +=
      noise(point) *
      amplitude;

    point =
      point * 2.01 +
      vec2(
        5.4,
        19.3
      );

    amplitude *=
      0.5;

    result +=
      noise(point) *
      amplitude;

    point =
      point * 2.04 +
      vec2(
        17.8,
        3.2
      );

    amplitude *=
      0.5;

    result +=
      noise(point) *
      amplitude;

    return result;
  }

  vec2 rotateUv(
    vec2 uv,
    float angle
  ) {
    float cosine =
      cos(angle);

    float sine =
      sin(angle);

    mat2 rotationMatrix =
      mat2(
        cosine,
        -sine,
        sine,
        cosine
      );

    return (
      rotationMatrix *
      (
        uv -
        0.5
      ) +
      0.5
    );
  }

  vec2 circularMotion(
    float phase,
    vec2 direction,
    float radius
  ) {
    vec2 perpendicular =
      vec2(
        -direction.y,
        direction.x
      );

    return (
      direction *
      cos(phase) +
      perpendicular *
      sin(phase)
    ) *
    radius;
  }

  vec3 unpackWaterNormal(
    sampler2D normalTexture,
    vec2 uv,
    float strength
  ) {
    vec3 sampledNormal =
      texture2D(
        normalTexture,
        uv
      ).xyz *
      2.0 -
      1.0;

    sampledNormal.xy *=
      strength;

    return normalize(
      sampledNormal
    );
  }

  vec3 combineNormals(
    vec3 normalA,
    vec3 normalB
  ) {
    vec3 combined =
      vec3(
        normalA.xy +
        normalB.xy,
        normalA.z *
        normalB.z
      );

    return normalize(
      combined
    );
  }

  vec3 tangentToWorldNormal(
    vec3 tangentNormal
  ) {
    return normalize(
      vec3(
        tangentNormal.x,
        tangentNormal.z,
        -tangentNormal.y
      )
    );
  }

  float sampleLand(
    vec2 uv
  ) {
    return texture2D(
      uLandMask,
      clamp(
        uv,
        vec2(0.0),
        vec2(1.0)
      )
    ).r;
  }

  vec4 sampleCurrent(
    vec2 uv
  ) {
    return texture2D(
      uCurrentMap,
      clamp(
        uv,
        vec2(0.0),
        vec2(1.0)
      )
    );
  }

  vec2 decodeCurrentVelocity(
    vec4 encodedCurrent
  ) {
    vec2 direction =
      encodedCurrent.rg *
      2.0 -
      1.0;

    float directionLength =
      length(direction);

    if (
      directionLength <
      0.001
    ) {
      return vec2(0.0);
    }

    return (
      direction /
      directionLength
    ) *
    encodedCurrent.b;
  }

  float calculateCurrentCurl(
    vec2 uv
  ) {
    vec2 texel =
      uCurrentMapTexelSize;

    vec2 velocityLeft =
      decodeCurrentVelocity(
        sampleCurrent(
          uv -
          vec2(texel.x, 0.0)
        )
      );

    vec2 velocityRight =
      decodeCurrentVelocity(
        sampleCurrent(
          uv +
          vec2(texel.x, 0.0)
        )
      );

    vec2 velocityDown =
      decodeCurrentVelocity(
        sampleCurrent(
          uv -
          vec2(0.0, texel.y)
        )
      );

    vec2 velocityUp =
      decodeCurrentVelocity(
        sampleCurrent(
          uv +
          vec2(0.0, texel.y)
        )
      );

    float derivativeVx =
      (
        velocityRight.y -
        velocityLeft.y
      ) /
      max(
        texel.x * 2.0,
        0.00001
      );

    float derivativeUy =
      (
        velocityUp.x -
        velocityDown.x
      ) /
      max(
        texel.y * 2.0,
        0.00001
      );

    return derivativeVx -
      derivativeUy;
  }

  vec2 safeNormalize(
    vec2 value,
    vec2 fallback
  ) {
    float valueLength =
      length(value);

    if (
      valueLength <
      0.001
    ) {
      return fallback;
    }

    return value /
      valueLength;
  }

  float calculateLandContact(
    vec2 uv,
    float exposedWater
  ) {
    vec2 texel =
      uLandMaskTexelSize;

    float radiusOne =
      0.0;

    radiusOne =
      max(
        radiusOne,
        sampleLand(
          uv +
          vec2(
            texel.x,
            0.0
          )
        )
      );

    radiusOne =
      max(
        radiusOne,
        sampleLand(
          uv -
          vec2(
            texel.x,
            0.0
          )
        )
      );

    radiusOne =
      max(
        radiusOne,
        sampleLand(
          uv +
          vec2(
            0.0,
            texel.y
          )
        )
      );

    radiusOne =
      max(
        radiusOne,
        sampleLand(
          uv -
          vec2(
            0.0,
            texel.y
          )
        )
      );

    radiusOne =
      max(
        radiusOne,
        sampleLand(
          uv +
          texel
        )
      );

    radiusOne =
      max(
        radiusOne,
        sampleLand(
          uv -
          texel
        )
      );

    radiusOne =
      max(
        radiusOne,
        sampleLand(
          uv +
          vec2(
            texel.x,
            -texel.y
          )
        )
      );

    radiusOne =
      max(
        radiusOne,
        sampleLand(
          uv +
          vec2(
            -texel.x,
            texel.y
          )
        )
      );

    vec2 texelTwo =
      texel * 2.0;

    float radiusTwo =
      0.0;

    radiusTwo =
      max(
        radiusTwo,
        sampleLand(
          uv +
          vec2(
            texelTwo.x,
            0.0
          )
        )
      );

    radiusTwo =
      max(
        radiusTwo,
        sampleLand(
          uv -
          vec2(
            texelTwo.x,
            0.0
          )
        )
      );

    radiusTwo =
      max(
        radiusTwo,
        sampleLand(
          uv +
          vec2(
            0.0,
            texelTwo.y
          )
        )
      );

    radiusTwo =
      max(
        radiusTwo,
        sampleLand(
          uv -
          vec2(
            0.0,
            texelTwo.y
          )
        )
      );

    vec2 texelFour =
      texel * 4.0;

    float radiusFour =
      0.0;

    radiusFour =
      max(
        radiusFour,
        sampleLand(
          uv +
          vec2(
            texelFour.x,
            0.0
          )
        )
      );

    radiusFour =
      max(
        radiusFour,
        sampleLand(
          uv -
          vec2(
            texelFour.x,
            0.0
          )
        )
      );

    radiusFour =
      max(
        radiusFour,
        sampleLand(
          uv +
          vec2(
            0.0,
            texelFour.y
          )
        )
      );

    radiusFour =
      max(
        radiusFour,
        sampleLand(
          uv -
          vec2(
            0.0,
            texelFour.y
          )
        )
      );

    float contact =
      radiusOne * 1.0 +
      radiusTwo * 0.55 +
      radiusFour * 0.22;

    return clamp01(
      contact *
      exposedWater
    );
  }

  float calculateFoamNoise(
    vec2 uv,
    float phase
  ) {
    vec2 largeUv =
      uv *
      (
        uFoamScale *
        0.14
      ) +
      circularMotion(
        phase,
        normalize(
          vec2(
            0.82,
            0.46
          )
        ),
        0.68
      );

    vec2 mediumUv =
      uv *
      (
        uFoamScale *
        0.34
      ) +
      circularMotion(
        -phase * 2.0,
        normalize(
          vec2(
            -0.32,
            0.95
          )
        ),
        0.44
      );

    vec2 fineUv =
      uv *
      (
        uFoamScale *
        0.76
      ) +
      circularMotion(
        phase * 3.0,
        normalize(
          vec2(
            0.68,
            -0.73
          )
        ),
        0.29
      );

    float largeNoise =
      fbm(largeUv);

    float mediumNoise =
      fbm(
        mediumUv +
        vec2(
          largeNoise * 2.5
        )
      );

    float fineNoise =
      fbm(
        fineUv +
        vec2(
          mediumNoise * 3.0
        )
      );

    float cellular =
      1.0 -
      abs(
        fineNoise * 2.0 -
        1.0
      );

    float porous =
      smootherStep(
        uFoamBreakup - 0.2,
        0.9,
        cellular
      );

    float cloudy =
      smootherStep(
        0.31,
        0.67,
        mediumNoise
      );

    float broadBreakup =
      smootherStep(
        0.24,
        0.71,
        largeNoise * 0.61 +
        mediumNoise * 0.39
      );

    return (
      max(
        porous,
        cloudy * 0.84
      ) *
      mix(
        0.18,
        1.0,
        broadBreakup
      )
    );
  }

  void main() {
    float animationTime =
      uTime *
      max(
        uSurfaceSpeed,
        0.001
      );

    float loopProgress =
      mod(
        animationTime,
        LOOP_DURATION
      ) /
      LOOP_DURATION;

    float phase =
      loopProgress *
      TWO_PI;

    float foamAnimationTime =
      uTime *
      max(
        uFoamSpeed,
        0.001
      );

    float foamProgress =
      mod(
        foamAnimationTime,
        LOOP_DURATION
      ) /
      LOOP_DURATION;

    float foamPhase =
      foamProgress *
      TWO_PI;

    float coastDistance =
      texture2D(
        uCoastDistance,
        vUv
      ).r;

    float landMask =
      sampleLand(
        vUv
      );

    float exposedWater =
      1.0 -
      smoothstep(
        0.25,
        0.75,
        landMask
      );

    vec4 encodedCurrent =
      sampleCurrent(
        vUv
      );

    vec2 currentVelocity =
      decodeCurrentVelocity(
        encodedCurrent
      );

    float currentMagnitude =
      clamp01(
        encodedCurrent.b
      );

    vec2 directionA =
      normalize(
        uNormalSpeedA
      );

    vec2 directionB =
      normalize(
        uNormalSpeedB
      );

    vec2 currentDirection =
      safeNormalize(
        currentVelocity,
        directionA
      );

    float directionBlend =
      currentMagnitude *
      uCurrentDirectionInfluence;

    vec2 waveDirectionA =
      safeNormalize(
        mix(
          directionA,
          currentDirection,
          directionBlend
        ),
        directionA
      );

    vec2 waveDirectionB =
      safeNormalize(
        mix(
          directionB,
          currentDirection,
          directionBlend * 0.62
        ),
        directionB
      );

    float localSpeedMultiplier =
      mix(
        1.0,
        1.0 +
        uCurrentSpeedInfluence,
        currentMagnitude
      );

    float currentTravelTime =
      animationTime *
      localSpeedMultiplier;

    vec2 currentOffset =
      currentVelocity *
      currentTravelTime *
      uCurrentAdvection;

    float signedCurl =
      clamp(
        calculateCurrentCurl(
          vUv
        ) *
        0.018,
        -1.0,
        1.0
      );

    vec2 currentPerpendicular =
      vec2(
        -currentDirection.y,
        currentDirection.x
      );

    float turbulenceOscillation =
      sin(
        phase * 3.0 +
        dot(
          vUv,
          vec2(31.0, 19.0)
        )
      );

    vec2 turbulenceOffset =
      currentPerpendicular *
      signedCurl *
      turbulenceOscillation *
      uCurrentTurbulenceStrength *
      currentMagnitude;

    vec2 normalUvA =
      rotateUv(
        vUv,
        uNormalRotationA
      ) *
      uNormalScaleA +
      circularMotion(
        phase *
        localSpeedMultiplier,
        waveDirectionA,
        0.78
      ) +
      currentOffset +
      turbulenceOffset;

    vec2 normalUvB =
      rotateUv(
        vUv,
        uNormalRotationB
      ) *
      uNormalScaleB +
      circularMotion(
        -phase *
        2.0 *
        localSpeedMultiplier,
        waveDirectionB,
        0.57
      ) +
      currentOffset *
      1.37 -
      turbulenceOffset *
      0.74;

    vec3 normalA =
      unpackWaterNormal(
        uWaterNormalA,
        normalUvA,
        uNormalStrengthA
      );

    vec3 normalB =
      unpackWaterNormal(
        uWaterNormalB,
        normalUvB,
        uNormalStrengthB
      );

    vec3 tangentNormal =
      combineNormals(
        normalA,
        normalB
      );

    vec3 waterNormal =
      tangentToWorldNormal(
        tangentNormal
      );

    vec3 viewDirection =
      normalize(
        cameraPosition -
        vWorldPosition
      );

    vec3 sunDirection =
      normalize(
        uSunDirection
      );

    vec3 halfDirection =
      normalize(
        viewDirection +
        sunDirection
      );

    float shallowToMid =
      smootherStep(
        0.01,
        0.62,
        coastDistance
      );

    float midToDeep =
      smootherStep(
        0.15,
        1.0,
        coastDistance
      );

    float shallowPresence =
      1.0 -
      smootherStep(
        0.0,
        uCoastWidth,
        coastDistance
      );

    vec3 shallowMidColor =
      mix(
        uShallowColor,
        uMidColor,
        shallowToMid
      );

    vec3 seaColor =
      mix(
        shallowMidColor,
        uDeepColor,
        midToDeep
      );

    seaColor =
      mix(
        seaColor,
        uShallowColor,
        shallowPresence * 0.2
      );

    /*
     * Illuminazione cartoony:
     * tre fasce morbide anziché risposta
     * continua e fotorealistica.
     */
    float facingLight =
      max(
        dot(
          waterNormal,
          sunDirection
        ),
        0.0
      );

    float softLight =
      smootherStep(
        0.12,
        0.68,
        facingLight
      );

    float brightLight =
      smootherStep(
        0.58,
        0.92,
        facingLight
      );

    seaColor +=
      uSunColor *
      softLight *
      0.025 *
      uSurfaceStrength *
      exposedWater;

    seaColor +=
      uSunColor *
      brightLight *
      0.018 *
      uSurfaceStrength *
      exposedWater;

    /*
     * Riflesso ampio:
     * meno puntini isolati, più masse
     * chiare e sfumate.
     */
    float rawSpecular =
      pow(
        max(
          dot(
            waterNormal,
            halfDirection
          ),
          0.0
        ),
        max(
          uSpecularPower,
          1.0
        )
      );

    float broadSpecular =
      smootherStep(
        0.025,
        0.36,
        rawSpecular
      );

    float sharpSpecular =
      smootherStep(
        0.48,
        0.94,
        rawSpecular
      );

    float specularNoise =
      fbm(
        vUv * 11.0 +
        circularMotion(
          phase,
          normalize(
            vec2(
              0.72,
              0.41
            )
          ),
          0.45
        )
      );

    float specularDistribution =
      mix(
        0.38,
        1.0,
        smootherStep(
          0.28,
          0.74,
          specularNoise
        )
      );

    float specular =
      (
        broadSpecular * 0.82 +
        sharpSpecular * 0.18
      ) *
      specularDistribution *
      uSpecularStrength *
      uSurfaceStrength *
      exposedWater;

    seaColor +=
      uSunColor *
      specular *
      0.48;

    /*
     * Fresnel morbido e colorato:
     * non bianco puro.
     */
    float fresnel =
      pow(
        1.0 -
        max(
          dot(
            waterNormal,
            viewDirection
          ),
          0.0
        ),
        max(
          uFresnelPower,
          0.01
        )
      );

    fresnel *=
      uFresnelStrength *
      exposedWater;

    vec3 fresnelColor =
      mix(
        uMidColor,
        uShallowColor,
        0.34
      );

    seaColor =
      mix(
        seaColor,
        fresnelColor,
        clamp01(
          fresnel * 0.38
        )
      );

    /*
     * Foam di mare aperto.
     *
     * Non è una patina uniforme: viene
     * costruita da creste sottili, allungate
     * nella direzione principale delle onde,
     * e spezzata da rumore a scala fine.
     */
    float slope =
      clamp01(
        length(
          tangentNormal.xy
        )
      );

    float normalInterference =
      1.0 -
      clamp01(
        dot(
          normalA,
          normalB
        )
      );

    float crestField =
      slope * 0.55 +
      normalInterference * 0.45;

    vec2 foamDirection =
      safeNormalize(
        directionA,
        vec2(0.86, 0.36)
      );

    vec2 foamPerpendicular =
      vec2(
        -foamDirection.y,
        foamDirection.x
      );

    float foamWarp =
      fbm(
        vUv * 38.0 +
        circularMotion(
          phase * 0.7,
          foamPerpendicular,
          0.34
        )
      );

    float longCrest =
      sin(
        dot(
          vUv,
          foamPerpendicular
        ) * 360.0 -
        phase * 4.2 +
        foamWarp * 8.5
      ) * 0.5 + 0.5;

    float shortCrest =
      sin(
        dot(
          vUv,
          foamPerpendicular
        ) * 610.0 +
        dot(
          vUv,
          foamDirection
        ) * 52.0 +
        phase * 2.8 -
        foamWarp * 6.0
      ) * 0.5 + 0.5;

    float crestBreakup =
      fbm(
        vUv * 92.0 +
        foamDirection *
        phase * 0.55
      );

    float directionalRidges =
      max(
        smootherStep(
          0.82,
          0.985,
          longCrest
        ),
        smootherStep(
          0.88,
          0.995,
          shortCrest
        ) * 0.58
      );

    directionalRidges *=
      smootherStep(
        0.34,
        0.78,
        crestBreakup
      );

    float openSeaFactor =
      smootherStep(
        0.045,
        0.22,
        coastDistance
      );

    float slopeFoam =
      smootherStep(
        uWhitecapThreshold,
        uWhitecapThreshold + 0.18,
        crestField
      );

    float openSeaFoam =
      directionalRidges *
      mix(
        0.18,
        1.0,
        slopeFoam
      );

    openSeaFoam *=
      mix(
        0.72,
        1.18,
        currentMagnitude
      );

    openSeaFoam *=
      openSeaFactor *
      exposedWater *
      uWhitecapStrength;

    vec3 paleCrestColor =
      mix(
        uShallowColor,
        uFoamColor,
        0.72
      );

    seaColor =
      mix(
        seaColor,
        paleCrestColor,
        clamp01(
          openSeaFoam * 0.72
        )
      );

    float whiteCrest =
      smootherStep(
        0.42,
        0.92,
        openSeaFoam
      );

    seaColor =
      mix(
        seaColor,
        uFoamColor,
        whiteCrest * 0.58
      );

    float crestMask =
      openSeaFoam;

    /*
     * Rilevamento del vero contatto
     * terra-acqua tramite land mask.
     */
    float landContact =
      calculateLandContact(
        vUv,
        exposedWater
      );

    float foamNoise =
      calculateFoamNoise(
        vUv,
        foamPhase
      );

    float broadDistortion =
      fbm(
        vUv *
        (
          uFoamScale *
          0.085
        ) +
        circularMotion(
          foamPhase,
          normalize(
            vec2(
              0.68,
              0.56
            )
          ),
          0.63
        )
      );

    float fineDistortion =
      fbm(
        vUv *
        (
          uFoamScale *
          0.26
        ) +
        circularMotion(
          -foamPhase * 2.0,
          normalize(
            vec2(
              -0.42,
              0.91
            )
          ),
          0.4
        )
      );

    float distortedDistance =
      coastDistance +
      (
        broadDistortion -
        0.5
      ) *
      0.037 +
      (
        fineDistortion -
        0.5
      ) *
      0.014;

    /*
     * Foam da impatto:
     * nasce sul bordo effettivo della mask.
     */
    float impactBreakup =
      smootherStep(
        0.25,
        0.68,
        foamNoise
      );

    float impactFoam =
      landContact *
      mix(
        0.52,
        1.0,
        impactBreakup
      );

    impactFoam *=
      mix(
        0.72,
        1.32,
        broadDistortion
      );

    /*
     * Massa spumosa poco oltre il bordo.
     */
    float shoreEnvelope =
      1.0 -
      smootherStep(
        0.001,
        uFoamWidth * 0.52,
        distortedDistance
      );

    float shoreMass =
      shoreEnvelope *
      mix(
        0.26,
        1.0,
        smootherStep(
          0.26,
          0.7,
          foamNoise
        )
      );

    /*
     * Risacca larga, irregolare e
     * deliberatamente illustrata.
     */
    float localPhaseWarp =
      (
        broadDistortion -
        0.5
      ) *
      7.4 +
      (
        fineDistortion -
        0.5
      ) *
      3.2;

    float primaryPhase =
      distortedDistance * 40.0 -
      foamPhase * 3.0 +
      localPhaseWarp;

    float secondaryPhase =
      distortedDistance * 65.0 -
      foamPhase * 2.0 -
      localPhaseWarp * 0.4;

    float tertiaryPhase =
      distortedDistance * 91.0 -
      foamPhase * 4.0 +
      localPhaseWarp * 0.25;

    float primaryWave =
      sin(primaryPhase) *
      0.5 +
      0.5;

    float secondaryWave =
      sin(secondaryPhase) *
      0.5 +
      0.5;

    float tertiaryWave =
      sin(tertiaryPhase) *
      0.5 +
      0.5;

    float localWidth =
      uFoamWidth *
      mix(
        0.86,
        1.48,
        broadDistortion
      );

    float primaryBand =
      smootherStep(
        1.0 -
        min(
          localWidth * 1.25,
          0.86
        ),
        1.0,
        primaryWave
      );

    float secondaryBand =
      smootherStep(
        1.0 -
        min(
          localWidth * 0.82,
          0.74
        ),
        1.0,
        secondaryWave
      );

    float tertiaryBand =
      smootherStep(
        1.0 -
        min(
          localWidth * 0.54,
          0.62
        ),
        1.0,
        tertiaryWave
      );

    float foamReach =
      min(
        uCoastWidth,
        0.27
      );

    float coastalEnvelope =
      1.0 -
      smootherStep(
        0.01,
        foamReach,
        coastDistance
      );

    float movingFoam =
      (
        primaryBand * 0.82 +
        secondaryBand * 0.39 +
        tertiaryBand * 0.17
      ) *
      coastalEnvelope;

    float fragmentMask =
      smootherStep(
        mix(
          0.21,
          0.43,
          broadDistortion
        ),
        mix(
          0.58,
          0.79,
          fineDistortion
        ),
        foamNoise
      );

    movingFoam *=
      mix(
        0.18,
        1.0,
        fragmentMask
      );

    float foam =
      max(
        impactFoam,
        max(
          shoreMass,
          movingFoam
        )
      );

    foam =
      clamp(
        foam *
        uFoamStrength,
        0.0,
        1.0
      );

    foam *=
      exposedWater;

    /*
     * Cartoony ma semi-realistico:
     * bordo turchese lattiginoso,
     * nucleo bianco morbido.
     */
    vec3 softFoamColor =
      mix(
        uShallowColor,
        uFoamColor,
        0.6
      );

    seaColor =
      mix(
        seaColor,
        softFoamColor,
        smootherStep(
          0.015,
          0.48,
          foam
        ) *
        0.82
      );

    seaColor =
      mix(
        seaColor,
        uFoamColor,
        smootherStep(
          0.34,
          1.0,
          foam
        ) *
        0.88
      );

    /*
     * Luce ambientale leggera.
     */
    seaColor +=
      vec3(
        0.012,
        0.031,
        0.041
      );

    vec3 parchmentDeep =
      vec3(
        0.26,
        0.22,
        0.16
      );

    vec3 parchmentShallow =
      vec3(
        0.49,
        0.43,
        0.32
      );

    vec3 parchmentSea =
      mix(
        parchmentShallow,
        parchmentDeep,
        smootherStep(
          0.0,
          1.0,
          coastDistance
        )
      );

    parchmentSea =
      mix(
        parchmentSea,
        vec3(
          0.76,
          0.71,
          0.58
        ),
        max(
          foam,
          crestMask * 0.26
        ) *
        0.48
      );

    seaColor =
      mix(
        seaColor,
        parchmentSea,
        uParchment
      );

    gl_FragColor =
      vec4(
        seaColor,
        1.0
      );
  }
`;

function prepareDataTexture(
  source: Texture,
): Texture {
  const texture =
    source.clone();

  texture.minFilter =
    LinearFilter;

  texture.magFilter =
    LinearFilter;

  texture.wrapS =
    ClampToEdgeWrapping;

  texture.wrapT =
    ClampToEdgeWrapping;

  texture.generateMipmaps =
    false;

  texture.needsUpdate =
    true;

  return texture;
}

function prepareCurrentMapTexture(
  source: Texture,
): Texture {
  const texture =
    source.clone();

  texture.colorSpace =
    NoColorSpace;

  texture.minFilter =
    LinearFilter;

  texture.magFilter =
    LinearFilter;

  texture.wrapS =
    ClampToEdgeWrapping;

  texture.wrapT =
    ClampToEdgeWrapping;

  texture.generateMipmaps =
    false;

  texture.flipY =
    source.flipY;

  texture.needsUpdate =
    true;

  return texture;
}

function prepareMaskTexture(
  source: Texture,
): Texture {
  const texture =
    source.clone();

  texture.minFilter =
    NearestFilter;

  texture.magFilter =
    NearestFilter;

  texture.wrapS =
    ClampToEdgeWrapping;

  texture.wrapT =
    ClampToEdgeWrapping;

  texture.generateMipmaps =
    false;

  texture.needsUpdate =
    true;

  return texture;
}

function prepareWaterNormalTexture(
  source: Texture,
): Texture {
  const texture =
    source.clone();

  texture.wrapS =
    RepeatWrapping;

  texture.wrapT =
    RepeatWrapping;

  texture.minFilter =
    LinearFilter;

  texture.magFilter =
    LinearFilter;

  texture.generateMipmaps =
    true;

  texture.needsUpdate =
    true;

  return texture;
}

export function MapSea({
  config,
  geometry,
  parchment,
  currentMap,
}: {
  config: NationMapConfig;
  geometry: DerivedMapGeometry;
  parchment: boolean;
  currentMap: Texture;
}) {
  const materialRef =
    useRef<ShaderMaterial>(null);

  const coastDistancePath =
    config.textures.coastDistance;

  const sea =
    config.seaRendering;

  if (!coastDistancePath) {
    throw new Error(
      `La mappa "${config.id}" non definisce textures.coastDistance.`,
    );
  }

  if (!sea) {
    throw new Error(
      `La mappa "${config.id}" non definisce seaRendering.`,
    );
  }

  const [
    coastDistanceSource,
    landMaskSource,
    waterNormalSource,
  ] = useLoader(
    TextureLoader,
    [
      coastDistancePath,
      config.textures.landMask,
      sea.normalMapA,
    ],
  );

  const coastDistanceTexture =
    useMemo(
      () =>
        prepareDataTexture(
          coastDistanceSource,
        ),
      [coastDistanceSource],
    );

  const landMaskTexture =
    useMemo(
      () =>
        prepareMaskTexture(
          landMaskSource,
        ),
      [landMaskSource],
    );

  const waterNormalTexture =
    useMemo(
      () =>
        prepareWaterNormalTexture(
          waterNormalSource,
        ),
      [waterNormalSource],
    );

  const currentMapTexture =
    useMemo(
      () =>
        prepareCurrentMapTexture(
          currentMap,
        ),
      [currentMap],
    );

  useEffect(
    () => () => {
      coastDistanceTexture.dispose();
      landMaskTexture.dispose();
      waterNormalTexture.dispose();
      currentMapTexture.dispose();
    },
    [
      coastDistanceTexture,
      currentMapTexture,
      landMaskTexture,
      waterNormalTexture,
    ],
  );

  const landMaskImage =
    landMaskSource.image as {
      width: number;
      height: number;
    };

  const currentMapImage =
    currentMap.image as {
      width: number;
      height: number;
    };

  const normalSpeedA =
    sea.normalSpeedA ??
    [
      0.85,
      0.32,
    ];

  const normalSpeedB =
    sea.normalSpeedB ??
    [
      -0.46,
      0.78,
    ];

  const sunDirection =
    sea.sunDirection ??
    [
      0.42,
      0.78,
      0.46,
    ];

  const uniforms =
    useMemo(
      () => ({
        uTime: {
          value: 0,
        },

        uParchment: {
          value:
            parchment
              ? 1
              : 0,
        },

        uSurfaceSpeed: {
          value:
            sea.surfaceSpeed ??
            0.46,
        },

        uSurfaceStrength: {
          value:
            sea.surfaceStrength ??
            1.02,
        },

        uNormalScaleA: {
          value:
            sea.normalScaleA ??
            34,
        },

        uNormalScaleB: {
          value:
            sea.normalScaleB ??
            82,
        },

        uNormalStrengthA: {
          value:
            sea.normalStrengthA ??
            0.48,
        },

        uNormalStrengthB: {
          value:
            sea.normalStrengthB ??
            0.22,
        },

        uNormalSpeedA: {
          value:
            new Vector2(
              normalSpeedA[0],
              normalSpeedA[1],
            ),
        },

        uNormalSpeedB: {
          value:
            new Vector2(
              normalSpeedB[0],
              normalSpeedB[1],
            ),
        },

        uNormalRotationA: {
          value:
            sea.normalRotationA ??
            0.08,
        },

        uNormalRotationB: {
          value:
            sea.normalRotationB ??
            1.13,
        },

        uSunDirection: {
          value:
            new Vector3(
              sunDirection[0],
              sunDirection[1],
              sunDirection[2],
            ).normalize(),
        },

        uSunColor: {
          value:
            new Color(
              sea.sunColor ??
              "#e7f4ee",
            ),
        },

        uSpecularStrength: {
          value:
            sea.specularStrength ??
            0.72,
        },

        uSpecularPower: {
          value:
            sea.specularPower ??
            18,
        },

        uFresnelStrength: {
          value:
            sea.fresnelStrength ??
            0.40,
        },

        uFresnelPower: {
          value:
            sea.fresnelPower ??
            2.7,
        },

        uWhitecapStrength: {
          value:
            sea.whitecapStrength ??
            0.88,
        },

        uWhitecapThreshold: {
          value:
            sea.whitecapThreshold ??
            0.38,
        },

        uCoastWidth: {
          value:
            sea.coastWidth ??
            0.4,
        },

        uFoamWidth: {
          value:
            sea.foamWidth ??
            0.24,
        },

        uFoamStrength: {
          value:
            sea.foamStrength ??
            1.75,
        },

        uFoamScale: {
          value:
            sea.foamScale ??
            72,
        },

        uFoamSpeed: {
          value:
            sea.foamSpeed ??
            0.56,
        },

        uFoamBreakup: {
          value:
            sea.foamBreakup ??
            0.42,
        },

        uDeepColor: {
          value:
            new Color(
              sea.deepColor ??
              config.palette.seaDeep,
            ),
        },

        uMidColor: {
          value:
            sea.midColor
              ? new Color(
                  sea.midColor,
                )
              : new Color(
                  config.palette.seaDeep,
                ).lerp(
                  new Color(
                    config.palette
                      .seaShallow,
                  ),
                  0.48,
                ),
        },

        uShallowColor: {
          value:
            new Color(
              sea.shallowColor ??
              config.palette
                .seaShallow,
            ),
        },

        uFoamColor: {
          value:
            new Color(
              sea.foamColor ??
              "#edf8f4",
            ),
        },

        uWaterNormalA: {
          value:
            waterNormalTexture,
        },

        /*
         * Secondo ottavo dello stesso asset: una sola normal map caricata,
         * campionata a scala e direzione differenti per evitare ripetizioni.
         */
        uWaterNormalB: {
          value:
            waterNormalTexture,
        },

        uCurrentMap: {
          value:
            currentMapTexture,
        },

        uCurrentAdvection: {
          value: 0.0025,
        },

        uCurrentDirectionInfluence: {
          value: 0.0,
        },

        uCurrentSpeedInfluence: {
          value: 0.05,
        },

        uCurrentTurbulenceStrength: {
          value: 0.004,
        },

        uCurrentMapTexelSize: {
          value:
            new Vector2(
              1 /
                currentMapImage.width,
              1 /
                currentMapImage.height,
            ),
        },

        uCoastDistance: {
          value:
            coastDistanceTexture,
        },

        uLandMask: {
          value:
            landMaskTexture,
        },

        uLandMaskTexelSize: {
          value:
            new Vector2(
              1 /
                landMaskImage.width,
              1 /
                landMaskImage.height,
            ),
        },
      }),
      [
        coastDistanceTexture,
        currentMapImage.height,
        currentMapImage.width,
        currentMapTexture,
        config.palette.seaDeep,
        config.palette.seaShallow,
        landMaskImage.height,
        landMaskImage.width,
        landMaskTexture,
        normalSpeedA,
        normalSpeedB,
        parchment,
        sea,
        sunDirection,
        waterNormalTexture,
      ],
    );

  useFrame((state) => {
    const material =
      materialRef.current;

    if (!material) {
      return;
    }

    material.uniforms.uTime.value =
      state.clock.elapsedTime;

    material.uniforms.uParchment.value =
      parchment
        ? 1
        : 0;
  });

  return (
    <mesh
      rotation={[
        -Math.PI / 2,
        0,
        0,
      ]}
      position={[
        0,
        0,
        0,
      ]}
      renderOrder={-10}
      receiveShadow
    >
      <planeGeometry
        args={[
          geometry.planeWidth,
          geometry.planeHeight,
          1,
          1,
        ]}
      />

      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent={false}
        depthWrite={false}
        depthTest
        side={DoubleSide}
      />
    </mesh>
  );
}