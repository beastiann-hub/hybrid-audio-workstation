// effects.js - Unified effects presets and utilities
// Consolidates effect presets that were duplicated across app.js and tracks.js

export const EFFECT_PRESETS = {
  'dry': { 
    reverbGain: 0, 
    delayGain: 0, 
    delayTime: 0.3,
    description: 'No effects applied'
  },
  'ambient': { 
    reverbGain: 0.4, 
    delayGain: 0.3, 
    delayTime: 0.5,
    description: 'Atmospheric space with subtle delay'
  },
  'lo-fi': { 
    reverbGain: 0.3, 
    delayGain: 0.2, 
    delayTime: 0.25,
    description: 'Warm, vintage character'
  },
  'space': { 
    reverbGain: 0.8, 
    delayGain: 0.6, 
    delayTime: 0.75,
    description: 'Expansive, cosmic reverb'
  },
  'cathedral': { 
    reverbGain: 0.9, 
    delayGain: 0.4, 
    delayTime: 0.625,
    description: 'Large, majestic hall reverb'
  },
  'hall': { 
    reverbGain: 0.7, 
    delayGain: 0.2, 
    delayTime: 0.375,
    description: 'Concert hall ambience'
  },
  'plate': { 
    reverbGain: 0.6, 
    delayGain: 0.15, 
    delayTime: 0.2,
    description: 'Classic plate reverb character'
  },
  'spring': { 
    reverbGain: 0.5, 
    delayGain: 0.4, 
    delayTime: 0.4,
    description: 'Guitar amp spring reverb'
  },
  'echo': { 
    reverbGain: 0.2, 
    delayGain: 0.8, 
    delayTime: 0.5,
    description: 'Prominent rhythmic echo'
  },
  'slapback': { 
    reverbGain: 0.1, 
    delayGain: 0.9, 
    delayTime: 0.2,
    description: 'Classic rockabilly slapback'
  },
  'telephone': { 
    reverbGain: 0.1, 
    delayGain: 0.05, 
    delayTime: 0.1,
    description: 'Filtered, distant telephone effect'
  },
  'radio': { 
    reverbGain: 0.2, 
    delayGain: 0.1, 
    delayTime: 0.15,
    description: 'AM radio broadcast quality'
  },
  'underwater': { 
    reverbGain: 0.85, 
    delayGain: 0.35, 
    delayTime: 0.65,
    description: 'Muffled, submerged sound'
  },
  'cave': { 
    reverbGain: 0.95, 
    delayGain: 0.3, 
    delayTime: 0.8,
    description: 'Dark, cavernous reflections'
  },
  'warm': { 
    reverbGain: 0.5, 
    delayGain: 0.25, 
    delayTime: 0.35,
    description: 'Smooth, pleasant warmth'
  },
  'bright': { 
    reverbGain: 0.45, 
    delayGain: 0.35, 
    delayTime: 0.3,
    description: 'Crisp, present brightness'
  },
  'vintage': { 
    reverbGain: 0.55, 
    delayGain: 0.25, 
    delayTime: 0.28,
    description: 'Classic studio sound'
  },
  'dubby': { 
    reverbGain: 0.3, 
    delayGain: 0.85, 
    delayTime: 0.6,
    description: 'Heavy dub-style delay'
  }
};

// Slice/chopper-specific effect presets
export const SLICE_EFFECT_PRESETS = {
  'lo-fi': {
    filter_type: 'lowpass',
    filter_freq: 800,
    filter_q: 2,
    dist_drive: 8,
    dist_curve: 30,
    dist_mix: 0.4,
    reverb_size: 0.3,
    reverb_decay: 1.5,
    reverb_mix: 0.2
  },
  'telephone': {
    filter_type: 'bandpass',
    filter_freq: 1200,
    filter_q: 8,
    dist_drive: 15,
    dist_curve: 50,
    dist_mix: 0.6
  },
  'radio': {
    filter_type: 'bandpass',
    filter_freq: 2500,
    filter_q: 4,
    dist_drive: 5,
    dist_curve: 20,
    dist_mix: 0.3,
    tremolo_rate: 1,
    tremolo_depth: 0.3
  },
  'vinyl': {
    filter_type: 'lowpass',
    filter_freq: 6000,
    filter_q: 1,
    dist_drive: 3,
    dist_curve: 10,
    dist_mix: 0.15,
    reverb_size: 0.2,
    reverb_decay: 0.8,
    reverb_mix: 0.1
  },
  'tape': {
    filter_type: 'lowpass',
    filter_freq: 8000,
    filter_q: 0.7,
    dist_drive: 4,
    dist_curve: 15,
    dist_mix: 0.2,
    chorus_rate: 0.3,
    chorus_depth: 0.002,
    chorus_mix: 0.15
  },
  'bitcrush': {
    filter_type: 'lowpass',
    filter_freq: 4000,
    filter_q: 1.5,
    dist_drive: 20,
    dist_curve: 80,
    dist_mix: 0.7
  },
  'spacey': {
    reverb_size: 0.9,
    reverb_decay: 4,
    reverb_mix: 0.6,
    delay_time: 0.4,
    delay_feedback: 0.5,
    delay_mix: 0.4
  },
  'underwater': {
    filter_type: 'lowpass',
    filter_freq: 400,
    filter_q: 3,
    reverb_size: 0.7,
    reverb_decay: 2,
    reverb_mix: 0.5,
    chorus_rate: 0.2,
    chorus_depth: 0.004,
    chorus_mix: 0.3
  }
};

