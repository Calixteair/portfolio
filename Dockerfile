# --- Build: Astro static site ---
FROM node:26.13.0-alpine3.24@sha256:c6ad9e9c1d80f6eb607c26b4b0a132ff7a2344fad1c78ea3baa2a7d4c8de6d94 AS build
WORKDIR /app

# Dependencies first: this layer stays cached while only sources change.
# pnpm (version de packageManager dans package.json) via corepack
COPY package.json pnpm-lock.yaml .npmrc ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY . .
# Commit SHA rendered in a <meta> (x-build): shows which version is live. GIT_REVISION is passed
# by the Jenkins build (jenkins-lib buildImage).
ARG GIT_REVISION=dev
ENV PUBLIC_BUILD_SHA=$GIT_REVISION
RUN pnpm run build \
 && find dist -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.svg' \
      -o -name '*.json' -o -name '*.wasm' -o -name '*.glb' -o -name '*.bin' \) -exec gzip -9 -k {} +

# --- Runtime: unprivileged nginx (uid 101, port 8080) ---
FROM nginxinc/nginx-unprivileged:1.31.7-alpine3.24@sha256:b5047b9b76845eac124358373c6852377c52e4b05834a47647e955dd91cb8f1e AS runtime

# Alpine security fixes published after the base image was built (e.g. brotli-libs 1.2.1):
# Trivy blocks fixable HIGH/CRITICAL. The pinned digest keeps the rest reproducible.
USER 0
RUN apk upgrade --no-cache
USER 101

ENV NGINX_ENTRYPOINT_QUIET_LOGS=1
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY docker/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD ["wget", "-q", "--spider", "http://127.0.0.1:8080/healthz"]
