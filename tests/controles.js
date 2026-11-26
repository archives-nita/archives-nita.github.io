// Archives NITA – contrôles avant publication (lancés automatiquement par GitHub à chaque dépôt).
// Si un seul contrôle échoue, la publication est annulée et la version en ligne reste inchangée.
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const RACINE = path.resolve(__dirname, '..');
let echecs = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : 'ECHEC ') + m); if (!c) echecs++; };
const lire = f => { try { return fs.readFileSync(path.join(RACINE, f), 'utf8'); } catch (e) { return null; } };

console.log('== 1. Fichiers de l\'application');
const html = lire('index.html');
ok(!!html, 'index.html présent');
if (!html) process.exit(1);
const ver = (html.match(/const APP_VER="([^"]*)"/) || [])[1];
ok(!!ver, 'numéro de version présent : ' + (ver || 'ABSENT'));
ok(html.length > 300000, 'index.html complet (' + Math.round(html.length / 1024) + ' Ko)');
ok(/<\/html>\s*$/.test(html), 'index.html se termine correctement (pas de fichier tronqué)');
for (const f of ['sw.js', 'manifest.json']) ok(lire(f) !== null, f + ' présent');
try { JSON.parse(lire('manifest.json')); ok(true, 'manifest.json valide'); } catch (e) { ok(false, 'manifest.json invalide : ' + e.message); }

console.log('== 2. Code JavaScript');
const re = /<script>([\s\S]*?)<\/script>/g; let m, n = 0, bad = 0;
while ((m = re.exec(html))) { n++; try { new Function(m[1]); } catch (e) { bad++; console.log('   script n°' + n + ' : ' + e.message); } }
ok(n > 0 && bad === 0, n + ' scripts intégrés, ' + bad + ' en erreur de syntaxe');
try { new Function(lire('sw.js')); ok(true, 'sw.js sans erreur de syntaxe'); } catch (e) { ok(false, 'sw.js : ' + e.message); }

console.log('== 3. Protection du navigateur (CSP)');
const csp = spawnSync(process.execPath, [path.join(__dirname, 'csp.js'), path.join(RACINE, 'index.html'), 'check'], { encoding: 'utf8' });
const lc = (csp.stdout || '').trim(); console.log('   ' + lc);
ok(/manquantes: 0 \| en trop: 0/.test(lc), 'empreintes de la CSP à jour (sinon la page serait bloquée par le navigateur)');

console.log('== 4. Essais dans un vrai navigateur (données fictives)');
for (const [f, nom] of [['interface.js', 'interface (ordinateur et téléphone)'], ['observateur.js', 'rôle Observateur (lecture seule)']]) {
  const r = spawnSync(process.execPath, [path.join(__dirname, f), RACINE], { encoding: 'utf8', timeout: 600000 });
  const out = (r.stdout || '') + (r.stderr || '');
  out.split('\n').filter(l => /ECHEC|Error|réussis/.test(l)).forEach(l => console.log('   ' + l));
  ok(r.status === 0, nom);
}

console.log('\n' + (echecs ? '✗ ' + echecs + ' contrôle(s) en échec : PUBLICATION ANNULÉE, la version en ligne ne change pas.' : '✓ Tous les contrôles sont passés : publication de la version « ' + ver + ' ».'));
process.exit(echecs ? 1 : 0);
