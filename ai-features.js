// ai-features.js - AI-powered audio features
// Beat detection, sample generation, and stem separation

// ==================== Configuration ====================
const AI_CONFIG = {
  // Replicate API for AI generation and stem separation
  replicateApiKey: null,
  replicateBaseUrl: 'https://api.replicate.com/v1',
  
  // Model IDs on Replicate
  models: {
    musicgen: 'meta/musicgen:b05b1dff1d8c6dc63d14b0cdb42135571e41f5ef1b74acd85a4c6f966296de77',
    demucs: 'cjwbw/demucs:25a173108cff36ef9f80f854c162d01df9e6528be175794b81f7ea5f90e7decd',
    riffusion: 'riffusion/riffusion:8cf61ea6c56afd61d8f5b9ffd14d7c216c0a93844ce2d82ac1c9ecc9c7f24e05'
  },
  
  // Local beat detection settings
  beatDetection: {
    minBPM: 60,
    maxBPM: 200,
    defaultSensitivity: 0.5
  }
};

// ==================== API Key Management ====================

/**
 * Set Replicate API key
 * @param {string} key - API key from replicate.com
 */
export function setReplicateApiKey(key) {
  AI_CONFIG.replicateApiKey = key;
  try {
    localStorage.setItem('replicateApiKey', key);
  } catch (e) {}
  console.log('Replicate API key set');
}

/**
 * Load API key from storage
 */
export function loadApiKey() {
  try {
    const key = localStorage.getItem('replicateApiKey');
    if (key) {
      AI_CONFIG.replicateApiKey = key;
      return true;
    }
  } catch (e) {}
  return false;
}

/**
 * Check if API key is configured
 */
export function hasApiKey() {
  return !!AI_CONFIG.replicateApiKey;
}

// ==================== BEAT DETECTION ====================

/**
 * Advanced beat detection using multiple algorithms
 * @param {AudioBuffer} buffer - Audio buffer to analyze
 * @param {object} options - Detection options
 * @returns {object} Beat analysis results
 */
export function detectBeats(buffer, options = {}) {
  const {
    sensitivity = 0.5,
    minBPM = AI_CONFIG.beatDetection.minBPM,
    maxBPM = AI_CONFIG.beatDetection.maxBPM
  } = options;
  
  const sampleRate = buffer.sampleRate;
  const data = buffer.getChannelData(0);
  
  // Step 1: Compute onset detection function
  const onsets = computeOnsetDetectionFunction(data, sampleRate, sensitivity);
  
  // Step 2: Find peaks in onset function
  const peaks = findOnsetPeaks(onsets, sampleRate, sensitivity);
  
  // Step 3: Estimate BPM using autocorrelation
  const bpmResult = estimateBPM(onsets, sampleRate, minBPM, maxBPM);
  
  // Step 4: Quantize beats to grid
  const beatGrid = createBeatGrid(peaks, bpmResult.bpm, buffer.duration, sampleRate);
  
  // Step 5: Detect downbeats (measure starts)
  const downbeats = detectDownbeats(data, beatGrid, sampleRate);
  
  return {
    bpm: bpmResult.bpm,
    confidence: bpmResult.confidence,
    beats: beatGrid,
    downbeats: downbeats,
    onsets: peaks,
    duration: buffer.duration,
    beatsPerBar: 4, // Assume 4/4 time
    
    // Helpful derived values
    beatDuration: 60 / bpmResult.bpm,
    barDuration: (60 / bpmResult.bpm) * 4,
    totalBeats: Math.round(buffer.duration / (60 / bpmResult.bpm)),
    totalBars: Math.round(buffer.duration / ((60 / bpmResult.bpm) * 4))
  };
}

/**
 * Compute onset detection function using spectral flux
 */
function computeOnsetDetectionFunction(data, sampleRate, sensitivity) {
  const frameSize = 2048;
  const hopSize = 512;
  const numFrames = Math.floor((data.length - frameSize) / hopSize);
  const onsets = new Float32Array(numFrames);
  
  // Frequency bands for multi-band onset detection
  const bands = [
    { low: 0, high: 200, weight: 2.0 },    // Sub-bass (kick drums)
    { low: 200, high: 400, weight: 1.5 },  // Bass
    { low: 400, high: 2000, weight: 1.0 }, // Midrange
    { low: 2000, high: 8000, weight: 1.2 } // High (hi-hats, cymbals)
  ];
  
  let prevSpectrum = null;
  
  for (let frame = 0; frame < numFrames; frame++) {
    const startSample = frame * hopSize;
    
    // Apply Hann window and compute magnitude spectrum
    const spectrum = computeSpectrum(data, startSample, frameSize);
    
    if (prevSpectrum) {
      // Compute spectral flux (positive differences only)
      let flux = 0;
      
      for (const band of bands) {
        const lowBin = Math.floor(band.low * frameSize / sampleRate);
        const highBin = Math.floor(band.high * frameSize / sampleRate);
        
        let bandFlux = 0;
        for (let bin = lowBin; bin < highBin && bin < spectrum.length; bin++) {
          const diff = spectrum[bin] - prevSpectrum[bin];
          if (diff > 0) bandFlux += diff * diff;
        }
        
        flux += Math.sqrt(bandFlux) * band.weight;
      }
      
      onsets[frame] = flux;
    }
    
    prevSpectrum = spectrum;
  }
  
  // Normalize
  const maxOnset = Math.max(...onsets);
  if (maxOnset > 0) {
    for (let i = 0; i < onsets.length; i++) {
      onsets[i] /= maxOnset;
    }
  }
  
  // Apply adaptive threshold based on sensitivity
  const threshold = 0.1 + (1 - sensitivity) * 0.3;
  for (let i = 0; i < onsets.length; i++) {
    if (onsets[i] < threshold) onsets[i] = 0;
  }
  
  return onsets;
}

