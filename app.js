// app.js - Main application entry point (Refactored)
// Imports all modules and wires up the UI

// Core engine import (required)
import { UnifiedAudioEngine } from './engine.js';
import { ensureAudioContextRunning } from './core.js';

// Optional module placeholders
let initMIDI, showMIDIMappingUI, exportMIDIMappings, importMIDIMappings;
let EFFECT_PRESETS, getPresetNames, applyPresetToTrack, applyPresetToMaster, ensureTrackEffects, copyMasterToTrack;
let initDB, saveProject, loadProject, getAllProjects, saveSetting, loadSetting;
let BeatDetector, detectBPM, getSlicePointsFromBeats;
let showAIPanel, detectBeats, setReplicateApiKey, hasApiKey, generateSample, separateStems;

// Load optional modules
async function loadOptionalModules() {
  // MIDI module
  try {
    const midi = await import('./midi.js');
    initMIDI = midi.initMIDI;
    showMIDIMappingUI = midi.showMIDIMappingUI;
    exportMIDIMappings = midi.exportMIDIMappings;
    importMIDIMappings = midi.importMIDIMappings;
    console.log('✅ MIDI module loaded');
  } catch (e) {
    console.warn('MIDI module not available:', e.message);
  }
  
  // Effects module
  try {
    const effects = await import('./effects.js');
    EFFECT_PRESETS = effects.EFFECT_PRESETS;
    getPresetNames = effects.getPresetNames;
    applyPresetToTrack = effects.applyPresetToTrack;
    applyPresetToMaster = effects.applyPresetToMaster;
    ensureTrackEffects = effects.ensureTrackEffects;
    copyMasterToTrack = effects.copyMasterToTrack;
    console.log('✅ Effects module loaded');
  } catch (e) {
    console.warn('Effects module not available:', e.message);
  }
  
  // Storage module
  try {
    const storage = await import('./storage.js');
    initDB = storage.initDB;
    saveProject = storage.saveProject;
    loadProject = storage.loadProject;
    getAllProjects = storage.getAllProjects;
    saveSetting = storage.saveSetting;
    loadSetting = storage.loadSetting;
    console.log('✅ Storage module loaded');
  } catch (e) {
    console.warn('Storage module not available:', e.message);
  }
  
  // Beat detection module
  try {
    const beatModule = await import('./beat-detection.js');
    BeatDetector = beatModule.BeatDetector;
    detectBPM = beatModule.detectBPM;
    getSlicePointsFromBeats = beatModule.getSlicePointsFromBeats;
    console.log('✅ Beat detection module loaded');
  } catch (e) {
    console.warn('Beat detection module not available:', e.message);
  }
  
  // AI features module
  try {
    const aiModule = await import('./ai-features.js');
    showAIPanel = aiModule.showAIPanel;
    detectBeats = aiModule.detectBeats;
    setReplicateApiKey = aiModule.setReplicateApiKey;
    hasApiKey = aiModule.hasApiKey;
    generateSample = aiModule.generateSample;
    separateStems = aiModule.separateStems;
    console.log('✅ AI features module loaded');
  } catch (e) {
    console.warn('AI features module not available:', e.message);
  }
}

// ==================== Global State ====================
let engine = null;
window.engine = null;

// ==================== Global Helpers ====================
window.getAudioContext = () => window.engine?.context || null;
window.getEngine = () => window.engine || null;
window.getAvailablePresets = getPresetNames;
window.applyPresetToTrack = (trackIndex, presetName) => applyPresetToTrack(window.engine, trackIndex, presetName);
window.applyPresetToMaster = (presetName) => applyPresetToMaster(window.engine, presetName);
window.ensureTrackSends = (trackIndex) => ensureTrackEffects(window.engine, trackIndex);

// ==================== Sample Bank Functions ====================
function initializeSampleBank() {
  const grid = document.getElementById('sample-grid');
  if (!grid) return;
  
  grid.innerHTML = '';
  for (let i = 0; i < 16; i++) {
    const slot = document.createElement('div');
    slot.className = 'sample-slot';
    slot.id = `sample-slot-${i}`;
    slot.innerHTML = `
      <div style="font-size: 24px; font-weight: bold; opacity: 0.5;">${i + 1}</div>
      <div style="font-size: 10px; opacity: 0.5;">Empty</div>
    `;
    slot.onclick = () => {
      if (engine?.sampleBank?.has(i)) {
        engine.playSample(i);
        slot.classList.add('active');
        setTimeout(() => slot.classList.remove('active'), 200);
      }
    };
    grid.appendChild(slot);
  }
}

