/*
 * Plugin perso: lit les assets locaux (image) depuis le depot Equicord ou le
 * plugin est installe. Ce code tourne cote Node (contexte natif Equicord),
 * pas dans le renderer sandboxe, donc l'acces disque direct est possible ici.
 *
 * __dirname ici pointe vers le dossier du bundle natif compile (dist/desktop
 * ou dist/equibop), pas vers le dossier source du plugin - donc on remonte a
 * la racine du depot Equicord (meme technique que userpluginInstaller.dev)
 * puis on redescend vers src/userplugins. Ca marche quel que soit l'endroit
 * ou le depot a ete clone.
 *
 * On ne suppose pas que le dossier du plugin s'appelle "bobyEasterEggs": le
 * panneau UserPlugins d'Equicord clone les depots sous le nom du repo GitHub
 * (ex: "Boby"), pas sous un nom fixe. On cherche donc l'asset dans tous les
 * sous-dossiers de src/userplugins au lieu de deviner un nom de dossier.
 */

import { readdir, readFile } from "fs/promises";
import { basename, join } from "path";

// dist/desktop et dist/equibop sont 2 niveaux sous la racine du depot, les
// autres layouts (ex: build web) sont 1 niveau sous - meme convention que
// src/main/updater/git.ts et userpluginInstaller.dev/native.ts.
const upLevels = ["desktop", "equibop"].includes(basename(__dirname)) ? "../.." : "..";
const equicordRoot = join(__dirname, upLevels);
const USERPLUGINS_DIR = join(equicordRoot, "src", "userplugins");

export async function readAsset(_: unknown, name: string) {
    const entries = await readdir(USERPLUGINS_DIR, { withFileTypes: true }).catch(() => []);

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        try {
            return await readFile(join(USERPLUGINS_DIR, entry.name, "assets", name));
        } catch {
            continue;
        }
    }

    throw new Error(`Asset introuvable dans src/userplugins/*/assets/${name}`);
}
