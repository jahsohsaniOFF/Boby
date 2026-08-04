/*
 * Petit badge fixe qui montre en temps reel si le compte Discord du bot Boby
 * est en ligne, sans avoir a aller chercher dans la liste des membres.
 */

import { PresenceStore } from "@webpack/common";

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
            left: 12px;
            bottom: 12px;
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
            pointer-events: none;
            backdrop-filter: blur(4px);
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

let badgeEl: HTMLElement | null = null;
let listener: (() => void) | null = null;
let getUserId: () => string = () => "";

function updateBadge() {
    if (!badgeEl) return;

    const userId = getUserId().trim();
    if (!userId) {
        badgeEl.style.display = "none";
        return;
    }
    badgeEl.style.display = "flex";

    const status = PresenceStore.getStatus(userId) || "offline";
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

    ensureStyles();

    const badge = document.createElement("div");
    badge.className = "boby-status-badge";
    badge.innerHTML = '<span class="boby-status-dot"></span><span class="boby-status-label"></span>';
    document.body.appendChild(badge);
    badgeEl = badge;

    updateBadge();
    listener = updateBadge;
    PresenceStore.addChangeListener(listener);
}

export function unmountBotStatus() {
    if (listener) {
        PresenceStore.removeChangeListener(listener);
        listener = null;
    }
    badgeEl?.remove();
    badgeEl = null;
}
