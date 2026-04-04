// neural-app.js - Neural Interface Controller
// UI workflow management only. Engine lifecycle is owned by app.js.
// Call neuralInterface.setEngine(engine) after the engine is initialized.

class NeuralWorkflowManager {
    constructor() {
        this.engine = null;
        this.currentWorkflow = 'performance';
        this.padModes = {
            performance: 'slices',
            capture: 'loops',
            chop: 'slices',
            loopstation: 'loops',
            mix: 'tracks'
        };
        this.visualizers = new Map();
        this.isRecording = false;
        this.metronomeActive = false;

        // UI-only setup (no audio needed yet)
        this._setupKeyboardMapping();
        this._setupWorkflowSwitching();
        this._initializeInterface();
        this._injectAnimationStyles();
    }

    // ==================== Engine handoff ====================

    /**
     * Called by app.js once UnifiedAudioEngine is ready.
     * All audio-dependent wiring happens here.
     */
    setEngine(engine) {
        this.engine = engine;
        this._setupTransportControls();
        this._setupWorkflowControls();
        this._setupFileOperations();
        this._setupParameterControls();
        this._setupMIDIHandling();
        this._initializeVisualization();
        this._startSystemMonitoring();
        this._fixButtonLabels(); // Fix emoji rendering issues
        this.showMessage('🎵 Neural Audio Engine Online', 'success');
    }

    // ==================== Workflow switching ====================

    _setupWorkflowSwitching() {
        document.querySelectorAll('[data-workflow]').forEach(btn => {
            btn.addEventListener('click', () => this.switchWorkflow(btn.dataset.workflow));
        });
    }

    switchWorkflow(workflow) {
        if (this.currentWorkflow === workflow) return;

        document.querySelectorAll('[data-workflow]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.workflow === workflow);
        });
        document.querySelectorAll('.workflow-panel').forEach(panel => {
            panel.classList.toggle('active', panel.dataset.workflow === workflow);
        });
        document.querySelectorAll('.workflow-content').forEach(content => {
            content.classList.toggle('active', content.id === `workflow-${workflow}`);
        });

