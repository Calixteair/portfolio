interface ImportMetaEnv {
  /** Commit SHA injected by the Docker build (`dev` locally). */
  readonly PUBLIC_BUILD_SHA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
