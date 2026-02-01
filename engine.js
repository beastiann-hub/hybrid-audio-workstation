import { attachCore } from './core.js';
import { installTracksImpls, attachTracks } from './tracks.js';
import { installChopperImpls, attachChopper } from './chopper.js';
import { attachSequencer, installSequencerImpls } from './sequencer.js';

// Unified Audio Engine
     export class UnifiedAudioEngine {
    constructor(options = {}) {
        // allow UI callbacks
        this.onStatus = options.onStatus || null;

        // Initialize tracks array
        this.maxTracks = 8;
        this.tracks = [];

            this.chopper = {
                buffer: null,
                slices: [],
                numSlices: 8,
                sensitivity: 0.5,
                attack: 0.01,
                release: 0.08,
                pitch: 1.0,
                sliceMarkers: [],
                manualMode: false,
                selectedSlice: 0,
                isDragging: false,
                dragMarkerIndex: -1,
                dragTolerance: 10, /* pixels for detecting marker clicks */
                zoom: 1,
                scrollPosition: 0,
                playingSources: new Set(), // Track playing audio sources for stopping
                trimStart: 0,
                trimEnd: null
            };
            // Tap tempo
            this.tapTimes = [];
            this.lastTapTime = 0;
            
            // Sequencer
            this.sequencer = {
                enabled: true,
                numRows: 8,
                numSteps: 16,
                stepDiv: 16,
                grid: Array.from({length: 8}, () => Array(16).fill(false)),
                rowSample: Array(8).fill(null),
                nextStepTime: 0,
                currentStep: 0,
                rowGain: Array(8).fill(0.9),
                rowPan: Array(8).fill(0),
                rowRev: Array(8).fill(0),
                rowDel: Array(8).fill(0),
                velGrid: Array.from({length: 8}, () => Array(16).fill(0.8)),
                swing: 0,
                patternBars: 1,
                activePattern: 0,
                chainEnabled: false,
                chain: 'AAA',
                patterns: [
                    { grid: Array.from({length:8},()=>Array(16).fill(false)), vel: Array.from({length:8},()=>Array(16).fill(0.8)) },
                    { grid: Array.from({length:8},()=>Array(16).fill(false)), vel: Array.from({length:8},()=>Array(16).fill(0.8)) },
                    { grid: Array.from({length:8},()=>Array(16).fill(false)), vel: Array.from({length:8},()=>Array(16).fill(0.8)) }
                ]
            };
        }

        async init() {
            try {
                // Delegate core audio setup to core module to centralize context and effects
                try {
                    attachCore(this);
                } catch (e) {
                    console.warn('attachCore failed, falling back to inline init', e);
                    // If attachCore fails, fall back to inline initialization (best-effort)
                    if (!this.context) this.context = new (window.AudioContext || window.webkitAudioContext)();
                    if (!this.masterGain) {
                        this.masterGain = this.context.createGain();
                        this.masterGain.gain.value = 0.7;
                        this.masterGain.connect(this.context.destination);
                    }
                }
                // Ensure backwards-compatible AudioContext aliases exist whether attachCore succeeded or fallback used
                try {
                    if (this.context && !this.audioContext) this.audioContext = this.context;
                    if (this.context && !this.audioCtx) this.audioCtx = this.context;
                } catch (e) {
                    // ignore
                }

                // Install and attach track helpers (module boundary)
                try { installTracksImpls(this); console.log('installTracksImpls completed; engine.applyTrackEffectPreset:', typeof this.applyTrackEffectPreset); } catch (e) { console.warn('installTracksImpls failed', e); }
                try { attachTracks(this); } catch (e) { console.warn('attachTracks failed', e); }

                // Install and attach chopper helpers
                try { installChopperImpls(this); } catch (e) { console.warn('installChopperImpls failed', e); }
                try { attachChopper(this); } catch (e) { console.warn('attachChopper failed', e); }

                // Install sequencer implementations and attach helpers
                try { installSequencerImpls(this); } catch (e) { console.warn('installSequencerImpls failed', e); }
                try { attachSequencer(this); } catch (e) { console.warn('attachSequencer failed', e); }
                
                // Initialize tracks
                for (let i = 0; i < this.maxTracks; i++) {
                    this.tracks.push({
                        buffer: null,
                        source: null,
                        gain: null,
                        panner: null,
                        isPlaying: false,
                        isRecording: false,
                        recorder: null,
                        chunks: [],
                        pan: 0,
                        volume: 100,
                        sliceMarkers: [],
                        _playheadRAF: null,
                        _recordingRAF: null,
                        _playheadStartTime: null,
                        _recordingStartTime: null,
                        trimStart: 0,
                        trimEnd: null, // null means use full length
                        muted: false,
                        soloed: false
                    });
                }
                
                // Initialize undo stack
                this.undoStack = [];
                
                // Create per-track effect send nodes directly so per-track FX are always available
                try {
                    console.log('Creating per-track sends for', this.maxTracks, 'tracks...');
                    for (let i = 0; i < this.maxTracks; i++) {
                        try {
                            const track = this.tracks[i];
                            if (!track) continue;
                            // create sends if context and global effect buses are present
                            if (this.context) {
                                try {
                                    track.reverbSend = track.reverbSend || this.context.createGain();
                                    track.reverbSend.gain.value = track.reverbSend.gain.value || 0;
                                    if (this.effects && this.effects.reverbSend) track.reverbSend.connect(this.effects.reverbSend);
                                } catch (e) {
                                    console.warn('Failed to create/connect track.reverbSend for', i, e);
                                }
                                try {
                                    track.delaySend = track.delaySend || this.context.createGain();
                                    track.delaySend.gain.value = track.delaySend.gain.value || 0;
                                    if (this.effects && this.effects.delaySend) track.delaySend.connect(this.effects.delaySend);
                                } catch (e) {
                                    console.warn('Failed to create/connect track.delaySend for', i, e);
                                }
                            }
                        } catch (e) {
                            console.warn('per-track send init failed for track', i, e);
                        }
                    }
                    console.log('Per-track sends created. Track 0 reverbSend:', !!this.tracks[0]?.reverbSend);
                } catch (e) {
                    console.warn('Error while creating per-track sends during init', e);
                }
                
                // Initialize UI components
                this.initChopper();
                this.bindUI();
                this.renderTracks();
                
                // Start meters
                this.startMeters();
                
                return true;
            } catch (error) {
                console.error('Audio initialization failed:', error);
                throw error;
            }
        }

        // Track methods moved to tracks.js - implementation installed via installTracksImpls(engine)
        // These stub methods are kept for reference but functionality is in tracks.js
        renderTracks() { throw new Error('renderTracks should be bound by installTracksImpls'); }
        createTrackCard(trackIndex, mode) { throw new Error('createTrackCard should be bound by installTracksImpls'); }
        importTrackFromFileDialog(trackIndex) { throw new Error('importTrackFromFileDialog should be bound by installTracksImpls'); }
        startRecording(trackIndex) { throw new Error('startRecording should be bound by installTracksImpls'); }
        doCountIn() { throw new Error('doCountIn should be bound by installTracksImpls'); }
        _updateRecordingPlayhead(trackIndex) { throw new Error('_updateRecordingPlayhead should be bound by installTracksImpls'); }
        stopRecording(trackIndex) { throw new Error('stopRecording should be bound by installTracksImpls'); }
        mixBuffers(buffer1, buffer2) { throw new Error('mixBuffers should be bound by installTracksImpls'); }
        mixBuffersAligned(existingBuffer, newBuffer) { throw new Error('mixBuffersAligned should be bound by installTracksImpls'); }
        playTrack(trackIndex) { throw new Error('playTrack should be bound by installTracksImpls'); }
        _updatePlayhead(trackIndex) { throw new Error('_updatePlayhead should be bound by installTracksImpls'); }
        stopTrack(trackIndex) { throw new Error('stopTrack should be bound by installTracksImpls'); }
        clearTrack(trackIndex) { throw new Error('clearTrack should be bound by installTracksImpls'); }
        drawWaveform(trackIndex, buffer, containerId = null) { throw new Error('drawWaveform should be bound by installTracksImpls'); }
        setupWaveformTrimInteraction(canvas, trackIndex, duration) { throw new Error('setupWaveformTrimInteraction should be bound by installTracksImpls'); }
        showTrimControls(trackIndex) { throw new Error('showTrimControls should be bound by installTracksImpls'); }
        hideTrimControls(trackIndex) { throw new Error('hideTrimControls should be bound by installTracksImpls'); }
        showTrimAppliedFeedback(trackIndex) { throw new Error('showTrimAppliedFeedback should be bound by installTracksImpls'); }
        
        startMeters() {
            const updateMeters = () => {
                if (this.analyser) {
                    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
                    this.analyser.getByteFrequencyData(dataArray);
                    
                    // Calculate average level
                    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                    const normalized = average / 255;
                    
                    // Fake CPU load (would need real calculation)
                    const cpuLoad = Math.round(normalized * 30 + Math.random() * 10);
                    document.getElementById('cpu-load').textContent = `CPU: ${cpuLoad}%`;
                }
                
                requestAnimationFrame(updateMeters);
            };
            
            requestAnimationFrame(updateMeters);
        }
        
        // ===== CHOPPER METHODS MOVED TO chopper.js =====
        // These are stub methods that will be bound by installChopperImpls(engine) during init()
        // Do NOT call these directly - they will throw errors if accessed before installChopperImpls runs
        
        initChopper() { throw new Error('initChopper should be bound by installChopperImpls'); }
        drawChopperWaveform() { throw new Error('drawChopperWaveform should be bound by installChopperImpls'); }
        stopAllChopperSamples() { throw new Error('stopAllChopperSamples should be bound by installChopperImpls'); }
        setupManualChopMode() { throw new Error('setupManualChopMode should be bound by installChopperImpls'); }
        findNearbyMarker(timePosition, canvas) { throw new Error('findNearbyMarker should be bound by installChopperImpls'); }
        addSliceMarker(timePosition) { throw new Error('addSliceMarker should be bound by installChopperImpls'); }
        updateSlicesFromMarkers() { throw new Error('updateSlicesFromMarkers should be bound by installChopperImpls'); }
        clearSliceMarkers() { throw new Error('clearSliceMarkers should be bound by installChopperImpls'); }
        toggleManualMode() { throw new Error('toggleManualMode should be bound by installChopperImpls'); }
        createSlicesFromMarkers() { throw new Error('createSlicesFromMarkers should be bound by installChopperImpls'); }
        smartSlice() { throw new Error('smartSlice should be bound by installChopperImpls'); }
        loadChopperFile() { throw new Error('loadChopperFile should be bound by installChopperImpls'); }
        drawChopperWaveformMain() { throw new Error('drawChopperWaveformMain should be bound by installChopperImpls'); }
        setupManualChopModeMain() { throw new Error('setupManualChopModeMain should be bound by installChopperImpls'); }
        renderChopperPadsMain() { throw new Error('renderChopperPadsMain should be bound by installChopperImpls'); }
        updateChopperInfo() { throw new Error('updateChopperInfo should be bound by installChopperImpls'); }
        updateSliceCountDisplay() { throw new Error('updateSliceCountDisplay should be bound by installChopperImpls'); }
        playFullSample() { throw new Error('playFullSample should be bound by installChopperImpls'); }
        selectSliceForEffects(sliceIndex) { throw new Error('selectSliceForEffects should be bound by installChopperImpls'); }
        playSliceWithEffects(sliceIndex) { throw new Error('playSliceWithEffects should be bound by installChopperImpls'); }
        resetSliceEffects(sliceIndex) { throw new Error('resetSliceEffects should be bound by installChopperImpls'); }
        applySliceEffectPreset(sliceIndex, presetName = null) { throw new Error('applySliceEffectPreset should be bound by installChopperImpls'); }
        exportSliceWithEffects(sliceIndex) { throw new Error('exportSliceWithEffects should be bound by installChopperImpls'); }
        createEqualSlices() { throw new Error('createEqualSlices should be bound by installChopperImpls'); }
        detectTransients() { throw new Error('detectTransients should be bound by installChopperImpls'); }
        renderChopperPads() { throw new Error('renderChopperPads should be bound by installChopperImpls'); }
        playSlice(index) { throw new Error('playSlice should be bound by installChopperImpls'); }
        slicesToSequencerRows() { throw new Error('slicesToSequencerRows should be bound by installChopperImpls'); }
        slicesToLoopTracks() { throw new Error('slicesToLoopTracks should be bound by installChopperImpls'); }
        exportAllSlices() { throw new Error('exportAllSlices should be bound by installChopperImpls'); }
        setupChopperInteraction() { throw new Error('setupChopperInteraction should be bound by installChopperImpls'); }

        // ===== Remaining helper methods (not moved to modules) =====

        applyEffectPreset() {
            const slice = this.chopper.slices[sliceIndex];
            if (!slice) return;
            
            // Get preset name from dropdown if not provided
            if (!presetName) {
                const presetSelect = document.getElementById(`slice-effect-preset-${sliceIndex}`);
                presetName = presetSelect ? presetSelect.value : 'none';
            }
            
            if (presetName === 'none') return;
            
            // Define effect presets
            const presets = {
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
                'underwater': {
                    filter_type: 'lowpass',
                    filter_freq: 400,
                    filter_q: 0.5,
                    chorus_rate: 0.5,
                    chorus_depth: 0.008,
                    reverb_size: 0.8,
                    reverb_decay: 6,
                    reverb_mix: 0.6,
                    pitch: 0.8
                },
                'robot': {
                    filter_type: 'bandpass',
                    filter_freq: 1500,
                    filter_q: 10,
                    dist_drive: 20,
                    dist_curve: 80,
                    dist_mix: 0.7,
                    tremolo_rate: 8,
                    tremolo_depth: 0.8,
                    pitch: 0.7
                },
                'vintage': {
                    filter_type: 'lowpass',
                    filter_freq: 5000,
                    filter_q: 1.5,
                    dist_drive: 3,
                    dist_curve: 15,
                    dist_mix: 0.2,
                    chorus_rate: 1.5,
                    chorus_depth: 0.005,
                    tremolo_rate: 0.8,
                    tremolo_depth: 0.2
                },
                'space': {
                    delay_time: 0.375,
                    delay_feedback: 0.7,
                    delay_mix: 0.8,
                    reverb_size: 0.9,
                    reverb_decay: 8,
                    reverb_mix: 0.5,
                    chorus_rate: 0.3,
                    chorus_depth: 0.012
                },
                'glitch': {
                    dist_drive: 25,
                    dist_curve: 90,
                    dist_mix: 0.5,
                    tremolo_rate: 16,
                    tremolo_depth: 0.9,
                    delay_time: 0.08,
                    delay_feedback: 0.8,
                    delay_mix: 0.4,
                    pitch: 1.5
                }
            };
            
            const preset = presets[presetName];
            if (preset) {
                // Apply preset to slice effects
                slice.effects = { ...slice.effects, ...preset };
                
                // Update the UI controls
                this.selectSliceForEffects(sliceIndex);
                
                // Update all sliders to match the preset values
                Object.keys(preset).forEach(param => {
                    const slider = document.getElementById(`slice-${param.replace('_', '-')}-${sliceIndex}`);
                    const display = document.getElementById(`slice-${param.replace('_', '-')}-${sliceIndex}-display`);
                    if (slider && display) {
                        slider.value = preset[param];
                        
                        // Update display with appropriate suffix
                        let suffix = '';
                        if (param.includes('freq')) suffix = 'Hz';
                        else if (param.includes('time') || param.includes('decay')) suffix = 's';
                        else if (param.includes('rate')) suffix = 'Hz';
                        
                        const decimals = param.includes('depth') && param.includes('chorus') ? 3 : 
                                       param.includes('freq') || param.includes('curve') || param.includes('vibrato') ? 0 : 
                                       param.includes('rate') || param.includes('drive') || param.includes('q') ? 1 : 2;
                        
                        display.textContent = parseFloat(preset[param]).toFixed(decimals) + suffix;
                    }
                });
                
                // Update dropdowns
                const filterType = document.getElementById(`slice-filter-type-${sliceIndex}`);
                if (filterType && preset.filter_type) {
                    filterType.value = preset.filter_type;
                }
                
                this.updateStatus(`Applied "${presetName}" preset to slice ${sliceIndex + 1}`);
            }
        }
        
        exportSliceWithEffects(sliceIndex) {
            // TODO: Implement offline rendering with effects
            this.updateStatus('Export with effects - coming soon!');
        }
        
        createEqualSlices() {
            if (!this.chopper.buffer) return;
            
            const duration = this.chopper.buffer.duration;
            const sliceLength = duration / this.chopper.numSlices;
            
            this.chopper.sliceMarkers = [];
            this.chopper.slices = [];
            
            for (let i = 0; i < this.chopper.numSlices; i++) {
                const start = i * sliceLength;
                const end = (i + 1) * sliceLength;
                
                this.chopper.sliceMarkers.push(start);
                this.chopper.slices.push({ start, end });
            }
            
            this.drawChopperWaveform();
            this.drawChopperWaveformMain();
            this.renderChopperPads();
            this.renderChopperPadsMain();
            this.updateStatus(`Created ${this.chopper.numSlices} equal slices`);
        }
        
        detectTransients() {
            if (!this.chopper.buffer) return;
            
            const data = this.chopper.buffer.getChannelData(0);
            const sampleRate = this.chopper.buffer.sampleRate;
            const sensitivity = this.chopper.sensitivity;
            
            // Improved transient detection using multiple algorithms
            const windowSize = Math.floor(sampleRate * 0.02); // 20ms window for better resolution
            const hopSize = Math.floor(windowSize / 8); // More overlap for precision
            const minDistance = Math.floor(sampleRate * 0.03); // Minimum 30ms between transients
            
            // Sensitivity-based adaptive thresholds (inverted for intuitive behavior)
            const baseEnergyThreshold = 1.2 + (1 - sensitivity) * 1.8; // 3.0 (low sens) to 1.2 (high sens)
            const spectralFluxThreshold = 0.02 + sensitivity * 0.2; // 0.02 to 0.22
            const highFreqThreshold = 0.15 + sensitivity * 0.5; // 0.15 to 0.65
            
            const transientCandidates = [];
            let previousEnergy = 0;
            let previousSpectralCentroid = 0;
            let previousHighFreqEnergy = 0;
            
            // Process audio in overlapping windows
            for (let i = 0; i < data.length - windowSize; i += hopSize) {
                // Calculate multiple energy measures
                let totalEnergy = 0;
                let highFreqEnergy = 0;
                let magnitudeSum = 0;
                let weightedSum = 0;
                
                // Analyze current window
                for (let j = 0; j < windowSize; j++) {
                    const sample = data[i + j];
                    const sampleSquared = sample * sample;
                    totalEnergy += sampleSquared;
                    
                    // High frequency energy (rough approximation)
                    if (j > windowSize * 0.6) {
                        highFreqEnergy += sampleSquared;
                    }
                    
                    // For spectral centroid
                    const magnitude = Math.abs(sample);
                    magnitudeSum += magnitude;
                    weightedSum += magnitude * (j / windowSize);
                }
                
                // Normalize energies
                totalEnergy = Math.sqrt(totalEnergy / windowSize);
                highFreqEnergy = Math.sqrt(highFreqEnergy / (windowSize * 0.4));
                const spectralCentroid = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
                
                // Multiple transient detection criteria
                const energyIncrease = totalEnergy > previousEnergy * baseEnergyThreshold;
                const spectralChange = Math.abs(spectralCentroid - previousSpectralCentroid) > spectralFluxThreshold;
                const highFreqIncrease = highFreqEnergy > previousHighFreqEnergy * (1 + highFreqThreshold);
                const aboveNoiseFloor = totalEnergy > 0.008; // Noise floor
                
                // Adaptive detection - at least 2 of 3 criteria must be met for reliability
                let criteriaCount = 0;
                if (energyIncrease) criteriaCount++;
                if (spectralChange) criteriaCount++;
                if (highFreqIncrease) criteriaCount++;
                
                const isTransient = criteriaCount >= 2 && aboveNoiseFloor;
                
                if (isTransient) {
                    const timePosition = i / sampleRate;
                    
                    // Check minimum distance from previous transients
                    let tooClose = false;
                    for (const candidate of transientCandidates) {
                        if (Math.abs(candidate.time - timePosition) < (minDistance / sampleRate)) {
                            tooClose = true;
                            break;
                        }
                    }
                    
                    if (!tooClose) {
                        // Add with confidence score for potential future sorting
                        transientCandidates.push({
                            time: timePosition,
                            confidence: criteriaCount + (totalEnergy * 5)
                        });
                    }
                }
                
                // Update previous values with slight smoothing to reduce noise
                previousEnergy = previousEnergy * 0.3 + totalEnergy * 0.7;
                previousSpectralCentroid = previousSpectralCentroid * 0.5 + spectralCentroid * 0.5;
                previousHighFreqEnergy = previousHighFreqEnergy * 0.4 + highFreqEnergy * 0.6;
            }
            
            // Sort by confidence and then by time
            transientCandidates.sort((a, b) => b.confidence - a.confidence);
            
            // Take the most confident transients up to the limit
            const maxTransients = Math.min(transientCandidates.length, this.chopper.numSlices - 1);
            const selectedTransients = transientCandidates.slice(0, maxTransients);
            
            // Sort selected transients by time
            selectedTransients.sort((a, b) => a.time - b.time);
            
            // Always include start position
            this.chopper.sliceMarkers = [0, ...selectedTransients.map(t => t.time)];
            this.chopper.slices = [];
            
            // Create slices from markers
            const allMarkers = [...this.chopper.sliceMarkers, this.chopper.buffer.duration];
            for (let i = 0; i < allMarkers.length - 1; i++) {
                const start = allMarkers[i];
                const end = allMarkers[i + 1];
                this.chopper.slices.push({ start, end });
            }
            
            this.drawChopperWaveform();
            this.drawChopperWaveformMain();
            this.renderChopperPads();
            this.renderChopperPadsMain();
            
            const sensPercent = (sensitivity * 100).toFixed(0);
            const avgConfidence = selectedTransients.length > 0 ? 
                (selectedTransients.reduce((sum, t) => sum + t.confidence, 0) / selectedTransients.length).toFixed(1) : 0;
            this.updateStatus(`Detected ${this.chopper.slices.length} transients (sensitivity: ${sensPercent}%, confidence: ${avgConfidence})`);
        }
        
        renderChopperPads() {
            const container = document.getElementById('chop-pads');
            if (!container) return;
            
            container.innerHTML = '';
            
            for (let i = 0; i < Math.min(16, this.chopper.numSlices); i++) {
                const pad = document.createElement('div');
                pad.className = 'chop-pad';
                pad.textContent = i + 1;
                pad.onclick = () => this.playSlice(i);
                container.appendChild(pad);
            }
        }
        
        playSlice(index) {
            if (!this.chopper.buffer || !this.chopper.slices[index]) return;
            
            const slice = this.chopper.slices[index];
            const source = this.context.createBufferSource();
            source.buffer = this.chopper.buffer;
            
            const gain = this.context.createGain();
            gain.gain.value = 0.8;
            
            source.connect(gain);
            gain.connect(this.masterGain);
            
            // ONE-SHOT MODE: No looping, plays once and stops
            source.loop = false;
            
            // Track this source for the stop button
            this.chopper.playingSources.add(source);
            
            // Remove from tracking when it ends naturally
            source.onended = () => {
                this.chopper.playingSources.delete(source);
            };
            
            source.start(0, slice.start, slice.end - slice.start);
            
            // Flash pad
            const pads = document.querySelectorAll('.chop-pad');
            if (pads[index]) {
                pads[index].classList.add('active');
                setTimeout(() => pads[index].classList.remove('active'), 200);
            }
        }
        
        slicesToSequencerRows() {
            if (!this.chopper.buffer || this.chopper.slices.length === 0) {
                this.updateStatus('No slices to send');
                return;
            }
            
            // Allow all slices to be sent, not just first 8
            const numSlices = this.chopper.slices.length;
            const availableSlots = 16; // Sample bank has 16 slots
            const slicesToSend = Math.min(numSlices, availableSlots);
            
            for (let i = 0; i < slicesToSend; i++) {
                const slice = this.chopper.slices[i];
                if (!slice) continue;
                
                // Create a new buffer for this slice
                const duration = slice.end - slice.start;
                const startSample = Math.floor(slice.start * this.context.sampleRate);
                const endSample = Math.floor(slice.end * this.context.sampleRate);
                const length = endSample - startSample;
                
                const sliceBuffer = this.context.createBuffer(
                    1,
                    length,
                    this.context.sampleRate
                );
                
                const sourceData = this.chopper.buffer.getChannelData(0);
                const sliceData = sliceBuffer.getChannelData(0);
                
                for (let j = 0; j < length; j++) {
                    sliceData[j] = sourceData[startSample + j] || 0;
                }
                
                // Add to sample bank
                const slotIndex = i;
                this.sampleBank.set(slotIndex, {
                    buffer: sliceBuffer,
                    name: `Slice ${i + 1}`,
                    duration: duration
                });
                
                // Assign to sequencer row (for first 8 slices)
                if (i < 8) {
                    this.sequencer.rowSample[i] = slotIndex;
                }
                
                // Update sample slot UI
                const slot = document.getElementById(`sample-slot-${slotIndex}`);
                if (slot) {
                    slot.classList.add('loaded');
                    slot.innerHTML = `
                        <div style="font-size: 18px; font-weight: bold;">${slotIndex + 1}</div>
                        <div style="font-size: 9px; opacity: 0.8;">Slice ${i + 1}</div>
                        <div style="font-size: 8px; opacity: 0.6;">${duration.toFixed(2)}s</div>
                    `;
                }
            }

        // Re-render sequencer rows
        this.renderSequencer();

        // Make sure the MPC sees the new samples in the sample bank
        if (this.updateMPCPadLabels) {
            this.updateMPCPadLabels();
        }

        this.updateStatus(
            `Sent ${slicesToSend} slices to sample bank${slicesToSend > 8 ? ' (first 8 assigned to sequencer rows)' : ''}`
        );
    }

        
        slicesToLoopTracks() {
            if (!this.chopper.buffer || this.chopper.slices.length === 0) {
                this.updateStatus('No chopped samples to send');
                return;
            }
            
            const numSlices = this.chopper.slices.length;
            const availableTracks = this.maxTracks;
            const slicesToSend = Math.min(numSlices, availableTracks);
            
            for (let i = 0; i < slicesToSend; i++) {
                const slice = this.chopper.slices[i];
                if (!slice) continue;
                
                // Create a new buffer for this slice
                const duration = slice.end - slice.start;
                const startSample = Math.floor(slice.start * this.context.sampleRate);
                const endSample = Math.floor(slice.end * this.context.sampleRate);
                const length = endSample - startSample;
                
                const sliceBuffer = this.context.createBuffer(
                    1,
                    length,
                    this.context.sampleRate
                );
                
                const sourceData = this.chopper.buffer.getChannelData(0);
                const sliceData = sliceBuffer.getChannelData(0);
                
                for (let j = 0; j < length; j++) {
                    sliceData[j] = sourceData[startSample + j] || 0;
                }
                
                // Clear existing track content and assign slice
                const track = this.tracks[i];
                track.buffer = sliceBuffer;
                track.chunks = [];
                track.isRecording = false;
                track.isPlaying = false;
                
                // Stop any ongoing playback
                if (track.source) {
                    track.source.stop();
                    track.source = null;
                }
                
                // Draw waveform for this track
                this.drawWaveform(i, sliceBuffer);
                
                // Update track card visual state
                const card = document.getElementById(`track-${i}`);
                if (card) {
                    card.classList.remove('recording');
                    // Update rec button
                    const recBtn = document.getElementById(`rec-btn-${i}`);
                    if (recBtn) {
                        recBtn.innerHTML = '[REC]';
                        recBtn.classList.remove('active');
                    }
                }
            }
            
            // Switch to unified view to see the tracks
            const unifiedBtn = document.querySelector('[data-mode="unified"]');
            if (unifiedBtn) {
                unifiedBtn.click();
            }
            
            this.updateStatus(`Sent ${slicesToSend} slices to loop tracks - Ready to play and layer!`);
        }
        
        exportAllSlices() {
            if (!this.chopper.buffer || this.chopper.slices.length === 0) {
                this.updateStatus('No slices to export');
                return;
            }
            
            this.chopper.slices.forEach((slice, index) => {
                const duration = slice.end - slice.start;
                const startSample = Math.floor(slice.start * this.context.sampleRate);
                const endSample = Math.floor(slice.end * this.context.sampleRate);
                const length = endSample - startSample;
                
                const sliceBuffer = this.context.createBuffer(
                    1,
                    length,
                    this.context.sampleRate
                );
                
                const sourceData = this.chopper.buffer.getChannelData(0);
                const sliceData = sliceBuffer.getChannelData(0);
                
                for (let j = 0; j < length; j++) {
                    sliceData[j] = sourceData[startSample + j] || 0;
                }
                
                const blob = this._audioBufferToWav(sliceBuffer);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `slice_${index + 1}.wav`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            });
            
            this.updateStatus(`Exported ${this.chopper.slices.length} slices`);
        }
        
        bindUI() {
            // Mode switcher
            document.querySelectorAll('.mode-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                    document.querySelectorAll('.workspace').forEach(w => w.classList.remove('active'));
                    
                    btn.classList.add('active');
                    const mode = btn.dataset.mode;
                    document.getElementById(`workspace-${mode}`).classList.add('active');
                    
                    // Render sequencer when switching to it
                    if (mode === 'sequencer') {
                        this.renderSequencer();
                        renderSequencerControls();
                    }
                });
            });
            
            // Master controls
            document.getElementById('master-bpm')?.addEventListener('change', (e) => {
                this.bpm = parseInt(e.target.value);
                this.effects.delay.delayTime.value = 60 / this.bpm * 0.25;
                this.updateStatus(`BPM set to ${this.bpm}`);
            });
            
            document.getElementById('master-bars')?.addEventListener('change', (e) => {
                this.bars = parseInt(e.target.value);
                this.updateStatus(`Bars set to ${this.bars}`);
            });
            
            document.getElementById('master-volume')?.addEventListener('input', (e) => {
                const value = e.target.value / 100;
                this.masterGain.gain.value = value;
                document.getElementById('master-volume-display').textContent = `${e.target.value}%`;
            });
            
            document.getElementById('input-gain')?.addEventListener('input', (e) => {
                const value = e.target.value / 100;
                if (this.inputGain) this.inputGain.gain.value = value;
                document.getElementById('input-gain-display').textContent = `${e.target.value}%`;
            });
            
            // Master transport
            document.getElementById('master-play')?.addEventListener('click', () => this.playAll());
            document.getElementById('master-stop')?.addEventListener('click', () => this.stopAll());
            
            // Record mode toggle
            document.getElementById('record-mode-toggle')?.addEventListener('click', () => this.toggleRecordMode());
            
            // Count-in and first track bars
            document.getElementById('count-in-bars')?.addEventListener('change', (e) => {
                this.countInBars = parseInt(e.target.value);
                this.updateStatus(`Count-in set to ${this.countInBars} bar(s)`);
            });
            
            document.getElementById('count-in-first-only')?.addEventListener('change', (e) => {
                this.countInFirstTrackOnly = e.target.checked;
                this.updateStatus(`Count-in ${this.countInFirstTrackOnly ? 'first track only' : 'all tracks'}`);
            });

            document.getElementById('metronome-during-recording')?.addEventListener('change', (e) => {
                this.metronomeDuringRecording = e.target.checked;
                this.updateStatus(`Metronome during recording: ${this.metronomeDuringRecording ? 'ON' : 'OFF'}`);
            });

            document.getElementById('first-track-bars')?.addEventListener('change', (e) => {
                this.firstTrackBars = parseInt(e.target.value);
                this.updateStatus(`First track length set to ${this.firstTrackBars} bar(s)`);
            });            // Tap tempo
            document.getElementById('tap-tempo')?.addEventListener('click', () => this.tapTempo());
            
            // Quantize
            document.getElementById('quantize-enabled')?.addEventListener('change', (e) => {
                this.quantize = e.target.checked;
            });
            
            // Metronome
            document.getElementById('metronome-toggle')?.addEventListener('click', () => {
                this.metronomeEnabled = !this.metronomeEnabled;
                const btn = document.getElementById('metronome-toggle');
                btn.textContent = this.metronomeEnabled ? 'Metronome' : 'Metronome';
                if (this.metronomeEnabled) {
                    this.startMetronome();
                } else {
                    this.stopMetronome();
                }
            });
            
            document.getElementById('metronome-volume')?.addEventListener('input', (e) => {
                if (this.metGain) {
                    this.metGain.gain.value = e.target.value / 100 * 0.5;
                }
            });
            
            // System audio capture
            document.getElementById('system-audio-capture')?.addEventListener('click', async () => {
                // Show user instructions
                const confirmMessage = `SYSTEM AUDIO CAPTURE INSTRUCTIONS:

1. Click OK to open the screen sharing dialog
2. Select a browser tab or application window that's playing audio
3. IMPORTANT: Check the "Share audio" checkbox in the dialog
4. Click "Share" to start capturing that audio

This will let you record audio from YouTube, Spotify, games, or any other app!

Ready to proceed?`;
                
                if (!confirm(confirmMessage)) {
                    this.updateStatus('System audio capture cancelled by user');
                    return;
                }
                
                const success = await this.startSystemAudioCapture();
                if (success) {
                    document.getElementById('system-audio-capture').style.display = 'none';
                    document.getElementById('system-audio-stop').style.display = 'inline-block';
                }
            });
            
            document.getElementById('system-audio-stop')?.addEventListener('click', () => {
                this.stopSystemAudioCapture();
                document.getElementById('system-audio-capture').style.display = 'inline-block';
                document.getElementById('system-audio-stop').style.display = 'none';
                this.updateStatus('System audio capture stopped');
            });
            
            // Studio features
            document.getElementById('mixdown-tracks')?.addEventListener('click', () => this.mixdownTracks());
            document.getElementById('undo-edit')?.addEventListener('click', () => this.undoLastEdit());
            
            // Quick effects
            document.getElementById('quick-reverb')?.addEventListener('input', (e) => {
                const value = e.target.value / 100;
                this.effects.reverbSend.gain.value = value;
                e.target.nextElementSibling.textContent = `${e.target.value}%`;
            });
            
            document.getElementById('quick-delay')?.addEventListener('input', (e) => {
                const value = e.target.value / 100;
                this.effects.delaySend.gain.value = value;
                e.target.nextElementSibling.textContent = `${e.target.value}%`;
            });
            
            document.getElementById('quick-filter')?.addEventListener('input', (e) => {
                const value = e.target.value / 100;
                this.effects.filter.frequency.value = 200 + (value * 19800);
                e.target.nextElementSibling.textContent = `${e.target.value}%`;
            });
            
            // Initialize properties from UI elements
            this.bpm = parseInt(document.getElementById('master-bpm')?.value) || 120;
            this.bars = parseInt(document.getElementById('master-bars')?.value) || 4;
            this.countInBars = parseInt(document.getElementById('count-in-bars')?.value) || 1;
            this.firstTrackBars = parseInt(document.getElementById('first-track-bars')?.value) || 4;
            this.countInFirstTrackOnly = document.getElementById('count-in-first-only')?.checked ?? true;
            this.metronomeDuringRecording = document.getElementById('metronome-during-recording')?.checked ?? true;
            this.quantize = document.getElementById('quantize-enabled')?.checked ?? false;
            this.recordMode = 'replace';
            this.metronomeEnabled = false;
            this.metronomeRunning = false;
            this.beatsPerBar = 4;
            this.transportStartTime = null;
            this.nextClickTime = 0;
            this.lookahead = 25;
            this.scheduleAheadTime = 0.1;
            this.timerID = null;
        }
        
        tapTempo() {
            const now = performance.now();
            
            // Reset if more than 2 seconds since last tap
            if (now - this.lastTapTime > 2000) {
                this.tapTimes = [];
            }
            
            this.tapTimes.push(now);
            this.lastTapTime = now;
            
            // Calculate BPM from last 4 taps
            if (this.tapTimes.length > 1) {
                const intervals = [];
                for (let i = 1; i < this.tapTimes.length; i++) {
                    intervals.push(this.tapTimes[i] - this.tapTimes[i - 1]);
                }
                
                const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
                const bpm = Math.round(60000 / avgInterval);
                
                if (bpm >= 60 && bpm <= 200) {
                    this.bpm = bpm;
                    document.getElementById('master-bpm').value = bpm;
                    this.effects.delay.delayTime.value = 60 / this.bpm * 0.25;
                    this.updateStatus(`BPM tapped: ${bpm}`);
                }
            }
            
            // Keep only last 8 taps
            if (this.tapTimes.length > 8) {
                this.tapTimes.shift();
            }
        }
        
        toggleRecordMode() {
            // Cycle through: replace -> overdub -> play -> replace
            const modes = ['replace', 'overdub', 'play'];
            const currentIndex = modes.indexOf(this.recordMode);
            this.recordMode = modes[(currentIndex + 1) % modes.length];
            
            const btn = document.getElementById('record-mode-toggle');
            if (btn) {
                let icon, text, isWarning = false;
                switch(this.recordMode) {
                    case 'replace':
                        icon = '[R]'; text = 'REPLACE'; break;
                    case 'overdub':
                        icon = '[O]'; text = 'OVERDUB'; isWarning = true; break;
                    case 'play':
                        icon = '[P]'; text = 'REC->PLAY'; break;
                }
                btn.innerHTML = `${icon} Record Mode: ${text}`;
                btn.classList.toggle('btn-warning', isWarning);
            }
            this.updateStatus(`Record mode: ${this.recordMode.toUpperCase()}`);
        }
        
        toggleRecording(trackIndex) {
            const track = this.tracks[trackIndex];
            
            if (track.isRecording) {
                this.stopRecording(trackIndex);
            } else {
                this.startRecording(trackIndex);
            }
            
            // Update button state after the action
            setTimeout(() => {
                const btn = document.getElementById(`rec-btn-${trackIndex}`);
                if (btn) {
                    if (track.isRecording) {
                        btn.innerHTML = '[STOP]';
                        btn.classList.add('active');
                    } else {
                        const mode = this.recordMode === 'replace' ? '[R]' : '[O]';
                        btn.innerHTML = `${mode} REC`;
                        btn.classList.remove('active');
                    }
                }
            }, 50);
        }

        updateStatus(message) {
    if (this.onStatus) {
        // Let the UI layer decide how to display status
        this.onStatus(message);
    } else {
        // Fallback (for safety / debugging)
        const el = document.getElementById('status-message');
        if (el) el.textContent = message;
        console.log('Status:', message);
    }
}

        
        // System audio capture methods
        async startSystemAudioCapture() {
            try {
                // Show user guidance before attempting capture
                this.updateStatus('Select a browser tab or window with audio to capture...');
                
                // Request screen/tab share with audio - this will show a dialog to select what to share
                this.systemAudioStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true, // Need video for most browsers to allow audio sharing
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                        sampleRate: 44100,
                        suppressLocalAudioPlayback: true // Prevent feedback
                    }
                });
                
                // Check if audio track exists
                const audioTracks = this.systemAudioStream.getAudioTracks();
                if (audioTracks.length === 0) {
                    throw new Error('No audio track available - make sure to select "Share audio" in the dialog');
                }
                
                // Create audio source from system audio
                this.systemAudioSource = this.context.createMediaStreamSource(this.systemAudioStream);
                
                // Connect to input gain (same path as microphone)
                this.systemAudioSource.connect(this.inputGain);
                
                // Handle stream end (user stops sharing)
                this.systemAudioStream.getAudioTracks()[0].onended = () => {
                    this.stopSystemAudioCapture();
                    this.updateStatus('System audio capture stopped by user');
                };
                
                // Stop video track if we only want audio (optional - keeps privacy)
                const videoTracks = this.systemAudioStream.getVideoTracks();
                videoTracks.forEach(track => track.stop());
                
                this.updateStatus('System audio capture started - Ready to record internal sound');
                return true;
            } catch (error) {
                console.error('Failed to start system audio capture:', error);
                
                let errorMessage = 'System audio capture failed: ';
                
                if (error.name === 'NotAllowedError') {
                    errorMessage += 'Permission denied. Please allow screen sharing and select "Share audio" option.';
                } else if (error.name === 'NotFoundError') {
                    errorMessage += 'No audio source found. Make sure to check "Share audio" when selecting a tab/window.';
                } else if (error.name === 'NotSupportedError') {
                    errorMessage += 'Browser doesn\'t support system audio capture. Try Chrome, Firefox, or Edge.';
                } else if (error.message.includes('audio track')) {
                    errorMessage += 'No audio track selected. Make sure to check "Share audio" in the sharing dialog.';
                } else {
                    errorMessage += error.message || 'Unknown error occurred.';
                }
                
                this.updateStatus(errorMessage);
                return false;
            }
        }
        
        stopSystemAudioCapture() {
            if (this.systemAudioStream) {
                this.systemAudioStream.getTracks().forEach(track => track.stop());
                this.systemAudioStream = null;
            }
            if (this.systemAudioSource) {
                this.systemAudioSource.disconnect();
                this.systemAudioSource = null;
            }
        }
        
        // Trim functionality
        setTrackTrim(trackIndex, startTime, endTime) {
            const track = this.tracks[trackIndex];
            if (!track.buffer) return;
            
            const duration = track.buffer.duration;
            track.trimStart = Math.max(0, Math.min(startTime, duration));
            track.trimEnd = endTime ? Math.max(track.trimStart, Math.min(endTime, duration)) : null;
            
            // Update waveform display to show trim markers
            this.drawWaveform(trackIndex, track.buffer);
            this.updateStatus(`Track ${trackIndex + 1} trimmed: ${track.trimStart.toFixed(2)}s - ${track.trimEnd ? track.trimEnd.toFixed(2) + 's' : 'end'}`);
        }
        
        resetTrackTrim(trackIndex) {
            const track = this.tracks[trackIndex];
            track.trimStart = 0;
            track.trimEnd = null;
            this.drawWaveform(trackIndex, track.buffer);
            this.hideTrimControls(trackIndex);
            
            // Reset input fields
            const startInput = document.getElementById(`trim-start-${trackIndex}`);
            const endInput = document.getElementById(`trim-end-${trackIndex}`);
            if (startInput) startInput.value = '0';
            if (endInput) endInput.value = '';
            
            this.updateStatus(`Track ${trackIndex + 1} trim reset`);
        }
        
        // Apply trim to create new trimmed buffer
        async applyTrackTrim(trackIndex) {
            const track = this.tracks[trackIndex];
            if (!track.buffer || (track.trimStart === 0 && track.trimEnd === null)) return;
            
            const originalBuffer = track.buffer;
            const startSample = Math.floor(track.trimStart * originalBuffer.sampleRate);
            const endSample = track.trimEnd ? Math.floor(track.trimEnd * originalBuffer.sampleRate) : originalBuffer.length;
            const newLength = endSample - startSample;
            
            const newBuffer = this.context.createBuffer(
                originalBuffer.numberOfChannels,
                newLength,
                originalBuffer.sampleRate
            );
            
            // Copy trimmed audio data
            for (let channel = 0; channel < originalBuffer.numberOfChannels; channel++) {
                const originalData = originalBuffer.getChannelData(channel);
                const newData = newBuffer.getChannelData(channel);
                for (let i = 0; i < newLength; i++) {
                    newData[i] = originalData[startSample + i];
                }
            }
            
            // Replace buffer and reset trim markers
            track.buffer = newBuffer;
            track.trimStart = 0;
            track.trimEnd = null;
            
            // Force clear and redraw waveform with new buffer
            setTimeout(() => {
                // Clear canvas first, then redraw
                ['unified-tracks', 'loopstation-tracks'].forEach(cId => {
                    const canvas = document.getElementById(`${cId}-waveform-${trackIndex}`);
                    if (canvas) {
                        const ctx = canvas.getContext('2d');
                        // Force canvas re-initialization
                        canvas.width = canvas.offsetWidth || 400;
                        canvas.height = canvas.offsetHeight || 100;
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                    }
                });
                
                // Redraw with new buffer
                this.drawWaveform(trackIndex, newBuffer);
                this.hideTrimControls(trackIndex);
                this.showTrimAppliedFeedback(trackIndex);
                
                // Log for debugging
                console.log(`Trim applied to track ${trackIndex + 1}: new duration ${newBuffer.duration.toFixed(2)}s`);
            }, 100); // Slightly longer delay to ensure canvas is ready
            
            // Reset input fields
            const startInput = document.getElementById(`trim-start-${trackIndex}`);
            const endInput = document.getElementById(`trim-end-${trackIndex}`);
            if (startInput) startInput.value = '0';
            if (endInput) endInput.value = '';
            
            this.updateStatus(`Track ${trackIndex + 1} trim applied - New length: ${newBuffer.duration.toFixed(2)}s (was ${originalBuffer.duration.toFixed(2)}s)`);
        }
        
        // ===== MIXDOWN FUNCTION =====
        async mixdownTracks() {
            // Find all tracks with buffers (excluding muted if solo is active)
            const hasSolo = this.tracks.some(t => t.soloed);
            const tracksToMix = this.tracks.filter((t, i) => {
                if (!t.buffer) return false;
                if (hasSolo) return t.soloed;
                return !t.muted;
            });
            
            if (tracksToMix.length === 0) {
                this.updateStatus('No tracks to mixdown');
                return;
            }
            
            // Find maximum length
            let maxLength = 0;
            let sampleRate = this.context.sampleRate;
            tracksToMix.forEach(t => {
                maxLength = Math.max(maxLength, t.buffer.length);
            });
            
            // Create mixdown buffer (stereo)
            const mixBuffer = this.context.createBuffer(2, maxLength, sampleRate);
            const leftData = mixBuffer.getChannelData(0);
            const rightData = mixBuffer.getChannelData(1);
            
            // Mix all tracks
            let trackCount = 0;
            for (let t of tracksToMix) {
                const trackIndex = this.tracks.indexOf(t);
                const volume = document.getElementById(`track-vol-${trackIndex}`).value / 100;
                const pan = parseFloat(document.getElementById(`track-pan-${trackIndex}`).value);
                
                // Get source data (handle mono/stereo)
                const sourceLeft = t.buffer.getChannelData(0);
                const sourceRight = t.buffer.numberOfChannels > 1 ? t.buffer.getChannelData(1) : sourceLeft;
                
                // Calculate pan gains (equal power panning)
                const panAngle = pan * 0.5 * Math.PI;
                const leftGain = Math.cos(panAngle) * volume;
                const rightGain = Math.sin(panAngle) * volume;
                
                // Mix into output
                for (let i = 0; i < t.buffer.length; i++) {
                    leftData[i] += sourceLeft[i] * leftGain;
                    rightData[i] += sourceRight[i] * rightGain;
                }
                trackCount++;
            }
            
            // Normalize to prevent clipping
            let peak = 0;
            for (let i = 0; i < maxLength; i++) {
                peak = Math.max(peak, Math.abs(leftData[i]), Math.abs(rightData[i]));
            }
            if (peak > 0.95) {
                const gain = 0.95 / peak;
                for (let i = 0; i < maxLength; i++) {
                    leftData[i] *= gain;
                    rightData[i] *= gain;
                }
                this.updateStatus(`Mixdown normalized by ${(gain * 100).toFixed(1)}%`);
            }
            
            // Find next empty track
            const emptyIndex = this.tracks.findIndex(t => !t.buffer);
            if (emptyIndex === -1) {
                // Download if no empty tracks
                const blob = this._audioBufferToWav(mixBuffer);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `mixdown_${Date.now()}.wav`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                this.updateStatus(`Mixdown saved (${trackCount} tracks, ${mixBuffer.duration.toFixed(2)}s)`);
            } else {
                // Put mixdown in empty track
                this.tracks[emptyIndex].buffer = mixBuffer;
                this.drawWaveform(emptyIndex, mixBuffer);
                this.updateStatus(`Mixdown -> Track ${emptyIndex + 1} (${trackCount} tracks, ${mixBuffer.duration.toFixed(2)}s)`);
            }
        }
        
        // Helper method to apply trim from input fields
        applyTrimFromInputs(trackIndex) {
            const startInput = document.getElementById(`trim-start-${trackIndex}`);
            const endInput = document.getElementById(`trim-end-${trackIndex}`);
            
            const startTime = parseFloat(startInput.value) || 0;
            const endTime = endInput.value ? parseFloat(endInput.value) : null;
            
            this.setTrackTrim(trackIndex, startTime, endTime);
        }
        
        // Chopper trim functionality
        setChopperTrim(startTime, endTime) {
            if (!this.chopper.buffer) return;
            
            const duration = this.chopper.buffer.duration;
            this.chopper.trimStart = Math.max(0, Math.min(startTime, duration));
            this.chopper.trimEnd = endTime ? Math.max(this.chopper.trimStart, Math.min(endTime, duration)) : null;
            
            this.drawChopperWaveform();
            this.drawChopperWaveformMain();
            this.updateStatus(`Chopper trimmed: ${this.chopper.trimStart.toFixed(2)}s - ${this.chopper.trimEnd ? this.chopper.trimEnd.toFixed(2) + 's' : 'end'}`);
        }
        
        resetChopperTrim() {
            this.chopper.trimStart = 0;
            this.chopper.trimEnd = null;
            this.drawChopperWaveform();
            this.drawChopperWaveformMain();
            this.hideChopperTrimControls();
            this.updateStatus('Chopper trim reset');
        }
        
        // Apply chopper trim to create new trimmed buffer
        async applyChopperTrim() {
            if (!this.chopper.buffer || (this.chopper.trimStart === 0 && this.chopper.trimEnd === null)) return;
            
            const originalBuffer = this.chopper.buffer;
            const startSample = Math.floor(this.chopper.trimStart * originalBuffer.sampleRate);
            const endSample = this.chopper.trimEnd ? Math.floor(this.chopper.trimEnd * originalBuffer.sampleRate) : originalBuffer.length;
            const newLength = endSample - startSample;
            
            const newBuffer = this.context.createBuffer(
                originalBuffer.numberOfChannels,
                newLength,
                originalBuffer.sampleRate
            );
            
            // Copy trimmed audio data
            for (let channel = 0; channel < originalBuffer.numberOfChannels; channel++) {
                const originalData = originalBuffer.getChannelData(channel);
                const newData = newBuffer.getChannelData(channel);
                for (let i = 0; i < newLength; i++) {
                    newData[i] = originalData[startSample + i];
                }
            }
            
            // Replace buffer and reset trim markers
            this.chopper.buffer = newBuffer;
            this.chopper.trimStart = 0;
            this.chopper.trimEnd = null;
            this.chopper.sliceMarkers = []; // Clear existing markers as they're now invalid
            this.chopper.slices = []; // Clear existing slices
            
            // Force update displays with small delay to ensure canvas refresh
            setTimeout(() => {
                // Clear canvases first, then redraw
                ['chop-wave', 'chop-wave-main'].forEach(canvasId => {
                    const canvas = document.getElementById(canvasId);
                    if (canvas) {
                        const ctx = canvas.getContext('2d');
                        // Force canvas re-initialization
                        canvas.width = canvas.offsetWidth || 800;
                        canvas.height = canvasId === 'chop-wave' ? 120 : 180;
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                    }
                });
                
                // Redraw with new buffer
                this.drawChopperWaveform();
                this.drawChopperWaveformMain();
                this.renderChopperPads();
                this.renderChopperPadsMain();
                this.hideChopperTrimControls();
                this.showChopperTrimAppliedFeedback();
                
                // Log for debugging
                console.log(`Chopper trim applied: new duration ${newBuffer.duration.toFixed(2)}s`);
            }, 100); // Slightly longer delay to ensure canvas is ready
            
            // Reset input fields
            const startInput = document.getElementById('chop-trim-start');
            const endInput = document.getElementById('chop-trim-end');
            if (startInput) startInput.value = '0';
            if (endInput) endInput.value = '';
            
            this.updateStatus(`Chopper trim applied - New length: ${newBuffer.duration.toFixed(2)}s (was ${originalBuffer.duration.toFixed(2)}s)`);
        }
        
        // Visual trim controls helpers
        applyChopperTrimVisual() {
            this.applyChopperTrim();
        }
        
        resetChopperTrimVisual() {
            this.resetChopperTrim();
            const startInput = document.getElementById('chop-trim-start');
            const endInput = document.getElementById('chop-trim-end');
            if (startInput) startInput.value = '0';
            if (endInput) endInput.value = '';
        }
        
        showChopperTrimControls() {
            const controls = document.getElementById('chop-trim-controls');
            if (controls) {
                controls.style.display = 'flex';
            }
        }
        
        hideChopperTrimControls() {
            const controls = document.getElementById('chop-trim-controls');
            if (controls) {
                controls.style.display = 'none';
            }
        }
        
        showChopperTrimAppliedFeedback() {
            // Flash green border on chopper waveform displays to indicate trim was applied
            ['chop-wave', 'chop-wave-main'].forEach(canvasId => {
                const canvas = document.getElementById(canvasId);
                if (canvas) {
                    const container = canvas.parentElement;
                    if (container) {
                        container.style.border = '3px solid #00ff88';
                        container.style.boxShadow = '0 0 15px rgba(0, 255, 136, 0.5)';
                        setTimeout(() => {
                            container.style.border = '';
                            container.style.boxShadow = '';
                        }, 1000);
                    }
                }
            });
        }
        
        // Create unified interaction method for chopper
        setupChopperInteraction() {
            const canvas = document.getElementById('chop-wave');
            if (!canvas) return;
            
            // Remove existing listeners
            canvas.removeEventListener('mousedown', this.handleChopperMouseDown);
            canvas.removeEventListener('mousemove', this.handleChopperMouseMove);
            canvas.removeEventListener('mouseup', this.handleChopperMouseUp);
            
            let isDragging = false;
            let dragType = null; // 'trim-start', 'trim-end', 'marker', 'new-trim', 'new-marker'
            let dragMarkerIndex = -1;
            let startDragX = 0;
            
            this.handleChopperMouseDown = (e) => {
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const totalDuration = this.chopper.buffer.duration;
                const zoomedDuration = totalDuration / this.chopper.zoom;
                const startTime = this.chopper.scrollPosition * (totalDuration - zoomedDuration);
                const clickTime = startTime + (x / canvas.offsetWidth) * zoomedDuration;
                
                const tolerance = (this.chopper.dragTolerance / canvas.offsetWidth) * zoomedDuration;
                
                // Check what we're clicking on (priority order: trim markers, slice markers, new actions)
                
                // 1. Check trim markers
                if (this.chopper.trimStart > 0 && Math.abs(clickTime - this.chopper.trimStart) < tolerance) {
                    dragType = 'trim-start';
                    isDragging = true;
                } else if (this.chopper.trimEnd !== null && Math.abs(clickTime - this.chopper.trimEnd) < tolerance) {
                    dragType = 'trim-end';
                    isDragging = true;
                }
                // 2. Check slice markers (only in manual mode)
                else if (this.chopper.manualMode) {
                    const markerIndex = this.findNearbyMarker(clickTime, canvas);
                    if (markerIndex >= 0) {
                        dragType = 'marker';
                        dragMarkerIndex = markerIndex;
                        isDragging = true;
                    } else {
                        // 3. Add new slice marker in manual mode
                        this.addSliceMarker(clickTime);
                    }
                }
                // 4. Start new trim selection (Shift+click)
                else if (e.shiftKey) {
                    dragType = 'new-trim';
                    isDragging = true;
                    startDragX = x;
                    this.chopper.trimStart = clickTime;
                    this.chopper.trimEnd = clickTime;
                }
                
                if (isDragging) e.preventDefault();
            };
            
            this.handleChopperMouseMove = (e) => {
                if (!isDragging) return;
                
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const totalDuration = this.chopper.buffer.duration;
                const zoomedDuration = totalDuration / this.chopper.zoom;
                const startTime = this.chopper.scrollPosition * (totalDuration - zoomedDuration);
                const currentTime = Math.max(0, Math.min(startTime + (x / canvas.offsetWidth) * zoomedDuration, totalDuration));
                
                if (dragType === 'trim-start') {
                    this.chopper.trimStart = Math.min(currentTime, this.chopper.trimEnd || totalDuration);
                } else if (dragType === 'trim-end') {
                    this.chopper.trimEnd = Math.max(currentTime, this.chopper.trimStart);
                } else if (dragType === 'new-trim') {
                    const startClickTime = startTime + (startDragX / canvas.offsetWidth) * zoomedDuration;
                    this.chopper.trimStart = Math.min(startClickTime, currentTime);
                    this.chopper.trimEnd = Math.max(startClickTime, currentTime);
                } else if (dragType === 'marker' && dragMarkerIndex >= 0) {
                    this.chopper.sliceMarkers[dragMarkerIndex] = currentTime;
                    this.chopper.sliceMarkers.sort((a, b) => a - b);
                }
                
                this.drawChopperWaveform();
                if (dragType.includes('trim')) {
                    this.showChopperTrimControls();
                }
            };
            
            this.handleChopperMouseUp = (e) => {
                if (isDragging) {
                    isDragging = false;
                    
                    if (dragType === 'marker') {
                        this.updateSlicesFromMarkers();
                        this.renderChopperPads();
                    } else if (dragType === 'new-trim') {
                        if (this.chopper.trimEnd - this.chopper.trimStart < 0.1) {
                            // Too small, reset
                            this.chopper.trimStart = 0;
                            this.chopper.trimEnd = null;
                            this.hideChopperTrimControls();
                        } else {
                            this.showChopperTrimControls();
                            this.updateStatus(`Chopper trim set: ${this.chopper.trimStart.toFixed(2)}s - ${this.chopper.trimEnd.toFixed(2)}s`);
                        }
                        this.drawChopperWaveform();
                    }
                    
                    dragType = null;
                    dragMarkerIndex = -1;
                }
            };
            
            canvas.addEventListener('mousedown', this.handleChopperMouseDown);
            canvas.addEventListener('mousemove', this.handleChopperMouseMove);
            canvas.addEventListener('mouseup', this.handleChopperMouseUp);
            canvas.style.cursor = 'crosshair';
        }
        
        applyEffectPreset() {
            const preset = document.getElementById('effect-preset').value;
            const presets = {
                'clean': { reverb: 0, delay: 0, filter: 100 },
                'warm-saturation': { reverb: 25, delay: 10, filter: 85 },
                'lead-vocals': { reverb: 35, delay: 8, filter: 90 },
                'beat-box': { reverb: 5, delay: 15, filter: 95 },
                'ambient-guitar': { reverb: 60, delay: 40, filter: 70 },
                'blues-lead': { reverb: 30, delay: 25, filter: 80 },
                'acoustic-guitar': { reverb: 20, delay: 5, filter: 95 },
                'atmospheric': { reverb: 80, delay: 60, filter: 60 }
            };
            
            const settings = presets[preset];
            if (settings) {
                // Apply settings to sliders
                document.getElementById('quick-reverb').value = settings.reverb;
                document.getElementById('quick-delay').value = settings.delay;
                document.getElementById('quick-filter').value = settings.filter;
                
                // Update displays
                document.querySelector('#quick-reverb + .value-display').textContent = `${settings.reverb}%`;
                document.querySelector('#quick-delay + .value-display').textContent = `${settings.delay}%`;
                document.querySelector('#quick-filter + .value-display').textContent = `${settings.filter}%`;
                
                // Apply to effects
                this.effects.reverbSend.gain.value = settings.reverb / 100;
                this.effects.delaySend.gain.value = settings.delay / 100;
                
                // Sync delay time to BPM for atmospheric effects
                if (preset === 'atmospheric' || preset === 'ambient-guitar') {
                    this.effects.delay.delayTime.value = 60 / this.bpm * 0.375; // Dotted eighth note
                } else {
                    this.effects.delay.delayTime.value = 60 / this.bpm * 0.25; // Quarter note
                }
                
                this.updateStatus(`Applied ${preset.replace('-', ' ')} preset`);
            }
        }
        
        applyChopPreset() {
            const preset = document.getElementById('chop-preset').value;
            if (!this.chopper.buffer || preset === 'custom') return;
            
            const chopPresets = {
                'vocal-chops': { 
                    slices: 16, 
                    sensitivity: 0.3, 
                    method: 'transient',
                    description: 'Perfect for vocal samples with 16 precise cuts'
                },
                'melody-chops': { 
                    slices: 8, 
                    sensitivity: 0.4, 
                    method: 'equal',
                    description: 'Clean 8-slice cuts ideal for melodic content'
                },
                'drum-breaks': { 
                    slices: 32, 
                    sensitivity: 0.6, 
                    method: 'transient',
                    description: 'High-sensitivity transient detection for drum breaks'
                },
                'bass-slices': { 
                    slices: 4, 
                    sensitivity: 0.2, 
                    method: 'equal',
                    description: '4 equal slices perfect for bass lines'
                },
                'texture-cuts': { 
                    slices: 12, 
                    sensitivity: 0.5, 
                    method: 'transient',
                    description: 'Medium sensitivity for textural elements'
                }
            };
            
            const settings = chopPresets[preset];
            if (settings) {
                // Update controls
                this.chopper.numSlices = settings.slices;
                this.chopper.sensitivity = settings.sensitivity;
                
                // Update UI sliders
                const slicesSlider = document.getElementById('chop-slices');
                const sensitivitySlider = document.getElementById('chop-sens'); // Fixed ID
                const slicesSliderMain = document.getElementById('chop-slices-main');
                const sensitivitySliderMain = document.getElementById('chop-sensitivity-main');
                
                if (slicesSlider) {
                    slicesSlider.value = settings.slices;
                    document.getElementById('chop-slices-display').textContent = settings.slices;
                }
                if (sensitivitySlider) {
                    sensitivitySlider.value = settings.sensitivity;
                    document.getElementById('chop-sens-display').textContent = settings.sensitivity.toFixed(2);
                }
                if (slicesSliderMain) {
                    slicesSliderMain.value = settings.slices;
                    document.getElementById('chop-slices-main-display').textContent = settings.slices;
                }
                if (sensitivitySliderMain) {
                    sensitivitySliderMain.value = settings.sensitivity;
                    document.getElementById('chop-sensitivity-main-display').textContent = settings.sensitivity;
                }
                
                // Apply the slicing method
                if (settings.method === 'transient') {
                    this.detectTransients();
                } else {
                    this.createEqualSlices();
                }
                
                this.updateStatus(`Applied ${preset.replace('-', ' ')} preset: ${settings.description}`);
            }
        }
        
        // ===== Samples =====
        playSample(slotIndex) {
            if (!this.sampleBank.has(slotIndex)) return;
            const entry = this.sampleBank.get(slotIndex);
            const buf = entry.buffer || entry;
            const now = this.context.currentTime;
            let when = now;
            if (this.quantize && this.transportStartTime) {
                when = this.getNextStepTime(now);
            }
            const src = this.context.createBufferSource();
            src.buffer = buf;
            src.connect(this.masterGain);
            src.start(when);
            
            // Flash the slot
            const slot = document.getElementById(`sample-slot-${slotIndex}`);
            if (slot) {
                slot.classList.add('active');
                setTimeout(() => slot.classList.remove('active'), 200);
            }
        }

        // === Audio import/export helpers ===
        async importTrackFromFile(trackIndex, file){
            try {
                if (!file) return;
                const arrayBuf = await file.arrayBuffer();
                const audioBuf = await this.context.decodeAudioData(arrayBuf);
                const t = this.tracks[trackIndex];
                t.buffer = audioBuf;
                t.isRecording = false;
                // draw waveform in both views
                this.drawWaveform(trackIndex, audioBuf, 'unified-tracks');
                this.drawWaveform(trackIndex, audioBuf, 'loopstation-tracks');
                this.updateStatus(`Imported audio into Track ${trackIndex+1}`);
            } catch(err){
                console.error('Import failed', err);
                this.updateStatus('Import failed');
            }
        }

        exportTrackWav(trackIndex){
            const t = this.tracks[trackIndex];
            if (!t || !t.buffer) { 
                this.updateStatus('No audio to export.'); 
                return; 
            }
            try {
                const wavBlob = this._audioBufferToWav(t.buffer);
                const url = URL.createObjectURL(wavBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `track_${trackIndex+1}.wav`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                this.updateStatus('Exported WAV successfully.');
            } catch (e) {
                console.error(e);
                this.updateStatus('Failed to export WAV.');
            }
        }
        
        exportTrackToChopper(trackIndex) {
            const track = this.tracks[trackIndex];
            if (!track || !track.buffer) {
                this.updateStatus('No audio to export to chopper');
                return;
            }
            
            // Copy the track buffer to the chopper
            this.chopper.buffer = track.buffer;
            this.chopper.sliceMarkers = [];
            this.chopper.slices = [];
            
            // Update chopper display
            this.drawChopperWaveform();
            this.drawChopperWaveformMain();
            this.updateChopperInfo();
            this.renderChopperPads();
            this.renderChopperPadsMain();
            
            // Switch to chopper mode for immediate editing
            const chopperBtn = document.querySelector('[data-mode="chopper"]');
            if (chopperBtn) {
                chopperBtn.click();
            }
            
            this.updateStatus(`Exported Track ${trackIndex + 1} to Sample Chopper - Ready for slicing!`);
        }
        
        _audioBufferToWav(buffer) {
            const length = buffer.length * buffer.numberOfChannels * 2 + 44;
            const arrayBuffer = new ArrayBuffer(length);
            const view = new DataView(arrayBuffer);
            const channels = [];
            let offset = 0;
            let pos = 0;

            // write WAVE header
            const setUint16 = (data) => {
                view.setUint16(pos, data, true);
                pos += 2;
            };
            const setUint32 = (data) => {
                view.setUint32(pos, data, true);
                pos += 4;
            };

            setUint32(0x46464952); // "RIFF"
            setUint32(length - 8); // file length - 8
            setUint32(0x45564157); // "WAVE"
            setUint32(0x20746d66); // "fmt " chunk
            setUint32(16); // length = 16
            setUint16(1); // PCM
            setUint16(buffer.numberOfChannels);
            setUint32(buffer.sampleRate);
            setUint32(buffer.sampleRate * buffer.numberOfChannels * 2); // avg bytes/sec
            setUint16(buffer.numberOfChannels * 2); // block align
            setUint16(16); // 16-bit
            setUint32(0x61746164); // "data" chunk
            setUint32(length - pos - 4); // chunk length

            // write interleaved data
            for (let i = 0; i < buffer.numberOfChannels; i++) {
                channels.push(buffer.getChannelData(i));
            }

            while (offset < buffer.length) {
                for (let i = 0; i < buffer.numberOfChannels; i++) {
                    let sample = Math.max(-1, Math.min(1, channels[i][offset]));
                    sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                    view.setInt16(pos, sample, true);
                    pos += 2;
                }
                offset++;
            }

            return new Blob([arrayBuffer], { type: 'audio/wav' });
        }

        renderSequencer() {
            const grid = document.getElementById('sequencer-grid');
            if (!grid) return;
            const rows = this.sequencer.numRows;
            const steps = this.sequencer.numSteps;
            grid.innerHTML = '';
            
            // header row
            const headLabel = document.createElement('div');
            headLabel.className = 'seq-row-label';
            headLabel.textContent = 'Row / Step';
            grid.appendChild(headLabel);
            
            for (let sIdx = 0; sIdx < steps; sIdx++) {
                const h = document.createElement('div');
                h.className = 'step-head';
                h.title = 'Step ' + (sIdx+1);
                grid.appendChild(h);
            }
            
            // rows
            for (let r = 0; r < rows; r++) {
                const label = document.createElement('div');
                label.className = 'seq-row-label';
                const slotIdx = this.sequencer.rowSample[r];
                label.innerHTML = `<div><strong>Row ${r+1}</strong><div style="opacity:.7;font-size:11px">${slotIdx!=null?('Slot '+(slotIdx+1)):'--'}</div></div>`;
                
                const ctrls = document.createElement('div');
                ctrls.className='seq-row-controls';
                ctrls.innerHTML = `
                    <label>Vol</label><input class="tiny" type="range" min="0" max="1" step="0.01" value="${this.sequencer.rowGain[r].toFixed(2)}"/>
                    <label>Pan</label><input class="tiny" type="range" min="-1" max="1" step="0.01" value="${this.sequencer.rowPan[r].toFixed(2)}"/>
                    <label>Rev</label><input class="tiny" type="range" min="0" max="1" step="0.01" value="${this.sequencer.rowRev[r].toFixed(2)}"/>
                    <label>Del</label><input class="tiny" type="range" min="0" max="1" step="0.01" value="${this.sequencer.rowDel[r].toFixed(2)}"/>
                `;
                
                const inputs = Array.from(ctrls.querySelectorAll('input'));
                inputs[0].addEventListener('input', (e)=>this.sequencer.rowGain[r]=Number(e.target.value));
                inputs[1].addEventListener('input', (e)=>this.sequencer.rowPan[r]=Number(e.target.value));
                inputs[2].addEventListener('input', (e)=>this.sequencer.rowRev[r]=Number(e.target.value));
                inputs[3].addEventListener('input', (e)=>this.sequencer.rowDel[r]=Number(e.target.value));
                
                label.appendChild(ctrls);
                grid.appendChild(label);
                
                for (let sIdx = 0; sIdx < steps; sIdx++) {
                    const cell = document.createElement('div');
                    cell.className = 'seq-step' + (this.sequencer.grid[r][sIdx] ? ' active' : '');
                    cell.dataset.row = r; 
                    cell.dataset.step = sIdx;
                    
                    const vb = document.createElement('div'); 
                    vb.className='velbar';
                    vb.style.transform = `scaleY(${this.sequencer.velGrid[r][sIdx]})`;
                    cell.appendChild(vb);
                    
                    cell.addEventListener('click', (e) => {
                        const rr = Number(cell.dataset.row);
                        const ss = Number(cell.dataset.step);
                        if (e.shiftKey) {
                            // Shift-click adjusts velocity
                            const cur = this.sequencer.velGrid[rr][ss];
                            let next = 0.5;
                            if (cur < 0.55) next = 0.8;
                            else if (cur < 0.85) next = 1.0;
                            else next = 0.5;
                            this.sequencer.velGrid[rr][ss] = next;
                            vb.style.transform = `scaleY(${next})`;
                            if (!this.sequencer.grid[rr][ss]) {
                                this.sequencer.grid[rr][ss] = true;
                                cell.classList.add('active');
                            }
                        } else {
                            // Regular click toggles step
                            this.sequencer.grid[rr][ss] = !this.sequencer.grid[rr][ss];
                            cell.classList.toggle('active', this.sequencer.grid[rr][ss]);
                        }
                    });
                    
                    grid.appendChild(cell);
                }
            }
        }

    }