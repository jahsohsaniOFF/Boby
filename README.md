# Boby

Userplugin perso pour [Equicord](https://github.com/Equicord/Equicord) (fork de Vencord).

un panneau de chat flottant pour parler a Boby n'importe quand.

Le panneau de chat (optionnel, desactivable dans les reglages du plugin) se connecte a un bot personnel via une API HTTP 

## Prerequis

Equicord doit etre installe **depuis les sources** (pas l'installeur classique), car les userplugins custom necessitent une build de dev.

## Installation

### Option A - via le panneau UserPlugins d'Equicord (recommande, permet les mises a jour en un clic)

1. Dans Discord (avec Equicord deja installe en mode dev), va dans **Reglages > UserPlugins**.
2. Colle l'URL de ce depot GitHub et installe.
3. Pour mettre a jour plus tard: le panneau UserPlugins te previent automatiquement quand une mise a jour est disponible, avec un bouton pour l'appliquer (git pull + rebuild automatique).

### Option B - manuelle

```sh
git clone <url-de-ce-depot> "<chemin-vers-ton-Equicord>/src/userplugins/boby"
cd "<chemin-vers-ton-Equicord>"
pnpm build
pnpm inject
```

Pour mettre a jour manuellement: `git pull` dans le dossier du plugin, puis `pnpm build` + `pnpm inject` a nouveau depuis la racine d'Equicord.

## Avertissement

Ce plugin utilise `native.ts` (execution de code cote Node, hors sandbox du renderer) pour lire une image locale. N'installe des userplugins que depuis des sources en qui tu as confiance.