function clearSampleBank() {
  if (!engine) return;
  engine.sampleBank.clear();
  initializeSampleBank();
  engine.updateStatus('Sample bank cleared');
}

async function importSamples() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'audio/*';
  input.multiple = true;
  
  input.onchange = async (e) => {
    const files = Array.from(e.target.files);
    let assignedRow = 0;
    
    for (let i = 0; i < files.length && i < 16; i++) {
      const file = files[i];
      try {
        const arrayBuf = await file.arrayBuffer();
        const audioBuf = await engine.context.decodeAudioData(arrayBuf.slice(0));
        
        engine.sampleBank.set(i, { 
          buffer: audioBuf, 
          name: file.name, 
          duration: audioBuf.duration 
        });
        
        const slot = document.getElementById(`sample-slot-${i}`);
        if (slot) {
          slot.classList.add('loaded');
          slot.innerHTML = `
            <div style="font-size: 24px; font-weight: bold;">${i + 1}</div>
            <div style="font-size: 10px; opacity: 0.8;">${file.name.replace(/\.[^/.]+$/, '')}</div>
            <div style="font-size: 8px; opacity: 0.6;">${audioBuf.duration.toFixed(2)}s</div>
          `;
        }
        
        if (assignedRow < 8) {
          engine.sequencer.rowSample[assignedRow] = i;
          assignedRow++;
        }
      } catch (err) {
        console.error('Decode failed:', err);
        engine.updateStatus('Decode failed for: ' + file.name);
      }
    }
    
    engine.renderSequencer();
    engine.updateStatus('Samples imported');
  };
  
  input.click();
}

// ==================== Sequencer Controls ====================
function renderSequencerControls() {
  const container = document.getElementById('sequencer-controls');
  if (!container || !engine) return;
  
  container.innerHTML = `
    <label for="seq-pattern">Pattern</label>
    <select id="seq-pattern">
      <option value="0">A</option>
      <option value="1">B</option>
      <option value="2">C</option>
    </select>
    <button class="btn mini-btn" id="seq-save">Save</button>
    <button class="btn mini-btn" id="seq-load">Load</button>
    <button class="btn mini-btn" id="seq-clear">Clear</button>
    <div class="spacer"></div>
    <label for="seq-swing">Swing</label>
    <input type="range" id="seq-swing" min="0" max="0.5" step="0.01" value="${engine.sequencer.swing}">
    <span id="swing-display">${Math.round(engine.sequencer.swing * 100)}%</span>
    <label for="seq-chain">Chain</label>
    <input type="checkbox" id="seq-chain" ${engine.sequencer.chainEnabled ? 'checked' : ''}>
    <label for="seq-chain-text" class="sr-only">Chain Pattern</label>
    <input type="text" id="seq-chain-text" value="${engine.sequencer.chain}" style="width: 60px;" aria-label="Chain pattern sequence">
  `;
  
  // Event listeners
  document.getElementById('seq-pattern').addEventListener('change', (e) => {
    saveCurrentPattern();
    setActivePattern(parseInt(e.target.value));
  });
  
  document.getElementById('seq-swing').addEventListener('input', (e) => {
    engine.sequencer.swing = parseFloat(e.target.value);
    document.getElementById('swing-display').textContent = Math.round(engine.sequencer.swing * 100) + '%';
  });
  
  document.getElementById('seq-chain').addEventListener('change', (e) => {
    engine.sequencer.chainEnabled = e.target.checked;
  });
  
  document.getElementById('seq-chain-text').addEventListener('input', (e) => {
    engine.sequencer.chain = e.target.value.toUpperCase();
  });
  
  document.getElementById('seq-save').addEventListener('click', saveCurrentPattern);
  document.getElementById('seq-load').addEventListener('click', loadPattern);
  document.getElementById('seq-clear').addEventListener('click', clearPattern);
}

function saveCurrentPattern() {
  if (!engine) return;
  const idx = engine.sequencer.activePattern;
  engine.sequencer.patterns[idx] = {
    grid: engine.sequencer.grid.map(row => [...row]),
    vel: engine.sequencer.velGrid.map(row => [...row])
  };
  engine.updateStatus(`Pattern ${['A','B','C'][idx]} saved`);
}

