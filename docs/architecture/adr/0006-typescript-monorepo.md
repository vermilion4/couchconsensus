# ADR-0006: TypeScript monorepo with shared protocol and referee packages

- Status: Accepted
- Date: 2026-10-10

## Context

Three clients of one protocol (TV, phone, server) built by one person in 13 days. Protocol drift between them is the most likely class of bug. The hackathon requires a single GitHub repo with all source and run instructions.

## Decision

- One repository, **pnpm workspaces**, **TypeScript strict** everywhere.
- Packages: `@couch/protocol` (Zod schemas + inferred types for REST, WS, projections), `@couch/referee` (pure engine), `@couch/catalog` (catalog types + demo deck).
- Apps: `apps/tv` (React Native for Vega, SDK 0.24 / RN 0.83), `apps/phone`, `apps/server`. Infra in `infra/`.
- Shared packages are plain ES2022 TypeScript with no Node or DOM APIs, so they run in Hermes on Vega, in browsers and in Node.
- `.npmrc`: `node-linker=hoisted`. Vega's Metro does not resolve pnpm's default isolated (symlinked) layout (spike S4).
- Metro in `apps/tv`: `watchFolders: [workspaceRoot]` and `resolver.nodeModulesPaths` for the app and the workspace root.
- Babel in `apps/tv`: add `@babel/plugin-transform-export-namespace-from` (Zod 4 uses `export * as`).
- Verified on the VVD on 2026-10-10: `@couch/protocol` with Zod runs on Hermes.
- One esbuild version for the whole workspace (`overrides` in `pnpm-workspace.yaml`): with the hoisted layout, tsup's older esbuild picked up a mismatched native binary.

## Alternatives considered

- **Separate repos.** Triples setup and loses compile-time protocol checks.
- **Nx / Turborepo.** Useful later; pnpm alone is enough for 3 apps.
- **Kotlin or Go server.** Faster in some ways but breaks "one language" and type sharing.

## Consequences

- A protocol change fails the build in every consumer at once.
- The Vega 0.24 template declares `"engines": {"node": ">=20"}` (the install guide still says 18). Development ran on Node 22 LTS; `.nvmrc` pins **22** until the server is confirmed on 24.
