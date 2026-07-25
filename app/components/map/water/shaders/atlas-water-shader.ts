import {
  Color,
  Vector2,
  Vector3,
  Vector4,
} from "three";

/**
 * Water2-compatible atlas water shader.
 *
 * Reflection, refraction and the two flowing normal maps are still handled by
 * Three.js Water2. Shore foam uses the MIT-licensed foam textures bundled by
 * tuxalin/water-shader, but the atlas-specific placement is driven by:
 *
 * - coastDistance: distance from the coast;
 * - currentMap: local current direction and strength;
 * - landMask: removal of water effects over land.
 *
 * Shore foam is built from three textured fronts. Every front:
 *
 * - starts offshore with large random interruptions unique to that wave;
 * - progressively closes those same interruptions while keeping the same seed;
 * - still keeps the inner/middle/outer ordering of baseline gap coverage;
 * - has strongly varying inner and outer thickness;
 * - progressively thins the fronts farther from the coast;
 * - spawns offshore and travels only toward the coast;
 * - grows thicker as it approaches the shoreline;
 * - fades completely to zero at the coast before respawning offshore;
 * - lets the current map advect patches, thickness and fine texture detail.
 *
 * A wider, low-opacity Screen pass acts as the optical blur around the core.
 */
export const atlasWaterShader = {
  name: "SelodiaAtlasWaterTextureFoamFronts",
  uniforms: {
    color: {
      value: new Color("#0b4655"),
    },
    reflectivity: {
      value: 0.075,
    },
    reflectionStrength: {
      value: 0.18,
    },
    refractionStrength: {
      value: 0.74,
    },
    normalStrength: {
      value: 0.62,
    },
    refractionBlurStrength: {
      value: 1.65,
    },
    refractionTexelSize: {
      value: new Vector2(
        1.0 / 768.0,
        1.0 / 768.0,
      ),
    },
    tCoastDistance: {
      value: null,
    },
    tLandMask: {
      value: null,
    },
    tFoamTexture: {
      value: null,
    },
    tShoreTexture: {
      value: null,
    },
    mapTexelSize: {
      value: new Vector2(
        1.0 / 2048.0,
        1.0 / 1152.0,
      ),
    },
    time: {
      value: 0,
    },
    foamColor: {
      value: new Color("#eef8f3"),
    },
    foamIntensity: {
      value: 0.78,
    },
    foamTiling: {
      value: new Vector2(4.8, 1.85),
    },
    foamRanges: {
      value: new Vector2(0.020, 0.235),
    },
    foamSpeed: {
      value: 0.0085,
    },
    foamPushPullSpeed: {
      value: 0.39,
    },
    foamGapSpeed: {
      value: 0.105,
    },
    foamLineWidths: {
      value: new Vector3(0.0240, 0.0150, 0.0085),
    },
    foamImpactStrength: {
      value: 0.34,
    },
    tReflectionMap: {
      value: null,
    },
    tRefractionMap: {
      value: null,
    },
    tNormalMap0: {
      value: null,
    },
    tNormalMap1: {
      value: null,
    },
    textureMatrix: {
      value: null,
    },
    config: {
      value: new Vector4(),
    },
  },
  vertexShader: /* glsl */ `
    #include <common>
    #include <logdepthbuf_pars_vertex>
    #include <fog_pars_vertex>

    uniform mat4 textureMatrix;

    varying vec4 vCoord;
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vToEye;

    void main() {
      vUv = uv;
      vCoord = textureMatrix * vec4(position, 1.0);

      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      vToEye = cameraPosition - worldPosition.xyz;

      vec4 mvPosition = viewMatrix * worldPosition;
      gl_Position = projectionMatrix * mvPosition;

      #include <logdepthbuf_vertex>
      #include <fog_vertex>
    }
  `,
  fragmentShader: /* glsl */ `
    #include <common>
    #include <logdepthbuf_pars_fragment>
    #include <fog_pars_fragment>

    uniform sampler2D tReflectionMap;
    uniform sampler2D tRefractionMap;
    uniform sampler2D tNormalMap0;
    uniform sampler2D tNormalMap1;
    uniform sampler2D tCoastDistance;
    uniform sampler2D tLandMask;
    uniform sampler2D tFoamTexture;
    uniform sampler2D tShoreTexture;

    #ifdef USE_FLOWMAP
      uniform sampler2D tFlowMap;
    #else
      uniform vec2 flowDirection;
    #endif

    uniform vec3 color;
    uniform float reflectivity;
    uniform float reflectionStrength;
    uniform float refractionStrength;
    uniform float normalStrength;
    uniform float refractionBlurStrength;
    uniform vec2 refractionTexelSize;

    uniform vec2 mapTexelSize;
    uniform float time;
    uniform vec3 foamColor;
    uniform float foamIntensity;
    uniform vec2 foamTiling;
    uniform vec2 foamRanges;
    uniform float foamSpeed;
    uniform float foamPushPullSpeed;
    uniform float foamGapSpeed;
    uniform vec3 foamLineWidths;
    uniform float foamImpactStrength;

    uniform vec4 config;

    varying vec4 vCoord;
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vToEye;

    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    float valueNoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);

      float a = hash12(i);
      float b = hash12(i + vec2(1.0, 0.0));
      float c = hash12(i + vec2(0.0, 1.0));
      float d = hash12(i + vec2(1.0, 1.0));

      return mix(
        mix(a, b, f.x),
        mix(c, d, f.x),
        f.y
      );
    }

    float fbm(vec2 p) {
      float value = 0.0;
      float amplitude = 0.5;

      for (int octave = 0; octave < 4; octave++) {
        value += valueNoise(p) * amplitude;
        p = p * 2.03 + vec2(17.1, 9.2);
        amplitude *= 0.5;
      }

      return value;
    }

    vec2 decodeFlowDirection(vec4 encoded) {
      vec2 direction = encoded.rg * 2.0 - 1.0;
      float directionLength = length(direction);

      if (directionLength < 0.001) {
        return normalize(vec2(0.72, 0.34));
      }

      return direction / directionLength;
    }

    vec3 screenBlend(vec3 base, vec3 blend) {
      return 1.0 - (1.0 - base) * (1.0 - blend);
    }

    vec3 sampleRefractedSeabed(
      vec2 uv,
      vec2 normalOffset,
      float strength
    ) {
      vec2 offset =
        normalOffset *
        refractionTexelSize *
        strength *
        7.5;

      vec2 crossOffset = vec2(-offset.y, offset.x) * 0.42;

      vec3 result = texture2D(tRefractionMap, uv).rgb * 0.24;
      result += texture2D(tRefractionMap, uv + offset).rgb * 0.16;
      result += texture2D(tRefractionMap, uv - offset).rgb * 0.16;
      result += texture2D(tRefractionMap, uv + offset * 2.0).rgb * 0.10;
      result += texture2D(tRefractionMap, uv - offset * 2.0).rgb * 0.10;
      result += texture2D(tRefractionMap, uv + crossOffset).rgb * 0.08;
      result += texture2D(tRefractionMap, uv - crossOffset).rgb * 0.08;
      result += texture2D(
        tRefractionMap,
        uv + offset * 0.65 + crossOffset
      ).rgb * 0.04;
      result += texture2D(
        tRefractionMap,
        uv - offset * 0.65 - crossOffset
      ).rgb * 0.04;

      return result;
    }

    float sampleCoastDistance(vec2 uv) {
      vec2 safeUv = clamp(uv, vec2(0.0), vec2(1.0));

      float center = texture2D(tCoastDistance, safeUv).r * 4.0;
      float left = texture2D(
        tCoastDistance,
        clamp(safeUv - vec2(mapTexelSize.x, 0.0), vec2(0.0), vec2(1.0))
      ).r;
      float right = texture2D(
        tCoastDistance,
        clamp(safeUv + vec2(mapTexelSize.x, 0.0), vec2(0.0), vec2(1.0))
      ).r;
      float down = texture2D(
        tCoastDistance,
        clamp(safeUv - vec2(0.0, mapTexelSize.y), vec2(0.0), vec2(1.0))
      ).r;
      float up = texture2D(
        tCoastDistance,
        clamp(safeUv + vec2(0.0, mapTexelSize.y), vec2(0.0), vec2(1.0))
      ).r;

      return (center + left + right + down + up) / 8.0;
    }

    float asymmetricBand(
      float value,
      float center,
      float innerWidth,
      float outerWidth
    ) {
      float delta = value - center;
      float width = delta < 0.0 ? innerWidth : outerWidth;
      float normalized = abs(delta) / max(width, 0.0001);

      return 1.0 - smoothstep(0.38, 1.0, normalized);
    }

    float foamLifecycleOpacity(float lifecycle) {
      /*
       * Hide the instant in which a completed front respawns offshore, then
       * keep it visible while it travels shoreward and dissolve it completely
       * during the final approach to the coastline.
       */
      float offshoreFadeIn = smoothstep(
        0.0,
        0.065,
        lifecycle
      );

      float shoreFadeOut = 1.0 - smoothstep(
        0.84,
        1.0,
        lifecycle
      );

      return offshoreFadeIn * shoreFadeOut;
    }

    vec2 coastGradientAt(vec2 uv) {
      float distanceLeft = sampleCoastDistance(
        uv - vec2(mapTexelSize.x, 0.0)
      );
      float distanceRight = sampleCoastDistance(
        uv + vec2(mapTexelSize.x, 0.0)
      );
      float distanceDown = sampleCoastDistance(
        uv - vec2(0.0, mapTexelSize.y)
      );
      float distanceUp = sampleCoastDistance(
        uv + vec2(0.0, mapTexelSize.y)
      );

      return vec2(
        distanceRight - distanceLeft,
        distanceUp - distanceDown
      );
    }

    void computeFoamFront(
      float normalizedDistance,
      float offshoreCenter,
      float shorelineCenter,
      float baseWidth,
      float lifecycleOffset,
      vec2 advectedUv,
      vec2 coastNormal,
      vec2 coastTangent,
      vec2 currentDirection,
      float currentMagnitude,
      float currentImpact,
      float gapCoverage,
      vec2 seed,
      out float core,
      out float halo
    ) {
      /*
       * foamPushPullSpeed retains its existing uniform name for compatibility,
       * but now controls a one-way breaking-wave lifecycle. Its old angular
       * speed is converted to cycles per second so the overall timing remains
       * unchanged from the approved animation.
       */
      const float TWO_PI = 6.28318530718;

      float waveCycle =
        time * foamPushPullSpeed / TWO_PI +
        lifecycleOffset;

      float waveIndex = floor(waveCycle);
      float lifecycle = fract(waveCycle);

      /*
       * Every new incoming wave gets its own deterministic random seed.
       * That seed stays fixed for the whole shoreward trip, so the same
       * interruption pattern starts offshore and then progressively closes
       * as the wave approaches the coastline.
       */
      vec2 cycleSeed = vec2(
        hash12(seed + vec2(waveIndex * 1.37, 2.19)),
        hash12(seed + vec2(waveIndex * 2.11, -3.47))
      );

      vec2 cycleSeedB = vec2(
        hash12(seed + vec2(waveIndex * -1.73, 5.81)),
        hash12(seed + vec2(waveIndex * 0.93, -7.13))
      );

      /*
       * coastDistance is zero on the shoreline and increases offshore. Every
       * front therefore begins at offshoreCenter and moves monotonically down
       * to shorelineCenter. The reset happens while opacity is exactly zero.
       */
      float travelProgress = lifecycle;

      float center = mix(
        offshoreCenter,
        shorelineCenter,
        travelProgress
      );

      float motionFade = foamLifecycleOpacity(lifecycle);

      /*
       * A breaking front starts narrow in deep water and swells as it reaches
       * the coast. The final maximum thickness is reached just before the
       * complete shoreline fade.
       */
      float shoreApproach = smoothstep(
        0.10,
        0.94,
        travelProgress
      );

      float approachWidthScale = mix(
        0.52,
        1.95,
        shoreApproach
      );

      /*
       * Build a local coast-oriented frame. X follows the shoreline and Y
       * points offshore. Noise stretched in this frame creates long organic
       * stretches rather than concentric, uniformly segmented contours.
       */
      vec2 centeredUv = advectedUv - vec2(0.5);

      vec2 coastUv = vec2(
        dot(centeredUv, coastTangent),
        dot(centeredUv, coastNormal)
      );

      /*
       * Resolve the current in a coast-oriented frame. The tangential
       * component carries foam patches along the shoreline, while the normal
       * component slightly bends them shoreward or offshore. This is added on
       * top of the one-way shoreward lifecycle instead of replacing it.
       */
      float currentAlongCoast = dot(
        currentDirection,
        coastTangent
      );

      float currentAcrossCoast = dot(
        currentDirection,
        coastNormal
      );

      float currentStrength = smoothstep(
        0.025,
        0.78,
        currentMagnitude
      );

      vec2 currentCoastDrift = vec2(
        currentAlongCoast,
        currentAcrossCoast * 0.42
      ) *
      time *
      foamSpeed *
      mix(0.30, 1.55, currentStrength);

      vec2 currentCoastUv = coastUv + currentCoastDrift;

      float currentBend = fbm(
        currentCoastUv * vec2(4.4, 0.92) +
        cycleSeed * 1.23 + cycleSeedB * 0.77
      ) - 0.5;

      center +=
        currentBend * currentStrength * 0.034 +
        currentAcrossCoast * currentStrength * 0.010;

      float centerWarpA = fbm(
        currentCoastUv * vec2(3.8, 1.15) +
        cycleSeed * 6.0
      );

      float centerWarpB = texture2D(
        tShoreTexture,
        advectedUv * foamTiling.y * 0.84 +
        cycleSeedB * 0.19
      ).r;

      center +=
        (centerWarpA - 0.5) * 0.055 +
        (centerWarpB - 0.5) * 0.028;

      /*
       * Inner and outer sides are varied independently. This gives each front
       * visibly changing thickness and avoids a constant-width outline.
       */
      /*
       * Width changes use a very broad field plus a second medium-scale field.
       * The broad field creates long stretches that visibly swell or narrow;
       * the medium field keeps the edge organic without turning it granular.
       */
      float broadWidthNoise = fbm(
        currentCoastUv * vec2(1.55, 0.42) +
        cycleSeed * 4.7 +
        vec2(time * foamSpeed * 0.055, 0.0)
      );

      float widthNoiseA = fbm(
        currentCoastUv * vec2(4.8, 0.92) +
        cycleSeedB * 5.3
      );

      float widthNoiseB = fbm(
        currentCoastUv * vec2(7.4, 1.18) -
        cycleSeed * 3.1 +
        vec2(time * foamSpeed * 0.11, 0.0)
      );

      float fineWidthNoise = texture2D(
        tFoamTexture,
        advectedUv * foamTiling.y * 0.96 +
        cycleSeedB * 0.27
      ).r;

      float widthShapeA = smoothstep(
        0.12,
        0.90,
        broadWidthNoise * 0.58 +
        widthNoiseA * 0.30 +
        fineWidthNoise * 0.12
      );

      float widthShapeB = smoothstep(
        0.14,
        0.88,
        (1.0 - broadWidthNoise) * 0.40 +
        widthNoiseB * 0.46 +
        (1.0 - fineWidthNoise) * 0.14
      );

      float innerWidth =
        baseWidth *
        approachWidthScale *
        mix(
          0.26,
          2.18,
          widthShapeA
        );

      float outerWidth =
        baseWidth *
        approachWidthScale *
        mix(
          0.24,
          1.92,
          widthShapeB
        );

      /*
       * Two broad, aperiodic fields cut each line into irregular stretches.
       * The thresholds have feathered transitions, so the front dissolves
       * rather than ending as a hard dash.
       */
      /*
       * Interruption masks are adaptive rather than independently animated.
       * Each new incoming wave starts with many large random missing stretches;
       * the same seeded pattern closes only partially as the wave nears the coast.
       * Current advection still drags and bends the mask because all fields
       * are sampled in the already current-aware coast frame.
       */
      float closure = smoothstep(
        0.08,
        0.92,
        travelProgress
      );

      float offshoreGapBoost = mix(
        0.46,
        0.27,
        closure
      );

      float adaptiveGapCoverage = clamp(
        mix(
          min(gapCoverage + offshoreGapBoost, 0.88),
          gapCoverage,
          closure
        ),
        0.0,
        0.95
      );

      float largeGapField = fbm(
        currentCoastUv * vec2(2.05, 0.38) +
        cycleSeed * vec2(9.7, 4.6) +
        cycleSeedB * vec2(-3.4, 6.2)
      );

      float mediumGapField = fbm(
        currentCoastUv * vec2(5.60, 0.82) +
        cycleSeedB * vec2(7.9, -5.1) -
        cycleSeed * vec2(2.6, 1.9)
      );

      float edgeBreakupField = fbm(
        currentCoastUv * vec2(9.40, 1.24) +
        cycleSeed * vec2(5.6, -4.3) +
        cycleSeedB * vec2(1.8, 3.9)
      );

      float gapShape = mix(
        largeGapField * 0.66 + mediumGapField * 0.34,
        largeGapField * 0.56 + mediumGapField * 0.44,
        smoothstep(0.22, 0.92, closure)
      );
      /*
       * gapCoverage is the shoreline-side baseline continuity of each front.
       * Offshore, every new wave starts with extra interruption coverage; the
       * same seeded pattern then closes progressively as the wave approaches
       * the coast.
       */
      float coverageT = clamp(
        (adaptiveGapCoverage - 0.325) / 0.250,
        0.0,
        1.0
      );

      float coreGapStart = mix(0.430, 0.510, coverageT);
      float coreGapEnd = mix(0.560, 0.640, coverageT);
      float haloGapStart = coreGapStart - 0.055;
      float haloGapEnd = coreGapEnd - 0.028;

      float coreContinuity = smoothstep(
        coreGapStart,
        coreGapEnd,
        gapShape
      );

      float haloContinuity = smoothstep(
        haloGapStart,
        haloGapEnd,
        gapShape
      );

      /*
       * Keep the initial seed and close only part of the offshore gaps, so
       * the wave remains split into distinct segments at the shoreline.
       */
      float continuityLift = mix(
        0.0,
        0.08,
        closure
      );

      coreContinuity = clamp(
        coreContinuity + continuityLift,
        0.0,
        1.0
      );

      haloContinuity = clamp(
        haloContinuity + continuityLift * 0.86,
        0.0,
        1.0
      );

      /*
       * A small secondary modulation makes the ends dissolve irregularly rather
       * than terminate at the same opacity across the full line width.
       */
      float irregularEdge = mix(
        0.64,
        1.0,
        smoothstep(0.28, 0.72, edgeBreakupField)
      );

      coreContinuity *= irregularEdge;
      haloContinuity *= mix(0.76, 1.0, irregularEdge);

      /*
       * Texture controls the fine ragged edge, never the front placement.
       */
      float textureA = texture2D(
        tFoamTexture,
        advectedUv * foamTiling.x +
        seed * 0.039
      ).r;

      float textureB = 1.0 - texture2D(
        tShoreTexture,
        advectedUv * foamTiling.y * 1.55 -
        seed * 0.053
      ).r;

      float textureDefinition = smoothstep(
        0.05,
        0.74,
        textureA * 0.76 +
        textureB * 0.24
      );

      float localDefinition = mix(
        0.58,
        1.15,
        textureDefinition
      );

      core = asymmetricBand(
        normalizedDistance,
        center,
        innerWidth,
        outerWidth
      );

      halo = asymmetricBand(
        normalizedDistance,
        center,
        innerWidth * 2.55,
        outerWidth * 2.75
      );

      core *=
        coreContinuity *
        localDefinition *
        motionFade;

      halo *=
        haloContinuity *
        motionFade;

      /*
       * Current impact strengthens visible foam without reconnecting gaps.
       */
      float impactGain = mix(
        0.92,
        1.18,
        currentImpact
      );

      core *= impactGain;
      halo *= mix(0.96, 1.08, currentImpact);
    }

    void main() {
      #include <logdepthbuf_fragment>

      float flowMapOffset0 = config.x;
      float flowMapOffset1 = config.y;
      float halfCycle = config.z;
      float scale = config.w;

      vec3 toEye = normalize(vToEye);
      vec2 flow;
      vec2 localFlowDirection;
      float localFlowMagnitude;

      #ifdef USE_FLOWMAP
        vec4 encodedFlow = texture2D(tFlowMap, vUv);
        localFlowDirection = decodeFlowDirection(encodedFlow);
        localFlowMagnitude = clamp(encodedFlow.b, 0.0, 1.0);

        flow = localFlowDirection * mix(
          0.88,
          1.85,
          smoothstep(0.005, 0.62, localFlowMagnitude)
        );
      #else
        localFlowDirection = normalize(flowDirection);
        localFlowMagnitude = 1.0;
        flow = flowDirection;
      #endif

      /* Match the existing Selodia current-map orientation. */
      flow.x *= -1.0;
      localFlowDirection.x *= -1.0;

      vec2 crossFlow = vec2(-flow.y, flow.x);

      vec4 normalColor0 = texture2D(
        tNormalMap0,
        vUv * scale +
        flow * flowMapOffset0 +
        crossFlow * flowMapOffset0 * 0.10
      );

      vec4 normalColor1 = texture2D(
        tNormalMap1,
        vUv * (scale * 1.17) +
        flow * flowMapOffset1 -
        crossFlow * flowMapOffset1 * 0.08
      );

      float flowLerp = abs(halfCycle - flowMapOffset0) / halfCycle;
      vec4 normalColor = mix(normalColor0, normalColor1, flowLerp);

      vec3 normal = normalize(
        vec3(
          (normalColor.r * 2.0 - 1.0) * normalStrength,
          max(normalColor.b, 0.20),
          (normalColor.g * 2.0 - 1.0) * normalStrength
        )
      );

      float theta = max(dot(toEye, normal), 0.0);
      float reflectance =
        reflectivity +
        (1.0 - reflectivity) * pow(1.0 - theta, 5.0);

      vec3 coord = vCoord.xyz / max(vCoord.w, 0.00001);
      vec2 projectedUv = coord.xy + coord.z * normal.xz * 0.012;

      vec3 reflection = texture2D(
        tReflectionMap,
        vec2(1.0 - projectedUv.x, projectedUv.y)
      ).rgb;

      float refractionSpread = mix(0.82, 1.30, 1.0 - theta);
      vec3 refraction = sampleRefractedSeabed(
        projectedUv,
        normal.xz,
        refractionBlurStrength * refractionSpread
      );

      float reflectionEnergy = dot(
        reflection,
        vec3(0.2126, 0.7152, 0.0722)
      );

      float refractionEnergy = dot(
        refraction,
        vec3(0.2126, 0.7152, 0.0722)
      );

      float usableReflection = smoothstep(0.008, 0.16, reflectionEnergy);
      float usableRefraction = smoothstep(0.002, 0.08, refractionEnergy);

      vec3 baseWater = color * vec3(0.62, 0.76, 0.82);
      vec3 refractedWater = mix(
        baseWater,
        refraction,
        refractionStrength * usableRefraction
      );

      vec3 reflectedWater = mix(
        refractedWater,
        reflection,
        reflectionStrength * usableReflection
      );

      vec3 surface = mix(
        refractedWater,
        reflectedWater,
        reflectance
      );

      vec3 atlasLight = normalize(vec3(-0.35, 0.82, 0.45));
      float sparkle = pow(max(dot(normal, atlasLight), 0.0), 30.0);
      surface += vec3(0.48, 0.72, 0.76) * sparkle * 0.22;

      float land = texture2D(
        tLandMask,
        clamp(vUv, vec2(0.0), vec2(1.0))
      ).r;

      float waterMask = 1.0 - smoothstep(0.25, 0.75, land);
      float coastDistance = sampleCoastDistance(vUv);

      vec2 coastGradient = coastGradientAt(vUv);
      vec2 coastNormal = length(coastGradient) > 0.00001
        ? normalize(coastGradient)
        : vec2(0.0, 1.0);

      vec2 coastTangent = vec2(-coastNormal.y, coastNormal.x);

      float currentImpact = max(
        dot(localFlowDirection, -coastNormal),
        0.0
      );

      float normalizedDistance = clamp(
        coastDistance / max(foamRanges.y, 0.0001),
        0.0,
        1.0
      );

      float shoreLimit = 1.0 - smoothstep(
        foamRanges.y * 0.92,
        foamRanges.y * 1.08,
        coastDistance
      );

      /*
       * Texture detail drifts at the same low constant speed as Water2.
       * The three foam fronts use an independent one-way lifecycle: each one
       * is born offshore, travels toward the coast and disappears there.
       */
      float travel = time * foamSpeed;

      float currentAdvectionStrength = mix(
        0.32,
        1.0,
        smoothstep(0.02, 0.72, localFlowMagnitude)
      );

      vec2 advectedUv =
        vUv -
        localFlowDirection *
          travel *
          0.74 *
          currentAdvectionStrength +
        coastTangent *
          travel *
          0.14 *
          currentAdvectionStrength;

      /*
       * Shared soft warping stops the front centres from simply tracing the
       * raw coast-distance map.
       */
      float distanceWarpA = fbm(
        advectedUv * vec2(3.7, 2.65) +
        vec2(5.7, 9.3)
      );

      float distanceWarpB = texture2D(
        tFoamTexture,
        advectedUv * foamTiling.y * 0.70
      ).r;

      float warpedDistance = clamp(
        normalizedDistance +
        (distanceWarpA - 0.5) * 0.072 +
        (distanceWarpB - 0.5) * 0.026,
        0.0,
        1.0
      );

      float core0;
      float halo0;
      float core1;
      float halo1;
      float core2;
      float halo2;

      computeFoamFront(
        warpedDistance,
        0.94,
        0.045,
        foamLineWidths.x,
        0.000,
        advectedUv,
        coastNormal,
        coastTangent,
        localFlowDirection,
        localFlowMagnitude,
        currentImpact,
        0.410,
        vec2(11.7, 4.3),
        core0,
        halo0
      );

      computeFoamFront(
        warpedDistance,
        0.94,
        0.045,
        foamLineWidths.y,
        0.333,
        advectedUv,
        coastNormal,
        coastTangent,
        localFlowDirection,
        localFlowMagnitude,
        currentImpact,
        0.555,
        vec2(-6.2, 18.1),
        core1,
        halo1
      );

      computeFoamFront(
        warpedDistance,
        0.94,
        0.045,
        foamLineWidths.z,
        0.666,
        advectedUv,
        coastNormal,
        coastTangent,
        localFlowDirection,
        localFlowMagnitude,
        currentImpact,
        0.665,
        vec2(23.4, -9.6),
        core2,
        halo2
      );

      float foamCore = max(core0, max(core1, core2));
      float foamHalo = max(halo0, max(halo1, halo2));

      float impactGain = mix(
        0.88,
        1.0 + foamImpactStrength,
        currentImpact * localFlowMagnitude
      );

      foamCore *= impactGain * waterMask * shoreLimit;
      foamHalo *= waterMask * shoreLimit;

      /*
       * Do not leave a permanent shoreline residue: when a front reaches the
       * coast its lifecycle opacity reaches exactly zero before it respawns.
       */
      foamHalo = clamp(
        foamHalo * 0.74,
        0.0,
        1.0
      );

      foamCore = clamp(foamCore, 0.0, 1.0);

      vec3 haloColor = mix(foamColor, vec3(1.0), 0.03);
      vec3 coreColor = mix(foamColor, vec3(1.0), 0.18);

      vec3 haloScreen = screenBlend(surface, haloColor);
      surface = mix(
        surface,
        haloScreen,
        foamHalo * foamIntensity * 0.32
      );

      vec3 coreScreen = screenBlend(surface, coreColor);
      surface = mix(
        surface,
        coreScreen,
        foamCore * foamIntensity * 0.70
      );

      surface +=
        coreColor *
        smoothstep(0.76, 0.98, foamCore) *
        foamIntensity *
        0.020;

      gl_FragColor = vec4(surface, 1.0);

      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }
  `,
};
