import {defineConfig} from 'tsup';

// Bundle everything (workspace packages and npm deps) into dist/index.js so the runtime
// image needs no node_modules. With node-linker=hoisted, a filtered prod install would
// otherwise pull in the TV app's and infra's dependencies too.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  noExternal: [/.*/],
  // optional native speedups for ws; it falls back to pure JS without them
  external: ['bufferutil', 'utf-8-validate'],
  // CommonJS deps call require() on Node built-ins; give the ESM bundle a real require
  banner: {js: "import {createRequire as __cr} from 'node:module'; const require = __cr(import.meta.url);"},
  sourcemap: true,
  clean: true,
});
