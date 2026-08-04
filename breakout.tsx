/*
 * Mini jeu "Atari Breakout" (comme l'easter egg Google Images) ou les briques
 * sont des images recuperees depuis la recherche du serveur Discord actuel
 * (`has:image`, meme mecanisme que la recherche native de Discord).
 */

import { ChannelStore, RestAPI, showToast, Toasts } from "@webpack/common";

interface DiscordAttachment {
    url: string;
    proxy_url?: string;
    content_type?: string;
    filename?: string;
}

let activeGame: { cleanup: () => void; } | null = null;

async function fetchGuildImageUrls(guildId: string, limit: number): Promise<string[]> {
    const { body } = await RestAPI.get({
        url: `/guilds/${guildId}/messages/search`,
        query: { has: "image" },
    });

    const urls: string[] = [];
    for (const group of (body?.messages ?? []) as any[][]) {
        const hit = group.find(m => m?.hit) ?? group[group.length - 1];
        const attachments: DiscordAttachment[] = hit?.attachments ?? [];

        for (const attachment of attachments) {
            const isImage =
                attachment.content_type?.startsWith("image/") ||
                /\.(png|jpe?g|gif|webp)$/i.test(attachment.filename ?? "");
            if (isImage) urls.push(attachment.proxy_url ?? attachment.url);
        }

        if (urls.length >= limit) break;
    }

    return urls.slice(0, limit);
}

export function stopAtariBreakout() {
    activeGame?.cleanup();
}

// Idempotent: si le jeu tourne deja, redire "atari breakout" ne fait rien.
// Seuls Echap et la croix ferment le jeu - un declencheur qui bascule
// ouvert/ferme a chaque match est fragile face aux MESSAGE_CREATE dupliques
// ou repetes par des bots, et finissait par se refermer tout seul.
export async function startAtariBreakout(channelId: string) {
    if (activeGame) return;

    const channel = ChannelStore.getChannel(channelId);
    const guildId = channel?.guild_id;
    if (!guildId) {
        showToast("Ca marche que dans un serveur, pas ici.", Toasts.Type.FAILURE);
        return;
    }

    let imageUrls: string[];
    try {
        imageUrls = await fetchGuildImageUrls(guildId, 40);
    } catch (error) {
        console.error("[BobyEasterEggs]", error);
        showToast("J'ai pas reussi a fouiller le serveur, ressaie.", Toasts.Type.FAILURE);
        return;
    }

    if (imageUrls.length === 0) {
        showToast("Ce serveur a pas une seule image, je fais quoi moi ?", Toasts.Type.FAILURE);
        return;
    }

    if (activeGame) return; // deja relance entre-temps
    launchGame(imageUrls);
}

