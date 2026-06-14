import { defineConfig } from 'vitest/config'

/* Tests unitaires headless du moteur (Grand Refactor J1+). Scopés à src/ pour ne
   PAS capter les specs Playwright E2E de tests/ (qui importent @playwright/test). */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
