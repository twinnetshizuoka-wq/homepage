const MAX_PAWS = 20;
const MOVE_THRESHOLD_SQ = 10 * 10;
const PAW_SIZE = 38;
const ANIMATION_MS = 700;

const PAW_SVG = `
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <ellipse cx="32" cy="42" rx="14" ry="12" fill="#C4A484"/>
  <ellipse cx="14" cy="22" rx="7" ry="9" fill="#B8956C"/>
  <ellipse cx="26" cy="14" rx="6.5" ry="8.5" fill="#B8956C"/>
  <ellipse cx="38" cy="14" rx="6.5" ry="8.5" fill="#B8956C"/>
  <ellipse cx="50" cy="22" rx="7" ry="9" fill="#B8956C"/>
</svg>
`.trim();

let initialized = false;
let pointerStart = null;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function pruneOldestPaw() {
  const paws = document.querySelectorAll('.paw-stamp');
  if (paws.length < MAX_PAWS) return;
  paws[0].remove();
}

function spawnPaw(clientX, clientY) {
  pruneOldestPaw();

  const half = PAW_SIZE / 2;
  const x = clamp(clientX, half, window.innerWidth - half);
  const y = clamp(clientY, half, window.innerHeight - half);
  const rotate = (Math.random() * 24 - 12).toFixed(1);

  const el = document.createElement('span');
  el.className = 'paw-stamp';
  el.setAttribute('aria-hidden', 'true');
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.setProperty('--paw-rotate', `${rotate}deg`);
  el.innerHTML = PAW_SVG;

  if (prefersReducedMotion()) {
    el.classList.add('paw-stamp--reduced');
  }

  document.body.appendChild(el);

  const remove = () => {
    el.removeEventListener('animationend', remove);
    el.remove();
  };

  el.addEventListener('animationend', remove);
  window.setTimeout(remove, ANIMATION_MS + 80);
}

function onPointerDown(event) {
  if (!event.isPrimary) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;

  pointerStart = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
  };
}

function onPointerUp(event) {
  if (!pointerStart || pointerStart.id !== event.pointerId) return;

  const dx = event.clientX - pointerStart.x;
  const dy = event.clientY - pointerStart.y;
  pointerStart = null;

  if (dx * dx + dy * dy > MOVE_THRESHOLD_SQ) return;

  spawnPaw(event.clientX, event.clientY);
}

function onPointerCancel(event) {
  if (pointerStart && pointerStart.id === event.pointerId) {
    pointerStart = null;
  }
}

/**
 * Site-wide cat paw stamp on click / tap.
 * Does not call preventDefault or stopPropagation.
 */
export function initPawClick() {
  if (initialized) return;
  initialized = true;

  document.addEventListener('pointerdown', onPointerDown, { passive: true });
  document.addEventListener('pointerup', onPointerUp, { passive: true });
  document.addEventListener('pointercancel', onPointerCancel, { passive: true });
}
