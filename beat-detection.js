// beat-detection.js - Enhanced Beat Detection Module
// Client-side tempo and beat detection using multiple algorithms

/**
 * Beat Detection Configuration
 */
const CONFIG = {
  // FFT settings
  fftSize: 2048,
  smoothingTimeConstant: 0.8,
  
  // Energy detection
  energyThreshold: 1.5,        // Multiplier above average for beat
  minBeatInterval: 0.2,        // Minimum seconds between beats (300 BPM max)
  maxBeatInterval: 2.0,        // Maximum seconds between beats (30 BPM min)
  
  // Tempo estimation
  minBPM: 60,
  maxBPM: 200,
  tempoResolution: 0.5,        // BPM precision
  
  // Onset detection
  onsetThreshold: 0.15,
  onsetSensitivity: 0.5,
  
  // Frequency bands for detection
  bands: {
    subBass: [20, 60],
    bass: [60, 250],
    lowMid: [250, 500],
    mid: [500, 2000],
    highMid: [2000, 4000],
    high: [4000, 20000]
  }
};

/**
 * Main BeatDetector class
 */
export class BeatDetector {
  constructor(audioContext) {
    this.context = audioContext;
    this.analyser = null;
    this.dataArray = null;
    this.frequencyData = null;
    this.previousEnergy = 0;
    this.beatHistory = [];
    this.onsetHistory = [];
    this.lastBeatTime = 0;
    this.detectedBPM = null;
    this.confidence = 0;
    this.isAnalyzing = false;
    
    // Callbacks
    this.onBeat = null;
    this.onBPMDetected = null;
  }
  
  /**
   * Initialize the analyser node
   */
  init() {
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = CONFIG.fftSize;
    this.analyser.smoothingTimeConstant = CONFIG.smoothingTimeConstant;
    
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.frequencyData = new Float32Array(this.analyser.frequencyBinCount);
    
    return this.analyser;
  }
  
  /**
   * Connect audio source for real-time detection
   */
  connectSource(source) {
    if (!this.analyser) this.init();
    source.connect(this.analyser);
  }
  
  /**
   * Analyze an AudioBuffer for tempo/beats (offline)
   * @param {AudioBuffer} buffer - Audio to analyze
   * @returns {Promise<object>} Analysis results
   */
  async analyzeBuffer(buffer) {
    console.log('Starting beat analysis...');
    
    const results = {
      bpm: null,
      confidence: 0,
      beats: [],
      onsets: [],
      downbeats: [],
      timeSignature: '4/4',
      key: null
    };
    
    try {
      // Get audio data
      const channelData = buffer.getChannelData(0);
      const sampleRate = buffer.sampleRate;
      const duration = buffer.duration;
      
      console.log(`Analyzing ${duration.toFixed(2)}s of audio at ${sampleRate}Hz`);
      
      // Step 1: Detect onsets (transients)
      results.onsets = this.detectOnsets(channelData, sampleRate);
      console.log(`Found ${results.onsets.length} onsets`);
      
      // Step 2: Estimate tempo from onset intervals
      const tempoResult = this.estimateTempo(results.onsets, duration);
      results.bpm = tempoResult.bpm;
      results.confidence = tempoResult.confidence;
      console.log(`Estimated BPM: ${results.bpm} (confidence: ${(results.confidence * 100).toFixed(1)}%)`);
      
      // Step 3: Generate beat grid aligned to detected tempo
      results.beats = this.generateBeatGrid(results.onsets, results.bpm, duration);
      console.log(`Generated ${results.beats.length} beat markers`);
      
      // Step 4: Identify downbeats (first beat of each bar)
      results.downbeats = this.identifyDownbeats(results.beats, results.onsets, channelData, sampleRate);
      
      // Step 5: Detect time signature
      results.timeSignature = this.detectTimeSignature(results.beats, results.downbeats);
      
      this.detectedBPM = results.bpm;
      this.confidence = results.confidence;
      
      return results;
      
    } catch (error) {
      console.error('Beat analysis failed:', error);
      throw error;
    }
  }
  
