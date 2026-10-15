# --- Build: Astro static site ---
FROM node:24.22.0-alpine3.24@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f AS build
WORKDIR /app

# Dependencies first: this layer stays cached while only sources change.
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit

COPY . .
RUN npm run build \
 && find dist -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.svg' \
      -o -name '*.json' -o -name '*.wasm' -o -name '*.glb' \) -exec gzip -9 -k {} +

# --- Runtime: unprivileged nginx (uid 101, port 8080) ---
FROM nginxinc/nginx-unprivileged:1.30.6-alpine3.24@sha256:782bb89768cc87b7f95c18b95baa1af250e5d451f26794f59363540161147c01

ENV NGINX_ENTRYPOINT_QUIET_LOGS=1
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY docker/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD ["wget", "-q", "--spider", "http://127.0.0.1:8080/healthz"]
