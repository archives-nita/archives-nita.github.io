// 4.82 : audit UI/UX – recherche unique, inventaire en tableau, fiche latérale, Équipe / Administration, téléphone, confort
const { launch } = require('./harness');
const fs = require('fs');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ok  ' : 'ECHEC ') + m) };
const H = { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
const reseau = p => p.route(/\/functions\/v1\/reseau/, r => r.fulfill({ status: 200, headers: H, body: '{"vpn":false}' }));
const pret = async p => { await p.waitForFunction(() => window.SBME && window.SBME(), null, { timeout: 20000 }).catch(() => { }); await p.waitForTimeout(1800) };
const nav = (p, v) => p.evaluate(v => document.querySelector(`nav button[data-v="${v}"]`).click(), v);
(async () => {
  const root = process.argv[2];
  // ---------- ordinateur ----------
  let h = await launch({ root, mfa: 'aal2', mobile: false, viewport: { width: 1440, height: 900 }, nDocs: 1672 }); let p = h.page; await reseau(p);
  await p.goto(h.origin + '/'); await pret(p);
  // accueil
  let t = await p.evaluate(() => document.getElementById('app').innerText);
  ok(!!(await p.$('.qsb')) && !(await p.$('#qs')), 'accueil : une seule recherche (barre qui ouvre la recherche globale)');
  const ordre = await p.evaluate(() => { const a = document.getElementById('app').innerHTML; return [a.indexOf('À traiter'), a.indexOf('Documents actuellement en sortie')] });
  ok(ordre[0] > 0 && (ordre[1] < 0 || ordre[0] < ordre[1]), '« À traiter » affiché avant les documents en sortie');
  ok(await p.evaluate(() => !!document.querySelector('button.kpi[data-a="tab"][data-v="inv"]')), 'chiffres clés de l’inventaire cliquables');
  const nr = await p.evaluate(() => { const h2 = [...document.querySelectorAll('#app h2')].find(x => /Retours en retard/.test(x.textContent)); if (!h2) return null; let n = 0, e = h2.nextElementSibling; while (e && e.tagName !== 'H2') { if (e.classList.contains('card')) n++; e = e.nextElementSibling } return { n, more: !!document.querySelector('#app [data-a="pvgo"]') } });
  ok(!nr || (nr.n <= 5 && nr.more), 'retours en retard : 5 au plus sur l’accueil + « Voir les … » (' + JSON.stringify(nr) + ')');
  ok(await p.evaluate(() => !document.querySelector('nav button[data-v="cons"] em')), 'menu : plus de badge d’alerte sur « Conservation »');
  await p.click('.qsb'); await p.waitForSelector('#cmdk[open]'); await p.type('#cmdq', 'factures'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => document.querySelectorAll('#cmdr mark').length > 0), 'recherche globale : mots trouvés surlignés');
  await p.keyboard.press('Escape');
  // inventaire en tableau
  await nav(p, 'inv'); await p.waitForTimeout(900);
  let r = await p.evaluate(() => ({ tb: !!document.querySelector('#lst table.itb'), rows: document.querySelectorAll('#lst tr.ir').length, grp: document.querySelectorAll('#lst tr.ig').length, th: getComputedStyle(document.querySelector('.itb th')).position, ph: (document.querySelector('.phd h2') || {}).textContent }));
  ok(r.tb && r.rows === 40 && r.grp > 0 && r.th === 'sticky', 'inventaire : vue Tableau par défaut (40 lignes, groupes, en-tête fixe) ' + JSON.stringify(r));
  ok(r.ph === 'Inventaire', 'inventaire : en-tête de page comme les autres écrans');
  const vis = await p.evaluate(() => [...document.querySelectorAll('#lst tr.ir')].filter(x => { const b = x.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight }).length);
  ok(vis >= 9, 'au moins 9 entrées visibles sans défiler (' + vis + ', contre 4 en cartes)');
  await p.evaluate(() => { const m = document.getElementById('lmore'); if (m) m.querySelector('button').click() }); await p.waitForTimeout(500);
  r = await p.evaluate(() => ({ rows: document.querySelectorAll('#lst tr.ir').length, tables: document.querySelectorAll('#lst table').length }));
  ok(r.rows > 40 && r.tables === 1, 'suite chargée dans le même tableau (' + JSON.stringify(r) + ')');
  // menu Exporter
  ok(await p.evaluate(() => { const d = document.querySelector('details.mnu'); return d && !d.open && d.querySelectorAll('.mnul button').length >= 3 }), 'menu « Exporter et imprimer » regroupe les sorties');
  await p.click('details.mnu > summary'); ok(await p.evaluate(() => document.querySelector('details.mnu').open), 'menu : ouverture');
  await p.click('.phd h2'); await p.waitForTimeout(100); ok(await p.evaluate(() => !document.querySelector('details.mnu').open), 'menu : fermeture en cliquant ailleurs');
  // filtres actifs + réinitialiser
  const dir = await p.evaluate(() => document.querySelector('#fd option:nth-child(2)').value);
  await p.selectOption('#fd', dir); await p.waitForTimeout(500);
  ok(await p.evaluate(() => document.getElementById('fd').classList.contains('on') && !!document.querySelector('[data-a="freset"]')), 'filtre actif mis en évidence + « Réinitialiser les filtres »');
  await p.click('[data-a="freset"]'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !document.getElementById('fd').value && !document.querySelector('[data-a="freset"]')), 'réinitialisation des filtres');
  // fiche en panneau latéral
  await p.evaluate(() => document.querySelector('#lst tr.ir td.icote').click()); await p.waitForTimeout(500);
  r = await p.evaluate(() => { const d = document.getElementById('dlg'), b = d.getBoundingClientRect(); return { open: d.open, lat: d.classList.contains('lat'), right: Math.round(innerWidth - b.right), w: Math.round(b.width), kv: !!d.querySelector('dl.kv'), fil: d.querySelectorAll('.fil [data-a="ffil"]').length, cp: !!d.querySelector('[data-a="cpcote"]') } });
  ok(r.open && r.lat && r.right < 30 && r.w < 520, 'fiche : panneau latéral à droite (' + JSON.stringify(r) + ')');
  ok(r.kv && r.fil === 3 && r.cp, 'fiche : libellé / valeur, fil d’Ariane cliquable, copie de la cote');
  await p.evaluate(() => document.querySelector('#dlg .fil [data-k="srv"]').click()); await p.waitForTimeout(500);
  r = await p.evaluate(() => ({ open: document.getElementById('dlg').open, lat: document.getElementById('dlg').classList.contains('lat'), fd: document.getElementById('fd').value, fv: document.getElementById('fv').value }));
  ok(!r.open && !r.lat && r.fd && r.fv, 'fil d’Ariane : filtre l’inventaire sur le service (' + JSON.stringify(r) + ')');
  // bascule Cartes, mémorisée
  await p.click('[data-a="ivue"][data-v="cartes"]'); await p.waitForTimeout(500);
  r = await p.evaluate(() => { const c = [...document.querySelectorAll('#lst > .card')].slice(0, 40).map(x => Math.round(x.getBoundingClientRect().top)), cnt = {}; c.forEach(y => cnt[y] = (cnt[y] || 0) + 1); return { cards: document.querySelectorAll('#lst .card').length, tb: !!document.querySelector('#lst table'), parLigne: Math.max(...Object.values(cnt)), mem: localStorage.getItem('arch_ivue') } });
  ok(!r.tb && r.cards > 0 && r.parLigne >= 2 && r.mem === 'cartes', 'vue Cartes : plusieurs cartes par ligne (groupes par année), choix mémorisé ' + JSON.stringify(r));
  await p.click('[data-a="ivue"][data-v="tab"]'); await p.waitForTimeout(300);
  // Équipe / Administration
  await nav(p, 'team'); await p.waitForTimeout(1200);
  t = await p.evaluate(() => document.getElementById('app').innerText);
  ok(/Équipe du service/.test(t) && /Niveaux d’accès/.test(t) && !/Santé du système/.test(t) && !/Journal des modifications/.test(t), 'Équipe : comptes et droits seulement');
  await nav(p, 'adm'); await p.waitForTimeout(1500);
  t = await p.evaluate(() => document.getElementById('app').innerText);
  ok(/Administration/.test(t) && /Santé du système/.test(t) && /Mode maintenance/.test(t) && /Journal des modifications/.test(t) && /Sauvegarde automatique de nuit/.test(t), 'Administration : santé, maintenance, sauvegardes, journal');
  r = await p.evaluate(() => { const n = document.querySelector('#app > .secnav'); return n ? { nb: n.querySelectorAll('button').length, wrap: getComputedStyle(n).flexWrap, h: Math.round(n.getBoundingClientRect().height) } : null });
  ok(r && r.wrap === 'nowrap' && r.h < 60, 'sommaire de section sur une seule ligne d’onglets ' + JSON.stringify(r));
  // Rapports : mois en français
  await nav(p, 'rap'); await p.waitForTimeout(700);
  r = await p.evaluate(() => ({ m: !!document.getElementById('rym_m'), y: !!document.getElementById('rym_y'), txt: (document.querySelector('#rym_m option:checked') || {}).textContent, native: !!document.querySelector('input[type=month]') }));
  ok(r.m && r.y && /^(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)$/.test(r.txt) && !r.native, 'rapport mensuel : mois en français (' + r.txt + ')');
  await p.selectOption('#rym_m', '03'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => rp.ym.endsWith('-03')), 'changement de mois pris en compte');
  // Prêts : retard en jours, « Annuler la sortie » discret, « Annuler » après un retour
  await nav(p, 'pret'); await p.waitForTimeout(900);
  r = await p.evaluate(() => ({ j: /En retard · J\+\d+/.test(document.getElementById('app').innerText), dg: !!document.querySelector('[data-a="canpret"].lnk') }));
  ok(r.j && r.dg, 'prêts : retard affiché en jours (J+n), annulation en lien discret');
  await p.evaluate(() => document.querySelector('#app [data-a="back"]').click()); await p.waitForTimeout(900);
  ok(await p.evaluate(() => { const t = document.getElementById('toast'); return t.style.display !== 'none' && !!t.querySelector('.tact') && /Retour enregistré/.test(t.textContent) }), 'retour enregistré : message avec bouton « Annuler »');
  // thème sombre sans violet
  await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark')); await p.waitForTimeout(100);
  r = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--fill2').trim());
  ok(r.toLowerCase() === '#25348a', 'thème sombre : dégradé aux couleurs NITA (' + r + ')');
  const E1 = h.errors.filter(e => /pageerror/.test(e)); ok(!E1.length, 'ordinateur : aucune erreur JavaScript ' + E1.slice(0, 2).join(' | '));
  await h.close();
  // ---------- téléphone ----------
  h = await launch({ root, mfa: 'aal2', mobile: true, viewport: { width: 390, height: 844 }, nDocs: 300 }); p = h.page; await reseau(p);
  await p.goto(h.origin + '/'); await pret(p);
  r = await p.evaluate(() => ['thm', 'scanb', 'sbout', 'cmdb', 'acct'].map(i => { const e = document.getElementById(i); return e ? getComputedStyle(e).display !== 'none' : null }));
  ok(r[0] === false && r[1] === false && r[2] === false && r[3] === true && r[4] === true, 'en-tête téléphone : recherche et compte seulement ' + JSON.stringify(r));
  await p.evaluate(() => document.getElementById('acct').click()); await p.waitForSelector('#dlg[open] .accq', { timeout: 6000 }).catch(() => { });
  r = await p.evaluate(() => [...document.querySelectorAll('#dlg .accq [data-q]')].map(b => b.dataset.q).join(','));
  ok(r === 'thm,scanb,sbout', 'Mon compte : thème, scanner et déconnexion regroupés');
  const th0 = await p.evaluate(() => document.documentElement.dataset.theme); await p.evaluate(() => document.querySelector('#dlg [data-q="thm"]').click()); await p.waitForTimeout(200);
  ok(th0 !== await p.evaluate(() => document.documentElement.dataset.theme), 'changement de thème depuis Mon compte');
  await p.evaluate(() => document.getElementById('dlg').close());
  await nav(p, 'inv'); await p.waitForTimeout(800);
  ok(await p.evaluate(() => !document.querySelector('#lst table') && document.querySelectorAll('#lst .card').length > 0 && getComputedStyle(document.querySelector('.ivs')).display === 'none'), 'téléphone : inventaire en cartes, pas de choix d’affichage');
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(200); await p.mouse.wheel(0, 900); await p.waitForTimeout(500);
  ok(await p.evaluate(() => document.body.classList.contains('fabh') && getComputedStyle(document.getElementById('fab')).opacity === '0'), 'bouton « + » effacé en défilant vers le bas');
  await p.mouse.wheel(0, -300); await p.waitForTimeout(500);
  ok(await p.evaluate(() => !document.body.classList.contains('fabh')), 'bouton « + » revenu en remontant');
  await p.evaluate(() => document.querySelector('#lst .card button[data-a="fiche"]').click()); await p.waitForTimeout(500);
  ok(await p.evaluate(() => document.getElementById('dlg').open && !document.getElementById('dlg').classList.contains('lat')), 'téléphone : fiche en panneau du bas (pas de panneau latéral)');
  const E2 = h.errors.filter(e => /pageerror/.test(e)); ok(!E2.length, 'téléphone : aucune erreur JavaScript ' + E2.slice(0, 2).join(' | '));
  await h.close();
  console.log(`\n${pass} réussis, ${fail} échec(s)`); process.exit(fail ? 1 : 0);
})();
