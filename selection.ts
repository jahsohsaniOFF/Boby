/*
 * Fait apparaitre un petit bouton "Demander a Boby" quand on selectionne du
 * texte n'importe ou a l'ecran (ex: pour verifier une info citee dans un
 * message). Un clic envoie directement le texte selectionne au panneau de
 * chat de Boby.
 */

import { askBobyAbout } from "./chatPanel";

const STYLE_ID = "boby-selection-style";
const MIN_SELECTION_LENGTH = 3;

function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
        .boby-ask-btn {
            position: fixed;
            z-index: 2147483646;
            background: #5865f2;
            color: #fff;
            border: none;
            border-radius: 999px;
            padding: 6px 12px;
            font-family: sans-serif;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 14px rgba(0,0,0,0.35);
            white-space: nowrap;
            animation: boby-ask-in 120ms ease;
        }
        .boby-ask-btn:hover { filter: brightness(1.1); }
        @keyframes boby-ask-in {
            from { opacity: 0; transform: scale(0.9); }
            to { opacity: 1; transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
            .boby-ask-btn { animation: none; }
        }
    `;
    document.head.appendChild(style);
}

let btnEl: HTMLElement | null = null;

function hideButton() {
    btnEl?.remove();
    btnEl = null;
}

function showButton(rect: DOMRect, text: string) {
    hideButton();
    ensureStyles();

    const btn = document.createElement("button");
    btn.className = "boby-ask-btn";
    btn.textContent = "💬 Demander à Boby";
    btn.style.visibility = "hidden";
    btn.style.left = "0px";
    btn.style.top = "0px";

    // Empeche le mousedown sur le bouton d'effacer la selection avant le clic.
    btn.addEventListener("mousedown", e => e.preventDefault());
    btn.addEventListener("click", () => {
        askBobyAbout(text);
        window.getSelection()?.removeAllRanges();
        hideButton();
    });

    document.body.appendChild(btn);
    btnEl = btn;

    // Mesure la taille reelle du bouton pour le garder dans l'ecran: sans ca,
    // un decalage fixe pouvait le placer au-dessus du bord haut de la fenetre
    // (donc invisible) quand la selection est proche du haut de l'ecran.
    const margin = 8;
    const { width: btnWidth, height: btnHeight } = btn.getBoundingClientRect();

    let left = rect.left + rect.width / 2 - btnWidth / 2;
    left = Math.min(Math.max(margin, left), window.innerWidth - btnWidth - margin);

    let top = rect.top - margin - btnHeight;
    if (top < margin) top = rect.bottom + margin;

    btn.style.left = `${left}px`;
    btn.style.top = `${top}px`;
    btn.style.visibility = "visible";
}

function onMouseUp() {
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? "";

    if (!selection || selection.rangeCount === 0 || text.length < MIN_SELECTION_LENGTH) {
        hideButton();
        return;
    }

    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
        hideButton();
        return;
    }

    showButton(rect, text);
}

function onSelectionChange() {
    const text = window.getSelection()?.toString().trim() ?? "";
    if (!text) hideButton();
}

function onMouseDownOutside(e: MouseEvent) {
    if (btnEl && !btnEl.contains(e.target as Node)) hideButton();
}

let listening = false;

export function mountSelectionHelper() {
    if (listening) return;
    listening = true;
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("mousedown", onMouseDownOutside);
}

export function unmountSelectionHelper() {
    if (!listening) return;
    listening = false;
    document.removeEventListener("mouseup", onMouseUp);
    document.removeEventListener("selectionchange", onSelectionChange);
    document.removeEventListener("mousedown", onMouseDownOutside);
    hideButton();
}
