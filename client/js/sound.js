/**
 * Procedural sound effects (Phase 5). Zero assets, zero dependencies: every
 * cue is synthesized on the fly with the WebAudio API, so the game ships no
 * binary files. Like net.js this is a browser-only leaf module — it touches
 * AudioContext but never the DOM or storage (main.js owns the mute
 * preference and calls play()/setMuted()). It never reads game state; main.js
 * triggers cues off the animation plan, so sound stays pure decoration.
 *
 * createSound() returns { play(name), setMuted(bool) }. The AudioContext is
 * created lazily on the first cue and resumed if the browser suspended it
 * (autoplay policy), so the first sound follows a real user gesture.
 */

/** @typedef {'reveal'|'move'|'manilha'|'win'|'lose'} Cue */

export function createSound() {
  /** @type {?AudioContext} */
  let ctx = null;
  let muted = false;

  function audio() {
    if (!ctx) {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  return {
    /** @param {Cue} name */
    play(name) {
      if (muted) return;
      const c = audio();
      if (!c) return;
      try {
        (CUES[name] ?? noop)(c, c.currentTime);
      } catch {
        // A blocked or dead AudioContext must never break the game loop.
      }
    },
    /** @param {boolean} value */
    setMuted(value) {
      muted = value;
    },
  };
}

const noop = () => {};

/**
 * One shaped oscillator note. `slideTo` glides the pitch (for whooshes/clashes),
 * and the gain envelope is a quick attack + exponential decay so notes never click.
 */
function note(ctx, { at, freq, dur, type = 'sine', gain = 0.18, slideTo }) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(amp).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

/** Each cue is a tiny score. Kept intentionally short and quiet. */
const CUES = {
  // Sword clash on reveal: two bright, slightly detuned blips close together.
  reveal(ctx, t) {
    note(ctx, { at: t, freq: 320, dur: 0.14, type: 'triangle', gain: 0.16, slideTo: 620 });
    note(ctx, { at: t + 0.04, freq: 480, dur: 0.16, type: 'square', gain: 0.09, slideTo: 900 });
  },
  // Pawn step: a soft low thud.
  move(ctx, t) {
    note(ctx, { at: t, freq: 220, dur: 0.16, type: 'sine', gain: 0.2, slideTo: 120 });
  },
  // Manilha flip: a small bright ping.
  manilha(ctx, t) {
    note(ctx, { at: t, freq: 880, dur: 0.18, type: 'triangle', gain: 0.12, slideTo: 1180 });
  },
  // Victory: a rising major arpeggio.
  win(ctx, t) {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => note(ctx, { at: t + i * 0.1, freq, dur: 0.22, type: 'triangle', gain: 0.16 }));
  },
  // Defeat: a downward pair.
  lose(ctx, t) {
    note(ctx, { at: t, freq: 392, dur: 0.24, type: 'sine', gain: 0.16 });
    note(ctx, { at: t + 0.16, freq: 261.63, dur: 0.34, type: 'sine', gain: 0.16 });
  },
};
