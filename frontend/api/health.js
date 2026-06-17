import { json, serverConfigStatus } from './_supabaseAdmin.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: { message: 'Methode nicht erlaubt' } });
  return json(res, 200, {
    ok: true,
    runtime: 'vercel-api',
    supabase: serverConfigStatus(),
  });
}
