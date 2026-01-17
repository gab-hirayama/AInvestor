/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_N8N_IMPORT_WEBHOOK_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  interface Window {
    ENV: {
      SUPABASE_URL: string
      SUPABASE_ANON_KEY: string
      N8N_IMPORT_WEBHOOK_URL: string
    }
  }
}

export {}

