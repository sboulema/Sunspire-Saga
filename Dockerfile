# Sunspire Saga, engine build: the site is built with Node, then served by nginx.
# Build:  docker build -t sunspire-saga .
# Run:    docker run --rm -p 8080:80 sunspire-saga   ->  http://localhost:8080/play
FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json .npmrc ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run site

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
WORKDIR /usr/share/nginx/html
RUN rm -f ./*
COPY --from=build /src/site/ ./

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/play >/dev/null || exit 1
