// Synthesised sound only (WebAudio oscillators, no audio files, no network).
// The context is created on the first user gesture, so autoplay rules never block it.
export function createAudio() {
  let ctx = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        ctx = null;
      }
    }
    if (ctx && ctx.state === 'suspended') void ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + dur);
    gain.gain.setValueAtTime(vol, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + dur);
  }

  function noise(dur, vol) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const gain = ac.createGain();
    gain.gain.value = vol;
    src.connect(gain).connect(ac.destination);
    src.start();
  }

  return {
    unlock() {
      ensure();
    },
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    shoot() {
      tone(720, 0.08, 'square', 0.05, 240);
    },
    hit() {
      noise(0.06, 0.08);
    },
    enemyDie() {
      tone(320, 0.18, 'sawtooth', 0.07, 60);
    },
    pickup() {
      tone(880, 0.09, 'sine', 0.06, 1320);
    },
    hurt() {
      tone(140, 0.22, 'sawtooth', 0.1, 70);
    },
    dash() {
      noise(0.12, 0.06);
    },
    ult() {
      // Lantern Nova: a rising chord plus a noise burst.
      tone(262, 0.4, 'triangle', 0.1, 1047);
      tone(392, 0.4, 'triangle', 0.08, 784);
      noise(0.3, 0.1);
    },
    waveHorn() {
      tone(196, 0.5, 'triangle', 0.09, 392);
      tone(294, 0.5, 'triangle', 0.06, 392);
    },
    upgrade() {
      tone(523, 0.12, 'sine', 0.08);
      setTimeout(() => tone(784, 0.16, 'sine', 0.08), 90);
    },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.09), i * 140));
    },
    lose() {
      [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.32, 'triangle', 0.09), i * 160));
    },
    startMusic() {
      if (musicTimer) return;
      const bass = [110, 110, 130.8, 98];
      musicTimer = setInterval(() => {
        if (muted) return;
        tone(bass[musicStep % bass.length], 0.5, 'triangle', 0.035);
        musicStep += 1;
      }, 500);
    },
    stopMusic() {
      if (musicTimer) {
        clearInterval(musicTimer);
        musicTimer = null;
      }
    },
  };
}
