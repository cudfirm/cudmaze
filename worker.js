/* CUDMAZE API: accounts, sessions, profile, saved cart.
   Runs on Cloudflare Workers with a D1 database bound as DB.
   Static files are served by the assets binding; only /api/* reaches this code. */

const SESSION_DAYS = 30;
const COOKIE = 'cm_session';
const MAX_CART_ITEMS = 30;
const PBKDF2_ITER = 100000; // Workers' maximum

const enc = new TextEncoder();
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  });
}
const fail = (status, error) => json({ ok: false, error }, status);

async function hashPassword(password, saltHex) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations: PBKDF2_ITER }, key, 256);
  return toHex(bits);
}
async function sha256(text) { return toHex(await crypto.subtle.digest('SHA-256', enc.encode(text))); }
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

function cookieHeader(value, maxAge, secure) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}
function readCookie(request) {
  const m = (request.headers.get('Cookie') || '').match(new RegExp('(?:^|; )' + COOKIE + '=([a-f0-9]+)'));
  return m ? m[1] : null;
}

async function startSession(env, userId, secure) {
  const raw = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?,?,?)')
    .bind(await sha256(raw), userId, exp).run();
  return cookieHeader(raw, SESSION_DAYS * 86400, secure);
}

async function currentUser(env, request) {
  const raw = readCookie(request);
  if (!raw) return null;
  const now = Math.floor(Date.now() / 1000);
  return await env.DB.prepare(
    `SELECT u.id, u.username, u.mobile, u.full_name, u.address FROM sessions s
     JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`)
    .bind(await sha256(raw), now).first();
}

const publicUser = (u) => ({ username: u.username, mobile: u.mobile, fullName: u.full_name, address: u.address });

async function getCart(env, userId) {
  const row = await env.DB.prepare('SELECT items FROM carts WHERE user_id = ?').bind(userId).first();
  try { return row ? JSON.parse(row.items) : []; } catch { return []; }
}

function sanitizeCart(items) {
  if (!Array.isArray(items)) return null;
  if (items.length > MAX_CART_ITEMS) return null;
  const out = [];
  for (const it of items) {
    const qty = Math.floor(Number(it.qty));
    const id = clean(it.id, 80);
    if (!id || !(qty >= 1 && qty <= 99)) return null;
    const price = it.price === '' || it.price == null ? '' : String(Math.max(0, Number(it.price)) || '');
    out.push({
      id, name: clean(it.name, 120), price, qty,
      variation: clean(it.variation, 160), image: clean(it.image, 200),
    });
  }
  return out;
}

async function tooManyFailures(env, key) {
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare('SELECT failures, window_start FROM login_attempts WHERE key = ?').bind(key).first();
  return !!(row && now - row.window_start < 900 && row.failures >= 5);
}
async function recordFailure(env, key) {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `INSERT INTO login_attempts (key, failures, window_start) VALUES (?1,1,?2)
     ON CONFLICT(key) DO UPDATE SET
       failures = CASE WHEN ?2 - window_start >= 900 THEN 1 ELSE failures + 1 END,
       window_start = CASE WHEN ?2 - window_start >= 900 THEN ?2 ELSE window_start END`)
    .bind(key, now).run();
}

const USERNAME_RE = /^(?![0-9])[a-zA-Z0-9_]{3,20}$/;
const MOBILE_RE = /^\+?\d{7,15}$/;

