// TradieUp — Booking proxy (Vercel serverless function)
// -----------------------------------------------------------------------------
// The booking widget calls /api/booking/<route>. We map the route to the Apps
// Script connector's action, inject the security token server-side (never in the
// browser), and GET-forward to the "Tradie Up Booking" web app /exec — which
// books straight into Tim's Google Calendar. Mirrors the proven Guia/NPM WP proxy.
//
// Apps Script drops POST bodies on its 302 redirect, so we GET-forward with a
// query string (exactly like the WP proxy does).
//
// Vercel env var required:  GTT_BOOKING_TOKEN  = the connector's AUTH_TOKEN
// -----------------------------------------------------------------------------

const BOOKING_EXEC =
  'https://script.google.com/macros/s/AKfycbxVtNkaItpTExotllfyMHoU1NffU_2Iv0E1OswLyVBkfVj94C8beMlrMqtlyvBfgZqfow/exec';

const ROUTE_ACTION = {
  'get-booking-config': 'getBookingConfig',
  'get-slots':          'getAvailableSlots',
  'available-slots':    'getAvailableSlots',
  'book-call':          'bookCall',
  'get-booking-details':'getBookingDetails',
  'reschedule-booking': 'rescheduleBooking',
  'cancel-booking':     'cancelBooking',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const route = String(req.query.route || '');
  const action = ROUTE_ACTION[route];
  if (!action) { res.status(404).json({ ok: false, error: 'unknown booking route: ' + route }); return; }

  const TOKEN = process.env.GTT_BOOKING_TOKEN;
  if (!TOKEN) { res.status(500).json({ ok: false, error: 'booking proxy not configured' }); return; }

  // Gather params from the JSON body (POST) or the query string (GET).
  let payload = {};
  if (req.method === 'POST') {
    let b = req.body;
    if (typeof b === 'string') { try { b = JSON.parse(b); } catch (_) { b = {}; } }
    payload = (b && typeof b === 'object') ? b : {};
  } else {
    payload = Object.assign({}, req.query);
    delete payload.route;
  }
  payload.action = action;
  payload.token  = TOKEN;

  const qs = new URLSearchParams();
  Object.keys(payload).forEach(function (k) {
    const v = payload[k];
    if (v === undefined || v === null) return;
    qs.append(k, (typeof v === 'object') ? JSON.stringify(v) : String(v));
  });
  const target = BOOKING_EXEC + (BOOKING_EXEC.indexOf('?') === -1 ? '?' : '&') + qs.toString();

  try {
    const r = await fetch(target, { method: 'GET', redirect: 'follow', headers: { Accept: 'application/json' } });
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch (_) {}
    res.status(200).json(json && typeof json === 'object' ? json : { ok: false, error: 'bad upstream response', raw: text.slice(0, 200) });
  } catch (err) {
    res.status(502).json({ ok: false, error: 'booking unavailable' });
  }
}
