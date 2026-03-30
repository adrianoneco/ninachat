/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Supabase environment variables removed for local mock mode.
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
