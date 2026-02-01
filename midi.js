// midi.js - MIDI handling module
// Extracted and refactored from app.js for cleaner separation of concerns

// MIDI state
let midiAccess = null;
let midiInputStates = {};
let midiMappings = [];
let midiLearning = false;
let midiLearnTarget = null;
let usingWebMidiJS = false;

// MIDI message log for monitor
const midiLog = [];
const MAX_LOG_ENTRIES = 20;

/**
 * Initialize MIDI support
 * @returns {Promise<object>} MIDI access object
 */
export async function initMIDI() {
  // Check if WebMidi.js library is loaded (polyfill for Safari/iOS)
  if (typeof WebMidi !== 'undefined') {
    console.log('Using WebMidi.js library for MIDI support');
    try {
      await WebMidi.enable();
      console.log('✅ WebMidi.js enabled');
      usingWebMidiJS = true;
      
      midiAccess = createWebMidiJSAdapter();
      setupWebMidiJSListeners();
      
      updateMIDIStatus(true);
      loadMIDIMappings();
      return midiAccess;
    } catch (error) {
      console.error('WebMidi.js failed:', error);
    }
  }
  
  // Try native Web MIDI API
  if (navigator.requestMIDIAccess) {
    try {
      midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      console.log('✅ Native Web MIDI API enabled');
      usingWebMidiJS = false;
      
      setupNativeMIDI();
      
      updateMIDIStatus(true);
      loadMIDIMappings();
      return midiAccess;
    } catch (error) {
      console.error('Native Web MIDI failed:', error);
    }
  }
  
  console.warn('No MIDI support available');
  updateMIDIStatus(false);
  return null;
}

/**
 * Create adapter for WebMidi.js to match native API
 */
function createWebMidiJSAdapter() {
  const midi = {
    inputs: new Map(),
    outputs: new Map(),
    onstatechange: null
  };
  
  WebMidi.inputs.forEach((input) => {
    const standardInput = {
      id: input.id,
      manufacturer: input.manufacturer,
      name: input.name,
      state: input.state || 'connected',
      connection: input.connection || 'open',
      type: 'input',
      open: async () => Promise.resolve(),
      onmidimessage: null
    };
    
    midi.inputs.set(input.id, standardInput);
    midiInputStates[input.id] = true;
  });
  
  WebMidi.outputs.forEach((output) => {
    const standardOutput = {
      id: output.id,
      manufacturer: output.manufacturer,
      name: output.name,
      state: output.state || 'connected',
      type: 'output',
      send: (data) => output.send(data)
    };
    
    midi.outputs.set(output.id, standardOutput);
  });
  
  return midi;
}

/**
 * Set up WebMidi.js event listeners
 */
function setupWebMidiJSListeners() {
  WebMidi.inputs.forEach((input) => {
    console.log('Setting up WebMidi.js listeners for:', input.name);
    input.removeListener();
    
    input.addListener('noteon', (e) => {
      handleMIDIMessage({
        data: new Uint8Array([0x90 + (e.message.channel - 1), e.note.number, e.rawVelocity])
      });
    });
    
    input.addListener('noteoff', (e) => {
      handleMIDIMessage({
        data: new Uint8Array([0x80 + (e.message.channel - 1), e.note.number, 0])
      });
    });
    
    input.addListener('controlchange', (e) => {
      handleMIDIMessage({
        data: new Uint8Array([0xB0 + (e.message.channel - 1), e.controller.number, e.rawValue])
      });
    });
    
    input.addListener('pitchbend', (e) => {
      const value = Math.round((e.value + 1) * 8192);
      handleMIDIMessage({
        data: new Uint8Array([0xE0 + (e.message.channel - 1), value & 0x7F, (value >> 7) & 0x7F])
      });
    });
  });
  
  console.log('✅ WebMidi.js setup complete');
}

/**
 * Set up native Web MIDI API
 */
function setupNativeMIDI() {
  midiAccess.inputs.forEach((input) => {
    midiInputStates[input.id] = true;
    input.onmidimessage = handleMIDIMessage;
    console.log('MIDI Input:', input.name);
  });
  
  midiAccess.outputs.forEach((output) => {
    console.log('MIDI Output:', output.name);
  });
  
  midiAccess.onstatechange = (e) => {
    console.log('MIDI state change:', e.port.name, e.port.state);
    if (e.port.type === 'input') {
      if (e.port.state === 'connected') {
        midiInputStates[e.port.id] = true;
        e.port.onmidimessage = handleMIDIMessage;
      } else {
        delete midiInputStates[e.port.id];
      }
    }
    updateMIDIStatus(Object.keys(midiInputStates).length > 0);
  };
}

/**
 * Handle incoming MIDI messages
 */
