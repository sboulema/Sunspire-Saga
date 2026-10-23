# Sunspire Saga is a static site: no build step, just the HTML pages, game.js and assets/.
# Build:  docker build -t sunspire-saga .
# Run:    docker run --rm -p 8080:80 sunspire-saga   ->  http://localhost:8080/play.html
FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

WORKDIR /usr/share/nginx/html
RUN rm -f ./*
COPY index.html play.html pack-guide.html changelog.html game.js ./
COPY assets/ ./assets/

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/play.html >/dev/null || exit 1