function loadPattern() {
  if (!engine) return;
  const idx = engine.sequencer.activePattern;
  const pattern = engine.sequencer.patterns[idx];
  if (pattern) {
    engine.sequencer.grid = pattern.grid.map(row => [...row]);
    engine.sequencer.velGrid = pattern.vel.map(row => [...row]);
    engine.renderSequencer();
    engine.updateStatus(`Pattern ${['A','B','C'][idx]} loaded`);
  }
}

function clearPattern() {
  if (!engine) return;
  engine.sequencer.grid = Array.from({length: 8}, () => Array(16).fill(false));
  engine.sequencer.velGrid = Array.from({length: 8}, () => Array(16).fill(0.8));
  engine.renderSequencer();
  engine.updateStatus('Pattern cleared');
}

function setActivePattern(idx) {
  if (!engine) return;
  engine.sequencer.activePattern = idx;
  loadPattern();
}

// ==================== Chopper Functions ====================
function autoChop() {
  if (engine?.chopper.buffer) {
    engine.createEqualSlices();
  } else {
    engine.updateStatus('No audio loaded in chopper');
  }
}

function manualChopMode() {
  if (engine) {
    engine.updateStatus('Manual chopping mode - click waveform to set slice points');
  }
}

// ==================== Mode Switching ====================
function setupModeSwitcher() {
  const buttons = document.querySelectorAll('.mode-btn');
  const workspaces = document.querySelectorAll('.workspace');
  
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      
      // Update button states
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Show corresponding workspace
      workspaces.forEach(ws => {
        ws.classList.remove('active');
        if (ws.id === `workspace-${mode}`) {
          ws.classList.add('active');
        }
      });
      
      // Check URL mode parameter
      const url = new URL(window.location);
      url.searchParams.set('mode', mode);
      window.history.replaceState({}, '', url);
    });
  });
  
  // Check for mode in URL
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode');
  if (mode) {
    const btn = document.querySelector(`[data-mode="${mode}"]`);
    if (btn) btn.click();
  }
}

