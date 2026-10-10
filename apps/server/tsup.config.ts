import {defineConfig} from 'tsup';

// Bundle workspace packages (they ship TypeScript source); keep npm deps external.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  noExternal: [/^@couch\//],
  sourcemap: true,
  clean: true,
});