/**
 * Get list of available preset names
 * @returns {string[]} Array of preset names
 */
export function getPresetNames() {
  return Object.keys(EFFECT_PRESETS);
}

/**
 * Get a specific preset by name
 * @param {string} name - Preset name
 * @returns {object|null} Preset configuration or null if not found
 */
export function getPreset(name) {
  return EFFECT_PRESETS[name] || null;
}

/**
 * Apply preset to a track's effect sends
 * @param {object} engine - Audio engine instance
 * @param {number} trackIndex - Track index
 * @param {string} presetName - Preset name to apply
 */
export function applyPresetToTrack(engine, trackIndex, presetName) {
  const track = engine?.tracks?.[trackIndex];
  if (!track) {
    console.warn('Track', trackIndex, 'not found');
    return false;
  }
  
  const preset = EFFECT_PRESETS[presetName];
  if (!preset) {
    console.warn('Preset', presetName, 'not found. Available:', getPresetNames().join(', '));
    return false;
  }
  
  // Ensure track has effect sends
  ensureTrackEffects(engine, trackIndex);
  
  // Apply preset values
  if (track.reverbSend) {
    track.reverbSend.gain.value = preset.reverbGain;
  }
  if (track.delaySend) {
    track.delaySend.gain.value = preset.delayGain;
  }
  if (engine.effects?.delayNode && preset.delayTime) {
    engine.effects.delayNode.delayTime.value = preset.delayTime;
  } else if (engine.effects?.delay && preset.delayTime) {
    engine.effects.delay.delayTime.value = preset.delayTime;
  }
  
  console.log(`Applied preset "${presetName}" to track ${trackIndex}`);
  return true;
}

/**
 * Apply preset to master/global effect sends
 * @param {object} engine - Audio engine instance
 * @param {string} presetName - Preset name to apply
 */
export function applyPresetToMaster(engine, presetName) {
  if (!engine || !engine.effects) {
    console.warn('Engine or effects not ready');
    return false;
  }

  const preset = EFFECT_PRESETS[presetName];
  if (!preset) {
    console.warn('Master preset not found:', presetName);
    return false;
  }

  if (engine.effects.reverbSend) {
    engine.effects.reverbSend.gain.value = preset.reverbGain;
  }
  if (engine.effects.delaySend) {
    engine.effects.delaySend.gain.value = preset.delayGain;
  }
  if (engine.effects.delay && preset.delayTime) {
    engine.effects.delay.delayTime.value = preset.delayTime;
  }

  // Persist selection for next session
  try { 
    localStorage.setItem('masterPreset', presetName); 
  } catch (e) { 
    // Ignore storage errors
  }

  // Update UI if present
  updateEffectUI(preset, presetName);

  console.log('Applied master preset:', presetName, preset);
  return true;
}

/**
 * Ensure a track has effect send nodes
 * @param {object} engine - Audio engine instance
 * @param {number} trackIndex - Track index
 */
export function ensureTrackEffects(engine, trackIndex) {
  if (!engine?.tracks?.[trackIndex]) {
    console.warn('Track', trackIndex, 'not found');
    return false;
  }
  
  const track = engine.tracks[trackIndex];
  
  if (!track.reverbSend && engine.context) {
    track.reverbSend = engine.context.createGain();
    track.reverbSend.gain.value = 0;
    if (engine.effects?.reverbSend) {
      track.reverbSend.connect(engine.effects.reverbSend);
    }
  }
  
  if (!track.delaySend && engine.context) {
    track.delaySend = engine.context.createGain();
    track.delaySend.gain.value = 0;
    if (engine.effects?.delaySend) {
      track.delaySend.connect(engine.effects.delaySend);
    }
  }
  
  return true;
}

/**
 * Copy master effect settings to a track
 * @param {object} engine - Audio engine instance
 * @param {number} trackIndex - Track index
 */
