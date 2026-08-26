import { defineConfig, devices } from '@playwright/test';

// PW_BASE_URL permite apuntar el spec a un deploy real (ej. Vercel) sin
// levantar un dev server local -- util cuando el backend local no tiene
// conectividad pero produccion si (ver sesion de verificacion del fix de
// Auditoria). Sin la env var, el comportamiento por defecto sigue siendo
// levantar `npm run dev` local.
const baseURL = process.env.PW_BASE_URL || 'http://localhost:5180';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.PW_BASE_URL ? undefined : {
    command: 'npm run dev -- --port 5180 --strictPort',
    url: 'http://localhost:5180',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
