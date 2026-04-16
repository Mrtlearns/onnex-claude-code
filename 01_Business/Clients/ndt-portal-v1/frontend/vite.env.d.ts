/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTHENTIK_ISSUER: string;
  readonly VITE_AUTHENTIK_CLIENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
