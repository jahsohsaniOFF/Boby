/*
 * Panneau de chat flottant pour parler a Boby n'importe quand depuis le
 * client, via l'API HTTP locale du bot (src/webServer.js du projet du bot,
 * WEB_ENABLED=true, endpoint POST /api/chat).
 */

import { MessageStore, SelectedChannelStore } from "@webpack/common";

import { makeDraggable } from "./draggable";

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

const CONTEXT_MESSAGE_LIMIT = 12;

// Recupere les derniers messages du salon Discord actuellement affiche, pour
// que Boby ait le contexte de la conversation en cours quand on lui pose une
// question (ex: verifier une info citee juste au-dessus dans le salon).
function getRecentChannelContext(): string {
    const channelId = SelectedChannelStore.getChannelId();
    if (!channelId) return "";

    const messages = (MessageStore.getMessages(channelId) as any)?._array as
        | { author?: { username?: string; }; content?: string; }[]
        | undefined;
    if (!messages?.length) return "";

    return messages
        .slice(-CONTEXT_MESSAGE_LIMIT)
        .filter(m => m.content)
        .map(m => `${m.author?.username ?? "?"}: ${m.content}`)
        .join("\n");
}

let panelEl: HTMLElement | null = null;
let toggleEl: HTMLElement | null = null;
let cleanupDrag: (() => void) | null = null;
let history: ChatMessage[] = [];
let getApiUrl: () => string = () => "https://bobyprvcode.onrender.com/api/chat";
let getApiToken: () => string = () => "";
let lastContextChannelId: string | null = null;

// Si on change de salon Discord, l'ancien fil de discussion avec Boby (deja
// oriente sur un autre sujet) fausse ses reponses meme si le nouveau
// discordContext est correct. On repart de zero des qu'on change de salon.
function resetHistoryIfChannelChanged(messagesEl: HTMLElement) {
    const channelId = SelectedChannelStore.getChannelId();
    if (!channelId) return;

    if (lastContextChannelId !== null && channelId !== lastContextChannelId && history.length) {
        history = [];
        messagesEl.innerHTML = "";
    }
    lastContextChannelId = channelId;
}

const STYLE_ID = "boby-chat-panel-style";

function ensureChatStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
        .boby-chat-toggle {
            position: fixed;
            top: 50%;
            right: 0;
            transform: translateY(-50%);
            width: 34px;
            height: 64px;
            border: none;
            border-radius: 8px 0 0 8px;
            background: #5865f2;
            color: #fff;
            font-size: 18px;
            cursor: pointer;
            z-index: 2147483644;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .boby-chat-toggle {
            transition: filter 150ms ease, box-shadow 150ms ease;
        }
        .boby-chat-toggle:hover {
            filter: brightness(1.12);
            box-shadow: 0 2px 12px rgba(0,0,0,0.35);
        }
        .boby-chat-toggle:active {
            filter: brightness(0.92);
        }
        .boby-chat-panel {
            position: fixed;
            top: 0;
            right: 0;
            bottom: 0;
            width: 320px;
            background: #1e1f22;
            border-left: 1px solid rgba(255,255,255,0.08);
            box-shadow: -6px 0 24px rgba(0,0,0,0.4);
            z-index: 2147483644;
            display: flex;
            flex-direction: column;
            font-family: sans-serif;
            transform: translateX(0);
            opacity: 1;
            transition: transform 200ms ease, opacity 200ms ease;
        }
        .boby-chat-panel.boby-panel-enter {
            transform: translateX(100%);
            opacity: 0;
        }
        .boby-chat-panel.boby-panel-closing {
            transform: translateX(100%);
            opacity: 0;
        }
        .boby-chat-header {
            padding: 12px 14px;
            font-weight: 600;
            color: #fff;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .boby-chat-close {
            background: none;
            border: none;
            color: #ccc;
            cursor: pointer;
            font-size: 16px;
        }
        .boby-chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 10px;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .boby-chat-msg {
            max-width: 85%;
            padding: 8px 10px;
            border-radius: 10px;
            font-size: 13px;
            line-height: 1.4;
            white-space: pre-wrap;
            word-break: break-word;
            animation: boby-msg-in 180ms ease;
        }
        @keyframes boby-msg-in {
            from { opacity: 0; transform: translateY(6px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .boby-chat-msg.user {
            align-self: flex-end;
            background: #5865f2;
            color: #fff;
        }
        .boby-chat-msg.assistant {
            align-self: flex-start;
            background: #2b2d31;
            color: #dcddde;
        }
        .boby-chat-msg.pending {
            opacity: 0.6;
        }
        .boby-typing-dots {
            display: inline-flex;
            gap: 3px;
            align-items: center;
            height: 14px;
        }
        .boby-typing-dots span {
            width: 5px;
            height: 5px;
            border-radius: 50%;
            background: currentColor;
            animation: boby-typing-bounce 1.1s infinite ease-in-out;
        }
        .boby-typing-dots span:nth-child(2) { animation-delay: 0.15s; }
        .boby-typing-dots span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes boby-typing-bounce {
            0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
            30% { transform: translateY(-4px); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
            .boby-chat-panel { transition: none; }
            .boby-chat-msg { animation: none; }
            .boby-typing-dots span { animation: none; }
            .boby-chat-toggle { transition: none; }
        }
        .boby-chat-input-row {
            display: flex;
            gap: 6px;
            padding: 10px;
            border-top: 1px solid rgba(255,255,255,0.08);
        }
        .boby-chat-input {
            flex: 1;
            resize: none;
            border-radius: 6px;
            border: none;
            padding: 8px;
            background: #2b2d31;
            color: #fff;
            font-family: inherit;
            font-size: 13px;
            max-height: 90px;
        }
        .boby-chat-send {
            border: none;
            border-radius: 6px;
            background: #5865f2;
            color: #fff;
            padding: 0 14px;
            cursor: pointer;
        }
    `;
    document.head.appendChild(style);
}

function appendMessage(container: HTMLElement, role: "user" | "assistant", content: string, pending = false) {
    const el = document.createElement("div");
    el.className = `boby-chat-msg ${role}${pending ? " pending" : ""}`;
    if (pending) {
        el.innerHTML = "<span class=\"boby-typing-dots\"><span></span><span></span><span></span></span>";
    } else {
        el.textContent = content;
    }
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
    return el;
}

function resolvePendingMessage(el: HTMLElement, text: string) {
    el.textContent = text; // remplace aussi les points de "typing" (innerHTML) par du texte simple
    el.classList.remove("pending");
}

async function sendMessage(messagesEl: HTMLElement, text: string) {
    resetHistoryIfChannelChanged(messagesEl);
    appendMessage(messagesEl, "user", text);
    const historyBeforeReply = history.slice();
    history.push({ role: "user", content: text });

    const pendingEl = appendMessage(messagesEl, "assistant", "", true);

    try {
        const token = getApiToken();
        const res = await fetch(getApiUrl(), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
                message: text,
                history: historyBeforeReply,
                discordContext: getRecentChannelContext(),
            }),
        });
        const data = await res.json();
        const reply = res.ok ? (data.reply ?? "J'ai rien a dire, essaie de reformuler.") : (data.error ?? "J'ai buggue, ressaie.");
        resolvePendingMessage(pendingEl, reply);
        if (res.ok) history.push({ role: "assistant", content: reply });
    } catch {
        resolvePendingMessage(pendingEl, "Boby dort, son serveur ne repond pas.");
    } finally {
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }
}

const PANEL_TRANSITION_MS = 200;

function togglePanel() {
    if (panelEl) {
        const panel = panelEl;
        panelEl = null; // ferme tout de suite pour eviter un double-clic pendant l'animation
        panel.classList.add("boby-panel-closing");
        window.setTimeout(() => panel.remove(), PANEL_TRANSITION_MS);
        return;
    }

    ensureChatStyles();

    const panel = document.createElement("div");
    panel.className = "boby-chat-panel boby-panel-enter";
    panel.innerHTML =
        "<div class=\"boby-chat-header\"><span>Boby</span><button class=\"boby-chat-close\">✕</button></div>" +
        "<div class=\"boby-chat-messages\"></div>" +
        "<div class=\"boby-chat-input-row\">" +
        "<textarea class=\"boby-chat-input\" rows=\"1\" placeholder=\"Ecris a Boby...\"></textarea>" +
        "<button class=\"boby-chat-send\">Envoyer</button>" +
        "</div>";
    document.body.appendChild(panel);
    panelEl = panel;

    // double rAF: laisse le navigateur peindre l'etat "enter" avant de le retirer,
    // sinon la transition CSS ne se declenche pas (pas de changement detecte).
    requestAnimationFrame(() => {
        requestAnimationFrame(() => panel.classList.remove("boby-panel-enter"));
    });

    const messagesEl = panel.querySelector<HTMLElement>(".boby-chat-messages")!;
    const inputEl = panel.querySelector<HTMLTextAreaElement>(".boby-chat-input")!;
    const sendBtn = panel.querySelector<HTMLElement>(".boby-chat-send")!;
    const closeBtn = panel.querySelector<HTMLElement>(".boby-chat-close")!;

    for (const entry of history) {
        appendMessage(messagesEl, entry.role, entry.content);
    }

    closeBtn.addEventListener("click", togglePanel);

    const submit = () => {
        const text = inputEl.value.trim();
        if (!text) return;
        inputEl.value = "";
        void sendMessage(messagesEl, text);
    };

    sendBtn.addEventListener("click", submit);
    inputEl.addEventListener("keydown", e => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
        }
    });

    inputEl.focus();
}

// Ouvre le panneau (s'il est ferme) et pose direct une question a Boby a
// propos du texte donne - utilise par le bouton "Demander a Boby" qui
// apparait quand on selectionne du texte a l'ecran (voir selection.ts).
export function askBobyAbout(text: string) {
    if (!panelEl) togglePanel();
    const messagesEl = panelEl?.querySelector<HTMLElement>(".boby-chat-messages");
    if (!messagesEl) return;
    void sendMessage(messagesEl, `Verifie ou explique ca : "${text}"`);
}

export function mountChatPanel(apiUrlGetter: () => string, apiTokenGetter: () => string = () => "") {
    getApiUrl = apiUrlGetter;
    getApiToken = apiTokenGetter;
    if (toggleEl) return;

    ensureChatStyles();

    const toggle = document.createElement("button");
    toggle.className = "boby-chat-toggle";
    toggle.textContent = "💬";
    toggle.setAttribute("aria-label", "Parler a Boby");
    toggle.addEventListener("click", togglePanel);
    document.body.appendChild(toggle);
    toggleEl = toggle;
    cleanupDrag = makeDraggable(toggle, "boby-chat-toggle-pos");
}

export function unmountChatPanel() {
    cleanupDrag?.();
    cleanupDrag = null;
    toggleEl?.remove();
    toggleEl = null;
    panelEl?.remove();
    panelEl = null;
    history = [];
}
