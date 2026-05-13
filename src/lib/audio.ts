/**
 * Minimal audio + haptic helpers for the rest timer.
 *
 * - Uses Web Audio API directly (no audio file, no asset to load).
 * - Vibration uses navigator.vibrate (Android only; iOS Safari ignores it,
 *   which is fine — the beep still plays).
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

/** Short beep. Pass `pattern: "double"` for a two-tone completion sound. */
export function beep(pattern: "single" | "double" = "single"): void {
  const c = getCtx();
  if (!c) return;

  // Resume in case the context was suspended (browsers do this until user gesture).
  if (c.state === "suspended") void c.resume();

  const playTone = (startAt: number, freq: number, duration = 0.18) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    // Gentle attack/release to avoid clicks.
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.3, startAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    osc.connect(gain).connect(c.destination);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.02);
  };

  const t = c.currentTime;
  if (pattern === "double") {
    playTone(t, 880);
    playTone(t + 0.22, 1175);
  } else {
    playTone(t, 880);
  }
}

/** Vibrate (Android). Pass an array for a pattern. */
export function vibrate(pattern: number | number[] = 200): void {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Some browsers throw if called outside a user gesture; safe to ignore.
  }
}

/** Call this once during the first user click to "unlock" Web Audio on iOS. */
export function unlockAudio(): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
}
