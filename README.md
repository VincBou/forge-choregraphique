# Forge Chorée

Application web à page unique pour composer un projet de combat chorégraphié au sabre laser. Le lexique initial non exhaustif se trouve dans `src/data/mouvements.json`. Chaque mouvement possède un nom, une description et une catégorie (`main` ou `pieds`). Les champs de mouvement de l’attaquant sont séparés par catégorie ; la réaction du défenseur propose le lexique complet.

## Démarrer

Prérequis : Node.js 22.12 ou plus récent et npm 10 ou plus récent.

```sh
npm ci
npm run dev
```

`npm test` lance les tests, `npm run build` produit le site dans `dist/`, et `npm run security:audit` vérifie les dépendances.

Le brouillon est enregistré dans le stockage local du navigateur. Utilisez **Effacer le brouillon local** pour supprimer les données conservées sur cet appareil. Elles ne sont pas protégées par chiffrement et ne doivent pas contenir de secrets.

Avant une mise en ligne, appliquer les en-têtes d’hébergement décrits dans [SECURITY.md](./SECURITY.md), en particulier CSP, HTTPS et la protection contre l’intégration dans une iframe.
