const defaultOrigins = ['http://localhost:5173', 'https://projektwoche-puzzel.vercel.app'];

export const config = {
  port: Number(process.env.BACKEND_PORT ?? process.env.PORT ?? 8000),
  apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:8000/api',
  sessionSecret: process.env.SESSION_SECRET ?? 'local-dev-change-me',
  uploadMaxMb: Number(process.env.UPLOAD_MAX_MB ?? 10),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? defaultOrigins.join(',')).split(',').map((s) => s.trim()).filter(Boolean),
  cookieName: 'puzzlestudio_session',
  crossSiteCookies: process.env.CROSS_SITE_COOKIES === 'true',
  supabase: {
    url: process.env.SUPABASE_URL?.replace(/\/$/, '') || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    storageBucket: process.env.SUPABASE_STORAGE_BUCKET || '',
  },
};