// ==================== UI Binding ====================
function bindUI() {
  // Master controls
  document.getElementById('master-bpm')?.addEventListener('change', (e) => {
    engine.bpm = parseInt(e.target.value);
    if (engine.effects?.delay) {
      engine.effects.delay.delayTime.value = 60 / engine.bpm * 0.25;
    }
  });
  
  document.getElementById('master-bars')?.addEventListener('change', (e) => {
    engine.bars = parseInt(e.target.value);
  });
  
  document.getElementById('master-play')?.addEventListener('click', () => engine.playAll());
  document.getElementById('master-stop')?.addEventListener('click', () => engine.stopAll());
  
  document.getElementById('tap-tempo')?.addEventListener('click', () => engine.tapTempo());
  
  document.getElementById('metronome-toggle')?.addEventListener('click', (e) => {
    if (engine.metronomeEnabled) {
      engine.stopMetronome();
      e.target.classList.remove('active');
    } else {
      engine.startMetronome();
      e.target.classList.add('active');
    }
  });
  
  // Volume controls
  document.getElementById('master-volume')?.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    engine.masterGain.gain.value = value / 100;
    document.getElementById('master-volume-display').textContent = value + '%';
  });
  
  document.getElementById('input-gain')?.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    engine.inputGain.gain.value = value / 100;
    document.getElementById('input-gain-display').textContent = value + '%';
  });
  
  // Effect preset
  document.getElementById('effect-preset')?.addEventListener('change', (e) => {
    applyPresetToMaster(engine, e.target.value);
  });
  
  // Quick reverb/delay
  document.getElementById('quick-reverb')?.addEventListener('input', (e) => {
    if (engine.effects?.reverbSend) {
      engine.effects.reverbSend.gain.value = e.target.value / 100;
    }
    e.target.nextElementSibling.textContent = e.target.value + '%';
  });
  
  document.getElementById('quick-delay')?.addEventListener('input', (e) => {
    if (engine.effects?.delaySend) {
      engine.effects.delaySend.gain.value = e.target.value / 100;
    }
    e.target.nextElementSibling.textContent = e.target.value + '%';
  });
  
  // Record mode toggle
  document.getElementById('record-mode-toggle')?.addEventListener('click', (e) => {
    const modes = ['replace', 'overdub', 'play'];
    const currentIndex = modes.indexOf(engine.recordMode);
    engine.recordMode = modes[(currentIndex + 1) % modes.length];
    e.target.textContent = `🔴 Record Mode: ${engine.recordMode.toUpperCase()}`;
  });
  
  // Count-in settings
  document.getElementById('count-in-bars')?.addEventListener('change', (e) => {
    engine.countInBars = parseInt(e.target.value);
  });
  
  document.getElementById('first-track-bars')?.addEventListener('change', (e) => {
    engine.firstTrackBars = parseInt(e.target.value);
  });
  
  document.getElementById('count-in-first-only')?.addEventListener('change', (e) => {
    engine.countInFirstTrackOnly = e.target.checked;
  });
  
  document.getElementById('metronome-during-recording')?.addEventListener('change', (e) => {
    engine.metronomeDuringRecording = e.target.checked;
  });
  
  document.getElementById('quantize-enabled')?.addEventListener('change', (e) => {
    engine.quantize = e.target.checked;
  });
  
  // Sample bank
  document.getElementById('clear-sample-bank')?.addEventListener('click', clearSampleBank);
  document.getElementById('import-samples')?.addEventListener('click', importSamples);
  
  // Chopper controls (inline panel)
  document.getElementById('chop-load')?.addEventListener('click', () => document.getElementById('chop-file')?.click());
  document.getElementById('chop-file')?.addEventListener('change', (e) => engine.loadChopperFile?.(e));
  document.getElementById('chop-stop')?.addEventListener('click', () => engine.stopAllChopperSamples?.());
  document.getElementById('chop-manual-toggle')?.addEventListener('click', () => engine.toggleManualMode?.());
  document.getElementById('chop-slice-button')?.addEventListener('click', () => engine.createSlicesFromMarkers?.());
  document.getElementById('chop-clear-markers')?.addEventListener('click', () => engine.clearSliceMarkers?.());
  document.getElementById('chop-equal')?.addEventListener('click', () => engine.createEqualSlices?.());
  document.getElementById('chop-detect')?.addEventListener('click', () => engine.detectTransients?.());
  document.getElementById('chop-to-rows')?.addEventListener('click', () => engine.slicesToSequencerRows?.());
  document.getElementById('chop-to-tracks')?.addEventListener('click', () => engine.slicesToLoopTracks?.());
  document.getElementById('chop-export-all')?.addEventListener('click', () => engine.exportAllSlices?.());
  document.getElementById('chop-play-full')?.addEventListener('click', () => engine.playFullSample?.());
  
  document.getElementById('chop-slices')?.addEventListener('input', (e) => {
    engine.chopper.numSlices = parseInt(e.target.value);
    document.getElementById('chop-slices-display').textContent = e.target.value;
    if (engine.chopper.buffer) engine.createEqualSlices();
  });
  
  document.getElementById('chop-sens')?.addEventListener('input', (e) => {
    engine.chopper.sensitivity = parseFloat(e.target.value);
    document.getElementById('chop-sens-display').textContent = parseFloat(e.target.value).toFixed(2);
  });
  
  // Chopper controls (main workspace)
  document.getElementById('chop-load-main')?.addEventListener('click', () => engine.loadChopperFile?.());
  document.getElementById('manual-chop-btn')?.addEventListener('click', () => engine.toggleManualMode?.());
  document.getElementById('chop-equal-main')?.addEventListener('click', () => engine.createEqualSlices?.());
  document.getElementById('chop-detect-main')?.addEventListener('click', () => engine.detectTransients?.());
  document.getElementById('chop-slice-main')?.addEventListener('click', () => engine.createSlicesFromMarkers?.());
  document.getElementById('chop-clear-main')?.addEventListener('click', () => engine.clearSliceMarkers?.());
  document.getElementById('chop-to-rows-main')?.addEventListener('click', () => engine.slicesToSequencerRows?.());
  document.getElementById('chop-to-tracks-main')?.addEventListener('click', () => engine.slicesToLoopTracks?.());
  document.getElementById('chop-export-main')?.addEventListener('click', () => engine.exportAllSlices?.());
  document.getElementById('chop-play-full-main')?.addEventListener('click', () => engine.playFullSample?.());
  
  document.getElementById('chop-slices-main')?.addEventListener('input', (e) => {
    engine.chopper.numSlices = parseInt(e.target.value);
    document.getElementById('chop-slices-main-display').textContent = e.target.value;
    if (engine.chopper.buffer) engine.createEqualSlices();
  });
  
  document.getElementById('chop-sensitivity-main')?.addEventListener('input', (e) => {
    engine.chopper.sensitivity = parseFloat(e.target.value);
    document.getElementById('chop-sensitivity-main-display').textContent = e.target.value;
  });
  
  // Mixdown
  document.getElementById('mixdown-tracks')?.addEventListener('click', () => engine.mixdownAllTracks?.());
  document.getElementById('undo-edit')?.addEventListener('click', () => engine.undoLastEdit?.());
  
  // MIDI Controls
  document.getElementById('connect-midi-btn')?.addEventListener('click', () => {
    if (initMIDI && showMIDIMappingUI) {
      initMIDI();
      showMIDIMappingUI();
    } else {
      alert('MIDI module not loaded');
    }
  });
  
  document.getElementById('show-midi-mapping-btn')?.addEventListener('click', () => {
    if (showMIDIMappingUI) showMIDIMappingUI();
  });
  
  document.getElementById('export-midi-mapping-btn')?.addEventListener('click', () => {
    if (exportMIDIMappings) exportMIDIMappings();
  });
  
  document.getElementById('import-midi-mapping-btn')?.addEventListener('click', () => {
    document.getElementById('import-midi-mapping-file')?.click();
  });
  
  document.getElementById('import-midi-mapping-file')?.addEventListener('change', (e) => {
    if (e.target.files[0] && importMIDIMappings) importMIDIMappings(e.target.files[0]);
  });
  
  document.getElementById('midi-monitor-btn')?.addEventListener('click', () => {
    const panel = document.getElementById('midi-monitor-panel');
    panel?.classList.toggle('hidden');
  });
  
  document.getElementById('midi-monitor-close')?.addEventListener('click', () => {
    document.getElementById('midi-monitor-panel')?.classList.add('hidden');
  });
  
  // Project controls
  document.getElementById('save-project-btn')?.addEventListener('click', saveCurrentProject);
  document.getElementById('load-project-btn')?.addEventListener('click', showProjectList);
  document.getElementById('export-project-btn')?.addEventListener('click', exportProject);
  document.getElementById('new-project-btn')?.addEventListener('click', newProject);
  
  // AI Features
  document.getElementById('ai-features-btn')?.addEventListener('click', () => {
    if (showAIPanel) {
      showAIPanel();
    } else {
      alert('AI features not loaded. Check console for errors.');
    }
  });
  
  // Quick beat detection button in chopper
  document.getElementById('chop-detect-beats')?.addEventListener('click', async () => {
    if (!engine?.chopper?.buffer) {
      engine.updateStatus('Load audio first');
      return;
    }
    
    if (!BeatDetector) {
      engine.updateStatus('Beat detection not available');
      return;
    }
    
    engine.updateStatus('Analyzing beats...');
    try {
      const detector = new BeatDetector(engine.context);
      const results = await detector.analyzeBuffer(engine.chopper.buffer);
      
      engine.bpm = results.bpm;
      document.getElementById('master-bpm').value = results.bpm;
      
      // Create slices at bar boundaries
      engine.chopper.sliceMarkers = results.downbeats;
      engine.drawChopperWaveform?.();
      
      engine.updateStatus(`Detected ${results.bpm} BPM (${Math.round(results.confidence * 100)}% confidence)`);
    } catch (e) {
      console.error('Beat detection failed:', e);
      engine.updateStatus('Beat detection failed: ' + e.message);
    }
  });
}

