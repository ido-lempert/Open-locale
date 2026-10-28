# Build stage
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json nx.json tsconfig.base.json ./
COPY apps/web ./apps/web
RUN npm ci && npx nx build web

# Serve stage
FROM nginx:alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/apps/web/browser /usr/share/nginx/html
EXPOSE 80
