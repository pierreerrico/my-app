export const waterParticlePositionShader = /* glsl */ `
  uniform sampler2D uLandMask;
  uniform sampler2D uCurrentMap;

  uniform float uDeltaTime;
  uniform float uParticleLifetime;
  uniform float uRespawnCurrentThreshold;

  float hash(float value) {
    return fract(
      sin(
        value *
        91.3458
      ) *
      47453.5453
    );
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

  float sampleCurrentStrength(
    vec2 uv
  ) {
    return texture2D(
      uCurrentMap,
      clamp(
        uv,
        vec2(0.0),
        vec2(1.0)
      )
    ).b;
  }

  vec2 randomPosition(
    float seed,
    float offset
  ) {
    return vec2(
      hash(
        seed +
        offset *
        17.37
      ),

      hash(
        seed +
        offset *
        41.93 +
        7.11
      )
    );
  }

  vec2 findCurrentPosition(
    float seed
  ) {
    vec2 bestPosition =
      randomPosition(
        seed,
        1.0
      );

    float bestScore =
      -1.0;

    /*
     * Prova diversi punti e sceglie quello
     * con la corrente più intensa che non
     * appartiene alla terra.
     *
     * Il ciclo ha dimensione fissa perché
     * viene eseguito nello shader.
     */
    for (
      int index = 0;
      index < 12;
      index++
    ) {
      float attempt =
        float(index) +
        1.0;

      vec2 candidate =
        randomPosition(
          seed,
          attempt
        );

      float land =
        sampleLand(
          candidate
        );

      float currentStrength =
        sampleCurrentStrength(
          candidate
        );

      float oceanMask =
        1.0 -
        step(
          0.5,
          land
        );

      float score =
        currentStrength *
        oceanMask;

      /*
       * Piccolissima variazione casuale:
       * evita che tutte le particelle scelgano
       * sempre gli stessi massimi locali.
       */
      score +=
        hash(
          seed +
          attempt *
          9.17
        ) *
        0.035 *
        oceanMask;

      if (
        score >
        bestScore
      ) {
        bestScore =
          score;

        bestPosition =
          candidate;
      }
    }

    return bestPosition;
  }

  void main() {
    vec2 uv =
      gl_FragCoord.xy /
      resolution.xy;

    vec4 positionState =
      texture2D(
        textureWaterParticlePosition,
        uv
      );

    vec4 velocityState =
      texture2D(
        textureWaterParticleVelocity,
        uv
      );

    vec2 position =
      positionState.xy;

    float age =
      positionState.z;

    float seed =
      positionState.w;

    vec2 velocity =
      velocityState.xy;

    float safeDelta =
      min(
        uDeltaTime,
        0.05
      );

    vec2 nextPosition =
      position +
      velocity *
      safeDelta;

    age +=
      safeDelta;

    bool outside =
      nextPosition.x < 0.0 ||
      nextPosition.x > 1.0 ||
      nextPosition.y < 0.0 ||
      nextPosition.y > 1.0;

    bool enteredLand =
      sampleLand(
        nextPosition
      ) > 0.5;

    bool expired =
      age >=
      uParticleLifetime;

    float localCurrentStrength =
      sampleCurrentStrength(
        nextPosition
      );

    bool almostStopped =
      length(
        velocity
      ) < 0.0008;

    /*
     * Evita particelle ferme per molto tempo
     * nelle zone dove la current map non
     * definisce alcuna corrente.
     */
    bool stranded =
      age > 1.0 &&
      almostStopped &&
      localCurrentStrength <
      uRespawnCurrentThreshold;

    if (
      outside ||
      expired ||
      stranded
    ) {
      seed =
        hash(
          seed +
          age +
          position.x *
          17.0 +
          position.y *
          31.0
        );

      nextPosition =
        findCurrentPosition(
          seed
        );

      age =
        0.0;
    } else if (
      enteredLand
    ) {
      /*
       * La velocity pass prova già a deviare
       * la particella. Questo controllo
       * impedisce il tunnelling.
       */
      nextPosition =
        position;

      age +=
        0.08;
    }

    /*
     * Ultima sicurezza nel caso in cui
     * il punto selezionato cada comunque
     * sulla terra.
     */
    if (
      sampleLand(
        nextPosition
      ) > 0.5
    ) {
      seed =
        hash(
          seed +
          83.17
        );

      nextPosition =
        findCurrentPosition(
          seed
        );

      age =
        0.0;
    }

    gl_FragColor =
      vec4(
        clamp(
          nextPosition,
          vec2(0.0),
          vec2(1.0)
        ),
        age,
        seed
      );
  }
`;