export const config = {
  port: Number(process.env.BACKEND_PORT ?? process.env.PORT ?? 8000),
  apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:8000/api',
  sessionSecret: process.env.SESSION_SECRET ?? 'local-dev-change-me',
  uploadMaxMb: Number(process.env.UPLOAD_MAX_MB ?? 10),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim()),
  cookieName: 'puzzlestudio_session',
};