export function copyMasterToTrack(engine, trackIndex) {
  const track = engine?.tracks?.[trackIndex];
  if (!track) return false;
  
  ensureTrackEffects(engine, trackIndex);
  
  try {
    let masterReverb = 0, masterDelay = 0;
    
    // Try to read from UI controls first
    const quickReverb = document.getElementById('quick-reverb');
    const quickDelay = document.getElementById('quick-delay');
    
    if (quickReverb) {
      masterReverb = Number(quickReverb.value) / 100;
    } else if (engine.effects?.reverbSend) {
      masterReverb = engine.effects.reverbSend.gain.value || 0;
    }
    
    if (quickDelay) {
      masterDelay = Number(quickDelay.value) / 100;
    } else if (engine.effects?.delaySend) {
      masterDelay = engine.effects.delaySend.gain.value || 0;
    }

    if (track.reverbSend) track.reverbSend.gain.value = masterReverb;
    if (track.delaySend) track.delaySend.gain.value = masterDelay;

    return true;
  } catch (e) {
    console.warn('copyMasterToTrack failed:', e);
    return false;
  }
}

/**
 * Update effect UI controls to match preset
 * @param {object} preset - Preset configuration
 * @param {string} presetName - Preset name
 */
function updateEffectUI(preset, presetName) {
  try {
    const sel = document.getElementById('effect-preset');
    if (sel) sel.value = presetName;
    
    const qr = document.getElementById('quick-reverb');
    const qd = document.getElementById('quick-delay');
    
    if (qr) { 
      qr.value = Math.round((preset.reverbGain || 0) * 100); 
      if (qr.nextElementSibling) {
        qr.nextElementSibling.textContent = qr.value + '%';
      }
    }
    if (qd) { 
      qd.value = Math.round((preset.delayGain || 0) * 100); 
      if (qd.nextElementSibling) {
        qd.nextElementSibling.textContent = qd.value + '%';
      }
    }
  } catch (e) {
    // Ignore UI update errors
  }
}

/**
 * Create reverb impulse response
 * @param {AudioContext} context - Web Audio context
 * @param {number} duration - Reverb duration in seconds
 * @param {number} decay - Decay rate
 * @returns {AudioBuffer} Impulse response buffer
 */
export function createReverbImpulse(context, duration = 2, decay = 2) {
  const sampleRate = context.sampleRate;
  const length = sampleRate * duration;
  const impulse = context.createBuffer(2, length, sampleRate);
  
  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  
  return impulse;
}

/**
 * Initialize effects chain on engine
 * @param {object} engine - Audio engine instance
 */
export function initEffectsChain(engine) {
  if (!engine.context) return;
  
  // Create effect nodes if they don't exist
  if (!engine.effects) engine.effects = {};
  
  if (!engine.effects.reverb) {
    engine.effects.reverb = engine.context.createConvolver();
    // Create default impulse response
    engine.effects.reverb.buffer = createReverbImpulse(engine.context, 2, 2);
  }
  
  if (!engine.effects.delay) {
    engine.effects.delay = engine.context.createDelay(4.0);
    engine.effects.delay.delayTime.value = 0.3;
  }
  
  if (!engine.effects.delayFeedback) {
    engine.effects.delayFeedback = engine.context.createGain();
    engine.effects.delayFeedback.gain.value = 0.3;
    engine.effects.delay.connect(engine.effects.delayFeedback);
    engine.effects.delayFeedback.connect(engine.effects.delay);
  }
  
  if (!engine.effects.filter) {
    engine.effects.filter = engine.context.createBiquadFilter();
    engine.effects.filter.type = 'lowpass';
    engine.effects.filter.frequency.value = 20000;
  }
  
  if (!engine.effects.compressor) {
    engine.effects.compressor = engine.context.createDynamicsCompressor();
    engine.effects.compressor.threshold.value = -24;
    engine.effects.compressor.knee.value = 30;
    engine.effects.compressor.ratio.value = 4;
    engine.effects.compressor.attack.value = 0.003;
    engine.effects.compressor.release.value = 0.25;
  }
  
  // Create send buses
  if (!engine.effects.reverbSend) {
    engine.effects.reverbSend = engine.context.createGain();
    engine.effects.reverbSend.gain.value = 0;
  }
  
  if (!engine.effects.delaySend) {
    engine.effects.delaySend = engine.context.createGain();
    engine.effects.delaySend.gain.value = 0;
  }
  
  // Connect effect chain
  try {
    engine.effects.reverbSend.connect(engine.effects.reverb);
    engine.effects.reverb.connect(engine.masterGain);
    
    engine.effects.delaySend.connect(engine.effects.delay);
    engine.effects.delay.connect(engine.masterGain);
  } catch (e) {
    console.warn('Effect chain connection error:', e);
  }
}

// Export for global access
if (typeof window !== 'undefined') {
  window.EFFECT_PRESETS = EFFECT_PRESETS;
  window.getAvailablePresets = getPresetNames;
  window.applyPresetToTrack = (trackIndex, presetName) => {
    return applyPresetToTrack(window.engine, trackIndex, presetName);
  };
  window.applyPresetToMaster = (presetName) => {
    return applyPresetToMaster(window.engine, presetName);
  };
  window.ensureTrackSends = (trackIndex) => {
    return ensureTrackEffects(window.engine, trackIndex);
  };
}
