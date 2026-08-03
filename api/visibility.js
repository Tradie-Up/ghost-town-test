// TradieUp — Ghost Town Test / Gap Engine proxy (Vercel serverless function)
// -----------------------------------------------------------------------------
// Same-origin relay for the landing page. Holds the gate token server-side,
// forwards the scan to the Apps Script web app, returns its JSON. This is what
// keeps your DataForSEO/OpenRouter keys off the page and dodges CORS.
//
// Set these in Vercel ▸ Project ▸ Settings ▸ Environment Variables:
//   GTT_EXEC   the Apps Script /exec URL (Deploy ▸ Web app)
//   GTT_TOKEN  the shared secret you set as GATE_TOKEN in Apps Script properties
//
// The page calls:  /api/visibility?trade=..&suburb=..&business=..&jobValue=..&radius=..
// -----------------------------------------------------------------------------

export default async function handler(req, res) {
  // Public GET, no cookies, token stays server-side — permissive origin is safe
  // and lets you embed the page on tradieup.com.au later if you ever want to.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const q = req.query || {};
  const trade    = String(q.trade    || '').trim();
  const suburb   = String(q.suburb   || '').trim();
  const business = String(q.business || '').trim();
  const jobValue = String(q.jobValue || '').replace(/[^0-9.]/g, '');
  // radius is handled client-side (patch multiplier) — not forwarded to the engine.

  if (!trade || !suburb) {
    res.status(400).json({ ok: false, error: 'trade and suburb are required' });
    return;
  }

  const EXEC  = process.env.GTT_EXEC;
  const TOKEN = process.env.GTT_TOKEN;
  if (!EXEC || !TOKEN) {
    res.status(500).json({ ok: false, error: 'proxy not configured' });
    return;
  }

  const url = EXEC + '?' + new URLSearchParams({
    token: TOKEN, trade, suburb, business, jobValue
  }).toString();

  try {
    const r = await fetch(url, { redirect: 'follow', headers: { Accept: 'application/json' } });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) { /* fall through */ }

    if (!json || typeof json !== 'object') {
      res.status(502).json({ ok: false, error: 'bad response' });
      return;
    }
    // Edge-cache identical successful scans for 24h → protects DataForSEO credit.
    if (json.ok && json.result) {
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600');
    }
    res.status(200).json(json);
  } catch (err) {
    res.status(502).json({ ok: false, error: 'scan unavailable' });
  }
}
