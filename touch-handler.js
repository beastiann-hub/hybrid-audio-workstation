// touch-handler.js - iPad-specific touch and gesture handling

export class TouchHandler {
    constructor() {
        this.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        
        if (this.isTouch) {
            this.initTouchEvents();
            this.preventIOSBehaviors();
        }
    }

    initTouchEvents() {
        // Prevent default touch behaviors that interfere with audio apps
        document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
        
        // Add visual feedback for touch interactions
        this.addTouchFeedback();
    }

    handleTouchStart(e) {
        // Prevent double-tap zoom on iPad
        if (e.touches.length > 1) {
            e.preventDefault();
        }
        
        // Add pressed state for visual feedback
        if (e.target.matches('.btn, .mode-btn, .sample-pad, .sequence-step')) {
            e.target.classList.add('touch-pressed');
        }
    }

    handleTouchMove(e) {
        // Prevent scrolling when interacting with controls
        if (e.target.matches('.btn, .mode-btn, .sample-pad, .sequence-step, input[type="range"]')) {
            e.preventDefault();
        }
    }

    handleTouchEnd(e) {
        // Remove pressed state
        if (e.target.matches('.btn, .mode-btn, .sample-pad, .sequence-step')) {
            setTimeout(() => {
                e.target.classList.remove('touch-pressed');
            }, 150);
        }
    }

    preventIOSBehaviors() {
        if (!this.isIOS) return;

        // Prevent bounce scroll
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        
        // Prevent zoom on input focus
        const inputs = document.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            if (input.style.fontSize === '' || parseInt(input.style.fontSize) < 16) {
                input.style.fontSize = '16px';
            }
        });

        // Disable text selection on UI elements
        document.addEventListener('selectstart', (e) => {
            if (e.target.matches('.btn, .mode-btn, .sample-pad, .sequence-step')) {
                e.preventDefault();
            }
        });

        // Optimize for low latency audio on iOS
        this.optimizeIOSAudio();
    }

    optimizeIOSAudio() {
        // Request permission for background audio
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(() => {
                console.log('Service Worker ready - background audio enabled');
            });
        }

        // Reduce audio buffer size for lower latency on iOS
        if (window.AudioContext || window.webkitAudioContext) {
            const originalCreate = (window.AudioContext || window.webkitAudioContext).prototype.createScriptProcessor;
            (window.AudioContext || window.webkitAudioContext).prototype.createScriptProcessor = function(bufferSize, ...args) {
                // Use smaller buffer on iOS for lower latency
                const iosBufferSize = Math.min(bufferSize || 4096, 2048);
                return originalCreate.call(this, iosBufferSize, ...args);
            };
        }
    }

    addTouchFeedback() {
        const style = document.createElement('style');
        style.textContent = `
            .touch-pressed {
                transform: scale(0.95) !important;
                opacity: 0.8 !important;
                transition: all 0.05s ease !important;
            }
            
            /* Prevent text selection on touch elements */
            .btn, .mode-btn, .sample-pad, .sequence-step {
                -webkit-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
                user-select: none;
                -webkit-tap-highlight-color: transparent;
            }
            
            /* iOS-specific improvements */
            @supports (-webkit-touch-callout: none) {
                input[type="range"] {
                    -webkit-appearance: none;
                    background: transparent;
                }
                
                input[type="range"]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    height: 30px;
                    width: 30px;
                    border-radius: 50%;
                    background: var(--color-primary);
                    box-shadow: 0 2px 10px rgba(0, 255, 136, 0.3);
                }
                
                input[type="range"]::-webkit-slider-track {
                    height: 8px;
                    border-radius: 4px;
                    background: var(--bg-control);
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Utility method to enable full-screen mode on iPad
    enableFullScreen() {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
            document.documentElement.webkitRequestFullscreen();
        }
    }

    // Method to handle device orientation changes
    handleOrientationChange() {
        window.addEventListener('orientationchange', () => {
            // Force layout recalculation after orientation change
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, 500);
        });
    }
}

// Auto-initialize on touch devices
if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    document.addEventListener('DOMContentLoaded', () => {
        const touchHandler = new TouchHandler();
        touchHandler.handleOrientationChange();
        
        // Make touch handler globally available
        window.touchHandler = touchHandler;
    });
}