/**
 * Compute magnitude spectrum using simple DFT
 */
function computeSpectrum(data, start, size) {
  const spectrum = new Float32Array(size / 2);
  
  // Simple magnitude calculation (not full FFT but adequate for onset detection)
  for (let k = 0; k < size / 2; k++) {
    let real = 0, imag = 0;
    
    for (let n = 0; n < size; n++) {
      const sample = data[start + n] || 0;
      // Hann window
      const window = 0.5 * (1 - Math.cos(2 * Math.PI * n / size));
      const angle = -2 * Math.PI * k * n / size;
      real += sample * window * Math.cos(angle);
      imag += sample * window * Math.sin(angle);
    }
    
    spectrum[k] = Math.sqrt(real * real + imag * imag);
  }
  
  return spectrum;
}

/**
 * Find peaks in onset detection function
 */
function findOnsetPeaks(onsets, sampleRate, sensitivity) {
  const hopSize = 512;
  const minPeakDistance = Math.floor(sampleRate * 0.05 / hopSize); // Min 50ms between peaks
  const peaks = [];
  
  const threshold = 0.15 + (1 - sensitivity) * 0.25;
  
  for (let i = 1; i < onsets.length - 1; i++) {
    // Check if local maximum
    if (onsets[i] > onsets[i - 1] && onsets[i] > onsets[i + 1] && onsets[i] > threshold) {
      // Check minimum distance from last peak
      if (peaks.length === 0 || i - peaks[peaks.length - 1].frame >= minPeakDistance) {
        peaks.push({
          frame: i,
          time: (i * hopSize) / sampleRate,
          strength: onsets[i]
        });
      }
    }
  }
  
  return peaks;
}

/**
 * Estimate BPM using autocorrelation
 */
function estimateBPM(onsets, sampleRate, minBPM, maxBPM) {
  const hopSize = 512;
  const minLag = Math.floor((60 / maxBPM) * sampleRate / hopSize);
  const maxLag = Math.floor((60 / minBPM) * sampleRate / hopSize);
  
  // Compute autocorrelation
  const autocorr = new Float32Array(maxLag - minLag);
  
  for (let lag = minLag; lag < maxLag; lag++) {
    let sum = 0;
    let count = 0;
    
    for (let i = 0; i < onsets.length - lag; i++) {
      sum += onsets[i] * onsets[i + lag];
      count++;
    }
    
    autocorr[lag - minLag] = count > 0 ? sum / count : 0;
  }
  
  // Find peaks in autocorrelation
  let maxCorr = 0;
  let bestLag = minLag;
  
  for (let i = 1; i < autocorr.length - 1; i++) {
    if (autocorr[i] > autocorr[i - 1] && autocorr[i] > autocorr[i + 1]) {
      if (autocorr[i] > maxCorr) {
        maxCorr = autocorr[i];
        bestLag = i + minLag;
      }
    }
  }
  
  // Convert lag to BPM
  const bpm = 60 / ((bestLag * hopSize) / sampleRate);
  
  // Round to nearest integer BPM
  const roundedBPM = Math.round(bpm);
  
  // Confidence based on autocorrelation strength
  const confidence = Math.min(maxCorr * 2, 1);
  
  return { bpm: roundedBPM, confidence };
}

/**
 * Create quantized beat grid
 */
