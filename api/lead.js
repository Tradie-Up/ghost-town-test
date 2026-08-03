// TradieUp — Website Roast lead capture proxy (Vercel serverless function)
// -----------------------------------------------------------------------------
// The roast page POSTs JSON { email, url, trade, roast } here. We forward it to
// the Apps Script web app (action=lead), which logs the lead to a Google Sheet,
// emails Tim, and emails the tradie their roast. Reuses GTT_EXEC + GTT_TOKEN.
// -----------------------------------------------------------------------------

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'method not allowed' }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};
  const email = String(body.email || '').trim();
  if (!email) { res.status(400).json({ ok: false, error: 'email required' }); return; }

  const EXEC = process.env.GTT_EXEC, TOKEN = process.env.GTT_TOKEN;
  if (!EXEC || !TOKEN) { res.status(500).json({ ok: false, error: 'proxy not configured' }); return; }

  const target = EXEC + '?' + new URLSearchParams({ token: TOKEN, action: 'lead' }).toString();
  try {
    const r = await fetch(target, {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body)
    });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) {}
    res.status(200).json(json && typeof json === 'object' ? json : { ok: false, error: 'bad response' });
  } catch (err) {
    res.status(502).json({ ok: false, error: 'lead unavailable' });
  }
}
