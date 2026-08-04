/*
 * Petit badge de profil pour les gens qui utilisent ce plugin. Il n'y a pas
 * de backend pour savoir automatiquement qui d'autre l'a installe, donc la
 * liste des IDs a afficher est geree a la main ci-dessous. Comme les badges
 * de profil sont un truc cote client, ce badge n'apparait que pour les
 * personnes qui ont AUSSI ce plugin installe - les autres ne voient rien.
 *
 * Pour ajouter quelqu'un: recupere son ID Discord (clic droit sur son nom,
 * mode developpeur active) et ajoute-le dans BOBY_USER_IDS ci-dessous.
 */

import { addProfileBadge, BadgePosition, BadgeUserArgs, removeProfileBadge } from "@api/Badges";

const BOBY_USER_IDS = new Set([
    "806442568564604968", // jahsohsani
]);

const ICON_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
    '<path d="M20 12.5c-4.5 1.5-8.5-2.5-7-7A8 8 0 1 0 20 12.5z" fill="#ffa94d"/>' +
    "</svg>";

const bobyBadge = {
    id: "boby-user-badge",
    description: "Utilise le plugin Boby",
    iconSrc: `data:image/svg+xml,${encodeURIComponent(ICON_SVG)}`,
    position: BadgePosition.START,
    shouldShow: (userInfo: BadgeUserArgs) => BOBY_USER_IDS.has(userInfo.userId),
};

export function mountBadge() {
    addProfileBadge(bobyBadge);
}

export function unmountBadge() {
    removeProfileBadge(bobyBadge);
}