// ==================== Project Management ====================
async function saveCurrentProject() {
  if (!saveProject) {
    alert('Storage module not available');
    return;
  }
  
  const name = prompt('Project name:', 'My Project');
  if (!name) return;
  
  const projectData = {
    name,
    bpm: engine.bpm,
    bars: engine.bars,
    sequencer: {
      grid: engine.sequencer.grid,
      velGrid: engine.sequencer.velGrid,
      rowSample: engine.sequencer.rowSample,
      swing: engine.sequencer.swing,
      patterns: engine.sequencer.patterns
    },
    // Note: Audio buffers would need special handling for storage
  };
  
  try {
    const id = await saveProject(projectData);
    engine.updateStatus(`Project "${name}" saved (ID: ${id})`);
  } catch (e) {
    console.error('Save failed:', e);
    engine.updateStatus('Failed to save project');
  }
}

async function showProjectList() {
  if (!getAllProjects) {
    alert('Storage module not available');
    return;
  }
  
  try {
    const projects = await getAllProjects();
    
    if (projects.length === 0) {
      alert('No saved projects found');
      return;
    }
    
    const projectNames = projects.map((p, i) => `${i + 1}. ${p.name} (${new Date(p.modified).toLocaleDateString()})`);
    const choice = prompt(`Load project:\n${projectNames.join('\n')}\n\nEnter number:`);
    
    if (choice) {
      const index = parseInt(choice) - 1;
      if (projects[index]) {
        await loadProjectById(projects[index].id);
      }
    }
  } catch (e) {
    console.error('Load failed:', e);
  }
}

