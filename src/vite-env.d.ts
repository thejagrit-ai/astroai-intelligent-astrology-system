/// <reference types="vite/client" />

declare interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_GEMINI_MODEL?: string;
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}
