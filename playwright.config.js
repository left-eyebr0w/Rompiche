import { defineConfig, devices } from '@playwright/test'

/* Tests garde-fous v0 — filet comportemental (cadrage §4).
   Observabilité via window.__rompiche (?debug=true) ; aucune modification du moteur.
   L'AudioContext démarre suspendu sans geste utilisateur → on autorise l'autoplay
   au lancement de Chromium pour que les couches audio produisent du signal. */
export default defineConfig({
  testDir: 'tests',
  fullyParallel: false,          // un seul contexte audio à la fois, évite la contention
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    launchOptions: {
      args: ['--autoplay-policy=no-user-gesture-required'],
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npx vite --port 5173',
    url: 'http://localhost:5173/src/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