function createBeatGrid(peaks, bpm, duration, sampleRate) {
  const beatInterval = 60 / bpm;
  const totalBeats = Math.ceil(duration / beatInterval);
  
  // Find the best phase (offset) for the beat grid
  let bestPhase = 0;
  let bestScore = 0;
  
  for (let phase = 0; phase < beatInterval; phase += beatInterval / 20) {
    let score = 0;
    
    for (const peak of peaks) {
      const nearestBeat = Math.round((peak.time - phase) / beatInterval) * beatInterval + phase;
      const distance = Math.abs(peak.time - nearestBeat);
      
      if (distance < beatInterval * 0.2) {
        score += peak.strength * (1 - distance / (beatInterval * 0.2));
      }
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestPhase = phase;
    }
  }
  
  // Generate beat grid
  const beats = [];
  for (let i = 0; i < totalBeats; i++) {
    const time = bestPhase + i * beatInterval;
    if (time < duration) {
      beats.push({
        index: i,
        time: time,
        isDownbeat: i % 4 === 0
      });
    }
  }
  
  return beats;
}

/**
 * Detect downbeats (measure starts) using spectral analysis
 */
function detectDownbeats(data, beatGrid, sampleRate) {
  const downbeats = [];
  const frameSize = 4096;
  
  // Analyze energy at each beat
  const beatEnergies = beatGrid.map(beat => {
    const startSample = Math.floor(beat.time * sampleRate);
    
    let lowEnergy = 0;
    let totalEnergy = 0;
    
    for (let i = 0; i < frameSize && startSample + i < data.length; i++) {
      const sample = data[startSample + i];
      totalEnergy += sample * sample;
      
      // Low frequency energy (rough approximation)
      if (i % 4 === 0) lowEnergy += sample * sample * 4;
    }
    
    return {
      time: beat.time,
      index: beat.index,
      lowEnergy,
      totalEnergy,
      ratio: totalEnergy > 0 ? lowEnergy / totalEnergy : 0
    };
  });
  
  // Find beats with high low-frequency energy (likely kick drums / downbeats)
  const avgRatio = beatEnergies.reduce((sum, b) => sum + b.ratio, 0) / beatEnergies.length;
  
  for (let i = 0; i < beatEnergies.length; i += 4) {
    // Look at groups of 4 beats, find the one most likely to be the downbeat
    let maxEnergy = 0;
    let downbeatIndex = i;
    
    for (let j = i; j < i + 4 && j < beatEnergies.length; j++) {
      if (beatEnergies[j].lowEnergy > maxEnergy) {
        maxEnergy = beatEnergies[j].lowEnergy;
        downbeatIndex = j;
      }
    }
    
    if (beatEnergies[downbeatIndex]) {
      downbeats.push(beatEnergies[downbeatIndex].time);
    }
  }
  
  return downbeats;
}

/**
 * Snap a time position to the nearest beat
 * @param {number} time - Time in seconds
 * @param {object} beatInfo - Beat detection results
 * @returns {number} Snapped time
 */
export function snapToBeat(time, beatInfo) {
  const { beats } = beatInfo;
  
  let nearest = beats[0];
  let minDistance = Math.abs(time - beats[0].time);
  
  for (const beat of beats) {
    const distance = Math.abs(time - beat.time);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = beat;
    }
  }
  
  return nearest.time;
}

/**
 * Get slices aligned to beats
 * @param {AudioBuffer} buffer - Audio buffer
 * @param {number} numSlices - Number of slices
 * @param {object} options - Options
 * @returns {array} Slice boundaries aligned to beats
 */
export function getBeatAlignedSlices(buffer, numSlices, options = {}) {
  const beatInfo = detectBeats(buffer, options);
  const { beats, bpm, barDuration } = beatInfo;
  
  const slices = [];
  const duration = buffer.duration;
  const sliceDuration = duration / numSlices;
  
  for (let i = 0; i < numSlices; i++) {
    const idealStart = i * sliceDuration;
    const idealEnd = (i + 1) * sliceDuration;
    
    // Snap to nearest beat
    const start = snapToBeat(idealStart, beatInfo);
    const end = i === numSlices - 1 ? duration : snapToBeat(idealEnd, beatInfo);
    
    slices.push({
      index: i,
      start,
      end,
      duration: end - start,
      startBeat: Math.round(start / (60 / bpm)),
      endBeat: Math.round(end / (60 / bpm))
    });
  }
  
  return { slices, beatInfo };
}

// ==================== AI SAMPLE GENERATION ====================

/**
 * Generate audio sample using MusicGen
 * @param {string} prompt - Text description of desired audio
 * @param {object} options - Generation options
 * @returns {Promise<ArrayBuffer>} Generated audio
 */
