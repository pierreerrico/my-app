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
    foamVisibility: {
      value: 0.0,
    },
    edgeBlendColor: {
      value: new Color("#123f55"),
    },
    edgeFadeWidth: {
      value: 0.14,
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
    uniform float foamVisibility;
    uniform vec3 edgeBlendColor;
    uniform float edgeFadeWidth;

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
      const float TWO_PI = 6.28318530718;
      float waveCycle =
        time * foamPushPullSpeed / TWO_PI +
        lifecycleOffset;
      float lifecycle = fract(waveCycle);
      float waveIndex = floor(waveCycle);
      float motionFade = foamLifecycleOpacity(lifecycle);
      float shoreApproach = smoothstep(0.08, 0.92, lifecycle);

      /*
       * A new deterministic layout is selected while the front is fully
       * transparent at the loop boundary. During the visible part of a cycle
       * the layout remains coherent and is carried by the local flow map.
       */
      vec2 cycleSeed = vec2(
        hash12(seed + vec2(waveIndex * 1.37, 2.19)),
        hash12(seed + vec2(waveIndex * 2.11, -3.47))
      );
      float currentStrength = smoothstep(
        0.025,
        0.78,
        currentMagnitude
      );
      float currentAlongCoast = dot(
        currentDirection,
        coastTangent
      );
      float currentAcrossCoast = dot(
        currentDirection,
        coastNormal
      );
      vec2 coastwiseFlow =
        coastTangent * currentAlongCoast +
        coastNormal * currentAcrossCoast * 0.24;
      vec2 currentDrift =
        coastwiseFlow *
        lifecycle *
        mix(0.012, 0.068, currentStrength);
      vec2 patternUv =
        vUv -
        currentDrift +
        (cycleSeed - 0.5) * 0.31;

      float staggerBroad = fbm(
        patternUv * vec2(7.5, 5.4) + seed * 0.73
      );
      float staggerFine = fbm(
        patternUv * vec2(18.0, 12.5) - seed * 0.41
      );
      float stagger =
        (staggerBroad - 0.5) * 0.105 +
        (staggerFine - 0.5) * 0.026;

      float center =
        mix(offshoreCenter, shorelineCenter, lifecycle) +
        stagger;

      /*
       * A pair of differently oriented static fields produces short,
       * irregular stretches. Multiplication guarantees real gaps instead of
       * merely dimming a continuous contour.
       */
      float patchA = fbm(
        patternUv * vec2(15.0, 10.0) + seed * 1.91
      );
      float patchB = fbm(
        vec2(patternUv.y, patternUv.x) * vec2(23.0, 13.0) -
        seed * 1.27
      );
      float coarsePieces = smoothstep(0.47, 0.59, patchA);
      float hardBreaks = smoothstep(0.39, 0.57, patchB);
      float continuity = coarsePieces * hardBreaks;

      float widthNoise = fbm(
        patternUv * vec2(12.0, 8.0) + seed * 2.43
      );
      float widthScale =
        mix(0.66, 1.08, shoreApproach) *
        mix(0.78, 1.16, widthNoise);
      float innerWidth = baseWidth * widthScale * 0.82;
      float outerWidth = baseWidth * widthScale;

      core = asymmetricBand(
        normalizedDistance,
        center,
        innerWidth,
        outerWidth
      );
      halo = asymmetricBand(
        normalizedDistance,
        center,
        innerWidth * 2.05,
        outerWidth * 2.25
      );

      /*
       * Only the surface grain is advected. Geometry, gaps and stagger stay
       * fixed in map space, while the foam itself still reads as moving water.
       */
      float grain = texture2D(
        tFoamTexture,
        advectedUv * foamTiling.x + seed * 0.039
      ).r;
      float grainDefinition = mix(
        0.68,
        1.08,
        smoothstep(0.18, 0.78, grain)
      );
      float impactGain = mix(0.92, 1.16, currentImpact);

      core *=
        continuity *
        grainDefinition *
        motionFade *
        impactGain;
      halo *=
        smoothstep(0.0, 0.72, continuity) *
        motionFade *
        mix(0.94, 1.06, currentImpact);
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
      vec3 openWaterSurface = surface;

      float land = texture2D(
        tLandMask,
        clamp(vUv, vec2(0.0), vec2(1.0))
      ).r;

      float waterMask = 1.0 - smoothstep(0.25, 0.75, land);
      bool outsideMap =
        vUv.x < 0.0 ||
        vUv.x > 1.0 ||
        vUv.y < 0.0 ||
        vUv.y > 1.0;
      float mapEdgeInset = min(
        min(vUv.x, 1.0 - vUv.x),
        min(vUv.y, 1.0 - vUv.y)
      );
      float coastalEffectsWeight = outsideMap
        ? 0.0
        : smoothstep(0.035, 0.060, mapEdgeInset);
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
       * A single segmented front remains inside the near-shore band, travels
       * toward the coast and disappears there before restarting.
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

      computeFoamFront(
        warpedDistance,
        0.34,
        0.050,
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

      float foamCore = core0;
      float foamHalo = halo0;

      float impactGain = mix(
        0.88,
        1.0 + foamImpactStrength,
        currentImpact * localFlowMagnitude
      );

      foamCore *=
        impactGain *
        waterMask *
        shoreLimit *
        foamVisibility;
      foamHalo *=
        waterMask *
        shoreLimit *
        foamVisibility;

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

      float offshoreTint = smoothstep(
        0.16,
        0.34,
        normalizedDistance
      );
      vec3 offshoreFoamColor = mix(
        color,
        foamColor,
        0.38
      );
      vec3 haloColor = mix(
        mix(foamColor, vec3(1.0), 0.03),
        offshoreFoamColor,
        offshoreTint * 0.82
      );
      vec3 coreColor = mix(
        mix(foamColor, vec3(1.0), 0.18),
        offshoreFoamColor,
        offshoreTint * 0.72
      );

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

      /*
       * Il mare locale conserva tutti i dettagli al centro ma converge verso
       * lo stesso colore dell'oceano remoto prima di raggiungere il bordo.
       * Evitiamo la trasparenza: Water2 resta opaco e non introduce costosi
       * problemi di ordinamento.
       */
      vec2 edgeCoordinates =
        abs(vUv - 0.5) * 2.0;
      float edgeDistance = max(
        edgeCoordinates.x,
        edgeCoordinates.y
      );
      float edgeBlend = smoothstep(
        1.0 - max(edgeFadeWidth, 0.001),
        1.0,
        edgeDistance
      );
      edgeBlend =
        edgeBlend *
        edgeBlend *
        step(0.001, edgeFadeWidth);

      /*
       * Fuori dal rettangolo cartografico il mare continua soltanto dai
       * tratti di bordo classificati come oceano dalla land mask. Le texture
       * scalari sono clampate al texel di bordo, quindi la classificazione
       * resta stabile lungo tutta l'estensione.
       */
      if (outsideMap && land >= 0.5) {
        discard;
      }
      surface = mix(
        openWaterSurface,
        surface,
        coastalEffectsWeight
      );

      surface = mix(
        surface,
        edgeBlendColor,
        edgeBlend
      );

      gl_FragColor = vec4(surface, 1.0);

      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }
  `,
};
