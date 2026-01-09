// Типы для CSS/SCSS модулей
declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.module.scss' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.module.sass' {
  const classes: { [key: string]: string };
  export default classes;
}

// Типы для переменных окружения (Vite-стиль через webpack DefinePlugin)
declare global {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL?: string;
    readonly VITE_SUPABASE_ANON_KEY?: string;
    readonly VITE_SUPABASE_SERVICE_ROLE_KEY?: string;
    readonly VITE_USE_SUPABASE_STORAGE?: string;
    readonly VITE_SUBDOMAIN_BASE_DOMAIN?: string;
    readonly VITE_SUBDOMAIN_BASE_DOMAINS?: string;
    readonly VITE_PRIMARY_DOMAIN?: string;
    readonly VITE_ENABLE_SUBDOMAIN_MULTI_TENANCY?: string;
    readonly VITE_DISABLE_SUBDOMAIN_MULTI_TENANCY?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export {};