export function handleMIDIMessage(event) {
  const data = event.data;
  if (!data || data.length < 1) return;
  
  const status = data[0];
  const cmd = status >> 4;
  const channel = status & 0x0F;
  const data1 = data[1];
  const data2 = data.length > 2 ? data[2] : 0;
  
  const message = { status, cmd, channel, data1, data2, timestamp: Date.now() };
  
  logMIDIMessage(message);
  
  // MIDI Learn mode
  if (midiLearning && cmd === 9 && data2 > 0) {
    completeMIDILearn(data1, channel);
    return;
  }
  
  // Process message
  switch (cmd) {
    case 8: // Note Off
      handleNoteOff(data1, channel);
      break;
    case 9: // Note On
      data2 > 0 ? handleNoteOn(data1, data2, channel) : handleNoteOff(data1, channel);
      break;
    case 11: // Control Change
      handleControlChange(data1, data2, channel);
      break;
    case 14: // Pitch Bend
      handlePitchBend((data2 << 7) | data1, channel);
      break;
  }
  
  processMIDIMappings(message);
}

/**
 * Log MIDI message for monitor
 */
function logMIDIMessage(message) {
  const typeNames = {
    8: 'Note Off', 9: 'Note On', 10: 'Aftertouch', 11: 'CC',
    12: 'Program', 13: 'Ch Pressure', 14: 'Pitch Bend'
  };
  
  midiLog.unshift({
    time: new Date().toLocaleTimeString(),
    type: typeNames[message.cmd] || `0x${message.cmd.toString(16)}`,
    channel: message.channel + 1,
    data1: message.data1,
    data2: message.data2
  });
  
  if (midiLog.length > MAX_LOG_ENTRIES) midiLog.pop();
  updateMIDIMonitor();
}

/**
 * Handle Note On
 */
function handleNoteOn(note, velocity, channel) {
  const engine = window.engine;
  if (!engine) return;
  
  // MPC pad mapping (notes 36-51)
  if (engine.mpc?.midiNoteMap[note] !== undefined) {
    const padIndex = engine.mpc.midiNoteMap[note];
    triggerMPCPad(padIndex, velocity);
  }
  
  // Sample bank trigger
  if (note >= 36 && note <= 51) {
    const sampleIndex = note - 36;
    if (engine.sampleBank?.has(sampleIndex)) {
      engine.playSample?.(sampleIndex, velocity / 127);
    }
  }
}

/**
 * Handle Note Off
 */
function handleNoteOff(note, channel) {
  const engine = window.engine;
  if (!engine) return;
  
  if (engine.mpc?.midiNoteMap[note] !== undefined) {
    releaseMPCPad(engine.mpc.midiNoteMap[note]);
  }
}

/**
 * Handle Control Change
 */
function handleControlChange(cc, value, channel) {
  const engine = window.engine;
  if (!engine) return;
  
  switch (cc) {
    case 7: // Volume
      if (engine.masterGain) engine.masterGain.gain.value = value / 127;
      break;
    case 1: // Mod wheel - could control effect depth
    case 10: // Pan
    case 64: // Sustain
      break;
  }
}

/**
 * Handle Pitch Bend
 */
function handlePitchBend(value, channel) {
  const normalized = (value - 8192) / 8192;
  console.log('Pitch Bend:', normalized.toFixed(3));
}

/**
 * Trigger MPC pad
 */
function triggerMPCPad(padIndex, velocity) {
  const engine = window.engine;
  if (!engine) return;
  
  const pad = document.querySelector(`.mpc-pad[data-index="${padIndex}"]`);
  if (pad) pad.classList.add('active');
  
  if (engine.mpc?.mode === 'slices' && engine.chopper?.slices[padIndex]) {
    engine.playSlice?.(padIndex);
  } else if (engine.mpc?.mode === 'samples' && engine.sampleBank?.has(padIndex)) {
    engine.playSample?.(padIndex, velocity / 127);
  }
}

/**
 * Release MPC pad
 */
function releaseMPCPad(padIndex) {
  const pad = document.querySelector(`.mpc-pad[data-index="${padIndex}"]`);
  if (pad) pad.classList.remove('active');
}

/**
 * Process MIDI mappings
 */
function processMIDIMappings(message) {
  midiMappings.forEach(mapping => {
    if (mapping.note === message.data1 && message.cmd === 9 && message.data2 > 0) {
      executeMapping(mapping, message.data2);
    }
  });
}

/**
 * Execute a MIDI mapping action
 */
function executeMapping(mapping, velocity) {
  const engine = window.engine;
  if (!engine) return;
  
  switch (mapping.action) {
    case 'playTrack':
      engine.playTrack?.(mapping.param);
      break;
    case 'stopTrack':
      engine.stopTrack?.(mapping.param);
      break;
    case 'toggleRecord':
      engine.toggleRecording?.(mapping.param);
      break;
    case 'playAll':
      engine.playAll?.();
      break;
    case 'stopAll':
      engine.stopAll?.();
      break;
    case 'playSample':
      engine.playSample?.(mapping.param, velocity / 127);
      break;
    case 'playSlice':
      engine.playSlice?.(mapping.param);
      break;
    case 'tapTempo':
      engine.tapTempo?.();
      break;
  }
}

