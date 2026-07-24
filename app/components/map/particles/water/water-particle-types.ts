import type {
  Texture,
} from "three";

export type WaterParticleSimulationOptions = {
  landMask: Texture;

  /**
   * Current map RGBA:
   *
   * R = direzione X codificata da -1 a +1
   * G = direzione Y codificata da -1 a +1
   * B = intensità locale da 0 a 1
   * A = riservato
   */
  currentMap: Texture;

  textureWidth?: number;
  textureHeight?: number;

  /**
   * Velocità massima globale della corrente.
   *
   * Il canale B della current map modula
   * questo valore localmente.
   */
  currentStrength?: number;

  /**
   * Rapidità con cui una particella si
   * riallinea al vettore della current map.
   */
  currentResponse?: number;

  turbulenceStrength?: number;

  coastLookAhead?: number;

  coastSlideStrength?: number;

  coastReflectionStrength?: number;

  coastAvoidanceStrength?: number;

  velocityDamping?: number;

  particleLifetime?: number;

  /**
   * Sotto questa intensità una particella
   * quasi ferma viene considerata fuori
   * dalla corrente e viene rigenerata.
   */
  respawnCurrentThreshold?: number;
};

export type WaterParticleFrame = {
  positionTexture: Texture;
  velocityTexture: Texture;
};

export type WaterParticleSimulationResult = {
  getFrame: () =>
    WaterParticleFrame | null;

  textureWidth: number;
  textureHeight: number;

  particleCount: number;
};

export type WaterParticleDebugProps = {
  simulation:
    WaterParticleSimulationResult;

  geometry: {
    planeWidth: number;
    planeHeight: number;
  };

  enabled?: boolean;

  pointSize?: number;
  opacity?: number;

  surfaceOffset?: number;
};