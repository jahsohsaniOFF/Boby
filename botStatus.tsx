/*
 * Petit badge fixe qui montre en temps reel si le compte Discord du bot Boby
 * est en ligne, sans avoir a aller chercher dans la liste des membres.
 */

import { PresenceStore } from "@webpack/common";

import { makeDraggable } from "./draggable";

const STATUS_LABELS: Record<string, string> = {
    online: "En ligne",
    idle: "Inactif",
    dnd: "Ne pas deranger",
    offline: "Hors ligne",
    invisible: "Hors ligne",
};

const STATUS_COLORS: Record<string, string> = {
    online: "#23a55a",
    idle: "#f0b232",
    dnd: "#f23f43",
    offline: "#80848e",
    invisible: "#80848e",
};

const STYLE_ID = "boby-status-badge-style";

function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
        .boby-status-badge {
            position: fixed;
            right: 12px;
            bottom: 16px;
            z-index: 2147483643;
            display: flex;
            align-items: center;
            gap: 7px;
            padding: 6px 12px 6px 10px;
            border-radius: 999px;
            background: rgba(20, 18, 31, 0.85);
            border: 1px solid rgba(255, 255, 255, 0.08);
            font-family: sans-serif;
            font-size: 11.5px;
            color: #e8e4f3;
            pointer-events: auto;
            backdrop-filter: blur(4px);
            user-select: none;
        }
        .boby-status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            flex-shrink: 0;
            box-shadow: 0 0 5px currentColor;
        }
    `;
    document.head.appendChild(style);
}

// Filet de securite: si le reglage botStatusUserId n'est pas encore resolu
// (store pas encore hydrate au tout premier lancement, valeur videe par erreur,
// etc.), on retombe sur l'ID connu plutot que de masquer le badge entier -
// c'est ce qui rendait le badge invisible ET impossible a cliquer/deplacer
// (display: none n'a pas de boite de layout, donc pas de zone cliquable).
const FALLBACK_BOT_USER_ID = "1522215686569590915";

let badgeEl: HTMLElement | null = null;
let listener: (() => void) | null = null;
let cleanupDrag: (() => void) | null = null;
let getUserId: () => string = () => "";

function updateBadge() {
    if (!badgeEl) return;

    const userId = (getUserId() || "").trim() || FALLBACK_BOT_USER_ID;

    let status = "offline";
    try {
        status = PresenceStore.getStatus(userId) || "offline";
    } catch (error) {
        console.error("[Boby] Impossible de lire le statut du bot:", error);
    }

    const dot = badgeEl.querySelector<HTMLElement>(".boby-status-dot")!;
    const label = badgeEl.querySelector<HTMLElement>(".boby-status-label")!;
    const color = STATUS_COLORS[status] ?? STATUS_COLORS.offline;

    dot.style.background = color;
    dot.style.color = color;
    label.textContent = `Boby: ${STATUS_LABELS[status] ?? "Hors ligne"}`;
}

export function mountBotStatus(userIdGetter: () => string) {
    getUserId = userIdGetter;

    if (badgeEl) {
        updateBadge();
        return;
    }

    try {
        ensureStyles();

        const badge = document.createElement("div");
        badge.className = "boby-status-badge";
        badge.innerHTML = '<span class="boby-status-dot"></span><span class="boby-status-label"></span>';
        document.body.appendChild(badge);
        badgeEl = badge;
        cleanupDrag = makeDraggable(badge, "boby-status-badge-pos");

        updateBadge();
        listener = updateBadge;
        PresenceStore.addChangeListener(listener);
    } catch (error) {
        console.error("[Boby] Impossible d'afficher le badge de statut:", error);
    }
}

export function unmountBotStatus() {
    if (listener) {
        PresenceStore.removeChangeListener(listener);
        listener = null;
    }
    cleanupDrag?.();
    cleanupDrag = null;
    badgeEl?.remove();
    badgeEl = null;
}