export async function generateSample(prompt, options = {}) {
  if (!AI_CONFIG.replicateApiKey) {
    throw new Error('Replicate API key not set. Call setReplicateApiKey() first.');
  }
  
  const {
    duration = 8,
    model = 'musicgen',
    temperature = 1.0,
    topK = 250,
    topP = 0,
    classifier_free_guidance = 3
  } = options;
  
  const modelId = AI_CONFIG.models[model] || AI_CONFIG.models.musicgen;
  
  // Start prediction
  const response = await fetch(`${AI_CONFIG.replicateBaseUrl}/predictions`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${AI_CONFIG.replicateApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      version: modelId.split(':')[1],
      input: {
        prompt: prompt,
        duration: Math.min(duration, 30), // Max 30 seconds
        temperature,
        top_k: topK,
        top_p: topP,
        classifier_free_guidance,
        output_format: 'wav'
      }
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to start generation');
  }
  
  const prediction = await response.json();
  
  // Poll for completion
  const result = await pollPrediction(prediction.id);
  
  if (result.status === 'failed') {
    throw new Error(result.error || 'Generation failed');
  }
  
  // Download the audio
  // Handle both array output (MusicGen returns array) and direct URL
  let audioUrl = result.output;
  if (Array.isArray(audioUrl)) {
    audioUrl = audioUrl[0]; // MusicGen returns array with single URL
  }
  
  if (!audioUrl) {
    throw new Error('No output URL received from generation');
  }
  
  const audioResponse = await fetch(audioUrl);
  if (!audioResponse.ok) {
    throw new Error(`Failed to download generated audio: ${audioResponse.status}`);
  }
  const audioBuffer = await audioResponse.arrayBuffer();
  
  return audioBuffer;
}

/**
 * Generate drum loop
 */
export async function generateDrumLoop(style, bpm, options = {}) {
  const prompts = {
    'boom-bap': `boom bap hip hop drums, dusty vinyl sound, ${bpm} bpm, punchy kick and snare`,
    'trap': `trap drums with 808 bass, hi-hat rolls, ${bpm} bpm, hard hitting`,
    'house': `house music drums, four on the floor kick, ${bpm} bpm, groovy`,
    'dnb': `drum and bass drums, fast breakbeat, ${bpm} bpm, energetic`,
    'lofi': `lo-fi hip hop drums, relaxed groove, ${bpm} bpm, vinyl crackle`,
    'jazz': `jazz drums, brush strokes, swing feel, ${bpm} bpm`,
    'rock': `rock drums, powerful kick and snare, ${bpm} bpm`,
    'electronic': `electronic drums, synthesized percussion, ${bpm} bpm`
  };
  
  const prompt = prompts[style] || `drums in ${style} style, ${bpm} bpm`;
  
  return generateSample(prompt, { duration: options.duration || 8 });
}

/**
 * Generate bass line
 */
export async function generateBassLine(style, key = 'C', bpm, options = {}) {
  const prompt = `${style} bass line in ${key}, ${bpm} bpm, deep and groovy, clean recording`;
  return generateSample(prompt, { duration: options.duration || 8 });
}

/**
 * Generate melody
 */
export async function generateMelody(style, key = 'C', bpm, options = {}) {
  const prompt = `${style} melody in ${key} major, ${bpm} bpm, catchy and memorable, single instrument`;
  return generateSample(prompt, { duration: options.duration || 8 });
}

/**
 * Generate ambient texture
 */
export async function generateAmbient(mood, options = {}) {
  const prompt = `ambient soundscape, ${mood} mood, atmospheric, ethereal, layered textures`;
  return generateSample(prompt, { duration: options.duration || 15 });
}

// ==================== STEM SEPARATION ====================

/**
 * Separate audio into stems using Demucs
 * @param {ArrayBuffer} audioData - Audio file data
 * @param {object} options - Separation options
 * @returns {Promise<object>} Object with drum, bass, vocals, other buffers
 */
export async function separateStems(audioData, options = {}) {
  if (!AI_CONFIG.replicateApiKey) {
    throw new Error('Replicate API key not set. Call setReplicateApiKey() first.');
  }
  
  const {
    model = 'htdemucs', // htdemucs, htdemucs_ft, mdx_extra
    stems = 4 // 2 (vocals/instrumental) or 4 (drums, bass, vocals, other)
  } = options;
  
  // Convert ArrayBuffer to base64
  const base64Audio = arrayBufferToBase64(audioData);
  const dataUrl = `data:audio/wav;base64,${base64Audio}`;
  
  // Start prediction
  const response = await fetch(`${AI_CONFIG.replicateBaseUrl}/predictions`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${AI_CONFIG.replicateApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      version: AI_CONFIG.models.demucs.split(':')[1],
      input: {
        audio: dataUrl,
        model: model,
        stems: stems,
        clip_mode: 'rescale',
        mp3_bitrate: 320
      }
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to start separation');
  }
  
  const prediction = await response.json();
  
  // Poll for completion
  const result = await pollPrediction(prediction.id);
  
  if (result.status === 'failed') {
    throw new Error(result.error || 'Separation failed');
  }
  
  // Download all stems
  const stems_result = {};
  
  if (result.output) {
    // Result may be an object with stem URLs or an array
    if (typeof result.output === 'object' && !Array.isArray(result.output)) {
      for (const [stemName, url] of Object.entries(result.output)) {
        const stemResponse = await fetch(url);
        stems_result[stemName] = await stemResponse.arrayBuffer();
      }
    } else if (Array.isArray(result.output)) {
      const stemNames = ['drums', 'bass', 'other', 'vocals'];
      for (let i = 0; i < result.output.length; i++) {
        const stemResponse = await fetch(result.output[i]);
        stems_result[stemNames[i] || `stem_${i}`] = await stemResponse.arrayBuffer();
      }
    }
  }
  
  return stems_result;
}

/**
 * Extract just the drums from audio
 */
export async function extractDrums(audioData) {
  const stems = await separateStems(audioData);
  return stems.drums;
}

/**
 * Extract just the vocals from audio
 */
export async function extractVocals(audioData) {
  const stems = await separateStems(audioData);
  return stems.vocals;
}

/**
 * Create instrumental (remove vocals)
 */
export async function createInstrumental(audioData) {
  const stems = await separateStems(audioData);
  // Would need to mix drums + bass + other
  // For now, return the "other" stem which often has the most instrumental content
  return stems;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Poll Replicate prediction until complete
 */
async function pollPrediction(predictionId, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`${AI_CONFIG.replicateBaseUrl}/predictions/${predictionId}`, {
      headers: {
        'Authorization': `Token ${AI_CONFIG.replicateApiKey}`
      }
    });
    
    const result = await response.json();
    
    if (result.status === 'succeeded' || result.status === 'failed') {
      return result;
    }
    
    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Update progress if callback provided
    if (window._aiProgressCallback) {
      window._aiProgressCallback({
        status: result.status,
        progress: i / maxAttempts
      });
    }
  }
  
  throw new Error('Prediction timed out');
}

/**
 * Convert ArrayBuffer to base64
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Set progress callback for AI operations
 */
export function setProgressCallback(callback) {
  window._aiProgressCallback = callback;
}

// ==================== UI INTEGRATION ====================

/**
 * Show AI features panel
 */
export function showAIPanel() {
  let panel = document.getElementById('ai-panel');
  
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'ai-panel';
    panel.innerHTML = getAIPanelHTML();
    document.body.appendChild(panel);
    bindAIPanelEvents();
  }
  
  panel.style.display = 'block';
}