// ==================== MIDI Learn ====================

/**
 * Start MIDI learn mode
 */
export function startMIDILearn(target) {
  midiLearning = true;
  midiLearnTarget = target;
  console.log('MIDI Learn started for:', target);
  
  const indicator = document.getElementById('midi-learn-indicator');
  if (indicator) {
    indicator.style.display = 'block';
    indicator.textContent = 'Press a MIDI note...';
  }
}

/**
 * Complete MIDI learn
 */
function completeMIDILearn(note, channel) {
  if (!midiLearnTarget) return;
  
  const mapping = {
    note,
    channel,
    action: midiLearnTarget.action,
    param: midiLearnTarget.param,
    name: midiLearnTarget.name || `Note ${note}`
  };
  
  // Remove existing mapping for this note
  midiMappings = midiMappings.filter(m => m.note !== note);
  midiMappings.push(mapping);
  
  saveMIDIMappings();
  
  midiLearning = false;
  midiLearnTarget = null;
  
  const indicator = document.getElementById('midi-learn-indicator');
  if (indicator) indicator.style.display = 'none';
  
  alert(`Learned! MIDI Note ${note} mapped to ${mapping.action}`);
  console.log('MIDI mapping created:', mapping);
}

/**
 * Cancel MIDI learn
 */
export function cancelMIDILearn() {
  midiLearning = false;
  midiLearnTarget = null;
  
  const indicator = document.getElementById('midi-learn-indicator');
  if (indicator) indicator.style.display = 'none';
}

// ==================== Mapping Management ====================

/**
 * Save mappings to localStorage
 */
export function saveMIDIMappings() {
  try {
    localStorage.setItem('midiMappings', JSON.stringify(midiMappings));
  } catch (e) {
    console.warn('Failed to save MIDI mappings:', e);
  }
}

/**
 * Load mappings from localStorage
 */
export function loadMIDIMappings() {
  try {
    const saved = localStorage.getItem('midiMappings');
    if (saved) {
      midiMappings = JSON.parse(saved);
      console.log('Loaded MIDI mappings:', midiMappings.length);
    }
  } catch (e) {
    console.warn('Failed to load MIDI mappings:', e);
  }
}

/**
 * Get all mappings
 */
export function getMIDIMappings() {
  return [...midiMappings];
}

/**
 * Clear all mappings
 */
export function clearMIDIMappings() {
  midiMappings = [];
  saveMIDIMappings();
}

/**
 * Export mappings as JSON
 */
