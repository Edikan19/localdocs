FROM node:24-bookworm-slim
WORKDIR /app

# Install dependencies first so Docker can cache this layer
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# The database lives in /data, which docker-compose mounts as a volume
ENV DATABASE_URL="file:/data/localdocs.db"
RUN mkdir -p /data \
 && npx prisma generate --config prisma7.config.ts \
 && npm run build

ENV NODE_ENV=production PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Apply any pending migrations, then start the custom server
CMD ["sh", "-c", "npx prisma migrate deploy --config prisma7.config.ts && node_modules/.bin/tsx server.ts"]
