/*
 * Plugin perso, pas destine a l'upstream Equicord.
 * Affiche des effets visuels rigolos dans le client quand certains mots-cles
 * apparaissent dans un message.
 *
 * Pour ajouter un nouvel easter egg, ajoute une entree dans le tableau `easterEggs`
 * plus bas avec ton propre regex `match` et une fonction `trigger`.
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import type { Message } from "@vencord/discord-types";

import { startAtariBreakout, stopAtariBreakout } from "./breakout";
import { mountChatPanel, unmountChatPanel } from "./chatPanel";

const Native = VencordNative.pluginHelpers.Boby as PluginNative<typeof import("./native")>;

interface EasterEgg {
    name: string;
    match: RegExp;
    trigger: (message: Message) => void;
}

const STYLE_ID = "boby-easter-eggs-style";

function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
        .boby-orbit-stage {
            position: fixed;
            top: 24px;
            right: 24px;
            width: 160px;
            height: 160px;
            pointer-events: none;
            z-index: 2147483645;
        }
        .boby-orbit-sun {
            position: absolute;
            left: 40px;
            top: 80px;
            width: 50px;
            height: 50px;
            margin: -25px 0 0 -25px;
            border-radius: 50%;
            overflow: hidden;
            box-shadow: 0 0 25px 8px rgba(255,180,60,0.85), 0 0 55px 20px rgba(255,140,0,0.5);
        }
        .boby-orbit-sun img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .boby-orbit-earth {
            position: absolute;
            left: 110px;
            top: 80px;
            width: 22px;
            height: 22px;
            margin: -11px 0 0 -11px;
            border-radius: 50%;
            background: radial-gradient(circle at 35% 35%, #6ec6ff, #1b5fa8 60%, #0b2f56);
            box-shadow: 0 0 10px rgba(60,140,255,0.6);
        }
        .boby-orbit-moon-pivot {
            position: absolute;
            left: 110px;
            top: 80px;
            width: 0;
            height: 0;
        }
        .boby-orbit-moon {
            position: absolute;
            left: 20px;
            top: 0;
            width: 10px;
            height: 10px;
            margin: -5px 0 0 -5px;
            border-radius: 50%;
            background: radial-gradient(circle at 35% 35%, #f4f4f4, #b5b5b5 70%, #7a7a7a);
            box-shadow: 0 0 6px rgba(255,255,255,0.5);
        }
        .boby-orbit-close {
            position: absolute;
            top: -6px;
            right: -6px;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border: none;
            background: rgba(20, 20, 25, 0.8);
            color: #fff;
            font-size: 11px;
            line-height: 20px;
            text-align: center;
            cursor: pointer;
            pointer-events: auto;
        }
    `;
    document.head.appendChild(style);
}

let pdpUrlPromise: Promise<string> | null = null;

function getPdpUrl() {
    return pdpUrlPromise ??= Native.readAsset("boby-pdp.gif").then(
        buf => URL.createObjectURL(new Blob([new Uint8Array(buf)], { type: "image/gif" }))
    );
}

// "made in heaven": Boby-soleil fixe, la Terre fixe a distance, et la Lune qui
// orbite la Terre en accelerant sans arret (reference a l'acceleration du temps
// du Stand Made in Heaven). Le declencheur est idempotent (redire la phrase
// pendant que c'est deja actif ne fait rien) - seule la croix ferme l'effet.
// Un declencheur qui "toggle" (ouvre/ferme en alternance) est fragile: Discord
// redispatche parfois plusieurs MESSAGE_CREATE pour un seul message affiche
// (echo local, backfill, reponses de bots qui repetent la phrase...), et un
// toggle finit par se refermer tout seul selon la parite du nombre de matchs.
let orbitSession: { rafId: number; container: HTMLElement; } | null = null;

function stopMadeHeaven() {
    if (!orbitSession) return;
    cancelAnimationFrame(orbitSession.rafId);
    orbitSession.container.remove();
    orbitSession = null;
}

async function startMadeHeaven() {
    if (orbitSession) return;

    ensureStyles();
    const pdpUrl = await getPdpUrl();
    if (orbitSession) return; // deja relance entre-temps (double trigger)

    const container = document.createElement("div");
    container.className = "boby-orbit-stage";
    container.innerHTML =
        `<div class="boby-orbit-sun"><img src="${pdpUrl}" /></div>` +
        "<div class=\"boby-orbit-earth\"></div>" +
        "<div class=\"boby-orbit-moon-pivot\"><div class=\"boby-orbit-moon\"></div></div>" +
        "<button class=\"boby-orbit-close\" aria-label=\"Fermer\">✕</button>";
    document.body.appendChild(container);

    container.querySelector(".boby-orbit-close")!.addEventListener("click", stopMadeHeaven);

    const moonPivot = container.querySelector<HTMLElement>(".boby-orbit-moon-pivot")!;
    const startTime = performance.now();
    let lastTime = startTime;
    let angleRad = 0;

    const tick = (now: number) => {
        const dtSec = (now - lastTime) / 1000;
        lastTime = now;
        const elapsedSec = (now - startTime) / 1000;

        const speedRadPerSec = Math.min(
            settings.store.orbitMaxSpeed,
            1 + elapsedSec * settings.store.orbitAcceleration
        );
        angleRad += speedRadPerSec * dtSec;
        moonPivot.style.transform = `rotate(${angleRad}rad)`;

        orbitSession = { rafId: requestAnimationFrame(tick), container };
    };

    orbitSession = { rafId: requestAnimationFrame(tick), container };
}

let lastHandledMessageId: string | null = null;

// Ajoute tes propres easter eggs ici.
const easterEggs: EasterEgg[] = [
    {
        name: "madeHeaven",
        match: /\bmade\s+in\s+heaven\b/i,
        trigger: () => void startMadeHeaven(),
    },
    {
        name: "atariBreakout",
        match: /\batari\s+breakout\b/i,
        trigger: message => void startAtariBreakout(message.channel_id),
    },
];

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Active les easter eggs visuels",
        default: true,
    },
    orbitAcceleration: {
        type: OptionType.NUMBER,
        description: "Acceleration de la lune autour de la terre (rad/s par seconde ecoulee) pour 'made in heaven'",
        default: 0.15,
    },
    orbitMaxSpeed: {
        type: OptionType.NUMBER,
        description: "Vitesse de rotation max de la lune (rad/s) pour 'made in heaven'",
        default: 24,
    },
    chatPanelEnabled: {
        type: OptionType.BOOLEAN,
        description: "Affiche le bouton de chat flottant pour parler a Boby n'importe quand",
        default: true,
    },
    chatApiUrl: {
        type: OptionType.STRING,
        description: "URL de l'API chat de Boby",
        default: "https://jah.qdnx.fr/api/chat",
    },
});

export default definePlugin({
    name: "Boby",
    description: "Des easter eggs caches dans le chat, et un panneau flottant pour parler a Boby. A toi de les trouver.",
    authors: [{ name: "jahsohsani", id: 0n }],
    settings,

    start() {
        if (settings.store.chatPanelEnabled) {
            mountChatPanel(() => settings.store.chatApiUrl);
        }
    },

    stop() {
        stopMadeHeaven();
        stopAtariBreakout();
        unmountChatPanel();
    },

    flux: {
        // Discord redispatche parfois MESSAGE_CREATE deux fois pour le meme message
        // (echo local optimiste + confirmation serveur), ce qui redeclenchait l'easter
        // egg deux fois de suite (ouvre puis referme aussitot). On ignore les doublons.
        // On ignore aussi les messages de bots: Boby repete souvent la phrase de
        // l'utilisateur dans ses reponses ("tu veux dire quoi par 'atari breakout' ?"),
        // ce qui remachait le regex et refermait le jeu juste apres l'avoir ouvert.
        MESSAGE_CREATE({ message }: { message: Message; }) {
            if (!settings.store.enabled) return;
            if (message?.author?.bot) return;
            if (!message?.content || !message?.id) return;
            if (message.id === lastHandledMessageId) return;

            for (const egg of easterEggs) {
                if (egg.match.test(message.content)) {
                    lastHandledMessageId = message.id;
                    egg.trigger(message);
                    break;
                }
            }
        },
    },
});
