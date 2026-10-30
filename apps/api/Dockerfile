# Build stage
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json nx.json tsconfig.base.json ./
COPY apps/api ./apps/api
COPY prisma ./prisma
RUN npm ci && npx prisma generate && npx nx build api

# Runtime stage
FROM node:22-alpine
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist/apps/api ./dist
COPY prisma ./prisma
COPY apps/api/package.json ./package.json
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
