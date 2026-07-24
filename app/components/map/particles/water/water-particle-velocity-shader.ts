export const waterParticleVelocityShader = /* glsl */ `
  uniform sampler2D uLandMask;
  uniform sampler2D uCurrentMap;

  uniform float uTime;
  uniform float uDeltaTime;

  uniform float uCurrentStrength;
  uniform float uCurrentResponse;
  uniform float uTurbulenceStrength;

  uniform float uCoastLookAhead;
  uniform float uCoastSlideStrength;
  uniform float uCoastReflectionStrength;
  uniform float uCoastAvoidanceStrength;

  uniform float uVelocityDamping;

  float hash(vec2 point) {
    return fract(
      sin(
        dot(
          point,
          vec2(127.1, 311.7)
        )
      ) *
      43758.5453123
    );
  }

  float noise(vec2 point) {
    vec2 cell =
      floor(point);

    vec2 local =
      fract(point);

    local =
      local *
      local *
      (3.0 - 2.0 * local);

    float a =
      hash(cell);

    float b =
      hash(
        cell +
        vec2(1.0, 0.0)
      );

    float c =
      hash(
        cell +
        vec2(0.0, 1.0)
      );

    float d =
      hash(
        cell +
        vec2(1.0, 1.0)
      );

    return mix(
      mix(a, b, local.x),
      mix(c, d, local.x),
      local.y
    );
  }

  float fbm(vec2 point) {
    float result =
      0.0;

    float amplitude =
      0.5;

    result +=
      noise(point) *
      amplitude;

    point =
      point * 2.03 +
      vec2(13.7, 7.1);

    amplitude *=
      0.5;

    result +=
      noise(point) *
      amplitude;

    point =
      point * 2.01 +
      vec2(5.4, 19.3);

    amplitude *=
      0.5;

    result +=
      noise(point) *
      amplitude;

    point =
      point * 2.04 +
      vec2(17.8, 3.2);

    amplitude *=
      0.5;

    result +=
      noise(point) *
      amplitude;

    return result;
  }

  float sampleLand(vec2 uv) {
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

  vec2 decodeCurrentDirection(
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

    return direction /
      directionLength;
  }

  vec2 calculateCoastGradient(
    vec2 position,
    vec2 texel
  ) {
    float left =
      sampleLand(
        position -
        vec2(texel.x, 0.0)
      );

    float right =
      sampleLand(
        position +
        vec2(texel.x, 0.0)
      );

    float down =
      sampleLand(
        position -
        vec2(0.0, texel.y)
      );

    float up =
      sampleLand(
        position +
        vec2(0.0, texel.y)
      );

    return vec2(
      right - left,
      up - down
    );
  }

  vec2 calculateCurlField(
    vec2 position,
    float seed,
    float time
  ) {
    float epsilon =
      0.0065;

    vec2 basePoint =
      position * 6.5 +
      vec2(
        time * 0.018,
        -time * 0.011
      ) +
      seed *
      vec2(4.1, 7.3);

    float noiseLeft =
      fbm(
        basePoint -
        vec2(epsilon, 0.0)
      );

    float noiseRight =
      fbm(
        basePoint +
        vec2(epsilon, 0.0)
      );

    float noiseDown =
      fbm(
        basePoint -
        vec2(0.0, epsilon)
      );

    float noiseUp =
      fbm(
        basePoint +
        vec2(0.0, epsilon)
      );

    vec2 gradient =
      vec2(
        noiseRight -
        noiseLeft,

        noiseUp -
        noiseDown
      ) /
      (2.0 * epsilon);

    return vec2(
      gradient.y,
      -gradient.x
    );
  }

  void main() {
    vec2 lookupUv =
      gl_FragCoord.xy /
      resolution.xy;

    vec4 positionState =
      texture2D(
        textureWaterParticlePosition,
        lookupUv
      );

    vec4 previousVelocityState =
      texture2D(
        textureWaterParticleVelocity,
        lookupUv
      );

    vec2 position =
      positionState.xy;

    float seed =
      positionState.w;

    vec2 velocity =
      previousVelocityState.xy;

    float safeDelta =
      min(
        uDeltaTime,
        0.05
      );

    /*
     * R e G contengono la direzione.
     * B contiene l’intensità locale.
     */
    vec4 currentSample =
      sampleCurrent(
        position
      );

    vec2 currentDirection =
      decodeCurrentDirection(
        currentSample
      );

    currentDirection.y *= -1.0;
    
    float localCurrentStrength =
      currentSample.b;

    vec2 targetCurrent =
      currentDirection *
      localCurrentStrength *
      uCurrentStrength;

    /*
     * La particella tende progressivamente
     * verso la velocità indicata dalla mappa.
     */
    float response =
      1.0 -
      exp(
        -uCurrentResponse *
        safeDelta
      );

    velocity =
      mix(
        velocity,
        targetCurrent,
        response
      );

    vec2 curl =
      calculateCurlField(
        position,
        seed,
        uTime
      );

    /*
     * La turbolenza viene ridotta fuori
     * dalla corrente principale.
     */
    float turbulenceMask =
      mix(
        0.18,
        1.0,
        localCurrentStrength
      );

    velocity +=
      curl *
      uTurbulenceStrength *
      turbulenceMask *
      safeDelta;

    vec2 maskTexel =
      1.0 /
      vec2(
        textureSize(
          uLandMask,
          0
        )
      );

    vec2 candidatePosition =
      position +
      velocity *
      safeDelta *
      uCoastLookAhead;

    float candidateLand =
      sampleLand(
        candidatePosition
      );

    vec2 coastGradient =
      calculateCoastGradient(
        candidatePosition,
        maskTexel * 2.0
      );

    float gradientLength =
      length(
        coastGradient
      );

    vec2 coastNormal =
      gradientLength > 0.0001
        ? coastGradient /
          gradientLength
        : vec2(0.0);

    float nearbyLand =
      max(
        candidateLand,
        clamp(
          gradientLength * 1.8,
          0.0,
          1.0
        )
      );

    float incomingSpeed =
      max(
        dot(
          velocity,
          coastNormal
        ),
        0.0
      );

    float collisionEnergy =
      incomingSpeed *
      nearbyLand;

    if (
      nearbyLand > 0.02 &&
      gradientLength > 0.0001
    ) {
      float normalComponent =
        dot(
          velocity,
          coastNormal
        );

      vec2 tangentVelocity =
        velocity -
        coastNormal *
        normalComponent;

      vec2 reflectedVelocity =
        reflect(
          velocity,
          coastNormal
        );

      velocity =
        tangentVelocity *
        uCoastSlideStrength +
        reflectedVelocity *
        uCoastReflectionStrength;

      velocity -=
        coastNormal *
        uCoastAvoidanceStrength *
        nearbyLand *
        safeDelta;
    }

    if (
      candidateLand > 0.5 &&
      gradientLength > 0.0001
    ) {
      velocity -=
        coastNormal *
        max(
          dot(
            velocity,
            coastNormal
          ),
          0.0
        );

      velocity -=
        coastNormal *
        uCoastAvoidanceStrength *
        0.45;
    }

    velocity *=
      pow(
        uVelocityDamping,
        safeDelta * 60.0
      );

    float maximumSpeed =
      max(
        uCurrentStrength *
        2.8,
        0.002
      );

    float speed =
      length(
        velocity
      );

    if (
      speed >
      maximumSpeed
    ) {
      velocity =
        velocity /
        speed *
        maximumSpeed;
    }

    float coastContact =
      clamp(
        nearbyLand,
        0.0,
        1.0
      );

    gl_FragColor =
      vec4(
        velocity,

        clamp(
          collisionEnergy *
          9.0,
          0.0,
          1.0
        ),

        coastContact
      );
  }
`;