async function handle(request, env) {
  const url = new URL(request.url);
  const secure = url.protocol === 'https:';
  const path = url.pathname.replace(/\/+$/, '');
  const method = request.method;

  if (method !== 'GET' && method !== 'HEAD') {
    // CSRF guard: same-origin browser requests with a JSON body only.
    const origin = request.headers.get('Origin');
    if (origin && origin !== url.origin) return fail(403, 'Cross-site request blocked.');
    if (!(request.headers.get('Content-Type') || '').includes('application/json')) return fail(415, 'JSON required.');
  }
  const body = method === 'GET' ? {} : await request.json().catch(() => null);
  if (body === null) return fail(400, 'Invalid request.');

  if (path === '/api/register' && method === 'POST') {
    const username = clean(body.username, 20), mobile = clean(body.mobile, 20).replace(/[\s-]/g, ''), password = String(body.password || '');
    if (!USERNAME_RE.test(username)) return fail(400, 'Username must be 3–20 letters, numbers or underscores and cannot start with a number.');
    if (!MOBILE_RE.test(mobile)) return fail(400, 'Enter a valid mobile number, e.g. +2348012345678.');
    if (password.length < 8 || password.length > 64) return fail(400, 'Password must be 8–64 characters.');
    const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
    const hash = await hashPassword(password, salt);
    try {
      const r = await env.DB.prepare('INSERT INTO users (username, mobile, pw_hash, pw_salt, created_at) VALUES (?,?,?,?,?)')
        .bind(username, mobile, hash, salt, Math.floor(Date.now() / 1000)).run();
      const id = r.meta.last_row_id;
      await env.DB.prepare('INSERT INTO carts (user_id, items, updated_at) VALUES (?,?,?)').bind(id, '[]', Math.floor(Date.now() / 1000)).run();
      const cookie = await startSession(env, id, secure);
      return json({ ok: true, user: { username, mobile, fullName: '', address: '' }, cart: [] }, 201, { 'Set-Cookie': cookie });
    } catch (e) {
      if (String(e).includes('UNIQUE')) return fail(409, 'That username is already taken.');
      throw e;
    }
  }

  if (path === '/api/login' && method === 'POST') {
    const username = clean(body.username, 20), password = String(body.password || '');
    const key = 'u:' + username.toLowerCase();
    if (await tooManyFailures(env, key)) return fail(429, 'Too many attempts. Please wait 15 minutes and try again.');
    const u = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
    // Always hash, so unknown users take as long as wrong passwords.
    const hash = await hashPassword(password, u ? u.pw_salt : '00'.repeat(16));
    if (!u || !safeEqual(hash, u.pw_hash)) { await recordFailure(env, key); return fail(401, 'Incorrect username or password.'); }
    await env.DB.prepare('DELETE FROM login_attempts WHERE key = ?').bind(key).run();
    const cookie = await startSession(env, u.id, secure);
    return json({ ok: true, user: publicUser(u), cart: await getCart(env, u.id) }, 200, { 'Set-Cookie': cookie });
  }

  if (path === '/api/logout' && method === 'POST') {
    const raw = readCookie(request);
    if (raw) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(raw)).run();
    return json({ ok: true }, 200, { 'Set-Cookie': cookieHeader('', 0, secure) });
  }

  const user = await currentUser(env, request);

  if (path === '/api/me' && method === 'GET') {
    if (!user) return json({ ok: true, user: null, cart: [] });
    return json({ ok: true, user: publicUser(user), cart: await getCart(env, user.id) });
  }
  if (!user) return fail(401, 'Please sign in.');

  if (path === '/api/me' && method === 'PUT') {
    const fullName = clean(body.fullName, 80), address = clean(body.address, 240), mobile = clean(body.mobile, 20).replace(/[\s-]/g, '');
    if (!MOBILE_RE.test(mobile)) return fail(400, 'Enter a valid mobile number, e.g. +2348012345678.');
    await env.DB.prepare('UPDATE users SET full_name = ?, address = ?, mobile = ? WHERE id = ?').bind(fullName, address, mobile, user.id).run();
    return json({ ok: true, user: { username: user.username, mobile, fullName, address } });
  }

  if (path === '/api/cart' && method === 'PUT') {
    const items = sanitizeCart(body.items);
    if (!items) return fail(400, 'Invalid cart.');
    await env.DB.prepare(
      `INSERT INTO carts (user_id, items, updated_at) VALUES (?,?,?)
       ON CONFLICT(user_id) DO UPDATE SET items = excluded.items, updated_at = excluded.updated_at`)
      .bind(user.id, JSON.stringify(items), Math.floor(Date.now() / 1000)).run();
    return json({ ok: true, cart: items });
  }

  return fail(404, 'Not found.');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try { return await handle(request, env); }
    catch (e) { console.error(e); return fail(500, 'Something went wrong. Please try again.'); }
  },
};
