/*
 * Panneau de chat flottant pour parler a Boby n'importe quand depuis le
 * client, via l'API HTTP locale du bot (src/webServer.js du projet du bot,
 * WEB_ENABLED=true, endpoint POST /api/chat).
 */

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

let panelEl: HTMLElement | null = null;
let toggleEl: HTMLElement | null = null;
let history: ChatMessage[] = [];
let getApiUrl: () => string = () => "https://jah.qdnx.fr/api/chat";

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
            font-style: italic;
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
    el.textContent = content;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
    return el;
}

async function sendMessage(messagesEl: HTMLElement, text: string) {
    appendMessage(messagesEl, "user", text);
    const historyBeforeReply = history.slice();
    history.push({ role: "user", content: text });

    const pendingEl = appendMessage(messagesEl, "assistant", "...", true);

    try {
        const res = await fetch(getApiUrl(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text, history: historyBeforeReply }),
        });
        const data = await res.json();
        const reply = res.ok ? (data.reply ?? "J'ai rien a dire, essaie de reformuler.") : (data.error ?? "J'ai buggue, ressaie.");
        pendingEl.textContent = reply;
        pendingEl.classList.remove("pending");
        if (res.ok) history.push({ role: "assistant", content: reply });
    } catch {
        pendingEl.textContent = "Boby dort, son serveur ne repond pas.";
        pendingEl.classList.remove("pending");
    } finally {
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }
}

function togglePanel() {
    if (panelEl) {
        panelEl.remove();
        panelEl = null;
        return;
    }

    ensureChatStyles();

    const panel = document.createElement("div");
    panel.className = "boby-chat-panel";
    panel.innerHTML =
        "<div class=\"boby-chat-header\"><span>Boby</span><button class=\"boby-chat-close\">✕</button></div>" +
        "<div class=\"boby-chat-messages\"></div>" +
        "<div class=\"boby-chat-input-row\">" +
        "<textarea class=\"boby-chat-input\" rows=\"1\" placeholder=\"Ecris a Boby...\"></textarea>" +
        "<button class=\"boby-chat-send\">Envoyer</button>" +
        "</div>";
    document.body.appendChild(panel);
    panelEl = panel;

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

export function mountChatPanel(apiUrlGetter: () => string) {
    getApiUrl = apiUrlGetter;
    if (toggleEl) return;

    ensureChatStyles();

    const toggle = document.createElement("button");
    toggle.className = "boby-chat-toggle";
    toggle.textContent = "💬";
    toggle.setAttribute("aria-label", "Parler a Boby");
    toggle.addEventListener("click", togglePanel);
    document.body.appendChild(toggle);
    toggleEl = toggle;
}

export function unmountChatPanel() {
    toggleEl?.remove();
    toggleEl = null;
    panelEl?.remove();
    panelEl = null;
    history = [];
}
