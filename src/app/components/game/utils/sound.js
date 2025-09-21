export function playSound(src) {
  // Only play if user has interacted (fixes play() failed error)
  if (window.__soundUnlocked || document.visibilityState === "visible") {
    const audio = new window.Audio(src);
    audio.volume = 0.5;
    audio.play().catch(() => {});
  }
}
window.addEventListener("pointerdown", () => { window.__soundUnlocked = true; }, { once: true });