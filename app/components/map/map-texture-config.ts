import {
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from "three";

type AtlasTextureRole =
  | "color"
  | "scalar"
  | "terrain-normal"
  | "repeat-normal"
  | "repeat-detail";

function configureOnce(
  texture: Texture,
  role: AtlasTextureRole,
  configure: () => void,
): Texture {
  const key = `atlas-texture-role:${role}`;
  if (texture.userData[key]) return texture;

  configure();
  texture.userData[key] = true;
  texture.needsUpdate = true;
  return texture;
}

export function configureColorTexture(texture: Texture): Texture {
  return configureOnce(texture, "color", () => {
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = false;
  });
}

export function configureScalarTexture(texture: Texture): Texture {
  return configureOnce(texture, "scalar", () => {
    texture.colorSpace = NoColorSpace;
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = false;
  });
}

export function configureTerrainNormalTexture(texture: Texture): Texture {
  return configureOnce(texture, "terrain-normal", () => {
    texture.colorSpace = NoColorSpace;
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = false;
  });
}

export function configureRepeatNormalTexture(texture: Texture): Texture {
  return configureOnce(texture, "repeat-normal", () => {
    texture.colorSpace = NoColorSpace;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = true;
  });
}

export function configureRepeatDetailTexture(texture: Texture): Texture {
  return configureOnce(texture, "repeat-detail", () => {
    texture.colorSpace = NoColorSpace;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = true;
  });
}
