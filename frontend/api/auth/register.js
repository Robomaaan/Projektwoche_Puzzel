import { createAdminClient, json } from '../_supabaseAdmin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: { message: 'Methode nicht erlaubt' } });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const displayName = String(body.displayName || '').trim();
  if (!email || !email.includes('@') || password.length < 6 || !displayName) {
    return json(res, 400, { error: { message: 'Ungültige Eingaben' } });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return json(res, 500, { error: { message: 'Supabase ist nicht konfiguriert' } });
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { displayName },
  });
  if (error) {
    const lower = error.message.toLowerCase();
    const duplicate = lower.includes('already') || lower.includes('registered') || lower.includes('exists');
    return json(res, duplicate ? 409 : 400, { error: { message: duplicate ? 'E-Mail ist bereits registriert' : error.message } });
  }
  return json(res, 201, { user: { id: data.user.id, email: data.user.email, displayName, language: 'de', timezone: 'Europe/Berlin' } });
}
