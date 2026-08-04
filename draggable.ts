/*
 * Rend un element flottant (position: fixed) deplacable a la souris, avec sa
 * position sauvegardee dans localStorage pour survivre aux redemarrages.
 * Un simple clic (sans deplacement notable) n'est pas traite comme un drag,
 * pour ne pas casser les boutons qui ont deja un comportement au clic.
 */

const DRAG_THRESHOLD_PX = 4;

export function makeDraggable(el: HTMLElement, storageKey: string) {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
        try {
            const { left, top } = JSON.parse(saved);
            applyPosition(el, left, top);
        } catch {
            // position sauvegardee invalide, on garde la position par defaut
        }
    }

    el.style.cursor = "grab";

    let dragging = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    let originLeft = 0;
    let originTop = 0;

    function onPointerDown(e: PointerEvent) {
        if (e.button !== 0) return;
        dragging = true;
        moved = false;
        startX = e.clientX;
        startY = e.clientY;
        const rect = el.getBoundingClientRect();
        originLeft = rect.left;
        originTop = rect.top;
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
    }

    function onPointerMove(e: PointerEvent) {
        if (!dragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (!moved && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
            moved = true;
            el.style.cursor = "grabbing";
        }
        if (!moved) return;

        const maxLeft = Math.max(0, window.innerWidth - el.offsetWidth);
        const maxTop = Math.max(0, window.innerHeight - el.offsetHeight);
        const left = Math.min(Math.max(0, originLeft + dx), maxLeft);
        const top = Math.min(Math.max(0, originTop + dy), maxTop);
        applyPosition(el, left, top);
    }

    function onPointerUp() {
        dragging = false;
        el.style.cursor = "grab";
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);

        if (moved) {
            const rect = el.getBoundingClientRect();
            localStorage.setItem(storageKey, JSON.stringify({ left: rect.left, top: rect.top }));
        }
    }

    // En phase de capture, pour intercepter le clic avant le handler du bouton
    // et l'annuler si ce qui vient de se passer etait un drag, pas un clic.
    function onClickCapture(e: MouseEvent) {
        if (moved) {
            e.stopImmediatePropagation();
            e.preventDefault();
            moved = false;
        }
    }

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("click", onClickCapture, true);

    return function cleanupDraggable() {
        el.removeEventListener("pointerdown", onPointerDown);
        el.removeEventListener("click", onClickCapture, true);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
    };
}

function applyPosition(el: HTMLElement, left: number, top: number) {
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.right = "auto";
    el.style.bottom = "auto";
    el.style.transform = "none";
}
