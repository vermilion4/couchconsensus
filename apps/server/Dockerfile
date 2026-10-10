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
RUN corepack enable
COPY --from=build /repo/package.json /repo/pnpm-lock.yaml /repo/pnpm-workspace.yaml /repo/.npmrc ./
COPY --from=build /repo/apps/server/package.json ./apps/server/package.json
COPY --from=build /repo/packages ./packages
RUN pnpm install --frozen-lockfile --prod --filter @couch/server...
COPY --from=build /repo/apps/server/dist ./apps/server/dist
COPY --from=build /repo/apps/phone/dist ./apps/phone/dist
ENV PHONE_DIST_DIR=/app/apps/phone/dist
EXPOSE 8080
USER node
CMD ["node", "apps/server/dist/index.js"]
