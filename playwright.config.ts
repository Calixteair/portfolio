import { defineConfig, devices, type Project } from '@playwright/test';

const PORT = 4322;

// The bundled headless Chromium only has SwiftShader, whose WebGPU drops its device:
// default specs force the WebGL 2 backend. Specs tagged @webgpu need a real GPU and run
// on a dev machine with E2E_WEBGPU=1: Chrome's new headless mode drives the GPU through
// Vulkan, so no window opens (nor steals the focus).
const webgpuProject: Project = {
  name: 'webgpu',
  grep: /@webgpu/,
  use: {
    ...devices['Desktop Chrome'],
    channel: 'chrome',
    headless: true,
    launchOptions: {
      args: [
        '--enable-unsafe-webgpu',
        '--ignore-gpu-blocklist',
        '--enable-features=Vulkan',
        '--use-angle=vulkan',
      ],
    },
  },
};

export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    // e2e runs against the production build, not the dev server.
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'webgl2', grepInvert: /@webgpu/, use: { ...devices['Desktop Chrome'] } },
    ...(process.env.E2E_WEBGPU ? [webgpuProject] : []),
  ],
  webServer: {
    // --ignore-lock: Astro 7 auto-backgrounds when it detects an AI agent, which
    // would make Playwright think the server exited. Keep it in the foreground.
    command: `npx astro preview --port ${PORT} --ignore-lock`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
});
