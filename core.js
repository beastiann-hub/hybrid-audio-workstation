export function attachCore(engine) {
  // Initialize AudioContext and core routing if not already present
  if (!engine.context) {
    try {
      engine.context = new (window.AudioContext || window.webkitAudioContext)();
      console.log('Audio context created, state:', engine.context.state);
    } catch (e) {
      console.error('Failed to create audio context:', e);
      throw new Error('Audio context creation failed. Your browser may not support Web Audio API.');
    }
  }
  // Backwards-compatible aliases for console / older code
  if (!engine.audioContext) engine.audioContext = engine.context;
  if (!engine.audioCtx) engine.audioCtx = engine.context;

  // Master gain
  if (!engine.masterGain) engine.masterGain = engine.context.createGain();
  engine.masterGain.gain.value = engine.masterGain.gain.value || 0.7;
  engine.masterGain.connect(engine.context.destination);

  // Input gain
  if (!engine.inputGain) engine.inputGain = engine.context.createGain();
  engine.inputGain.gain.value = engine.inputGain.gain.value || 1.0;

  try {
    engine.inputGain.connect(engine.masterGain);
  } catch (e) {
    // ignore
  }

  // Effects
  if (!engine.effects) engine.effects = {};
  if (!engine.effects.reverb) engine.effects.reverb = engine.context.createConvolver();
  if (!engine.effects.delay) engine.effects.delay = engine.context.createDelay(4.0);
  if (!engine.effects.filter) engine.effects.filter = engine.context.createBiquadFilter();
  if (!engine.effects.compressor) engine.effects.compressor = engine.context.createDynamicsCompressor();

  // Effect sends
  if (!engine.effects.reverbSend) engine.effects.reverbSend = engine.context.createGain();
  if (!engine.effects.delaySend) engine.effects.delaySend = engine.context.createGain();
  engine.effects.reverbSend.gain.value = engine.effects.reverbSend.gain.value || 0;
  engine.effects.delaySend.gain.value = engine.effects.delaySend.gain.value || 0;

  // Connect effects
  try {
    engine.effects.reverbSend.connect(engine.effects.reverb);
    engine.effects.reverb.connect(engine.masterGain);
    engine.effects.delaySend.connect(engine.effects.delay);
    engine.effects.delay.connect(engine.masterGain);
  } catch (e) {
    // ignore connection errors
  }

  // Draw worker initialization
  try {
    if (window.Worker && !engine.drawWorker) {
      engine.drawWorker = new Worker('draw-worker.js');
      engine._offscreenTransferred = new Set();
    }
  } catch (e) {
    console.warn('Failed to create draw worker', e);
  }
}

// Function to ensure audio context is running - call after user interaction
export async function ensureAudioContextRunning(engine) {
  if (!engine.context) return false;
  
  if (engine.context.state === 'suspended') {
    console.log('Resuming suspended audio context...');
    try {
      await engine.context.resume();
      console.log('✅ Audio context resumed successfully, state:', engine.context.state);
      // Update audio status indicator
      updateAudioStatusIndicator(engine);
      return true;
    } catch (e) {
      console.error('Failed to resume audio context:', e);
      return false;
    }
  }
  
  console.log('Audio context already running, state:', engine.context.state);
  updateAudioStatusIndicator(engine);
  return true;
}

// Update the visual audio status indicator
function updateAudioStatusIndicator(engine) {
  const indicator = document.getElementById('audio-status');
  if (!indicator || !engine.context) return;
  
  if (engine.context.state === 'running') {
    indicator.classList.add('active');
    indicator.textContent = '🔊 Audio Active';
  } else if (engine.context.state === 'suspended') {
    indicator.classList.remove('active');
    indicator.textContent = '🔇 Audio Suspended';
  } else {
    indicator.classList.remove('active');
    indicator.textContent = '⚠️ Audio Offline';
  }
}
