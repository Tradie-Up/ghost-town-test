// TradieUp — Website Roast proxy (Vercel serverless function)
// -----------------------------------------------------------------------------
// Same-origin relay for the roast page. Forwards { url, trade } to the Apps
// Script web app (action=roast), which reads the site + roasts it via OpenRouter.
// Reuses the SAME env vars as /api/visibility — GTT_EXEC + GTT_TOKEN.
//   The page calls:  /api/roast?url=..&trade=..
// -----------------------------------------------------------------------------

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const q = req.query || {};
  const url   = String(q.url   || '').trim();
  const trade = String(q.trade || '').trim();
  if (!url) { res.status(400).json({ ok: false, error: 'url is required' }); return; }

  const EXEC  = process.env.GTT_EXEC;
  const TOKEN = process.env.GTT_TOKEN;
  if (!EXEC || !TOKEN) { res.status(500).json({ ok: false, error: 'proxy not configured' }); return; }

  const target = EXEC + '?' + new URLSearchParams({ token: TOKEN, action: 'roast', url, trade }).toString();
  try {
    const r = await fetch(target, { redirect: 'follow', headers: { Accept: 'application/json' } });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) {}
    if (!json || typeof json !== 'object') { res.status(502).json({ ok: false, error: 'bad response' }); return; }
    if (json.ok && json.result && !json.result.error) {
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600'); // cache a site's roast 24h
      res.status(200).json(json);
    } else {
      res.status(200).json({ ok: false, error: (json.result && json.result.error) || json.error || 'roast unavailable' });
    }
  } catch (err) {
    res.status(502).json({ ok: false, error: 'roast unavailable' });
  }
}
