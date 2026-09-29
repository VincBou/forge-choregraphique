# Forge Chorée

Application web à page unique pour écrire un projet chorégraphique de sabre laser (SL) dans le cadre de la pratique FFE. Chaque ligne associe un attaquant à un mouvement de main et/ou de pieds, un détail libre et, si besoin, un défenseur avec sa réaction. Les propositions d’autocomplétion aident à la saisie sans imposer les noms du lexique.

## Utiliser l’éditeur

- L’équipe commence avec « Combattant A » et « Combattant B ». Après validation d’un nouveau nom par Entrée ou en quittant le champ, ses occurrences exactes dans les rôles Attaquant et Défenseur sont mises à jour. Un nom existant laissé vide est restauré.
- Les mouvements `main` sont proposés dans le champ de main, les mouvements `pieds` dans celui de pieds. Les actions `combine` réunissent les deux et se choisissent dans le champ de main ; elles effacent le mouvement de pieds déjà saisi et masquent ce champ.
- Le défenseur est facultatif. Lorsqu’il est renseigné, les champs de réaction (« qui », mouvement et détail libre) apparaissent. Le bouton `+` ajoute une ligne.
- Les lignes sont regroupées dans des **Phrases d’armes** (au moins une). Le panneau de chaque phrase reste à gauche de ses lignes ; faites glisser leur numéro pour réordonner ou changer de phrase. Les boutons fléchés permettent aussi de déplacer les lignes au clavier.
- Chaque phrase commence à la fin de la précédente (la première commence à `0.0`). Saisissez sa fin ; les fins suivantes avancent si nécessaire pour garder une chronologie valide. Une nouvelle phrase reprend la fin précédente. Les phrases vides restent dans l’éditeur, mais ne figurent pas dans l’export.
- **Télécharger le projet** exporte un fichier `.txt` avec les marqueurs de début et de fin, puis les lignes numérotées par phrase (par exemple `1.2`). Une ligne commencée doit avoir un attaquant et au moins un mouvement de main ou de pieds pour être exportée.

## Lexique des mouvements et source FFE

Le lexique est dans [`src/data/mouvements.json`](./src/data/mouvements.json). Chaque entrée contient `nom` (autocomplétion), `description` et `categorie` (`main`, `pieds` ou `combine`). Cliquez sur un mouvement pour lire sa description ; elle disparaît lorsque le pointeur quitte sa ligne. La liste reste unique ; les icônes de main et de chaussure identifient les catégories, et une action combinée affiche les deux. Les SVG sont dans `public/resources/icons/`.

Les mouvements FFE ajoutés proviennent du document de la Fédération française d’escrime, *Sabre Laser — Livret 1, Cahier technique*, version 02.7.2, décembre 2025. Le fichier JSON sert d’aide à l’écriture et ne reprend pas exhaustivement le livret.

## Démarrer

Prérequis : Node.js 22.12+ et npm 10+.

```sh
npm ci
npm run dev
```

`npm test` lance Vitest ; `npm run build` vérifie TypeScript et crée `dist/` ; `npm run security:audit` contrôle les dépendances.

## Avec Docker

Avec Docker et le plugin Compose installés, lancez l’application compilée sur [http://localhost:8080](http://localhost:8080) :

```sh
docker compose up --build
```

Arrêtez le conteneur avec `Ctrl+C`, puis `docker compose down` si nécessaire.

Le brouillon, y compris les phrases et leurs lignes, est enregistré dans le stockage local du navigateur. Les anciens brouillons sont migrés automatiquement vers le format courant. **Effacer le brouillon local** le supprime de cet appareil. Ce stockage n’est pas chiffré : ne saisissez pas de secrets. Avant une mise en ligne, appliquez les en-têtes décrits dans [SECURITY.md](./SECURITY.md).
