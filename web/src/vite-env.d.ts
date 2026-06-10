/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_MAPTILER_KEY: string;
  readonly VITE_TILE_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
