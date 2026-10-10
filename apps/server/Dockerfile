# Built from the repo root: docker build -f apps/server/Dockerfile .
FROM node:22-slim AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages ./packages
COPY apps/server ./apps/server
COPY apps/phone ./apps/phone
# The TV app and infra are not needed in the image.
RUN pnpm install --frozen-lockfile --filter @couch/server... --filter @couch/phone...
RUN pnpm --filter @couch/phone build && pnpm --filter @couch/server build

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
# The server is a single bundled file (tsup bundles every dependency); no node_modules needed.
COPY --from=build /repo/apps/server/dist ./apps/server/dist
COPY --from=build /repo/apps/phone/dist ./apps/phone/dist
COPY --from=build /repo/packages/catalog/art ./art
ENV PHONE_DIST_DIR=/app/apps/phone/dist
ENV ART_DIR=/app/art
EXPOSE 8080
USER node
CMD ["node", "--enable-source-maps", "apps/server/dist/index.js"]
