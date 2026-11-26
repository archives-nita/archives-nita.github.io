// Banc de mesure : sert l'application localement, simule Supabase (REST, auth, temps réel) avec des données fictives.
// Banc portable : fonctionne chez GitHub (Chromium fourni par Playwright) comme en local.
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const http = require('http'), fs = require('fs'), path = require('path');

const REF = 'yyuvzfibbpexundcxsrb';
const UID = '11111111-2222-4333-8444-555555555555';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');

function mkData(nDocs) {
  const DIRS = { 'Direction Finance et Comptabilité': ['Service Finance et Comptabilité'], 'Direction des Affaires Juridiques, Ressources Humaines / Services Archives': ['Service Ressources Humaines', 'Service Gestion des Contrats', 'Service Recouvrement', 'Service Archives'], 'Direction Commerciale': ['Service Grandes Entreprises', 'Service Gestion des ONG', 'Service Paiement Marchand'], 'Direction Liquidité': ['Service Liquidité'], 'Direction Exploitation': ['Service Travaux', 'Service Exploitation'] };
  const dk = Object.keys(DIRS), MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const T = ['Chrono', 'Carton', 'Chemise', 'Volume relié'], CAT = ['F1', 'F2', 'J1', 'RH7', 'M2', 'A4', ''];
  const W = ['Factures fournisseurs', 'Pièces de caisse', 'Journées comptables', 'Contrats agents', 'Déclarations CNSS', 'Relevés bancaires', 'Bordereaux de versement', 'Dossiers du personnel', 'Courriers arrivée', 'Rapports mensuels'];
  let s = 42; const rnd = n => (s = (s * 1103515245 + 12345) & 0x7fffffff, (s >>> 8) % n);
  const docs = [];
  for (let i = 0; i < nDocs; i++) {
    const d = dk[rnd(dk.length)], sv = DIRS[d][rnd(DIRS[d].length)], an = 2012 + rnd(15);
    docs.push({ id: 'd' + String(i).padStart(6, '0'), data: { intitule: W[rnd(W.length)] + ' ' + MOIS[rnd(12)] + ' ' + an + ' n°' + i, cote: 'FC-' + an + '-' + String(i % 999).padStart(3, '0'), mots: 'factures, caisse, ' + sv.toLowerCase(), direction: d, service: sv, empl: 'Étage ' + (1 + rnd(6)) + ' · Armoire ' + (1 + rnd(12)), obs: rnd(4) ? '' : 'Versé par le service, état correct', annee: an, mois: MOIS[rnd(12)], type: T[rnd(4)], nb: 1 + rnd(3), statut: rnd(40) ? 'disponible' : 'en_pret', cat: CAT[rnd(CAT.length)], gel: false } });
  }
  const prets = [];
  docs.filter(d => d.data.statut === 'en_pret').forEach((d, i) => prets.push({ id: 'p' + i, data: { docId: d.id, docLabel: d.data.intitule, titre: d.data.intitule, cote: d.data.cote, demandeur: 'Agent ' + (i % 9), service: d.data.service, direction: d.data.direction, mode: 'Prêt interne', sortie: '2026-10-' + String(1 + i % 28).padStart(2, '0'), prevu: '2026-11-' + String(1 + i % 28).padStart(2, '0'), retour: '', statut: 'en_cours', par: UID, valide: '', ref: 'BS-2026-' + String(i).padStart(3, '0'), type: d.data.type, annee: d.data.annee, grp: '' } }));
  for (let i = 0; i < 40; i++) prets.push({ id: 'ph' + i, data: { docId: docs[i].id, docLabel: docs[i].data.intitule, titre: docs[i].data.intitule, cote: docs[i].data.cote, demandeur: 'Agent ' + (i % 9), service: docs[i].data.service, direction: docs[i].data.direction, mode: 'Consultation sur place', sortie: '2026-09-' + String(1 + i % 28).padStart(2, '0'), prevu: '2026-09-' + String(2 + i % 27).padStart(2, '0'), retour: '2026-09-' + String(2 + i % 27).padStart(2, '0'), statut: 'rendu', par: UID, valide: '', ref: 'BS-2026-9' + String(i).padStart(2, '0'), type: docs[i].data.type, annee: docs[i].data.annee, grp: '' } });
  const directions = dk.map((d, i) => ({ id: 'dir' + i, data: { nom: d } }));
  const services = []; dk.forEach(d => DIRS[d].forEach(sv => services.push({ id: 'sv' + services.length, data: { nom: sv, dir: d } })));
  return { docs, prets, directions, services };
}

