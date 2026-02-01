# Hybrid Audio Workstation v2 (Refactored)

A professional web-based music production workstation with loop station, sample chopper, and step sequencer - optimized for iPad and desktop browsers.

## 🚀 What's New in v2

### Structural Improvements

1. **Extracted CSS** (`styles.css`)
   - All styles moved from inline to external stylesheet
   - CSS custom properties (variables) for consistent theming
   - Better organization with sections for each component
   - Reduced HTML file size by ~70%

2. **Modular JavaScript**
   - `effects.js` - Unified effect presets (removed duplication)
   - `midi.js` - Extracted MIDI handling with cleaner API
   - `storage.js` - IndexedDB persistence for projects/samples
   - `beat-detection.js` - **NEW** Enhanced beat/tempo detection
   - `ai-features.js` - **NEW** AI sample generation & stem separation
   - Clean imports in `app.js`

3. **PWA Support**
   - `manifest.json` - App manifest for install prompt
   - `sw.js` - Service worker for offline caching
   - Works offline after first load
   - Add to home screen on iPad/mobile

4. **Project Persistence**
   - Save/load projects to IndexedDB
   - Export/import projects as JSON
   - Sample library storage
   - MIDI mapping persistence

### 🤖 AI Features (NEW!)

#### Beat Detection (Works Offline!)
- **Multi-algorithm analysis**: Onset detection, spectral flux, autocorrelation
- **Accurate BPM detection**: 60-200 BPM with confidence score
- **Beat grid alignment**: Snaps slices to actual beats
- **Downbeat detection**: Identifies bar boundaries
- **Time signature detection**: 4/4, 3/4, 6/8, etc.

#### AI Sample Generation (Requires API Key)
- **Text-to-music**: Describe what you want, AI generates it
- **Preset generators**: Drum loops, bass lines, melodies, ambient
- **Style options**: Boom-bap, trap, house, lo-fi, DnB, jazz, rock
- **BPM sync**: Generated samples match your project tempo

#### Stem Separation (Requires API Key)
- **Demucs integration**: Industry-leading stem separation
- **4-stem split**: Drums, bass, vocals, other
- **Load to tracks**: Each stem goes to a separate track
- **Sample from songs**: Extract just the drums or vocals from any song

## 📁 File Structure

```
workstation-v2/
├── index.html          # Main HTML (clean, no inline styles/scripts)
├── styles.css          # All CSS extracted and organized
├── app.js              # Main application entry point
├── engine.js           # Audio engine core
├── core.js             # AudioContext and effects setup
├── tracks.js           # Track management
├── chopper.js          # Sample chopper functionality
├── sequencer.js        # Step sequencer
├── effects.js          # NEW: Unified effect presets
├── midi.js             # NEW: MIDI handling module
├── storage.js          # NEW: IndexedDB persistence
├── sw.js               # NEW: Service worker for PWA
├── manifest.json       # NEW: PWA manifest
├── soundtouch_min.js   # Time-stretching library
├── draw-worker.js      # Waveform drawing worker
├── recorder-processor.js # Recording worklet
└── icons/              # PWA icons (add your own)
```

## 🔧 Migration Guide

To switch from the original to the refactored version:

1. **Backup your original files**
2. **Copy the v2 folder contents** to your hosting location
3. **Add PWA icons** (72, 96, 128, 144, 152, 192, 384, 512px)
4. **Test thoroughly** before going live

## 🎵 Features

### Loop Station
- 8 tracks with recording/playback
- Per-track volume, pan, reverb, delay
- Trim and split audio
- Mute/solo controls
- Count-in metronome
- Overdub mode

### Sample Chopper
- Load any audio file
- Automatic transient detection
- Manual slice mode
- Equal slicing
- Send slices to sequencer or tracks
- Per-slice effects

### Step Sequencer
- 16-step, 8-row drum machine
- Swing control
- Per-row volume/pan/reverb/delay
- Pattern save/load (A/B/C)
- Pattern chaining

