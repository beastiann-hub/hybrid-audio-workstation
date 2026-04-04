export function attachCore(engine) {
  // ── AudioContext (fatal if unavailable) ─────────────────────────────────
  if (!engine.context) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) throw new Error('Web Audio API not supported in this browser.');
    engine.context = new AudioCtx();
    console.log('AudioContext created, state:', engine.context.state);
  }
  if (!engine.audioContext) engine.audioContext = engine.context;
  if (!engine.audioCtx)     engine.audioCtx     = engine.context;

  // ── Master gain & input gain ─────────────────────────────────────────────
  if (!engine.masterGain) engine.masterGain = engine.context.createGain();
  engine.masterGain.gain.value = engine.masterGain.gain.value || 0.7;
  engine.masterGain.connect(engine.context.destination);

  if (!engine.inputGain) engine.inputGain = engine.context.createGain();
  engine.inputGain.gain.value = engine.inputGain.gain.value || 1.0;
  engine.inputGain.connect(engine.masterGain);

  // ── Effects chain ─────────────────────────────────────────────────────────
  if (!engine.effects) engine.effects = {};

  if (!engine.effects.reverb) {
    engine.effects.reverb = engine.context.createConvolver();
    // Impulse response is optional — missing IR just gives a dry signal through
    try {
      const sr  = engine.context.sampleRate;
      const len = sr * 2; // 2-second tail
      const impulse = engine.context.createBuffer(2, len, sr);
      for (let ch = 0; ch < 2; ch++) {
        const data = impulse.getChannelData(ch);
        for (let i = 0; i < len; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
        }
      }
      engine.effects.reverb.buffer = impulse;
    } catch (e) {
      console.warn('Reverb impulse response skipped:', e);
    }
  }

  if (!engine.effects.delay)      engine.effects.delay      = engine.context.createDelay(4.0);
  if (!engine.effects.filter)     engine.effects.filter     = engine.context.createBiquadFilter();
  if (!engine.effects.compressor) engine.effects.compressor = engine.context.createDynamicsCompressor();

  if (!engine.effects.reverbSend) engine.effects.reverbSend = engine.context.createGain();
  if (!engine.effects.delaySend)  engine.effects.delaySend  = engine.context.createGain();
  engine.effects.reverbSend.gain.value = engine.effects.reverbSend.gain.value || 0;
  engine.effects.delaySend.gain.value  = engine.effects.delaySend.gain.value  || 0;

  // Route: sends → effects → master
  engine.effects.reverbSend.connect(engine.effects.reverb);
  engine.effects.reverb.connect(engine.masterGain);
  engine.effects.delaySend.connect(engine.effects.delay);
  engine.effects.delay.connect(engine.masterGain);

  // ── Draw worker (optional — waveforms fall back to main thread) ──────────
  if (window.Worker && !engine.drawWorker) {
    try {
      engine.drawWorker = new Worker('draw-worker.js');
      engine._offscreenTransferred = new Set();
    } catch (e) {
      console.warn('Draw worker unavailable, waveforms run on main thread:', e);
    }
  }
}

// Ensure the AudioContext is running after a user gesture.
// Accepts an engine instance directly, or falls back to window.engine for
// legacy callers in index.html that call it without an argument.
export async function ensureAudioContextRunning(engine) {
  const eng = engine ?? window.engine;
  if (!eng?.context) return false;

  if (eng.context.state === 'suspended') {
    try {
      await eng.context.resume();
    } catch (e) {
      console.error('Failed to resume AudioContext:', e);
      return false;
    }
  }

  _updateAudioStatusIndicator(eng);
  return eng.context.state === 'running';
}

function _updateAudioStatusIndicator(engine) {
  const el = document.getElementById('audio-status');
  if (!el || !engine.context) return;
  const running = engine.context.state === 'running';
  el.classList.toggle('active', running);
  el.textContent = running          ? '🔊 Audio Active'
    : engine.context.state === 'suspended' ? '🔇 Audio Suspended'
    : '⚠️ Audio Offline';
}
