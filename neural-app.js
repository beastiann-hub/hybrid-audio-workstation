// neural-app.js - Enhanced Neural Interface Controller
// Completely reimagined workflow-based audio workstation

import { UnifiedAudioEngine } from './engine.js';
import { ensureAudioContextRunning } from './core.js';

// Neural Workflow Manager
class NeuralWorkflowManager {
    constructor() {
        this.engine = null;
        this.currentWorkflow = 'performance';
        this.padModes = {
            performance: 'slices',
            capture: 'loops', 
            chop: 'slices',
            mix: 'tracks'
        };
        this.visualizers = new Map();
        this.isRecording = false;
        this.metronomeActive = false;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.initializeInterface();
        this.setupWorkflowSwitching();
        this.setupKeyboardMapping();
        
        // Wait for user interaction to initialize audio
        document.addEventListener('click', this.initializeAudio.bind(this), { once: true });
        document.addEventListener('touchstart', this.initializeAudio.bind(this), { once: true });
    }

    async initializeAudio(event) {
        const overlay = document.getElementById('loading-overlay');
        
        try {
            // Initialize audio engine with enhanced features
            this.engine = new UnifiedAudioEngine();
            await this.engine.init();
            await ensureAudioContextRunning();
            
            // Enhance engine with neural capabilities
            this.enhanceEngineWithNeuralFeatures();
            
            // Start systems
            this.initializeVisualization();
            this.startSystemMonitoring();
            
            // Hide loading overlay with smooth transition
            overlay.style.opacity = '0';
            overlay.style.transform = 'scale(0.95)';
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 500);
            
            this.updateSystemStatus('audio', true);
            this.showWelcomeMessage();
            
        } catch (error) {
            console.error('Neural engine initialization failed:', error);
            this.showErrorMessage('Failed to initialize audio system');
        }
    }

    enhanceEngineWithNeuralFeatures() {
        // Add neural processing capabilities
        this.engine.neuralEffects = {
            spatialProcessor: null,
            spectralAnalyzer: null,
            adaptiveCompressor: null
        };
        
        // Enhanced sample management
        this.engine.sampleMatrix = new Map();
        this.engine.sliceMatrix = new Map();
        this.engine.loopMatrix = new Map();
        
        // Workflow-specific processors
        this.initializeWorkflowProcessors();
    }

    initializeWorkflowProcessors() {
        // Performance mode: Real-time effects and spatial processing
        this.engine.performanceMode = {
            liveEffects: new Map(),
            spatialMix: null,
            energyAnalyzer: null
        };
        
        // Capture mode: Advanced recording with automatic gain staging
        this.engine.captureMode = {
            autoGain: true,
            adaptiveFiltering: true,
            latencyCompensation: true
        };
        
        // Chop mode: AI-assisted slicing and arrangement
        this.engine.chopMode = {
            beatDetection: null,
            spectralSlicing: null,
            contentAnalysis: null
        };
        
        // Mix mode: Intelligent mixing assistance
        this.engine.mixMode = {
            autoBalance: false,
            spectralMastering: null,
            dynamicEQ: new Map()
        };
    }

    setupEventListeners() {
        // Transport controls with enhanced feedback
        this.setupTransportControls();
        
        // Workflow-specific controls
        this.setupWorkflowControls();
        
        // File operations with drag & drop
        this.setupFileOperations();
        
        // Real-time parameter controls
        this.setupParameterControls();
        
        // MIDI integration
        this.setupMIDIHandling();
    }

    setupTransportControls() {
        const controls = {
            'play-all': () => this.playAll(),
            'stop-all': () => this.stopAll(),
            'record-mode': () => this.toggleGlobalRecord(),
            'metronome': () => this.toggleMetronome(),
            'save-project': () => this.saveProject(),
            'load-project': () => this.loadProject()
        };

        Object.entries(controls).forEach(([id, handler]) => {
            const element = document.getElementById(id);
            if (element) {
                element.onclick = handler;
                element.addEventListener('mousedown', () => this.playUIFeedback());
            }
        });
    }

    setupWorkflowControls() {
        // Performance workflow
        document.getElementById('pad-mode-cycle')?.addEventListener('click', () => {
            this.cyclePadMode();
        });

        // Capture workflow
        document.getElementById('record-arm')?.addEventListener('click', () => {
            this.toggleRecordArm();
        });

        // Chop workflow
        document.getElementById('load-sample')?.addEventListener('click', () => {
            this.loadSampleForChopping();
        });

        document.getElementById('auto-slice')?.addEventListener('click', () => {
            this.performAutoSlice();
        });

        // Mix workflow
        document.getElementById('mixdown-tracks')?.addEventListener('click', () => {
            this.performMixdown();
        });
    }

    setupKeyboardMapping() {
        const keyMap = {
            // Pad triggers
            'KeyQ': () => this.triggerPad(0),
            'KeyW': () => this.triggerPad(1),
            'KeyE': () => this.triggerPad(2),
            'KeyR': () => this.triggerPad(3),
            'KeyA': () => this.triggerPad(4),
            'KeyS': () => this.triggerPad(5),
            'KeyD': () => this.triggerPad(6),
            'KeyF': () => this.triggerPad(7),
            'KeyZ': () => this.triggerPad(8),
            'KeyX': () => this.triggerPad(9),
            'KeyC': () => this.triggerPad(10),
            'KeyV': () => this.triggerPad(11),
            'Digit1': () => this.triggerPad(12),
            'Digit2': () => this.triggerPad(13),
            'Digit3': () => this.triggerPad(14),
            'Digit4': () => this.triggerPad(15),
            
            // Transport shortcuts
            'Space': (e) => { e.preventDefault(); this.togglePlayStop(); },
            'KeyM': () => this.toggleMetronome(),
            'KeyL': () => this.toggleLoop(),
            
            // Workflow switching
            'Digit5': () => this.switchWorkflow('performance'),
            'Digit6': () => this.switchWorkflow('capture'),
            'Digit7': () => this.switchWorkflow('chop'),
            'Digit8': () => this.switchWorkflow('mix')
        };

        document.addEventListener('keydown', (e) => {
            const handler = keyMap[e.code];
            if (handler && !e.target.matches('input, select, textarea')) {
                e.preventDefault();
                handler(e);
            }
        });
    }

    initializeInterface() {
        this.initializePads();
        this.initializeSampleBank();
        this.initializeWorkflowContents();
        this.setupDragAndDrop();
    }

    initializePads() {
        const container = document.getElementById('performance-pads');
        if (!container) return;

        container.innerHTML = '';
        
        for (let i = 0; i < 16; i++) {
            const pad = document.createElement('div');
            pad.className = 'neural-pad';
            pad.dataset.index = i;
            
            pad.innerHTML = `
                <div style="font-size: 18px; font-weight: bold;">${i + 1}</div>
                <div style="font-size: 10px; opacity: 0.7;">Empty</div>
            `;
            
            pad.addEventListener('click', () => this.triggerPad(i));
            pad.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showPadContextMenu(i, e.clientX, e.clientY);
            });
            
            container.appendChild(pad);
        }
    }

    triggerPad(index) {
        // Visual feedback
        const pad = document.querySelector(`[data-index="${index}"]`);
        if (pad) {
            pad.classList.add('active');
            setTimeout(() => pad.classList.remove('active'), 150);
        }

        if (!this.engine) return;

        const currentMode = this.padModes[this.currentWorkflow];
        
        switch (currentMode) {
            case 'slices':
                this.engine.playSlice?.(index);
                break;
            case 'samples':
                this.engine.playSample?.(index);
                break;
            case 'loops':
                this.engine.toggleLoop?.(index);
                break;
            case 'tracks':
                this.engine.toggleTrack?.(index);
                break;
        }

        // Send MIDI feedback if available
        this.sendMIDIFeedback(index, true);
    }

    cyclePadMode() {
        const modes = ['slices', 'samples', 'loops', 'tracks'];
        const current = this.padModes[this.currentWorkflow];
        const currentIndex = modes.indexOf(current);
        const nextIndex = (currentIndex + 1) % modes.length;
        
        this.padModes[this.currentWorkflow] = modes[nextIndex];
        this.updatePadModeDisplay();
        this.playUIFeedback();
    }

    updatePadModeDisplay() {
        const button = document.getElementById('pad-mode-cycle');
        const mode = this.padModes[this.currentWorkflow];
        
        const icons = {
            slices: '🔪',
            samples: '🎵',
            loops: '🔄', 
            tracks: '🎛️'
        };
        
        if (button) {
            button.textContent = icons[mode];
            button.title = `Current mode: ${mode}`;
        }
    }

    setupWorkflowSwitching() {
        document.querySelectorAll('.workflow-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchWorkflow(tab.dataset.workflow);
            });
        });
    }

    switchWorkflow(workflow) {
        if (this.currentWorkflow === workflow) return;

        // Smooth transition effect
        const currentContent = document.getElementById(`workflow-${this.currentWorkflow}`);
        const newContent = document.getElementById(`workflow-${workflow}`);
        
        if (currentContent && newContent) {
            // Fade out current
            currentContent.style.opacity = '0';
            currentContent.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                // Switch content
                document.querySelectorAll('.workflow-content').forEach(c => {
                    c.classList.remove('active');
                });
                newContent.classList.add('active');
                
                // Fade in new
                newContent.style.opacity = '0';
                newContent.style.transform = 'translateY(20px)';
                
                requestAnimationFrame(() => {
                    newContent.style.opacity = '1';
                    newContent.style.transform = 'translateY(0)';
                });
            }, 200);
        }

        // Update active tab
        document.querySelectorAll('.workflow-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`[data-workflow="${workflow}"]`)?.classList.add('active');
        
        this.currentWorkflow = workflow;
        this.updatePadModeDisplay();
        
        // Initialize workflow-specific features
        this.initializeWorkflowFeatures(workflow);
        this.playUIFeedback();
    }

    initializeWorkflowFeatures(workflow) {
        switch (workflow) {
            case 'performance':
                this.startPerformanceVisualization();
                this.generatePerformanceTracks();
                break;
            case 'capture':
                this.setupRecordingInterface();
                this.generateCaptureTracks();
                break;
            case 'chop':
                this.setupChoppingInterface();
                this.initializeSlicePads();
                break;
            case 'mix':
                this.setupMixingInterface();
                this.generateMixerStrips();
                break;
        }
    }

    initializeVisualization() {
        this.visualizers.set('performance', this.createPerformanceVisualizer());
        this.visualizers.set('chop', this.createWaveformVisualizer());
        
        this.startVisualizationLoop();
    }

    createPerformanceVisualizer() {
        const canvas = document.getElementById('performance-visualizer');
        if (!canvas) return null;

        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth * window.devicePixelRatio;
        canvas.height = canvas.offsetHeight * window.devicePixelRatio;
        canvas.style.width = canvas.offsetWidth + 'px';
        canvas.style.height = canvas.offsetHeight + 'px';
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

        return {
            canvas,
            ctx,
            analyser: this.engine?.context ? this.engine.context.createAnalyser() : null,
            dataArray: new Uint8Array(256)
        };
    }

    startVisualizationLoop() {
        const animate = () => {
            this.updateVisualization();
            requestAnimationFrame(animate);
        };
        animate();
    }

    updateVisualization() {
        const viz = this.visualizers.get(this.currentWorkflow);
        if (!viz || !viz.ctx) return;

        const { ctx, canvas, analyser, dataArray } = viz;
        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;

        // Clear with fade effect
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(0, 0, width, height);

        if (this.currentWorkflow === 'performance') {
            this.renderPerformanceVisualization(ctx, width, height, dataArray);
        }
    }

    renderPerformanceVisualization(ctx, width, height, dataArray) {
        // Animated waveform
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const time = Date.now() * 0.001;
        for (let i = 0; i < width; i += 3) {
            const x = i;
            const y = height / 2 + Math.sin(x * 0.02 + time * 2) * 25 + 
                      Math.sin(x * 0.01 + time) * 15;
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Spectrum bars
        ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
        for (let i = 0; i < 32; i++) {
            const x = (i / 32) * width;
            const barHeight = Math.random() * height * 0.4;
            ctx.fillRect(x, height - barHeight, width / 32 - 2, barHeight);
        }
    }

    generatePerformanceTracks() {
        const container = document.getElementById('performance-tracks');
        if (!container) return;

        container.innerHTML = '';
        
        for (let i = 0; i < 6; i++) {
            const track = this.createTrackCard(i, 'performance');
            container.appendChild(track);
        }
    }

    createTrackCard(index, type) {
        const card = document.createElement('div');
        card.className = 'track-card';
        card.dataset.trackIndex = index;
        
        const trackName = `Track ${index + 1}`;
        const isActive = false; // Get from engine state
        
        card.innerHTML = `
            <div class="track-title">${trackName}</div>
            <div class="control-strip">
                <div class="orb-control ${isActive ? 'active' : ''}" 
                     onclick="neuralInterface.toggleTrack(${index})"
                     style="width: 35px; height: 35px; font-size: 14px;">
                    ${isActive ? '⏸️' : '▶️'}
                </div>
                <input type="range" min="0" max="100" value="70" 
                       onchange="neuralInterface.setTrackVolume(${index}, this.value)"
                       style="flex: 1; margin: 0 10px;">
                <div class="orb-control" 
                     onclick="neuralInterface.toggleTrackMute(${index})"
                     style="width: 35px; height: 35px; font-size: 14px;">🔇</div>
            </div>
            <div style="margin-top: 10px; font-size: 12px; opacity: 0.7;">
                ${type === 'performance' ? 'Live Performance' : type === 'capture' ? 'Recording' : 'Playback'}
            </div>
        `;
        
        return card;
    }

    playUIFeedback() {
        // Play subtle UI sound feedback
        if (this.engine?.context) {
            const osc = this.engine.context.createOscillator();
            const gain = this.engine.context.createGain();
            
            osc.connect(gain);
            gain.connect(this.engine.context.destination);
            
            osc.frequency.setValueAtTime(800, this.engine.context.currentTime);
            gain.gain.setValueAtTime(0.1, this.engine.context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.engine.context.currentTime + 0.1);
            
            osc.start();
            osc.stop(this.engine.context.currentTime + 0.1);
        }
    }

    updateSystemStatus(system, active) {
        const indicator = document.getElementById(`${system}-status`);
        if (indicator) {
            indicator.classList.toggle('active', active);
        }
    }

    showWelcomeMessage() {
        this.showTemporaryMessage('🎵 Neural Audio Engine Online', 'success');
    }

    showErrorMessage(message) {
        this.showTemporaryMessage(`⚠️ ${message}`, 'error');
    }

    showTemporaryMessage(text, type = 'info') {
        // Create floating message
        const message = document.createElement('div');
        message.style.cssText = `
            position: fixed;
            top: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'error' ? '#ff4444' : type === 'success' ? '#00ff88' : '#00ccff'};
            color: #000;
            padding: 15px 25px;
            border-radius: 25px;
            font-weight: 600;
            z-index: 10000;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            animation: slideInDown 0.5s ease;
        `;
        message.textContent = text;
        
        document.body.appendChild(message);
        
        setTimeout(() => {
            message.style.animation = 'slideOutUp 0.5s ease';
            setTimeout(() => message.remove(), 500);
        }, 3000);
    }

    // Export interface for global access
    static getInstance() {
        if (!window.neuralInterface) {
            window.neuralInterface = new NeuralWorkflowManager();
        }
        return window.neuralInterface;
    }
}

// Initialize Neural Interface
const neuralInterface = NeuralWorkflowManager.getInstance();

// Add required CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInDown {
        from { transform: translate(-50%, -100%); opacity: 0; }
        to { transform: translate(-50%, 0); opacity: 1; }
    }
    
    @keyframes slideOutUp {
        from { transform: translate(-50%, 0); opacity: 1; }
        to { transform: translate(-50%, -100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

export { NeuralWorkflowManager, neuralInterface };