function getAIPanelHTML() {
  const hasKey = hasApiKey();
  
  return `
    <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a1a2e;border:2px solid #00ff88;border-radius:12px;padding:20px;z-index:10000;min-width:500px;max-height:80vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
        <h3 style="color:#00ff88;margin:0;">ðŸ¤– AI Features</h3>
        <button onclick="document.getElementById('ai-panel').style.display='none'" style="background:#ff4444;border:none;color:#fff;padding:5px 10px;border-radius:4px;cursor:pointer;">âœ•</button>
      </div>
      
      <!-- API Key Section -->
      <div style="background:#0a0a0a;padding:15px;border-radius:8px;margin-bottom:15px;">
        <h4 style="color:#00ccff;margin:0 0 10px 0;">ðŸ”‘ API Configuration</h4>
        <p style="font-size:12px;opacity:0.7;margin-bottom:10px;">Get your API key from <a href="https://replicate.com" target="_blank" style="color:#00ff88;">replicate.com</a></p>
        <label for="ai-api-key" class="sr-only">Replicate API Key</label>
        <input type="password" id="ai-api-key" placeholder="Enter Replicate API key" value="${hasKey ? 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢' : ''}" style="width:100%;padding:8px;background:#2a2a3e;border:1px solid #444;color:#fff;border-radius:4px;" aria-label="Replicate API Key">
        <button id="ai-save-key" style="margin-top:10px;padding:8px 15px;background:linear-gradient(135deg,#00ff88,#00ccff);border:none;color:#000;border-radius:4px;cursor:pointer;font-weight:bold;">Save Key</button>
        <span id="ai-key-status" style="margin-left:10px;font-size:12px;">${hasKey ? 'âœ… Key saved' : ''}</span>
      </div>
      
      <!-- Beat Detection Section -->
      <div style="background:#0a0a0a;padding:15px;border-radius:8px;margin-bottom:15px;">
        <h4 style="color:#ff8800;margin:0 0 10px 0;">ðŸ¥ Beat Detection</h4>
        <p style="font-size:12px;opacity:0.7;margin-bottom:10px;">Analyze audio to detect BPM, beats, and downbeats (works offline)</p>
        <button id="ai-detect-beats" class="btn" style="width:100%;">ðŸŽ¯ Detect Beats in Chopper</button>
        <div id="beat-detection-results" style="margin-top:10px;display:none;padding:10px;background:#1a1a2e;border-radius:4px;">
          <div>BPM: <span id="detected-bpm">--</span> (confidence: <span id="bpm-confidence">--</span>)</div>
          <div>Total beats: <span id="total-beats">--</span></div>
          <div>Total bars: <span id="total-bars">--</span></div>
          <button id="ai-apply-bpm" class="btn mini-btn" style="margin-top:10px;">Apply BPM</button>
          <button id="ai-slice-to-beats" class="btn mini-btn">Slice to Beats</button>
          <button id="ai-slice-to-bars" class="btn mini-btn">Slice to Bars</button>
        </div>
      </div>
      
      <!-- Sample Generation Section -->
      <div style="background:#0a0a0a;padding:15px;border-radius:8px;margin-bottom:15px;">
        <h4 style="color:#00ff88;margin:0 0 10px 0;">ðŸŽµ AI Sample Generation</h4>
        <p style="font-size:12px;opacity:0.7;margin-bottom:10px;">Generate audio samples using AI (requires API key)</p>
        
        <div style="margin-bottom:10px;">
          <label for="ai-gen-type" style="font-size:12px;color:#888;">Generation Type:</label>
          <select id="ai-gen-type" style="width:100%;padding:8px;background:#2a2a3e;border:1px solid #444;color:#fff;border-radius:4px;margin-top:5px;">
            <option value="custom">Custom Prompt</option>
            <option value="drums">Drum Loop</option>
            <option value="bass">Bass Line</option>
            <option value="melody">Melody</option>
            <option value="ambient">Ambient Texture</option>
          </select>
        </div>
        
        <div id="ai-custom-prompt-section">
          <label for="ai-prompt" style="font-size:12px;color:#888;">Prompt:</label>
          <textarea id="ai-prompt" placeholder="Describe the audio you want to generate..." style="width:100%;height:60px;padding:8px;background:#2a2a3e;border:1px solid #444;color:#fff;border-radius:4px;margin-top:5px;resize:vertical;"></textarea>
        </div>
        
        <div id="ai-preset-section" style="display:none;">
          <label for="ai-gen-style" style="font-size:12px;color:#888;">Style:</label>
          <select id="ai-gen-style" style="width:100%;padding:8px;background:#2a2a3e;border:1px solid #444;color:#fff;border-radius:4px;margin-top:5px;">
            <option value="boom-bap">Boom Bap</option>
            <option value="trap">Trap</option>
            <option value="house">House</option>
            <option value="lofi">Lo-Fi</option>
            <option value="dnb">Drum & Bass</option>
            <option value="jazz">Jazz</option>
            <option value="rock">Rock</option>
            <option value="electronic">Electronic</option>
          </select>
        </div>
        
        <div style="display:flex;gap:10px;margin-top:10px;">
          <div style="flex:1;">
            <label for="ai-duration" style="font-size:12px;color:#888;">Duration (sec):</label>
            <input type="number" id="ai-duration" value="8" min="1" max="30" style="width:100%;padding:8px;background:#2a2a3e;border:1px solid #444;color:#fff;border-radius:4px;margin-top:5px;">
          </div>
          <div style="flex:1;">
            <label for="ai-bpm" style="font-size:12px;color:#888;">Use BPM:</label>
            <input type="number" id="ai-bpm" value="120" min="60" max="200" style="width:100%;padding:8px;background:#2a2a3e;border:1px solid #444;color:#fff;border-radius:4px;margin-top:5px;">
          </div>
        </div>
        
        <button id="ai-generate" class="btn btn-primary" style="width:100%;margin-top:15px;" ${!hasKey ? 'disabled' : ''}>
          âœ¨ Generate Sample
        </button>
        
        <div id="ai-generation-progress" style="display:none;margin-top:10px;">
          <div style="background:#333;border-radius:4px;overflow:hidden;">
            <div id="ai-progress-bar" style="height:4px;background:linear-gradient(90deg,#00ff88,#00ccff);width:0%;transition:width 0.3s;"></div>
          </div>
          <p id="ai-progress-text" style="font-size:12px;text-align:center;margin-top:5px;">Starting...</p>
        </div>
      </div>
      
      <!-- Stem Separation Section -->
      <div style="background:#0a0a0a;padding:15px;border-radius:8px;">
        <h4 style="color:#ff00ff;margin:0 0 10px 0;">ðŸŽšï¸ Stem Separation</h4>
        <p style="font-size:12px;opacity:0.7;margin-bottom:10px;">Split audio into drums, bass, vocals, and other (requires API key)</p>
        
        <button id="ai-separate-chopper" class="btn" style="width:100%;" ${!hasKey ? 'disabled' : ''}>
          ðŸ”€ Separate Stems from Chopper
        </button>
        
        <div id="stem-results" style="display:none;margin-top:10px;">
          <p style="font-size:12px;margin-bottom:10px;">Stems ready! Send to tracks:</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <button id="stem-drums" class="btn mini-btn">ðŸ¥ Drums â†’ Track</button>
            <button id="stem-bass" class="btn mini-btn">ðŸŽ¸ Bass â†’ Track</button>
            <button id="stem-vocals" class="btn mini-btn">ðŸŽ¤ Vocals â†’ Track</button>
            <button id="stem-other" class="btn mini-btn">ðŸŽ¹ Other â†’ Track</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function bindAIPanelEvents() {
  // API Key
  document.getElementById('ai-save-key')?.addEventListener('click', () => {
    const input = document.getElementById('ai-api-key');
    if (input.value && !input.value.includes('â€¢')) {
      setReplicateApiKey(input.value);
      document.getElementById('ai-key-status').textContent = 'âœ… Key saved';
      document.getElementById('ai-generate').disabled = false;
      document.getElementById('ai-separate-chopper').disabled = false;
    }
  });
  
  // Generation type change
  document.getElementById('ai-gen-type')?.addEventListener('change', (e) => {
    const isCustom = e.target.value === 'custom';
    document.getElementById('ai-custom-prompt-section').style.display = isCustom ? 'block' : 'none';
    document.getElementById('ai-preset-section').style.display = isCustom ? 'none' : 'block';
  });
  
  // Beat detection
  document.getElementById('ai-detect-beats')?.addEventListener('click', async () => {
    const engine = window.engine;
    if (!engine?.chopper?.buffer) {
      alert('Load audio in the chopper first');
      return;
    }
    
    const results = detectBeats(engine.chopper.buffer);
    
    document.getElementById('detected-bpm').textContent = results.bpm;
    document.getElementById('bpm-confidence').textContent = (results.confidence * 100).toFixed(0) + '%';
    document.getElementById('total-beats').textContent = results.totalBeats;
    document.getElementById('total-bars').textContent = results.totalBars;
    document.getElementById('beat-detection-results').style.display = 'block';
    
    // Store results for later use
    window._beatDetectionResults = results;
    
    engine.updateStatus(`Detected ${results.bpm} BPM (${(results.confidence * 100).toFixed(0)}% confidence)`);
  });
  
  // Apply BPM
  document.getElementById('ai-apply-bpm')?.addEventListener('click', () => {
    const results = window._beatDetectionResults;
    if (!results) return;
    
    window.engine.bpm = results.bpm;
    document.getElementById('master-bpm').value = results.bpm;
    document.getElementById('ai-bpm').value = results.bpm;
    window.engine.updateStatus(`BPM set to ${results.bpm}`);
  });
  
  // Slice to beats
  document.getElementById('ai-slice-to-beats')?.addEventListener('click', () => {
    const results = window._beatDetectionResults;
    const engine = window.engine;
    if (!results || !engine) return;
    
    // Create slices at beat positions
    engine.chopper.sliceMarkers = results.beats.map(b => b.time);
    engine.chopper.slices = [];
    
    for (let i = 0; i < results.beats.length; i++) {
      const start = results.beats[i].time;
      const end = results.beats[i + 1]?.time || engine.chopper.buffer.duration;
      engine.chopper.slices.push({ start, end });
    }
    
    engine.drawChopperWaveform?.();
    engine.renderChopperPads?.();
    engine.updateStatus(`Created ${engine.chopper.slices.length} beat-aligned slices`);
  });
  
  // Slice to bars
  document.getElementById('ai-slice-to-bars')?.addEventListener('click', () => {
    const results = window._beatDetectionResults;
    const engine = window.engine;
    if (!results || !engine) return;
    
    // Create slices at bar positions (every 4 beats)
    engine.chopper.sliceMarkers = [];
    engine.chopper.slices = [];
    
    for (let i = 0; i < results.beats.length; i += 4) {
      const start = results.beats[i].time;
      const end = results.beats[i + 4]?.time || engine.chopper.buffer.duration;
      
      engine.chopper.sliceMarkers.push(start);
      engine.chopper.slices.push({ start, end });
    }
    
    engine.drawChopperWaveform?.();
    engine.renderChopperPads?.();
    engine.updateStatus(`Created ${engine.chopper.slices.length} bar-aligned slices`);
  });
  
  // Generate sample
  document.getElementById('ai-generate')?.addEventListener('click', async () => {
    const genType = document.getElementById('ai-gen-type').value;
    const duration = parseInt(document.getElementById('ai-duration').value);
    const bpm = parseInt(document.getElementById('ai-bpm').value);
    
    const progressDiv = document.getElementById('ai-generation-progress');
    const progressBar = document.getElementById('ai-progress-bar');
    const progressText = document.getElementById('ai-progress-text');
    
    progressDiv.style.display = 'block';
    progressBar.style.width = '10%';
    progressText.textContent = 'Starting generation...';
    
    setProgressCallback(({ status, progress }) => {
      progressBar.style.width = `${10 + progress * 80}%`;
      progressText.textContent = `${status}... ${Math.round(progress * 100)}%`;
    });
    
    try {
      let audioData;
      
      if (genType === 'custom') {
        const prompt = document.getElementById('ai-prompt').value;
        if (!prompt) {
          alert('Please enter a prompt');
          progressDiv.style.display = 'none';
          return;
        }
        audioData = await generateSample(prompt, { duration });
      } else if (genType === 'drums') {
        const style = document.getElementById('ai-gen-style').value;
        audioData = await generateDrumLoop(style, bpm, { duration });
      } else if (genType === 'bass') {
        const style = document.getElementById('ai-gen-style').value;
        audioData = await generateBassLine(style, 'C', bpm, { duration });
      } else if (genType === 'melody') {
        const style = document.getElementById('ai-gen-style').value;
        audioData = await generateMelody(style, 'C', bpm, { duration });
      } else if (genType === 'ambient') {
        audioData = await generateAmbient('dreamy', { duration });
      }
      
      progressBar.style.width = '90%';
      progressText.textContent = 'Loading audio...';
      
      // Decode and load into chopper
      const engine = window.engine;
      const audioBuffer = await engine.context.decodeAudioData(audioData);
      
      engine.chopper.buffer = audioBuffer;
      engine.drawChopperWaveform?.();
      engine.drawChopperWaveformMain?.();
      engine.updateChopperInfo?.();
      
      progressBar.style.width = '100%';
      progressText.textContent = 'Done!';
      
      setTimeout(() => {
        progressDiv.style.display = 'none';
      }, 2000);
      
      engine.updateStatus('AI sample loaded into chopper');
      
    } catch (error) {
      console.error('Generation failed:', error);
      progressDiv.style.display = 'none';
      alert('Generation failed: ' + error.message);
    }
  });
  
  // Stem separation
  document.getElementById('ai-separate-chopper')?.addEventListener('click', async () => {
    const engine = window.engine;
    if (!engine?.chopper?.buffer) {
      alert('Load audio in the chopper first');
      return;
    }
    
    const progressDiv = document.getElementById('ai-generation-progress');
    const progressBar = document.getElementById('ai-progress-bar');
    const progressText = document.getElementById('ai-progress-text');
    
    progressDiv.style.display = 'block';
    progressBar.style.width = '10%';
    progressText.textContent = 'Uploading audio...';
    
    setProgressCallback(({ status, progress }) => {
      progressBar.style.width = `${10 + progress * 80}%`;
      progressText.textContent = `Separating... ${Math.round(progress * 100)}%`;
    });
    
    try {
      // Convert buffer to WAV
      const wavBlob = engine._audioBufferToWav(engine.chopper.buffer);
      const arrayBuffer = await wavBlob.arrayBuffer();
      
      const stems = await separateStems(arrayBuffer);
      
      window._separatedStems = stems;
      
      progressBar.style.width = '100%';
      progressText.textContent = 'Done!';
      
      document.getElementById('stem-results').style.display = 'block';
      
      setTimeout(() => {
        progressDiv.style.display = 'none';
      }, 2000);
      
      engine.updateStatus('Stems separated successfully');
      
    } catch (error) {
      console.error('Separation failed:', error);
      progressDiv.style.display = 'none';
      alert('Separation failed: ' + error.message);
    }
  });
  
  // Stem buttons
  ['drums', 'bass', 'vocals', 'other'].forEach(stemName => {
    document.getElementById(`stem-${stemName}`)?.addEventListener('click', async () => {
      const stems = window._separatedStems;
      if (!stems?.[stemName]) {
        alert(`${stemName} stem not available`);
        return;
      }
      
      const engine = window.engine;
      const emptyTrack = engine.tracks.findIndex(t => !t.buffer);
      
      if (emptyTrack === -1) {
        alert('No empty tracks available');
        return;
      }
      
      const audioBuffer = await engine.context.decodeAudioData(stems[stemName].slice(0));
      engine.tracks[emptyTrack].buffer = audioBuffer;
      engine.drawWaveform(emptyTrack, audioBuffer);
      engine.updateStatus(`${stemName} loaded to Track ${emptyTrack + 1}`);
    });
  });
}

// ==================== EXPORTS ====================

// Load API key on module load
loadApiKey();

// Export for global access
if (typeof window !== 'undefined') {
  window.aiFeatures = {
    // Configuration
    setReplicateApiKey,
    hasApiKey,
    
    // Beat detection
    detectBeats,
    snapToBeat,
    getBeatAlignedSlices,
    
    // Sample generation
    generateSample,
    generateDrumLoop,
    generateBassLine,
    generateMelody,
    generateAmbient,
    
    // Stem separation
    separateStems,
    extractDrums,
    extractVocals,
    createInstrumental,
    
    // UI
    showAIPanel,
    setProgressCallback
  };
}