### MPC Pads
- 16 velocity-sensitive pads
- Keyboard mapping (QWER/ASDF/ZXCV/1234)
- MIDI support (notes 36-51)
- Switch between slices/samples mode

### Effects
- 18 built-in presets (Ambient, Lo-Fi, Space, Cathedral, etc.)
- Global reverb and delay sends
- Per-track effect sends
- Real-time parameter control

### MIDI Support
- WebMidi.js polyfill for Safari/iOS
- MIDI learn for any control
- Save/load MIDI mappings
- MIDI monitor panel

## 🎨 Customization

### Theme Colors (in styles.css)
```css
:root {
  --color-primary: #00ff88;    /* Main accent */
  --color-secondary: #00ccff;  /* Secondary accent */
  --color-accent: #ff00ff;     /* Playhead, highlights */
  --color-warning: #ff8800;    /* Warning actions */
  --color-danger: #ff4444;     /* Recording, delete */
  --bg-dark: #0a0a0a;          /* Main background */
  --bg-panel: rgba(25, 25, 40, 0.9);  /* Panel backgrounds */
}
```

### Adding Effect Presets (in effects.js)
```javascript
export const EFFECT_PRESETS = {
  'my-preset': {
    reverbGain: 0.5,
    delayGain: 0.3,
    delayTime: 0.4,
    description: 'My custom preset'
  },
  // ...
};
```

## 📱 iPad Optimization

- Touch-optimized controls
- Viewport locked to prevent zoom
- PWA install for fullscreen
- WebMidi.js for MIDI on iOS Safari

## 🔌 MIDI Setup

1. Connect your MIDI device
2. Click "Connect MIDI"
3. Click "MIDI Mapping" to configure
4. Use "Learn" to map controls
5. Export mappings for backup

## 🤖 AI Features Setup

### Beat Detection (No Setup Required!)
Beat detection works entirely offline using advanced algorithms:
- Click **🎯 Beats** button in the chopper to analyze loaded audio
- Detected BPM is automatically applied to the project
- Slices are created at bar boundaries for perfect loops

### AI Generation & Stem Separation (Requires Replicate API)

1. **Get API Key**: Sign up at [replicate.com](https://replicate.com)
2. **Click** the **🤖 AI Features** button
3. **Enter** your API key in the configuration section
4. **Generate** samples or **separate** stems!

**Pricing Note**: Replicate charges per-use (~$0.01-0.10 per generation). Free tier available.

### What You Can Do:

**Generate Samples:**
```
"hard hitting trap drums 140 bpm"
"lo-fi jazz piano chords in C minor"
"deep house bass line 124 bpm groovy"
"ethereal ambient pad with reverb"
```

**Separate Stems:**
- Load any song into the chopper
- Click "Separate Stems"
- Get individual tracks for drums, bass, vocals, other
- Load each stem to a track for remixing

## 🛠️ Development

No build step required! Just serve the files with any HTTP server:

```bash
# Python
python -m http.server 8000

# Node.js
npx serve .

# PHP
php -S localhost:8000
```

## 📋 Browser Support

- Chrome 80+ ✅
- Safari 14+ ✅ (with WebMidi.js)
- Firefox 75+ ✅
- Edge 80+ ✅
- iOS Safari 14+ ✅ (PWA recommended)

## 🔮 Future Improvements

Potential AI-powered features to add:

1. **Stem Separation** - Split songs into drums/bass/vocals/other
2. **Beat Detection** - Auto-sync samples to tempo
3. **AI Sample Generation** - Generate loops from text prompts
4. **Key Detection** - Auto-detect musical key
5. **Smart Arrangement** - Suggest beat patterns

## 📄 License

MIT License - Use freely for personal and commercial projects.

---

**Original project files are preserved** - this is a non-destructive refactor. Compare the two versions to see the improvements!
