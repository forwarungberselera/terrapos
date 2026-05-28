/**
 * Order Notification Sound
 * Plays a "ding-dong" notification sound using Web Audio API
 * No external file needed - generates sound programmatically
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

/**
 * Play a pleasant notification chime (2-tone ding-dong)
 */
export function playOrderNotificationSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Resume context if suspended (browser autoplay policy)
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;

  // First tone (higher) - "ding"
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(880, now); // A5
  gain1.gain.setValueAtTime(0.3, now);
  gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.3);

  // Second tone (slightly lower) - "dong"
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(659.25, now + 0.15); // E5
  gain2.gain.setValueAtTime(0, now);
  gain2.gain.setValueAtTime(0.3, now + 0.15);
  gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now + 0.15);
  osc2.stop(now + 0.5);

  // Third tone (resolve) - pleasant ending
  const osc3 = ctx.createOscillator();
  const gain3 = ctx.createGain();
  osc3.type = "sine";
  osc3.frequency.setValueAtTime(1108.73, now + 0.3); // C#6
  gain3.gain.setValueAtTime(0, now);
  gain3.gain.setValueAtTime(0.2, now + 0.3);
  gain3.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
  osc3.connect(gain3);
  gain3.connect(ctx.destination);
  osc3.start(now + 0.3);
  osc3.stop(now + 0.7);
}

/**
 * Play a repeat notification (for persistent alert)
 * Plays 3 times with interval
 */
export function playOrderNotificationRepeat(times = 2) {
  playOrderNotificationSound();
  let count = 1;
  const interval = setInterval(() => {
    if (count >= times) {
      clearInterval(interval);
      return;
    }
    playOrderNotificationSound();
    count++;
  }, 800);
}
