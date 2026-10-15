import { describe, expect, it } from 'vitest';
import { isWebGLForced } from '../../src/three/renderer';

describe('isWebGLForced', () => {
  it('forces the WebGL 2 backend with ?gl=webgl2', () => {
    expect(isWebGLForced('?gl=webgl2')).toBe(true);
  });

  it('keeps automatic backend selection otherwise', () => {
    expect(isWebGLForced('')).toBe(false);
    expect(isWebGLForced('?gl=webgpu')).toBe(false);
    expect(isWebGLForced('?other=webgl2')).toBe(false);
  });
});