  /**
   * Detect onsets (transients) in audio data
   */
  detectOnsets(data, sampleRate) {
    const onsets = [];
    const windowSize = Math.floor(sampleRate * 0.02); // 20ms windows
    const hopSize = Math.floor(windowSize / 4);
    const sensitivity = CONFIG.onsetSensitivity;
    
    let previousEnergy = 0;
    let previousSpectralFlux = 0;
    const energyHistory = [];
    const maxHistoryLength = 43; // ~1 second at 23ms hop
    
    for (let i = 0; i < data.length - windowSize; i += hopSize) {
      // Calculate current window energy
      let energy = 0;
      let highFreqEnergy = 0;
      
      for (let j = 0; j < windowSize; j++) {
        const sample = data[i + j];
        energy += sample * sample;
        
        // Rough high-frequency energy approximation
        if (j > 0) {
          const diff = Math.abs(sample - data[i + j - 1]);
          highFreqEnergy += diff * diff;
        }
      }
      
      energy = Math.sqrt(energy / windowSize);
      highFreqEnergy = Math.sqrt(highFreqEnergy / windowSize);
      
      // Keep energy history for adaptive threshold
      energyHistory.push(energy);
      if (energyHistory.length > maxHistoryLength) {
        energyHistory.shift();
      }
      
      // Calculate adaptive threshold
      const avgEnergy = energyHistory.reduce((a, b) => a + b, 0) / energyHistory.length;
      const threshold = avgEnergy * (1.5 + (1 - sensitivity) * 2);
      
      // Spectral flux (change in energy)
      const spectralFlux = Math.max(0, energy - previousEnergy);
      
      // Detect onset
      const isOnset = (
        energy > threshold &&
        spectralFlux > previousSpectralFlux * (1.2 + sensitivity) &&
        energy > 0.01 // Noise floor
      );
      
      if (isOnset) {
        const time = i / sampleRate;
        
        // Check minimum interval from last onset
        if (onsets.length === 0 || time - onsets[onsets.length - 1].time > CONFIG.minBeatInterval * 0.5) {
          onsets.push({
            time,
            energy,
            strength: spectralFlux / (avgEnergy + 0.001)
          });
        }
      }
      
      previousEnergy = energy;
      previousSpectralFlux = spectralFlux;
    }
    
    return onsets;
  }
  
  /**
   * Estimate tempo from onset intervals using autocorrelation
   */
  estimateTempo(onsets, duration) {
    if (onsets.length < 4) {
      return { bpm: 120, confidence: 0 };
    }
    
    // Calculate inter-onset intervals
    const intervals = [];
    for (let i = 1; i < onsets.length; i++) {
      const interval = onsets[i].time - onsets[i - 1].time;
      if (interval >= CONFIG.minBeatInterval && interval <= CONFIG.maxBeatInterval) {
        intervals.push({
          interval,
          strength: (onsets[i].strength + onsets[i - 1].strength) / 2
        });
      }
    }
    
    if (intervals.length < 3) {
      return { bpm: 120, confidence: 0 };
    }
    
    // Build tempo histogram
    const histogram = new Map();
    const resolution = CONFIG.tempoResolution;
    
    for (const { interval, strength } of intervals) {
      // Convert interval to BPM and check multiples/divisions
      for (const multiplier of [0.5, 1, 2, 4]) {
        const bpm = Math.round((60 / interval) * multiplier / resolution) * resolution;
        
        if (bpm >= CONFIG.minBPM && bpm <= CONFIG.maxBPM) {
          const current = histogram.get(bpm) || { count: 0, totalStrength: 0 };
          histogram.set(bpm, {
            count: current.count + 1,
            totalStrength: current.totalStrength + strength
          });
        }
      }
    }
    
    // Find best BPM candidate
    let bestBPM = 120;
    let bestScore = 0;
    
    for (const [bpm, data] of histogram) {
      const score = data.count * data.totalStrength;
      if (score > bestScore) {
        bestScore = score;
        bestBPM = bpm;
      }
    }
    
    // Calculate confidence
    const totalIntervals = intervals.length;
    const matchingIntervals = histogram.get(bestBPM)?.count || 0;
    const confidence = Math.min(1, matchingIntervals / totalIntervals + 0.2);
    
    // Refine BPM using weighted average of nearby candidates
    let weightedSum = 0;
    let weightTotal = 0;
    
    for (const [bpm, data] of histogram) {
      if (Math.abs(bpm - bestBPM) <= 5) {
        const weight = data.count * data.totalStrength;
        weightedSum += bpm * weight;
        weightTotal += weight;
      }
    }
    
    if (weightTotal > 0) {
      bestBPM = Math.round(weightedSum / weightTotal / resolution) * resolution;
    }
    
    return { bpm: bestBPM, confidence };
  }
  