function launchGame(imageUrls: string[]) {
    const CANVAS_W = 720;
    const CANVAS_H = 480;

    const overlay = document.createElement("div");
    overlay.id = "boby-breakout-overlay";
    Object.assign(overlay.style, {
        position: "fixed",
        inset: "0",
        background: "rgba(0,0,0,0.78)",
        zIndex: "2147483647",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
    });

    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    Object.assign(canvas.style, {
        background: "#111",
        boxShadow: "0 0 40px rgba(0,0,0,0.8)",
        cursor: "none",
    });
    overlay.appendChild(canvas);

    const hint = document.createElement("div");
    hint.textContent = "Bouge la souris pour la raquette - Echap ou la croix pour quitter";
    Object.assign(hint.style, {
        color: "#ddd",
        fontFamily: "sans-serif",
        fontSize: "13px",
        marginTop: "10px",
    });
    overlay.appendChild(hint);

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Fermer Atari Breakout");
    Object.assign(closeBtn.style, {
        position: "absolute",
        top: "16px",
        right: "24px",
        width: "32px",
        height: "32px",
        borderRadius: "50%",
        border: "none",
        background: "rgba(255,255,255,0.15)",
        color: "#fff",
        fontSize: "16px",
        lineHeight: "32px",
        textAlign: "center",
        cursor: "pointer",
    });
    closeBtn.addEventListener("mouseenter", () => { closeBtn.style.background = "rgba(255,255,255,0.3)"; });
    closeBtn.addEventListener("mouseleave", () => { closeBtn.style.background = "rgba(255,255,255,0.15)"; });
    overlay.appendChild(closeBtn);

    document.body.appendChild(overlay);

    const ctx = canvas.getContext("2d")!;

    const cols = Math.min(8, imageUrls.length);
    const rows = Math.min(5, Math.ceil(imageUrls.length / cols));
    const brickW = CANVAS_W / cols;
    const brickH = 40;
    const brickPad = 2;
    // Marge au-dessus des briques pour laisser la balle rebondir contre le
    // "toit" avant de toucher la premiere rangee d'images.
    const brickTopOffset = 80;

    interface Brick { x: number; y: number; alive: boolean; img: HTMLImageElement; }
    const bricks: Brick[] = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const img = new Image();
            img.src = imageUrls[(r * cols + c) % imageUrls.length];
            bricks.push({ x: c * brickW, y: r * brickH + brickTopOffset, alive: true, img });
        }
    }

    const paddleW = 100;
    const paddleH = 12;
    const paddleY = CANVAS_H - paddleH - 10;
    let paddleX = CANVAS_W / 2 - paddleW / 2;

    const ballR = 7;
    let ballX = CANVAS_W / 2;
    let ballY = CANVAS_H - 60;
    let ballVX = 4;
    let ballVY = -4;

    const resetBall = () => {
        ballX = CANVAS_W / 2;
        ballY = CANVAS_H - 60;
        ballVX = 4;
        ballVY = -4;
    };

    function onMouseMove(e: MouseEvent) {
        const rect = canvas.getBoundingClientRect();
        paddleX = Math.max(0, Math.min(CANVAS_W - paddleW, e.clientX - rect.left - paddleW / 2));
    }
    canvas.addEventListener("mousemove", onMouseMove);

    function onKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape") cleanup();
    }
    window.addEventListener("keydown", onKeyDown);
    closeBtn.addEventListener("click", () => cleanup());

    // Petit bruit de casse genere en WebAudio (pas d'asset a charger), avec
    // une hauteur qui change a chaque brique cassee.
    const audioCtx = new AudioContext();
    function playBreakSound() {
        if (audioCtx.state === "suspended") void audioCtx.resume();

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "square";
        osc.frequency.value = 220 + Math.random() * 660;
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
    }

    let rafId = 0;
    let running = true;

    function cleanup() {
        if (!running) return;
        running = false;
        cancelAnimationFrame(rafId);
        canvas.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("keydown", onKeyDown);
        void audioCtx.close();
        overlay.remove();
        activeGame = null;
    }

    activeGame = { cleanup };

    function update() {
        ballX += ballVX;
        ballY += ballVY;

        if (ballX < ballR || ballX > CANVAS_W - ballR) ballVX *= -1;
        if (ballY < ballR) ballVY *= -1;

        if (
            ballVY > 0 &&
            ballY + ballR >= paddleY &&
            ballY + ballR <= paddleY + paddleH + 8 &&
            ballX >= paddleX &&
            ballX <= paddleX + paddleW
        ) {
            const hitPos = (ballX - paddleX) / paddleW;
            ballVX = (hitPos - 0.5) * 8;
            ballVY = -Math.abs(ballVY);
        }

        if (ballY > CANVAS_H + 40) resetBall();

        for (const brick of bricks) {
            if (!brick.alive) continue;
            if (
                ballX + ballR > brick.x &&
                ballX - ballR < brick.x + brickW &&
                ballY + ballR > brick.y &&
                ballY - ballR < brick.y + brickH
            ) {
                brick.alive = false;
                ballVY *= -1;
                playBreakSound();
                break;
            }
        }
    }

    function draw() {
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

        for (const brick of bricks) {
            if (!brick.alive) continue;
            if (brick.img.complete && brick.img.naturalWidth > 0) {
                ctx.drawImage(
                    brick.img,
                    brick.x + brickPad,
                    brick.y + brickPad,
                    brickW - brickPad * 2,
                    brickH - brickPad * 2
                );
            } else {
                ctx.fillStyle = "#333";
                ctx.fillRect(brick.x + brickPad, brick.y + brickPad, brickW - brickPad * 2, brickH - brickPad * 2);
            }
        }

        ctx.fillStyle = "#f5f5f5";
        ctx.fillRect(paddleX, paddleY, paddleW, paddleH);

        ctx.beginPath();
        ctx.arc(ballX, ballY, ballR, 0, Math.PI * 2);
        ctx.fillStyle = "#ffcc33";
        ctx.fill();

        if (bricks.every(b => !b.alive)) {
            ctx.fillStyle = "#fff";
            ctx.font = "32px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("GG !", CANVAS_W / 2, CANVAS_H / 2);
        }
    }

    function loop() {
        if (!running) return;
        update();
        draw();
        rafId = requestAnimationFrame(loop);
    }

    loop();
}