async function loadProjectById(id) {
  if (!loadProject) return;
  
  const project = await loadProject(id);
  if (!project) return;
  
  engine.bpm = project.bpm || 120;
  engine.bars = project.bars || 4;
  
  document.getElementById('master-bpm').value = engine.bpm;
  document.getElementById('master-bars').value = engine.bars;
  
  if (project.sequencer) {
    engine.sequencer.grid = project.sequencer.grid || engine.sequencer.grid;
    engine.sequencer.velGrid = project.sequencer.velGrid || engine.sequencer.velGrid;
    engine.sequencer.rowSample = project.sequencer.rowSample || engine.sequencer.rowSample;
    engine.sequencer.swing = project.sequencer.swing || 0;
    engine.sequencer.patterns = project.sequencer.patterns || engine.sequencer.patterns;
    
    engine.renderSequencer();
  }
  
  engine.updateStatus(`Project "${project.name}" loaded`);
}

function exportProject() {
  const projectData = {
    name: 'Exported Project',
    bpm: engine.bpm,
    bars: engine.bars,
    sequencer: {
      grid: engine.sequencer.grid,
      velGrid: engine.sequencer.velGrid,
      swing: engine.sequencer.swing
    },
    exportedAt: new Date().toISOString()
  };
  
  const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'project.haw.json';
  a.click();
  URL.revokeObjectURL(url);
}

function newProject() {
  if (!confirm('Start new project? Unsaved changes will be lost.')) return;
  
  // Reset engine state
  engine.bpm = 120;
  engine.bars = 4;
  engine.sequencer.grid = Array.from({length: 8}, () => Array(16).fill(false));
  engine.sequencer.velGrid = Array.from({length: 8}, () => Array(16).fill(0.8));
  
  // Clear tracks
  engine.tracks.forEach((track, i) => {
    engine.clearTrack(i);
  });
  
  // Clear sample bank
  clearSampleBank();
  
  // Reset UI
  document.getElementById('master-bpm').value = 120;
  document.getElementById('master-bars').value = 4;
  
  engine.renderSequencer();
  engine.updateStatus('New project created');
}

// ==================== Time Display ====================
setInterval(() => {
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];
  const timeEl = document.getElementById('time-display');
  if (timeEl) timeEl.textContent = timeStr;
}, 1000);

// ==================== Keyboard Shortcuts ====================
document.addEventListener('keydown', (e) => {
  if (!engine) return;
  
  // Skip if typing in input
  if (e.target.matches('input, textarea, select')) return;
  
  // Spacebar for play/stop
  if (e.code === 'Space') {
    e.preventDefault();
    engine.isPlaying ? engine.stopAll() : engine.playAll();
  }
  
  // M for metronome
  if (e.key === 'm' || e.key === 'M') {
    e.preventDefault();
    document.getElementById('metronome-toggle')?.click();
  }
  
  // Number keys 1-8 for samples/tracks
  if (e.key >= '1' && e.key <= '8' && !e.shiftKey) {
    const index = parseInt(e.key) - 1;
    engine.playSample?.(index);
  }
  
  // MPC pad keys
  const mpcKeyMap = {
    'q': 0, 'w': 1, 'e': 2, 'r': 3,
    'a': 4, 's': 5, 'd': 6, 'f': 7,
    'z': 8, 'x': 9, 'c': 10, 'v': 11
  };
  
  if (mpcKeyMap[e.key.toLowerCase()] !== undefined) {
    const padIndex = mpcKeyMap[e.key.toLowerCase()];
    if (engine.mpc?.mode === 'slices') {
      engine.playSlice?.(padIndex);
    } else {
      engine.playSample?.(padIndex);
    }
    
    // Visual feedback
    const pad = document.querySelector(`.mpc-pad[data-index="${padIndex}"]`);
    if (pad) {
      pad.classList.add('active');
      setTimeout(() => pad.classList.remove('active'), 100);
    }
  }
});

