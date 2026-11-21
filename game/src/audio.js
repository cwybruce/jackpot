// A tiny WebAudio synth: engine hum, police siren, mission beeps. No audio files,
// no network — every sound is an oscillator built here. Silent when audio is off.
export function createAudio() {
  let context = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;

  function ensure() {
    if (context) return true;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      context = new Ctor();
      return true;
    } catch {
      return false;
    }
  }

  function beep(freq, seconds, volume) {
    if (!ensure()) return;
    try {
      if (context.state === 'suspended') void context.resume();
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + seconds);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start();
      osc.stop(context.currentTime + seconds);
    } catch {
      // Sound is garnish: a failure here never stops the game.
    }
  }

  return {
    unlock() {
      ensure();
    },
    mission() {
      beep(660, 0.12, 0.08);
      setTimeout(() => beep(880, 0.18, 0.08), 110);
    },
    complete() {
      [523, 659, 784, 1047].forEach((freq, index) => setTimeout(() => beep(freq, 0.22, 0.09), index * 130));
    },
    busted() {
      beep(220, 0.5, 0.09);
    },
    engine(speed01, driving) {
      if (!ensure()) return;
      try {
        if (context.state === 'suspended') void context.resume();
        if (!driving) {
          if (engineGain) engineGain.gain.value = 0;
          return;
        }
        if (!engineOsc) {
          engineOsc = context.createOscillator();
          engineGain = context.createGain();
          engineOsc.type = 'sawtooth';
          engineGain.gain.value = 0.02;
          engineOsc.connect(engineGain);
          engineGain.connect(context.destination);
          engineOsc.start();
        }
        engineOsc.frequency.value = 55 + speed01 * 130;
        engineGain.gain.value = 0.015 + speed01 * 0.02;
      } catch {
        // Never let audio break the frame.
      }
    },
    siren(wanted, now) {
      if (!ensure()) return;
      try {
        if (wanted <= 0) {
          if (sirenGain) sirenGain.gain.value = 0;
          return;
        }
        if (!sirenOsc) {
          sirenOsc = context.createOscillator();
          sirenGain = context.createGain();
          sirenOsc.type = 'triangle';
          sirenGain.gain.value = 0.018;
          sirenOsc.connect(sirenGain);
          sirenGain.connect(context.destination);
          sirenOsc.start();
        }
        if (now - sirenTimer > 0.45) {
          sirenTimer = now;
          sirenOsc.frequency.value = sirenOsc.frequency.value > 800 ? 660 : 940;
        }
      } catch {
        // Never let audio break the frame.
      }
    },
  };
}
