# Sécurité de Forge Chorée

La V0 est une application statique sans compte, API, authentification ni serveur applicatif. Le brouillon, notamment les licences et coordonnées d’identité saisies, reste dans `localStorage`, accessible aux scripts exécutés sur la même origine et à toute personne ayant accès au profil du navigateur. Le stockage n’est pas chiffré ; évitez les informations confidentielles.

## Mesures de développement

- Les saisies, mouvements et données locales sont affichés comme du texte. Ne pas ajouter `dangerouslySetInnerHTML`, `innerHTML`, `eval` ou une interprétation HTML des données.
- Les champs courts sont limités à 100 caractères, les durées à 30, les détails à 500 et les informations générales multiligne à 5 000. Seul le champ d’informations générales accepte les retours à la ligne. Toute donnée relue depuis `localStorage` est validée avant usage.
- L’import lit uniquement du JSON d’au plus 10 Mio, exige l’enveloppe `forge-choregraphique` version 1 et valide toutes les limites, les identifiants et la chronologie avant de demander confirmation. Les données importées sont copiées champ par champ ; les propriétés inconnues et versions non prises en charge sont rejetées. Un import ne fusionne ni n’exécute jamais le contenu du fichier. Les textes importés sont affichés en texte brut. L’export JSON applique la même limite de taille.
- La génération PDF construit sa définition à partir de valeurs textuelles et n’accepte aucune ressource distante issue du projet. Le format et l’orientation proviennent d’un choix fixe dans l’interface.
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