export function exportMIDIMappings() {
  const blob = new Blob([JSON.stringify(midiMappings, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'midi-mappings.json';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Import mappings from JSON file
 */
export function importMIDIMappings(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      midiMappings = JSON.parse(e.target.result);
      saveMIDIMappings();
      alert('MIDI mappings imported!');
    } catch (err) {
      alert('Failed to import: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// ==================== UI Updates ====================

/**
 * Update MIDI status indicator
 */
function updateMIDIStatus(connected) {
  const indicator = document.getElementById('midi-status');
  if (indicator) {
    indicator.classList.toggle('active', connected);
  }
  
  window.engine?.updateStatus?.(connected ? 'MIDI connected' : 'MIDI disconnected');
}

/**
 * Update MIDI monitor display
 */
function updateMIDIMonitor() {
  const logEl = document.getElementById('midi-monitor-log');
  if (!logEl) return;
  
  logEl.innerHTML = midiLog.map(entry => 
    `<div style="margin-bottom:4px;border-bottom:1px solid #333;padding-bottom:4px;">
      <span style="color:#888">${entry.time}</span> - 
      <span style="color:#00ff88">${entry.type}</span>: 
      ${entry.type === 'Note On' || entry.type === 'Note Off' 
        ? `Note=${entry.data1} Vel=${entry.data2}` 
        : `D1=${entry.data1} D2=${entry.data2}`} 
      Ch=${entry.channel}
    </div>`
  ).join('') || '<div style="opacity:0.5">Waiting for MIDI messages...</div>';
}

/**
 * Show MIDI mapping UI
 */
export function showMIDIMappingUI() {
  let panel = document.getElementById('midi-mapping-panel');
  
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'midi-mapping-panel';
    panel.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: #1a1a2e; border: 2px solid #00ff88; border-radius: 12px;
      padding: 20px; z-index: 10000; min-width: 400px; max-height: 80vh; overflow-y: auto;
    `;
    document.body.appendChild(panel);
  }
  
  const actions = [
    { action: 'playAll', name: 'Play All' },
    { action: 'stopAll', name: 'Stop All' },
    { action: 'tapTempo', name: 'Tap Tempo' },
    ...Array.from({length: 8}, (_, i) => ({ action: 'playTrack', param: i, name: `Play Track ${i+1}` })),
    ...Array.from({length: 8}, (_, i) => ({ action: 'stopTrack', param: i, name: `Stop Track ${i+1}` })),
    ...Array.from({length: 8}, (_, i) => ({ action: 'toggleRecord', param: i, name: `Toggle Record ${i+1}` })),
    ...Array.from({length: 16}, (_, i) => ({ action: 'playSample', param: i, name: `Sample ${i+1}` })),
    ...Array.from({length: 16}, (_, i) => ({ action: 'playSlice', param: i, name: `Slice ${i+1}` }))
  ];
  
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
      <h3 style="color:#00ff88;margin:0;">MIDI Mapping</h3>
      <button onclick="document.getElementById('midi-mapping-panel').remove()" 
        style="background:#ff4444;border:none;color:#fff;padding:5px 10px;border-radius:4px;cursor:pointer;">✕</button>
    </div>
    
    <div style="margin-bottom:15px;">
      <h4 style="color:#00ccff;margin-bottom:10px;">Current Mappings</h4>
      <div id="current-mappings" style="max-height:150px;overflow-y:auto;background:#0a0a0a;padding:10px;border-radius:6px;">
        ${midiMappings.length === 0 ? '<div style="opacity:0.5">No mappings configured</div>' :
          midiMappings.map((m, i) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #333;">
              <span>Note ${m.note} → ${m.name || m.action}</span>
              <button onclick="window.midiModule.removeMappingByIndex(${i})" 
                style="background:#ff4444;border:none;color:#fff;padding:2px 6px;border-radius:3px;cursor:pointer;">×</button>
            </div>
          `).join('')
        }
      </div>
    </div>
    
    <div style="margin-bottom:15px;">
      <h4 style="color:#00ccff;margin-bottom:10px;">Add New Mapping</h4>
      <label for="midi-action-select" class="sr-only">Select action to map</label>
      <select id="midi-action-select" style="width:100%;padding:8px;background:#2a2a3e;border:1px solid #444;color:#fff;border-radius:4px;" aria-label="Select action to map">
        ${actions.map(a => `<option value="${a.action}|${a.param ?? ''}">${a.name}</option>`).join('')}
      </select>
      <button onclick="window.midiModule.learnFromUI()" 
        style="width:100%;margin-top:10px;padding:10px;background:linear-gradient(135deg,#00ff88,#00ccff);border:none;color:#000;font-weight:bold;border-radius:6px;cursor:pointer;">
        🎹 Learn MIDI
      </button>
    </div>
    
    <div id="midi-learn-indicator" style="display:none;text-align:center;padding:15px;background:#ff880033;border-radius:6px;margin-bottom:15px;">
      Press a MIDI note...
    </div>
    
    <div style="display:flex;gap:10px;">
      <button onclick="window.midiModule.clearMIDIMappings();window.midiModule.showMIDIMappingUI();" 
        style="flex:1;padding:8px;background:#ff4444;border:none;color:#fff;border-radius:4px;cursor:pointer;">Clear All</button>
      <button onclick="window.midiModule.exportMIDIMappings()" 
        style="flex:1;padding:8px;background:#2a2a3e;border:1px solid #444;color:#fff;border-radius:4px;cursor:pointer;">Export</button>
    </div>
  `;
  
  panel.style.display = 'block';
}

/**
 * Learn from UI selection
 */
export function learnFromUI() {
  const select = document.getElementById('midi-action-select');
  if (!select) return;
  
  const [action, param] = select.value.split('|');
  const option = select.options[select.selectedIndex];
  
  startMIDILearn({
    action,
    param: param ? parseInt(param) : undefined,
    name: option.textContent
  });
}

/**
 * Remove mapping by index
 */
export function removeMappingByIndex(index) {
  midiMappings.splice(index, 1);
  saveMIDIMappings();
  showMIDIMappingUI();
}

// Export for global access
if (typeof window !== 'undefined') {
  window.initMIDI = initMIDI;
  window.handleMIDIMessage = handleMIDIMessage;
  window._midiMappings = midiMappings;
  window._midiInputStates = midiInputStates;
  window._midiLearning = midiLearning;
  window._usingWebMidiJS = usingWebMidiJS;
  
  window.midiModule = {
    initMIDI,
    startMIDILearn,
    cancelMIDILearn,
    saveMIDIMappings,
    loadMIDIMappings,
    getMIDIMappings,
    clearMIDIMappings,
    exportMIDIMappings,
    importMIDIMappings,
    showMIDIMappingUI,
    learnFromUI,
    removeMappingByIndex
  };
}