async function launch(opts = {}) {
  const root = opts.root, lat = opts.latency || 0, DATA = Object.assign(mkData(opts.nDocs || 1672), opts.data || {}), log = { unknown: new Set(), reqs: 0, bytes: 0 };
  const supa = fs.readFileSync(require.resolve('@supabase/supabase-js/dist/umd/supabase.js', { paths: [__dirname, '/home/claude/bench'] }));
  let srvLog = [];
  const srv = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
    const f = path.join(root, p); if (!f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end() }
    const ct = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' }[path.extname(f)] || 'application/octet-stream';
    const body = fs.readFileSync(f), st = fs.statSync(f), et = '"' + require('crypto').createHash('sha1').update(body).digest('hex').slice(0, 16) + '"';
    (srvLog = srvLog || []).push(q.method + ' ' + q.url);
    r.writeHead(200, { 'content-type': ct, 'cache-control': 'no-store', 'etag': et, 'last-modified': st.mtime.toUTCString(), 'content-length': body.length }); r.end(q.method === 'HEAD' ? undefined : body);
  });
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
  const origin = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}), headless: true, args: ['--no-sandbox', ...(opts.args || [])] });
  const mobile = opts.mobile !== false;
  const ctx = await browser.newContext({ viewport: opts.viewport || (mobile ? { width: 430, height: 873 } : { width: 1440, height: 900 }), deviceScaleFactor: opts.dpr || (mobile ? 3 : 1), ...(opts.ua ? { userAgent: opts.ua } : {}), isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block', colorScheme: opts.scheme || 'dark', locale: 'fr-FR', timezoneId: 'Africa/Niamey' });
  const now = Math.floor(Date.now() / 1000);
  // double vérification simulée : opts.mfa = 'aal2' (défaut : facteur vérifié, session vérifiée), 'verified' (facteur vérifié, session simple), 'none' (aucun facteur)
  const MF = { mode: opts.mfa || 'aal2', factors: [], log: [] };
  if (MF.mode !== 'none') MF.factors.push({ id: 'f-ok', factor_type: 'totp', status: 'verified', friendly_name: 'Téléphone', created_at: '2026-11-17T00:00:00Z', updated_at: '2026-11-17T00:00:00Z' });
  const user = { id: UID, aud: 'authenticated', role: 'authenticated', email: 'test@example.org', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z', get factors() { return MF.factors } };
  const mkJwt = aal => b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: UID, role: 'authenticated', exp: now + 36000, iat: now, email: user.email, aud: 'authenticated', aal, amr: aal === 'aal2' ? [{ method: 'password', timestamp: now }, { method: 'totp', timestamp: now }] : [{ method: 'password', timestamp: now }] }) + '.sig';
  const jwt = mkJwt(MF.mode === 'aal2' ? 'aal2' : 'aal1');
  const sessionOf = aal => ({ access_token: mkJwt(aal), token_type: 'bearer', expires_in: 36000, expires_at: now + 36000, refresh_token: 'r', user: JSON.parse(JSON.stringify(user)) });
  const session = sessionOf(MF.mode === 'aal2' ? 'aal2' : 'aal1');
  const tokAal = q => { try { return JSON.parse(Buffer.from((q.headers()['authorization'] || '').split('.')[1], 'base64url')).aal } catch (e) { return 'aal1' } };
  await ctx.addInitScript(([k, s, extra]) => { try { localStorage.setItem(k, s); localStorage.setItem('nitaLastActivity', String(Date.now())); for (const [a, b] of Object.entries({ arch_visite: '1', ...(extra || {}) })) localStorage.setItem(a, b) } catch (e) { } }, ['sb-' + REF + '-auth-token', JSON.stringify(session), opts.ls || {}]);
  const json = (route, body, status = 200, headers = {}) => { const b = JSON.stringify(body); log.reqs++; log.bytes += b.length; const go = () => route.fulfill({ status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', ...headers }, body: b }).catch(() => { }); lat ? setTimeout(go, lat) : go() };
  const LIB = { 'npm/xlsx@0.18.5/dist/xlsx.full.min.js': 'xlsx/dist/xlsx.full.min.js', 'npm/@e965/xlsx@0.20.3/dist/xlsx.full.min.js': '/home/claude/libs3/e965-xlsx/dist/xlsx.full.min.js', 'npm/pdfjs-dist@4.10.38/legacy/build/pdf.min.mjs': '/home/claude/libs3/pdfjs4/legacy/build/pdf.min.mjs', 'npm/pdfjs-dist@4.10.38/legacy/build/pdf.worker.min.mjs': '/home/claude/libs3/pdfjs4/legacy/build/pdf.worker.min.mjs', 'npm/tesseract.js@7.0.0/dist/tesseract.min.js': 'tesseract.js/dist/tesseract.min.js', 'npm/tesseract.js@7.0.0/dist/worker.min.js': 'tesseract.js/dist/worker.min.js', 'npm/tesseract.js-core@7.0.0/tesseract-core-simd-lstm.wasm.js': 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'npm/tesseract.js-core@7.0.0/tesseract-core-lstm.wasm.js': 'tesseract.js-core/tesseract-core-lstm.wasm.js', 'npm/@tesseract.js-data/fra@1.0.0/4.0.0_best_int/fra.traineddata.gz': '@tesseract.js-data/fra/4.0.0_best_int/fra.traineddata.gz', 'npm/qrcode-generator@1.4.4/qrcode.js': 'qrcode-generator/qrcode.js', 'npm/pdf-lib@1.17.1/dist/pdf-lib.min.js': 'pdf-lib/dist/pdf-lib.min.js', 'npm/pdfjs-dist@3.11.174/build/pdf.min.js': 'pdfjs-dist/build/pdf.min.js', 'npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js': 'pdfjs-dist/build/pdf.worker.min.js' };
  await ctx.route('https://cdn.jsdelivr.net/**', r => { const u = r.request().url(); if (u.includes('supabase-js')) return r.fulfill({ status: 200, headers: { 'content-type': 'text/javascript', 'access-control-allow-origin': '*' }, body: supa });
    const k = u.replace('https://cdn.jsdelivr.net/', ''); if (opts.libs && LIB[k]) return r.fulfill({ status: 200, headers: { 'content-type': 'text/javascript', 'access-control-allow-origin': '*' }, body: fs.readFileSync(LIB[k].startsWith('/') ? LIB[k] : '/home/claude/libs2/node_modules/' + LIB[k]) }); return r.abort() });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  // service des mots de passe piratés simulé : « Soleil2024 » y figure 52 fois
  const sha1 = x => require('crypto').createHash('sha1').update(x).digest('hex').toUpperCase(), PW = sha1('Soleil2024');
  await ctx.route('https://api.pwnedpasswords.com/**', r => { const pre = r.request().url().split('/').pop(); MF.log.push('hibp:' + pre + ':' + (r.request().headers()['add-padding'] || ''));
    r.fulfill({ status: 200, headers: { 'content-type': 'text/plain', 'access-control-allow-origin': '*' }, body: (pre === PW.slice(0, 5) ? PW.slice(5) + ':52\r\n' : '') + '0018A45C4D1DEF81644B54AB7F969B88D65:0\r\n00D4F6E8FA6EECAD2A3AA415EEC418D38EC:3' }) });
  await ctx.route('https://' + REF + '.supabase.co/**', route => {
    const q = route.request(), u = new URL(q.url()), m = q.method(), P = u.pathname, S = u.searchParams;
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (P === '/auth/v1/factors' && m === 'POST') { const f = { id: 'f-new' + MF.factors.length, factor_type: 'totp', status: 'unverified', friendly_name: 'x', created_at: '', updated_at: '' }; MF.factors.push(f); MF.log.push('enroll'); return json(route, { id: f.id, type: 'totp', friendly_name: 'x', totp: { qr_code: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#000"/></svg>', secret: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://totp/x' } }) }
    let mm = P.match(/^\/auth\/v1\/factors\/([^/]+)(?:\/(challenge|verify))?$/);
    if (mm && m === 'DELETE') { MF.factors = MF.factors.filter(f => f.id !== mm[1]); MF.log.push('unenroll'); return json(route, { id: mm[1] }) }
    if (mm && mm[2] === 'challenge') { MF.log.push('challenge'); return json(route, { id: 'ch1', type: 'totp', expires_at: now + 300 }) }
    if (mm && mm[2] === 'verify') { let code = ''; try { code = JSON.parse(q.postData() || '{}').code } catch (e) { } MF.log.push('verify:' + code);
      if (code !== '123456') return json(route, { code: 'mfa_verification_failed', error_code: 'mfa_verification_failed', msg: 'Invalid TOTP code entered', message: 'Invalid TOTP code entered' }, 422);
      MF.factors.forEach(f => { if (f.id === mm[1]) f.status = 'verified' }); return json(route, sessionOf('aal2')) }
    if (P.startsWith('/auth/v1/user')) { if (m === 'PUT') MF.log.push('updateUser'); return json(route, JSON.parse(JSON.stringify(user))) }
    if (P.startsWith('/auth/v1/token')) { MF.log.push('token'); return json(route, sessionOf('aal1')) }
    if (P.startsWith('/auth/v1/')) return json(route, {});
    if (P === '/rest/v1/members') { const row = { user_id: UID, role: opts.role || 'admin', nom: 'TEST', prenom: 'Essai', actif: true, perim_dir: opts.perimDir || null, perim_srv: opts.perimSrv || null }; return json(route, (q.headers()['accept'] || '').includes('vnd.pgrst.object') ? row : [row]) }
    if (P === '/rest/v1/documents' && m === 'POST') { MF.log.push('insert:' + (q.postData() || '').slice(0, 400)); return json(route, []) }
    if (P === '/rest/v1/documents' && (m === 'GET' || m === 'HEAD') && (opts.role || 'admin') === 'admin' && MF.factors.some(f => f.status === 'verified') && tokAal(q) !== 'aal2') return json(route, [], 200, { 'content-range': '*/0' });
    if (P === '/rest/v1/documents' && (m === 'GET' || m === 'HEAD')) {
      const c = (S.get('collection') || '').replace('eq.', ''), sel = S.get('select') || '', all = DATA[c] || [];
      if (S.get('id')) { const id = S.get('id').replace('eq.', ''), r = all.find(x => x.id === id); const obj = (q.headers()['accept'] || '').includes('vnd.pgrst.object'); return json(route, obj ? (r ? { data: r.data } : null) : (r ? [{ data: r.data }] : [])) }
      if (sel === 'updated_at') return json(route, all.length ? [{ updated_at: '2026-11-14T10:00:00.000Z' }] : []);
      if (S.get('updated_at')) return json(route, []);
      const off = +(S.get('offset') || 0), lim = +(S.get('limit') || 1000), rows = all.slice(off, off + lim);
      return json(route, sel === 'id' ? rows.map(r => ({ id: r.id })) : rows, 200, { 'content-range': `${off}-${off + rows.length - 1}/${all.length}` });
    }
    if (P === '/rest/v1/documents_historique') { const id = (S.get('doc_id') || '').replace('eq.', ''), d = DATA.docs.find(x => x.id === id); return json(route, d ? [{ t: '2026-11-17T10:00:00Z', nom: 'Essai TEST', op: 'update', ancien: { ...d.data, empl: 'Armoire 9', obs: 'ancienne note' } }] : []) }
    if (P.startsWith('/rest/v1/rpc/')) { log.unknown.add('rpc ' + P.slice(13)); return json(route, P.endsWith('merge_doc') ? true : null) }
    if (P.startsWith('/rest/v1/')) { log.unknown.add(m + ' ' + P + '?' + (S.get('select') || '').slice(0, 40)); return json(route, (q.headers()['accept'] || '').includes('vnd.pgrst.object') ? null : []) }
    log.unknown.add(m + ' ' + P); return json(route, []);
  });
  const page = await ctx.newPage();
  await page.routeWebSocket(/supabase\.co\/realtime/, ws => {
    ws.onMessage(msg => { try { const d = JSON.parse(msg); const arr = Array.isArray(d); const [jr, ref, topic, ev, pl] = arr ? d : [d.join_ref, d.ref, d.topic, d.event, d.payload];
        let resp = {}; if (ev === 'phx_join') { const pc = (pl && pl.config && pl.config.postgres_changes) || []; resp = { postgres_changes: pc.map((x, i) => ({ ...x, id: i + 1 })) } }
        const out = arr ? [jr, ref, topic, 'phx_reply', { status: 'ok', response: resp }] : { topic, event: 'phx_reply', payload: { status: 'ok', response: resp }, ref, join_ref: jr };
        ws.send(JSON.stringify(out)) } catch (e) { } });
  });
  const errors = []; page.on('pageerror', e => errors.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)) });
  const cdp = await ctx.newCDPSession(page);
  if (opts.cpu) await cdp.send('Emulation.setCPUThrottlingRate', { rate: opts.cpu });
  return { page, ctx, browser, cdp, origin, log, errors, DATA, MF, get srvLog() { return srvLog }, close: async () => { await browser.close(); srv.close() } };
}
module.exports = { launch, mkData, UID };
