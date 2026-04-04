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
                // ── 1. Core audio context (fatal if this fails) ──────────────────
                attachCore(this);
                // Backwards-compatible aliases (property assignment never throws)
                if (!this.audioContext) this.audioContext = this.context;
                if (!this.audioCtx)     this.audioCtx     = this.context;

                // ── 2. Module installations (each is required; log which one fails) ─
                const modules = [
                    () => installTracksImpls(this),
                    () => attachTracks(this),
                    () => installChopperImpls(this),
                    () => attachChopper(this),
                    () => installSequencerImpls(this),
                    () => attachSequencer(this),
                ];
                for (const install of modules) {
                    try { install(); }
                    catch (e) { console.error('Module install failed:', install.toString().slice(6, 40), e); }
                }

                // ── 3. Track objects ─────────────────────────────────────────────
                for (let i = 0; i < this.maxTracks; i++) {
                    this.tracks.push({
                        buffer: null, source: null, gain: null, panner: null,
                        isPlaying: false, isRecording: false,
                        recorder: null, chunks: [],
                        pan: 0, volume: 100, sliceMarkers: [],
                        _playheadRAF: null, _recordingRAF: null,
                        _playheadStartTime: null, _recordingStartTime: null,
                        trimStart: 0, trimEnd: null,
                        muted: false, soloed: false
                    });
                }
                this.undoStack = [];

                // ── 4. Per-track FX send nodes ───────────────────────────────────
                // These are optional — a single warn if the loop fails is enough.
                try {
                    for (const track of this.tracks) {
                        track.reverbSend = this.context.createGain();
                        track.reverbSend.gain.value = 0;
                        track.reverbSend.connect(this.effects.reverbSend);

                        track.delaySend = this.context.createGain();
                        track.delaySend.gain.value = 0;
                        track.delaySend.connect(this.effects.delaySend);
                    }
                } catch (e) {
                    console.warn('Per-track FX sends partially failed:', e);
                }

                // ── 5. UI initialisation ─────────────────────────────────────────
                this.initChopper();
                this.bindUI();
                this.renderTracks();
                this.startMeters();

                return true;
            } catch (error) {
                console.error('Audio initialization failed:', error);
                throw error;
            }
        }

        // Track methods are installed at runtime by installTracksImpls() in tracks.js
        
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
        
        // Chopper methods are installed at runtime by installChopperImpls() in chopper.js

        // ===== Remaining helper methods (not moved to modules) =====

        // applySliceEffectPreset() and exportSliceWithEffects() are installed by installChopperImpls()


        // createEqualSlices, detectTransients, renderChopperPads, playSlice,
        // slicesToSequencerRows, slicesToLoopTracks, exportAllSlices
        // are all installed by installChopperImpls() in chopper.js

        /**
         * bindUI() — UI event binding is handled by app.js.
         * Transport state is initialized here so the engine is self-contained.
         * Call this during init() to set default transport values.
         */
        bindUI() {
            // Transport / scheduler state (must be set before playAll/startMetronome)
            this.bpm              = parseInt(document.getElementById('master-bpm')?.value) || 120;
            this.bars             = parseInt(document.getElementById('master-bars')?.value) || 4;
            this.countInBars      = parseInt(document.getElementById('count-in-bars')?.value) || 1;
            this.firstTrackBars   = parseInt(document.getElementById('first-track-bars')?.value) || 4;
            this.countInFirstTrackOnly    = document.getElementById('count-in-first-only')?.checked ?? true;
            this.metronomeDuringRecording = document.getElementById('metronome-during-recording')?.checked ?? true;
            this.quantize         = document.getElementById('quantize-enabled')?.checked ?? false;
            this.recordMode       = 'replace';
            this.metronomeEnabled = false;
            this.metronomeRunning = false;
            this.beatsPerBar      = 4;
            this.transportStartTime = null;
            this.nextClickTime    = 0;
            this.lookahead        = 25;
            this.scheduleAheadTime = 0.1;
            this.timerID          = null;

            // System audio capture buttons (engine owns these since they need this.startSystemAudioCapture)
            document.getElementById('system-audio-capture')?.addEventListener('click', async () => {
                const msg = `SYSTEM AUDIO CAPTURE INSTRUCTIONS:\n\n1. Click OK to open the screen sharing dialog\n2. Select a browser tab or application window that's playing audio\n3. IMPORTANT: Check the "Share audio" checkbox in the dialog\n4. Click "Share" to start capturing that audio\n\nReady to proceed?`;
                if (!confirm(msg)) { this.updateStatus('System audio capture cancelled'); return; }
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
        }
        
        // tapTempo() is installed by installSequencerImpls() in sequencer.js

        toggleRecordMode() {
            // Cycle through: replace -> overdub -> play -> replace
            const modes = ['replace', 'overdub', 'play'];
            const currentIndex = modes.indexOf(this.recordMode);
            this.recordMode = modes[(currentIndex + 1) % modes.length];
            
            const btn = document.getElementById('record-mode-toggle');
            if (btn) {
                let text, isWarning = false;
                switch(this.recordMode) {
                    case 'replace':
                        text = 'REPLACE'; break;
                    case 'overdub':
                        text = 'OVERDUB'; isWarning = true; break;
                    case 'play':
                        text = 'REC->PLAY'; break;
                }
                btn.innerHTML = `Record Mode: ${text}`;
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
                        btn.innerHTML = 'STOP';
                        btn.classList.add('active');
                    } else {
                        btn.innerHTML = 'REC';
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
        
        // Applies a named quick-FX preset to the master effects bus.
        // Called from the #effect-preset dropdown in the UI.
        applyMasterPreset() {
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

        // renderSequencer() lives in sequencer.js and is bound via installSequencerImpls()

    }