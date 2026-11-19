# Pips Journal v2 — Design Spec

## Contexte

App JS vanilla (pas de framework). Deux fichiers principaux a modifier en parallele : `js/app.js` (dev local) et `pips-bundle.html` (production GitHub Pages). Storage dans `js/storage.js` (localStorage). Symbole unique : XAUUSD.

Workflow utilisateur : import initial de l'historique complet, puis mises a jour quotidiennes/hebdomadaires via CSV ou PDF.

## 1. Bouton "Vider" un compte

### Comportement
- Nouveau bouton dans le header-actions de la vue compte, entre "Renommer" et "Supprimer"
- Label : "Vider"
- Style : `btn-secondary` (meme style que Renommer)
- Au clic : `confirm('Vider tous les trades de "NomDuCompte" ? Cette action est irreversible.')`
- Si confirme : supprime tous les trades du compte (`account.trades = []`), garde le compte intact (nom, id)
- Toast : "Trades supprimes."
- Re-render la vue

### Storage
- Nouvelle fonction `clearTrades(accountId)` dans `storage.js` :
  - Charge le state, trouve le compte, vide `account.trades`, sauvegarde
  - Retourne le nombre de trades supprimes

### Fichiers impactes
- `js/storage.js` : ajouter `clearTrades`
- `js/app.js` : ajouter import, bouton HTML, event listener
- `pips-bundle.html` : meme changements inline

## 2. Stats highlights (5 cartes)

### Remplacement
Les 3 stat-cards actuelles (Total cumule, Ce mois-ci, Nb de trades) sont remplacees par 5 highlights.

### Les 5 highlights

| # | Label | Calcul | Sous-texte | Couleur |
|---|-------|--------|------------|---------|
| 1 | Total cumule | `sum(pips)` | "pips nets" | pos/neg |
| 2 | Win rate | `trades_positifs / total * 100` | "X gagnants / Y trades" | pos si >= 50%, neg sinon |
| 3 | Ratio R/R | `avg(pips des wins) / abs(avg(pips des losses))` | "gain moy / perte moy" | pos si >= 1, neg sinon |
| 4 | Meilleur trade | `max(pips)` | date du trade | pos (toujours vert) |
| 5 | Pire trade | `min(pips)` | date du trade | neg (toujours rouge) |

### Cas limites
- 0 trades : afficher "—" pour toutes les valeurs
- Que des wins (0 losses) : Ratio R/R = "—" (division par zero), Win rate = 100%
- Que des losses : Ratio R/R = "—", Win rate = 0%
- 1 seul trade : Win rate = 100% ou 0%, Ratio = "—", meilleur = pire = ce trade

### Ou
- Vue compte (`renderAccountView`) : stats du compte
- Dashboard (`renderDashboard`) : stats agregees tous comptes
- Vue Total (`renderTotalView`) : stats agregees tous comptes

### Implementation
- Nouvelle fonction `computeStats(trades)` retournant `{ totalPips, winRate, winCount, lossCount, rrRatio, bestTrade, worstTrade }`
- Remplacer le HTML des stat-cards dans les 3 vues
- La grille CSS `.stats-grid` passe de 3 a 5 colonnes (responsive : 2-3 sur mobile)

### Fichiers impactes
- `js/app.js` : nouvelle fonction, modifier 3 vues
- `pips-bundle.html` : meme changements

## 3. Notes simplifiees

### Changement
- Retirer le `<select>` d'emotion
- Garder uniquement le `<textarea>` pour note libre
- Retirer le bouton "Enregistrer"
- Sauvegarde automatique au `blur` (quand le champ perd le focus)

### Structure de la note
Le champ `note` passe de `{ emotion, text }` a juste `{ text }`.
Retrocompatibilite : si un ancien trade a `note.emotion`, on l'ignore simplement (pas de migration de donnees).

### UI du trade row
- Le bouton note affiche : "Note" si pas de note, un indicateur si note presente
- Au clic : toggle la zone de note (meme comportement qu'aujourd'hui)
- La zone contient uniquement le textarea
- Au blur du textarea : sauvegarde automatique via `saveNote(accId, key, { text })`

### Fichiers impactes
- `js/app.js` : simplifier `renderTradeList`, modifier le listener delegue
- `pips-bundle.html` : meme changements
- `js/storage.js` : aucun changement (saveNote reste generique)

## 4. Design agrandi

### Changements CSS

| Element | Avant | Apres |
|---------|-------|-------|
| Police de base (body) | 13px | 15px |
| Titres h1 | 20px | 26px |
| Stat card valeur | 24px | 32px |
| Stat card label/sub | 11-12px | 13-14px |
| Trade row hauteur | ~44px | ~56px |
| Trade row texte | 12-13px | 14-15px |
| Sidebar noms | 13px | 15px |
| Sidebar pips | 11px | 13px |
| Boutons | padding 8px 16px | padding 10px 20px |
| Cards padding | 16-20px | 24-28px |
| Section spacing | 16px | 24px |
| Filter tabs | 11px | 13px |

### Approche
- Modifier les variables CSS et les styles inline dans les deux fichiers
- Les styles sont dans le `<style>` du `index.html` et du `pips-bundle.html`
- Certains styles sont inline dans les templates JS (a ajuster aussi)

### Fichiers impactes
- `index.html` : CSS
- `pips-bundle.html` : CSS + templates JS inline
- `js/app.js` : templates JS inline

## Ordre d'implementation

1. `clearTrades` dans storage.js + bouton Vider (petit, isole)
2. `computeStats` + 5 highlights (remplace les 3 cartes)
3. Simplification des notes (retire emotion, auto-save)
4. Design agrandi (CSS global, en dernier pour eviter les conflits visuels pendant le dev)