// ==================== Window Events ====================
window.addEventListener('resize', () => {
  if (engine) {
    engine.tracks.forEach((track, idx) => {
      if (track.buffer) {
        engine.drawWaveform(idx, track.buffer);
      }
    });
    if (engine.chopper.buffer) {
      engine.drawChopperWaveform();
    }
  }
});

window.addEventListener('beforeunload', (e) => {
  if (engine && engine.tracks.some(t => t.buffer)) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ==================== Initialization ====================
window.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('loading-overlay');
  
  const start = async () => {
    try {
      // Load optional modules (non-blocking)
      await loadOptionalModules();
      
      // Initialize database if available
      if (initDB) {
        try {
          await initDB();
        } catch (e) {
          console.warn('Database init failed:', e);
        }
      }
      
      // Create and initialize engine
      engine = new UnifiedAudioEngine();
      window.engine = engine;
      
      await engine.init();
      
      // Ensure audio context is running after user interaction
      const audioResumed = await ensureAudioContextRunning(engine);
      if (!audioResumed) {
        console.warn('Audio context could not be resumed');
      }
      
      // Initialize UI components
      initializeSampleBank();
      saveCurrentPattern();
      setActivePattern(0);
      renderSequencerControls();
      engine.renderSequencer();
      
      // Bind all UI events
      bindUI();
      setupModeSwitcher();
      
      // Add global handler for audio context resume on any user interaction
      document.addEventListener('click', async () => {
        if (engine && engine.context && engine.context.state === 'suspended') {
          await ensureAudioContextRunning(engine);
        }
      }, { passive: true });
      
      document.addEventListener('touchstart', async () => {
        if (engine && engine.context && engine.context.state === 'suspended') {
          await ensureAudioContextRunning(engine);
        }
      }, { passive: true });
      
      // Load saved settings if available
      if (loadSetting && applyPresetToMaster) {
        try {
          const savedPreset = await loadSetting('masterPreset', 'ambient');
          applyPresetToMaster(engine, savedPreset);
        } catch (e) {
          console.warn('Could not load saved preset:', e);
        }
      }
      
      // Hide loading overlay
      overlay.style.display = 'none';
      
      // Update status and audio indicator based on actual audio context state
      if (engine.context && engine.context.state === 'running') {
        engine.updateStatus('Ready - Audio Active');
      } else if (engine.context && engine.context.state === 'suspended') {
        engine.updateStatus('Ready - Click anywhere to activate audio');
      } else {
        engine.updateStatus('Ready - Audio initialization may be needed');
      }
      
    } catch (e) {
      console.error('Init failed:', e);
      overlay.innerHTML = `
        <div class="loading-content">
          <h2>Initialization failed</h2>
          <p style="opacity:.7">${e.message || e}</p>
          <button class="btn" onclick="location.reload()">Reload</button>
        </div>
      `;
    }
  };
  
  // Start on click/touch (required for AudioContext)
  const startApp = () => {
    console.log('Starting app with user interaction...');
    start();
  };
  
  // Support both click and touch events for better iPad compatibility
  overlay.addEventListener('click', startApp, { once: true });
  overlay.addEventListener('touchstart', startApp, { once: true });
  
  // Also add keyboard support for accessibility
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      startApp();
    }
  }, { once: true });
  
  // Make overlay focusable for keyboard navigation
  overlay.setAttribute('tabindex', '0');
  overlay.setAttribute('aria-label', 'Click or tap to start the audio workstation');
});

// ==================== Expose Global Functions ====================
window.clearSampleBank = clearSampleBank;
window.importSamples = importSamples;
window.autoChop = autoChop;
window.manualChopMode = manualChopMode;
window.saveCurrentPattern = saveCurrentPattern;
window.loadPattern = loadPattern;
window.clearPattern = clearPattern;
window.setActivePattern = setActivePattern;
window.renderSequencerControls = renderSequencerControls;

// Helper function to ensure audio is ready before critical operations
window.ensureAudioReady = async function() {
  if (!engine) return false;
  return await ensureAudioContextRunning(engine);
};
