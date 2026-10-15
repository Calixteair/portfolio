import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// Static output only (no SSR): the site is served by nginx-unprivileged.
export default defineConfig({
  site: 'https://portfolio.calixteair.fr',
  output: 'static',
  integrations: [react()],
  vite: {
    // R3F 9 imports WebGLRenderer from 'three' (only used when no renderer is
    // given, never here). Resolving 'three' to the WebGPU build drops the unused
    // WebGL renderer from the bundle (-87 KB gzip) and keeps one copy of Three.
    resolve: {
      alias: [{ find: /^three$/, replacement: 'three/webgpu' }],
    },
  },
  security: {
    // Astro hashes its own inline scripts/styles into a <meta> CSP, so no
    // 'unsafe-inline' is needed. Directives a <meta> CSP cannot carry
    // (frame-ancestors) are sent as a header by nginx.
    csp: {
      algorithm: 'SHA-256',
      scriptDirective: {
        // 'wasm-unsafe-eval': self-hosted Meshopt/Basis WASM decoders (M8).
        resources: ["'self'", "'wasm-unsafe-eval'"],
      },
      directives: [
        "default-src 'self'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "connect-src 'self'",
        // blob: workers: KTX2 transcoder (M8).
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
      ],
    },
  },
});