  /**
   * Generate a beat grid aligned to detected tempo
   */
  generateBeatGrid(onsets, bpm, duration) {
    const beatInterval = 60 / bpm;
    const beats = [];
    
    // Find best starting point from onsets
    let bestOffset = 0;
    let bestScore = 0;
    
    // Try different phase offsets
    for (let offset = 0; offset < beatInterval; offset += 0.01) {
      let score = 0;
      
      for (const onset of onsets) {
        // Calculate distance to nearest beat at this offset
        const beatNumber = Math.round((onset.time - offset) / beatInterval);
        const expectedTime = offset + beatNumber * beatInterval;
        const distance = Math.abs(onset.time - expectedTime);
        
        // Score inversely proportional to distance, weighted by onset strength
        if (distance < beatInterval * 0.25) {
          score += onset.strength * (1 - distance / beatInterval);
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestOffset = offset;
      }
    }
    
    // Generate beat grid
    for (let time = bestOffset; time < duration; time += beatInterval) {
      beats.push({
        time,
        type: 'beat',
        confidence: this.getBeatConfidence(time, onsets, beatInterval)
      });
    }
    
    return beats;
  }
  
  /**
   * Get confidence score for a beat position
   */
  getBeatConfidence(time, onsets, beatInterval) {
    const tolerance = beatInterval * 0.15; // 15% of beat interval
    
    for (const onset of onsets) {
      if (Math.abs(onset.time - time) < tolerance) {
        return Math.min(1, onset.strength);
      }
    }
    
    return 0.3; // Low confidence for interpolated beats
  }
  
  /**
   * Identify downbeats (first beat of each bar)
   */
  identifyDownbeats(beats, onsets, data, sampleRate) {
    const downbeats = [];
    
    // Analyze energy at each beat to find accented beats
    const beatEnergies = beats.map(beat => {
      const sampleIndex = Math.floor(beat.time * sampleRate);
      const windowSize = Math.floor(sampleRate * 0.05); // 50ms window
      
      let energy = 0;
      for (let i = 0; i < windowSize && sampleIndex + i < data.length; i++) {
        energy += data[sampleIndex + i] * data[sampleIndex + i];
      }
      
      return {
        time: beat.time,
        energy: Math.sqrt(energy / windowSize)
      };
    });
    
    // Find periodic strong beats (every 4 beats typically)
    for (let groupSize = 3; groupSize <= 6; groupSize++) {
      const scores = new Array(groupSize).fill(0);
      
      for (let i = 0; i < beatEnergies.length; i++) {
        scores[i % groupSize] += beatEnergies[i].energy;
      }
      
      // Check if there's a clear winner
      const maxScore = Math.max(...scores);
      const avgScore = scores.reduce((a, b) => a + b) / scores.length;
      
      if (maxScore > avgScore * 1.3) {
        const downbeatPosition = scores.indexOf(maxScore);
        
        // Mark downbeats
        for (let i = downbeatPosition; i < beats.length; i += groupSize) {
          downbeats.push(beats[i].time);
        }
        
        break;
      }
    }
    
    // Fallback: every 4 beats
    if (downbeats.length === 0) {
      for (let i = 0; i < beats.length; i += 4) {
        downbeats.push(beats[i].time);
      }
    }
    
    return downbeats;
  }
  
  /**
   * Detect time signature based on accent patterns
   */
  detectTimeSignature(beats, downbeats) {
    if (downbeats.length < 2 || beats.length < 8) {
      return '4/4';
    }
    
    // Calculate beats between downbeats
    const beatsPerBar = [];
    
    for (let i = 1; i < downbeats.length; i++) {
      const barStart = downbeats[i - 1];
      const barEnd = downbeats[i];
      
      let count = 0;
      for (const beat of beats) {
        if (beat.time >= barStart && beat.time < barEnd) {
          count++;
        }
      }
      
      if (count > 0) {
        beatsPerBar.push(count);
      }
    }
    
    // Find most common bar length
    const histogram = {};
    for (const count of beatsPerBar) {
      histogram[count] = (histogram[count] || 0) + 1;
    }
    
    let mostCommon = 4;
    let maxCount = 0;
    
    for (const [count, freq] of Object.entries(histogram)) {
      if (freq > maxCount) {
        maxCount = freq;
        mostCommon = parseInt(count);
      }
    }
    
    // Map to time signatures
    const signatures = {
      3: '3/4',
      4: '4/4',
      5: '5/4',
      6: '6/8',
      7: '7/8',
      8: '4/4' // Could be 4/4 with subdivisions
    };
    
    return signatures[mostCommon] || '4/4';
  }
  
  /**
   * Real-time beat detection (call in animation frame)
   */
  detectRealtime() {
    if (!this.analyser) return null;
    
    this.analyser.getByteFrequencyData(this.dataArray);
    
    // Calculate energy in bass frequencies (where beats usually are)
    const bassEnd = Math.floor(250 * CONFIG.fftSize / this.context.sampleRate);
    let bassEnergy = 0;
    
    for (let i = 0; i < bassEnd; i++) {
      bassEnergy += this.dataArray[i];
    }
    bassEnergy /= bassEnd;
    
    // Detect beat
    const now = this.context.currentTime;
    const timeSinceLastBeat = now - this.lastBeatTime;
    
    const isBeat = (
      bassEnergy > this.previousEnergy * CONFIG.energyThreshold &&
      timeSinceLastBeat > CONFIG.minBeatInterval &&
      bassEnergy > 100 // Minimum threshold
    );
    
    if (isBeat) {
      this.lastBeatTime = now;
      this.beatHistory.push({
        time: now,
        energy: bassEnergy
      });
      
      // Keep history limited
      if (this.beatHistory.length > 20) {
        this.beatHistory.shift();
      }
      
      // Update BPM estimate from recent beats
      if (this.beatHistory.length >= 4) {
        this.updateRealtimeBPM();
      }
      
      // Trigger callback
      if (this.onBeat) {
        this.onBeat({ time: now, energy: bassEnergy });
      }
    }
    
    this.previousEnergy = this.previousEnergy * 0.8 + bassEnergy * 0.2;
    
    return {
      isBeat,
      energy: bassEnergy,
      bpm: this.detectedBPM,
      confidence: this.confidence
    };
  }
  
  /**
   * Update BPM from real-time beat history
   */
  updateRealtimeBPM() {
    if (this.beatHistory.length < 4) return;
    
    const intervals = [];
    for (let i = 1; i < this.beatHistory.length; i++) {
      intervals.push(this.beatHistory[i].time - this.beatHistory[i - 1].time);
    }
    
    // Filter outliers
    const sorted = [...intervals].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const filtered = intervals.filter(i => Math.abs(i - median) < median * 0.3);
    
    if (filtered.length < 3) return;
    
    const avgInterval = filtered.reduce((a, b) => a + b) / filtered.length;
    const bpm = Math.round(60 / avgInterval);
    
    if (bpm >= CONFIG.minBPM && bpm <= CONFIG.maxBPM) {
      this.detectedBPM = bpm;
      this.confidence = filtered.length / intervals.length;
      
      if (this.onBPMDetected) {
        this.onBPMDetected({ bpm: this.detectedBPM, confidence: this.confidence });
      }
    }
  }
  
  /**
   * Quantize time to nearest beat
   */
  quantizeTobeat(time, bpm, strength = 1) {
    const beatInterval = 60 / bpm;
    const beatNumber = Math.round(time / beatInterval);
    const quantizedTime = beatNumber * beatInterval;
    
    // Blend based on strength (0 = no quantize, 1 = full quantize)
    return time + (quantizedTime - time) * strength;
  }
  
  /**
   * Get beat grid for a given duration and BPM
   */
  getBeatGrid(bpm, duration, offset = 0) {
    const beatInterval = 60 / bpm;
    const beats = [];
    
    for (let time = offset; time < duration; time += beatInterval) {
      const beatInBar = Math.round((time - offset) / beatInterval) % 4;
      beats.push({
        time,
        isDownbeat: beatInBar === 0,
        beatInBar
      });
    }
    
    return beats;
  }
}

/**
 * Quick BPM detection function
 * @param {AudioBuffer} buffer - Audio buffer to analyze
 * @returns {Promise<number>} Detected BPM
 */
export async function detectBPM(buffer) {
  const detector = new BeatDetector(buffer.context || new AudioContext());
  const results = await detector.analyzeBuffer(buffer);
  return results.bpm;
}

/**
 * Create slice points at detected beats
 * @param {AudioBuffer} buffer - Audio buffer
 * @param {object} options - Options
 * @returns {Promise<number[]>} Array of slice times
 */
export async function getSlicePointsFromBeats(buffer, options = {}) {
  const {
    beatsPerSlice = 4,  // Slice every N beats (4 = 1 bar in 4/4)
    includeOnsets = false
  } = options;
  
  const detector = new BeatDetector(buffer.context || new AudioContext());
  const results = await detector.analyzeBuffer(buffer);
  
  const slicePoints = [0]; // Always start at 0
  
  if (includeOnsets) {
    // Use onsets as slice points
    for (const onset of results.onsets) {
      if (onset.strength > 0.5 && onset.time > slicePoints[slicePoints.length - 1] + 0.1) {
        slicePoints.push(onset.time);
      }
    }
  } else {
    // Use beat grid
    for (let i = beatsPerSlice; i < results.beats.length; i += beatsPerSlice) {
      slicePoints.push(results.beats[i].time);
    }
  }
  
  return slicePoints;
}

// Export for global access
if (typeof window !== 'undefined') {
  window.BeatDetector = BeatDetector;
  window.detectBPM = detectBPM;
  window.getSlicePointsFromBeats = getSlicePointsFromBeats;
}
