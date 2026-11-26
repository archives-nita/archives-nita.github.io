# Contrôles avant publication – Archives NITA

Ce dossier n'est **pas** publié sur le site : il sert uniquement à GitHub.

À chaque dépôt sur la branche principale, GitHub lance `controles.js` :

1. fichiers présents et complets (index.html, sw.js, manifest.json) ;
2. code JavaScript sans erreur de syntaxe ;
3. empreintes de la protection du navigateur (CSP) à jour ;
4. essais dans un vrai navigateur avec des données fictives : interface ordinateur et téléphone (36 contrôles),
   rôle Observateur en lecture seule (10 contrôles).

Tout est vert → l'application est publiée. Un seul échec → **rien n'est publié**, la version en ligne reste inchangée.
Résultat visible dans l'onglet **Actions** du dépôt.

Lancer les contrôles sur un ordinateur : `cd tests && npm install && npx playwright install chromium && node controles.js`
