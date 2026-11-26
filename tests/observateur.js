// 4.84 : rôle « observateur » — voit tous les écrans métier, aucun bouton d'écriture, pas d'administration
const { launch } = require('./harness');
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  ok  ':'ECHEC ')+m)};
const H={'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'*'};
(async()=>{
  const root=process.argv[2];
  const A=await launch({root,role:'observateur',mfa:'aal2',mobile:false,viewport:{width:1440,height:900},nDocs:300});
  const p=A.page; await p.route(/\/functions\/v1\/reseau/,r=>r.fulfill({status:200,headers:H,body:'{"vpn":false}'}));
  await p.goto(A.origin+'/'); await p.waitForFunction(()=>window.SBME&&window.SBME(),null,{timeout:20000}).catch(()=>{}); await p.waitForTimeout(1800);
  // classes du corps
  const b=await p.evaluate(()=>{const c=document.body.classList;return{stf:c.contains('stf'),nw:c.contains('nw'),ro:c.contains('ro'),obs:c.contains('r-obs'),adm:c.contains('adm'),lect:c.contains('r-lect'),dem:c.contains('r-dem')}});
  ok(b.stf&&b.nw&&b.ro&&b.obs&&!b.adm&&!b.lect&&!b.dem,'profil : vue personnel + lecture seule, ni admin ni lecteur '+JSON.stringify(b));
  ok(await p.evaluate(()=>typeof P!=='undefined'&&P.fn==='Observateur'&&P.write===false&&P.admin===false&&P.arch===false),'permissions : Observateur, write=false, admin=false, arch=false');
  // navigation visible
  const nav=await p.evaluate(()=>[...document.querySelectorAll('nav button[data-v]')].filter(x=>x.offsetParent!==null).map(x=>x.dataset.v));
  ok(['dash','inv','vers','pret','cons','isad','rap','ged'].every(v=>nav.includes(v)),'écrans métier visibles : '+nav.join(','));
  ok(!nav.includes('team')&&!nav.includes('adm'),'écrans d\'administration masqués (Équipe, Administration)');
  // inventaire : voit les données, aucune action
  await p.evaluate(()=>document.querySelector('nav button[data-v="inv"]').click()); await p.waitForTimeout(900);
  const inv=await p.evaluate(()=>{const rows=document.querySelectorAll('#lst tr.ir, #lst .card').length;
    const act=[...document.querySelectorAll('#lst [data-a="lend"],#lst [data-a="edit"]')].filter(x=>x.offsetParent!==null).length;
    const tools=[...document.querySelectorAll('[data-a="imp"],details.mnu,#fab')].filter(x=>x.offsetParent!==null).length;
    const fab=(()=>{const f=document.getElementById('fab');return f&&getComputedStyle(f).display!=='none'})();
    return{rows,act,tools,fab}});
  ok(inv.rows>0,'inventaire : les entrées sont visibles ('+inv.rows+')');
  ok(inv.act===0,'inventaire : aucun bouton Prêter/Modifier sur les lignes');
  ok(inv.tools===0&&!inv.fab,'inventaire : ni Importer, ni Exporter, ni Ajouter, ni bouton +');
  // tableau de bord : pas d'actions rapides d'écriture
  await p.evaluate(()=>document.querySelector('nav button[data-v="dash"]').click()); await p.waitForTimeout(700);
  const dash=await p.evaluate(()=>[...document.querySelectorAll('[data-a="lend"],[data-a="dem"],[data-a="new"],[data-a="copie"]')].filter(x=>x.offsetParent!==null).length);
  ok(dash===0,'accueil : aucune action rapide d\'écriture (Sortie directe, Demander, Reproduction)');
  // prêts : pas de bouton d'écriture
  await p.evaluate(()=>document.querySelector('nav button[data-v="pret"]').click()); await p.waitForTimeout(800);
  const pret=await p.evaluate(()=>[...document.querySelectorAll('[data-a="back"],[data-a="canpret"],[data-rs]')].filter(x=>x.offsetParent!==null).length);
  ok(pret===0,'prêts : aucun bouton Enregistrer le retour / Relancer / Annuler');
  // label du rôle dans la liste des fonctions (écran Équipe réservé admin : on vérifie juste la constante)
  ok(!A.errors.some(e=>/pageerror/.test(e)),'aucune erreur JavaScript '+A.errors.filter(e=>/pageerror/.test(e)).slice(0,2).join(' | '));
  await A.close();
  console.log(`\n${pass} réussis, ${fail} échec(s)`); process.exit(fail?1:0);
})();
