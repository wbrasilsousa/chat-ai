FROM docker.io/node:20-alpine AS base
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

FROM base AS deps
COPY package.json ./
RUN npm install --production

FROM base AS runner
COPY --from=deps /app/node_modules ./node_modules
COPY server/ ./server/
COPY client/ ./client/
COPY package.json ./
RUN chown -R appuser:appgroup /app
USER appuser
EXPOSE 3000
ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV
CMD ["node", "server/server.js"]