        this.currentWorkflow = workflow;
        this._updatePadModeDisplay();
        this._initializeWorkflowFeatures(workflow);
        this._playUIClick();
        this.showMessage(`Switched to ${workflow} mode`, 'info');
    }

    _initializeWorkflowFeatures(workflow) {
        switch (workflow) {
            case 'performance': this._startPerformanceVisualization(); break;
            case 'capture':     this._setupRecordingInterface();       break;
            case 'chop':        this._initializeSlicePads(); this._ensureChopperFeatures(); break;
            case 'loopstation': this._initializeLoopStation(); break;
            case 'mix':         this._generateMixerStrips();           break;
        }
    }

    _playUIClick() {
        if (!this.engine?.context) return;
        try {
            const osc = this.engine.context.createOscillator();
            const gain = this.engine.context.createGain();
            osc.connect(gain);
            gain.connect(this.engine.context.destination);
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.08, this.engine.context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.engine.context.currentTime + 0.08);
            osc.start();
            osc.stop(this.engine.context.currentTime + 0.08);
        } catch (_) {}
    }

    // ==================== Transport controls ====================

    _setupTransportControls() {
        const bind = (id, fn) => {
            const el = document.getElementById(id);
            if (el) el.onclick = fn;
        };

        bind('play-all',     () => this.engine?.playAll?.());
        bind('stop-all',     () => this.engine?.stopAll?.());
        bind('record-mode',  () => this._toggleGlobalRecord());
        bind('metronome',    () => this._toggleMetronome());
        bind('save-project', () => window.saveCurrentProject?.());
        bind('load-project', () => window.showProjectList?.());
    }

    _toggleGlobalRecord() {
        this.isRecording = !this.isRecording;
        document.getElementById('record-mode')?.classList.toggle('active', this.isRecording);
        this.showMessage(this.isRecording ? '🔴 Recording armed' : '⏹ Recording disarmed', 'info');
    }

    _toggleMetronome() {
        this.metronomeActive = !this.metronomeActive;
        document.getElementById('metronome')?.classList.toggle('active', this.metronomeActive);
        this.metronomeActive ? this.engine?.startMetronome?.() : this.engine?.stopMetronome?.();
    }

    // ==================== Workflow controls ====================

    _setupWorkflowControls() {
        document.getElementById('pad-mode-cycle')?.addEventListener('click', () => this._cyclePadMode());
        document.getElementById('record-arm')?.addEventListener('click',     () => this._toggleRecordArm());
        // chop-load button handled by chopper module
        document.getElementById('auto-slice')?.addEventListener('click',    () => {
            if (this.engine?.chopper?.buffer) {
                this.engine.createEqualSlices?.();
            } else {
                this.showMessage('Load a sample first', 'error');
            }
        });
        document.getElementById('mixdown-tracks')?.addEventListener('click', () => this.engine?.mixdownAllTracks?.());
    }

    _cyclePadMode() {
        const modes = ['slices', 'samples', 'loops', 'tracks'];
        const current = this.padModes[this.currentWorkflow] || 'slices';
        this.padModes[this.currentWorkflow] = modes[(modes.indexOf(current) + 1) % modes.length];
        this._updatePadModeDisplay();
    }

    _updatePadModeDisplay() {
        const el = document.getElementById('pad-mode-display');
        if (el) el.textContent = (this.padModes[this.currentWorkflow] || 'slices').toUpperCase();
    }

    _toggleRecordArm() {
        this.isRecording = !this.isRecording;
        document.getElementById('record-arm')?.classList.toggle('active', this.isRecording);
    }

    // ==================== File operations ====================

    _setupFileOperations() {
        document.addEventListener('dragover', e => e.preventDefault());
        document.addEventListener('drop', e => {
            e.preventDefault();
            const file = e.dataTransfer?.files?.[0];
            if (file?.type.startsWith('audio/') && this.engine) {
                this._handleDroppedFile(file);
            }
        });
    }

    _handleDroppedFile(file) {
        this.showMessage(`Loading: ${file.name}`, 'info');
        if (typeof this.engine.loadChopperFile === 'function') {
            const dt = new DataTransfer();
            dt.items.add(file);
            const input = document.createElement('input');
            input.type = 'file';
            Object.defineProperty(input, 'files', { value: dt.files });
            this.engine.loadChopperFile({ target: input });
        }
    }

    _setupParameterControls() {
        const bindFx = (id, fn) => {
            document.getElementById(id)?.addEventListener('input', e => fn(parseFloat(e.target.value)));
        };

        bindFx('live-reverb', v => {
            if (this.engine?.effects?.reverbSend)
                this.engine.effects.reverbSend.gain.value = v;
        });
        bindFx('live-delay', v => {
            if (this.engine?.effects?.delaySend)
                this.engine.effects.delaySend.gain.value = v;
        });
        bindFx('live-filter', v => {
            if (this.engine?.effects?.filter)
                this.engine.effects.filter.frequency.value = v * 20000;
        });
        bindFx('live-volume', v => {
            if (this.engine?.masterGain)
                this.engine.masterGain.gain.value = v;
        });
    }

    _setupMIDIHandling() {
        document.getElementById('midi-connect')?.addEventListener('click', () => {
            if (typeof window.initMIDI === 'function') {
                window.initMIDI();
            } else {
                this.showMessage('MIDI module not loaded', 'error');
            }
        });
    }

    // ==================== Pad grid ====================

    _initializeInterface() {
        this._initializePads();
        this._initializeSampleBank();
    }

    _initializePads() {
        const container = document.getElementById('performance-pads');
        if (!container) return;

        container.innerHTML = '';
        const labels = ['Q','W','E','R','A','S','D','F','Z','X','C','V','1','2','3','4'];
        for (let i = 0; i < 16; i++) {
            const pad = document.createElement('div');
            pad.className = 'neural-pad';
            pad.dataset.index = i;
            pad.innerHTML = `<span style="font-size:14px;font-weight:600;opacity:.7">${labels[i]}</span>`;
            pad.addEventListener('pointerdown', () => this._triggerPad(i));
            container.appendChild(pad);
        }
    }

    _triggerPad(index) {
        if (!this.engine) return;
        const mode = this.padModes[this.currentWorkflow] || 'slices';
        switch (mode) {
            case 'slices':  this.engine.playSlice?.(index);  break;
            case 'samples': this.engine.playSample?.(index); break;
            case 'loops':
            case 'tracks':  this.engine.playTrack?.(index);  break;
        }
        const pad = document.querySelector(`.neural-pad[data-index="${index}"]`);
        if (pad) {
            pad.classList.add('active');
            setTimeout(() => pad.classList.remove('active'), 120);
        }
    }

    _initializeSampleBank() {
        const container = document.getElementById('neural-sample-bank');
        if (!container) return;
        container.innerHTML = '';
        for (let i = 0; i < 16; i++) {
            const slot = document.createElement('div');
            slot.className = 'sample-slot';
            slot.dataset.index = i;
            slot.textContent = i + 1;
            slot.addEventListener('click', () => {
                if (this.engine?.sampleBank?.has(i)) {
                    this.engine.playSample?.(i);
                    slot.classList.add('active');
                    setTimeout(() => slot.classList.remove('active'), 200);
                }
            });
            container.appendChild(slot);
        }
    }

    _initializeSlicePads() {
        if (!this.engine?.chopper?.slices?.length) return;
        document.querySelectorAll('.neural-pad').forEach((pad, i) => {
            pad.classList.toggle('loaded', i < this.engine.chopper.slices.length);
        });
    }

    _ensureChopperFeatures() {
        // Ensure chopper UI elements are properly connected
        if (this.engine?.initChopper && !this._chopperInitialized) {
            this.engine.initChopper();
            this._chopperInitialized = true;
        }
    }

    _fixButtonLabels() {
        // Fix any broken emoji rendering
        const buttonFixes = {
            'chop-load': '📁 Load',
            'chop-detect': '⚡ Detect', 
            'chop-equal': '📊 Equal',
            'chop-slice-button': '🔪 Slice',
            'chop-stop': '⏹️ Stop',
            'chop-clear-markers': '🗑️ Clear',
            'chop-to-rows': '📋 To Rows',
            'chop-to-tracks': '🎵 To Tracks',
            'chop-export-all': '💾 Export'
        };
        
        Object.entries(buttonFixes).forEach(([id, label]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = label;
                element.title = label.split(' ').slice(1).join(' '); // Remove emoji for tooltip
            }
        });
        
        // Fix title too
        const titleElement = document.querySelector('#workflow-chop .panel-title');
        if (titleElement && titleElement.textContent.includes('ðŸ"ª')) {
            titleElement.textContent = '🔪 Quantum Slicer';
        }
    }

    _initializeLoopStation() {
        // Initialize loopstation tracks UI
        if (this.engine?.renderTracksUI) {
            this.engine.renderTracksUI();
        }
        this.showMessage('🔄 Loopstation ready', 'info');
    }

    _generateMixerStrips() {
        const container = document.getElementById('neural-mixer');
        if (!container || !this.engine) return;
        container.innerHTML = '';
        this.engine.tracks.forEach((track, i) => {
            const strip = document.createElement('div');
            strip.className = 'mixer-strip';
            strip.innerHTML = `
                <div class="mixer-label">T${i + 1}</div>
                <input type="range" min="0" max="100"
                       value="${track.volume ?? 70}"
                       orient="vertical"
                       oninput="window.engine.setTrackVolume?.(${i}, this.value)">
                <div class="mixer-mute" onclick="window.engine.toggleMute?.(${i})">M</div>
            `;
            container.appendChild(strip);
        });
    }

    // ==================== Keyboard mapping ====================
    // Pad keys (Q-V) + workflow switching (5-8) only.
    // Transport (Space, M) and BPM keys stay in app.js to avoid double-binding.

    _setupKeyboardMapping() {
        const padKeys = {
            'KeyQ':0,'KeyW':1,'KeyE':2,'KeyR':3,
            'KeyA':4,'KeyS':5,'KeyD':6,'KeyF':7,
            'KeyZ':8,'KeyX':9,'KeyC':10,'KeyV':11
        };
        const workflowKeys = {
            'Digit5': 'performance',
            'Digit6': 'capture',
            'Digit7': 'chop',
            'Digit8': 'mix'
        };

        document.addEventListener('keydown', e => {
            if (e.target.matches('input, select, textarea')) return;

            if (padKeys[e.code] !== undefined) {
                e.preventDefault();
                this._triggerPad(padKeys[e.code]);
                return;
            }
            if (workflowKeys[e.code]) {
                e.preventDefault();
                this.switchWorkflow(workflowKeys[e.code]);
            }
        });
    }

    // ==================== Visualization ====================

    _initializeVisualization() {
        const v = this._createPerformanceVisualizer();
        if (v) this.visualizers.set('performance', v);
        this._startVisualizationLoop();
    }

    _createPerformanceVisualizer() {
        const canvas = document.getElementById('performance-visualizer');
        if (!canvas) return null;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        canvas.width  = canvas.offsetWidth  * dpr;
        canvas.height = canvas.offsetHeight * dpr;
        canvas.style.width  = canvas.offsetWidth  + 'px';
        canvas.style.height = canvas.offsetHeight + 'px';
        ctx.scale(dpr, dpr);

        let analyser = null;
        let dataArray = new Uint8Array(256);
        if (this.engine?.context && this.engine?.masterGain) {
            try {
                analyser = this.engine.context.createAnalyser();
                analyser.fftSize = 512;
                this.engine.masterGain.connect(analyser);
                dataArray = new Uint8Array(analyser.frequencyBinCount);
            } catch (_) {}
        }

        return { canvas, ctx, analyser, dataArray };
    }

    _startPerformanceVisualization() {
        if (!this.visualizers.has('performance') && this.engine) {
            const v = this._createPerformanceVisualizer();
            if (v) this.visualizers.set('performance', v);
        }
    }

    _startVisualizationLoop() {
        const animate = () => {
            requestAnimationFrame(animate);
            if (this.currentWorkflow === 'performance') this._renderVisualization();
        };
        animate();
    }

    _renderVisualization() {
        const viz = this.visualizers.get('performance');
        if (!viz?.ctx) return;
        const { ctx, canvas, analyser, dataArray } = viz;
        const w = canvas.offsetWidth;
        const h = canvas.offsetHeight;

        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(0, 0, w, h);

        if (analyser) {
            analyser.getByteFrequencyData(dataArray);
            const barW = w / dataArray.length * 2.5;
            ctx.fillStyle = '#00ffcc';
            dataArray.forEach((val, i) => {
                const barH = (val / 255) * h * 0.9;
                ctx.fillRect(i * (barW + 1), h - barH, barW, barH);
            });
        } else {
            const t = Date.now() * 0.001;
            ctx.strokeStyle = '#00ffcc';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let x = 0; x < w; x += 2) {
                const y = h / 2 + Math.sin(x * 0.03 + t * 2) * 20 + Math.sin(x * 0.015 + t) * 10;
                x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
    }

    // ==================== System monitoring ====================

    _startSystemMonitoring() {
        setInterval(() => {
            if (!this.engine?.context) return;
            this._updateSystemStatus('audio', this.engine.context.state === 'running');
            this._updateSystemStatus('midi', !!window.midiAccess);
        }, 2000);
    }

    _updateSystemStatus(system, active) {
        document.getElementById(`${system}-status`)?.classList.toggle('active', active);
    }

    // ==================== Recording interface ====================

    _setupRecordingInterface() {
        document.getElementById('capture-record')?.addEventListener('click', () => {
            if (!this.engine) return;
            const idx = this.engine.tracks.findIndex(t => !t.buffer);
            if (idx >= 0) {
                this.engine.startRecording?.(idx);
                this.showMessage(`Recording on Track ${idx + 1}`, 'info');
            } else {
                this.showMessage('All tracks are full', 'error');
            }
        });

        document.getElementById('capture-stop')?.addEventListener('click', () => {
            this.engine?.stopRecording?.();
        });

        document.getElementById('monitor-toggle')?.addEventListener('click', e => {
            const on = e.target.classList.toggle('active');
            if (this.engine?.inputGain) {
                this.engine.inputGain.gain.value = on ? 1.0 : 0;
            }
        });
    }

    // ==================== Toast messages ====================

    showMessage(text, type = 'info') {
        document.getElementById('neural-toast')?.remove();
        const colors = { error: '#ff4455', success: '#00ff88', info: '#00ccff' };
        const toast = document.createElement('div');
        toast.id = 'neural-toast';
        toast.textContent = text;
        toast.style.cssText = `
            position:fixed;top:80px;left:50%;
            transform:translateX(-50%);
            background:${colors[type] ?? colors.info};
            color:#000;padding:10px 22px;
            border-radius:20px;font-weight:600;
            z-index:9999;font-size:14px;
            animation:neural-slide-in 0.3s ease;
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'neural-slide-out 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }

    // ==================== Singleton ====================

    static getInstance() {
        if (!window.neuralInterface) {
            window.neuralInterface = new NeuralWorkflowManager();
        }
        return window.neuralInterface;
    }

    _injectAnimationStyles() {
        if (document.getElementById('neural-anim-styles')) return;
        const s = document.createElement('style');
        s.id = 'neural-anim-styles';
        s.textContent = `
            @keyframes neural-slide-in  { from{opacity:0;top:60px} to{opacity:1;top:80px} }
            @keyframes neural-slide-out { from{opacity:1;top:80px} to{opacity:0;top:60px} }
        `;
        document.head.appendChild(s);
    }
}

// Singleton — engine handoff happens later via setEngine()
const neuralInterface = NeuralWorkflowManager.getInstance();

export { NeuralWorkflowManager, neuralInterface };
