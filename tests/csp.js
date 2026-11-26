// Recalcule les empreintes sha256 des scripts intégrés et met à jour la politique de sécurité (CSP) de la page.
const fs = require('fs'), crypto = require('crypto');
const f = process.argv[2], check = process.argv[3] === 'check';
let s = fs.readFileSync(f, 'utf8');
const hs = []; const re = /<script>([\s\S]*?)<\/script>/g; let m;
while ((m = re.exec(s))) hs.push("'sha256-" + crypto.createHash('sha256').update(m[1], 'utf8').digest('base64') + "'");
const cur = (s.match(/'sha256-[^']+'/g) || []).filter((x, i, a) => a.indexOf(x) === i);
const inCsp = s.slice(0, s.indexOf('<meta name="referrer"')).match(/'sha256-[^']+'/g) || [];
const missing = hs.filter(h => !inCsp.includes(h)), extra = inCsp.filter(h => !hs.includes(h));
console.log('scripts intégrés:', hs.length, '| empreintes dans la CSP:', inCsp.length, '| manquantes:', missing.length, '| en trop:', extra.length);
if (!check && (missing.length || extra.length)) {
  const a = s.indexOf(inCsp[0]), b = s.indexOf(inCsp[inCsp.length - 1]) + inCsp[inCsp.length - 1].length;
  s = s.slice(0, a) + hs.join(' ') + s.slice(b); fs.writeFileSync(f, s); console.log('CSP mise à jour');
}
