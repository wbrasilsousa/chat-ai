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
COPY package.json .env ./
RUN chown -R appuser:appgroup /app
USER appuser
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "server/server.js"]
