# Sécurité de Forge Chorée

La V0 est une application statique sans compte, API, authentification ni serveur applicatif. Elle n’enregistre aucun secret. Le brouillon reste dans `localStorage`, qui est accessible aux scripts exécutés sur la même origine et lisible par une personne ayant accès au profil du navigateur. Ne saisissez donc pas d’informations sensibles.

## Mesures de développement

- Les saisies, mouvements et données locales sont affichés comme du texte. Ne pas ajouter `dangerouslySetInnerHTML`, `innerHTML`, `eval` ou une interprétation HTML des données.
- Les champs sont limités à 100 caractères (noms et mouvements de main/pieds) ou 500 caractères (détails), sans retours à la ligne. Toute donnée relue depuis `localStorage` est validée avant usage.
- Le JSON du lexique est validé au chargement. Les erreurs de stockage sont interceptées et signalées sans afficher de contenu du brouillon.
- Les dépendances sont verrouillées dans `package-lock.json`. Lancer `npm run security:audit` pour rechercher les avis de vulnérabilité npm avant une livraison.
- Le build ajoute une politique CSP de production. Elle limite les scripts, styles, polices, connexions et images à la même origine et bloque les objets intégrés.

## Hébergement

Servir le site en HTTPS et configurer des en-têtes HTTP au niveau de l’hébergeur statique :

```text
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

La directive `frame-ancestors` doit être envoyée comme en-tête HTTP ; les navigateurs l’ignorent dans une CSP définie par balise `meta`. Revoir ces règles si des ressources externes sont ajoutées. Cette base tient compte des catégories applicables de l’[OWASP Top 10:2025](https://top10.owasp.org/2025/en/), sans prétendre couvrir les risques liés à l’authentification ou au serveur, absents de la V0.
