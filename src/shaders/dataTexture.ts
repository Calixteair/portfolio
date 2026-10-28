import { DataTexture, FloatType, NearestFilter, RGBAFormat, RedFormat } from 'three/webgpu';

/**
 * Float data read texel by texel with textureLoad (emitters, colliders): unfiltered, so
 * no float-filtering support is needed, on WebGPU or WebGL 2.
 */
export function floatTexture(
  data: Float32Array,
  width: number,
  height: number,
  channels: 'r' | 'rgba' = 'rgba',
): DataTexture {
  const format = channels === 'r' ? RedFormat : RGBAFormat;
  const tex = new DataTexture(data, width, height, format, FloatType);
  tex.magFilter = NearestFilter;
  tex.minFilter = NearestFilter;
  tex.needsUpdate = true;
  return tex;
}
