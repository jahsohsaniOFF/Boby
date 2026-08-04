# BobyEasterEggs

Userplugin perso pour [Equicord](https://github.com/Equicord/Equicord) (fork de Vencord). Ajoute des easter eggs visuels declenches par mots-cles dans le chat, et un panneau de chat flottant.

## Fonctionnalites

- **`made in heaven`** : fait apparaitre un petit widget soleil/terre/lune ou la lune tourne de plus en plus vite autour de la terre. Redire la phrase ou cliquer la croix arrete l'effet.
- **`atari breakout`** : lance un mini-jeu Breakout en plein ecran ou les briques sont les images recuperees depuis la recherche du serveur Discord actuel (`has:image`). Souris pour la raquette, Echap ou la croix pour quitter.
- **Panneau de chat flottant** (optionnel, desactivable dans les reglages) : un bouton toujours visible sur le bord de l'ecran pour parler a un bot personnel via une API HTTP locale. **Ne marchera pas** sans ton propre serveur compatible tournant en local (voir `chatApiUrl` dans les reglages du plugin) - desactive `chatPanelEnabled` si tu n'as pas ce backend.

## Prerequis

Equicord doit etre installe **depuis les sources** (pas l'installeur classique), car les userplugins custom necessitent une build de dev.

## Installation

### Option A - via le panneau UserPlugins d'Equicord (recommande, permet les mises a jour en un clic)

1. Dans Discord (avec Equicord deja installe en mode dev), va dans **Reglages > UserPlugins**.
2. Colle l'URL de ce depot GitHub et installe.
3. Pour mettre a jour plus tard: le panneau UserPlugins te previent automatiquement quand une mise a jour est disponible, avec un bouton pour l'appliquer (git pull + rebuild automatique).

### Option B - manuelle

```sh
git clone <url-de-ce-depot> "<chemin-vers-ton-Equicord>/src/userplugins/bobyEasterEggs"
cd "<chemin-vers-ton-Equicord>"
pnpm build
pnpm inject
```

Pour mettre a jour manuellement: `git pull` dans le dossier du plugin, puis `pnpm build` + `pnpm inject` a nouveau depuis la racine d'Equicord.

## Avertissement

Ce plugin utilise `native.ts` (execution de code cote Node, hors sandbox du renderer) pour lire l'image locale du dossier `assets/`. N'installe des userplugins que depuis des sources en qui tu as confiance.
