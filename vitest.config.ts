import {defineConfig} from 'vitest/config';

// One test run for every workspace package except the Vega app (it uses jest + RN).
export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/server/src/**/*.test.ts', 'apps/phone/src/**/*.test.ts', 'apps/tv/src/**/*.test.ts'],
  },
});
