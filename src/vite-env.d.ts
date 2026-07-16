/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SP_HOSTNAME: string;
  readonly VITE_SP_SITE_PATH: string;
  readonly VITE_GEMINI_API_ROOT?: string;
  readonly VITE_PUBLIC_SITE_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.module.scss' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*.scss' {
  const content: string;
  export default content;
}

declare module '*.css' {
  const content: string;
  export default content;
}
