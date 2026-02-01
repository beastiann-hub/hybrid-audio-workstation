// Install concrete track implementations onto the engine instance
export function installTracksImpls(engine) {
  function renderTracks() {
    const unifiedContainer = document.getElementById('unified-tracks');
    const looperContainer = document.getElementById('loopstation-tracks');
    
    if (unifiedContainer) {
      unifiedContainer.innerHTML = '';
      for (let i = 0; i < this.maxTracks; i++) {
        const trackCard = this.createTrackCard(i, 'unified');
        unifiedContainer.appendChild(trackCard);
      }
    }
    
    if (looperContainer) {
      looperContainer.innerHTML = '';
      for (let i = 0; i < this.maxTracks; i++) {
        const trackCard = this.createTrackCard(i, 'looper');
        looperContainer.appendChild(trackCard);
      }
    }
  }

  // Copy current master/global quick effect settings into a track's sends
  function copyMasterEffectsToTrack(trackIndex) {
    const track = this.tracks[trackIndex]; if (!track) return;
    this.ensureTrackEffects(trackIndex);
    try {
      // Read global/master quick controls if present, otherwise read the global send gains
      let masterReverb = 0, masterDelay = 0;
      const quickReverb = document.getElementById('quick-reverb');
      const quickDelay = document.getElementById('quick-delay');
      if (quickReverb) masterReverb = Number(quickReverb.value) / 100;
      else if (this.effects && this.effects.reverbSend) masterReverb = this.effects.reverbSend.gain.value || 0;
      if (quickDelay) masterDelay = Number(quickDelay.value) / 100;
      else if (this.effects && this.effects.delaySend) masterDelay = this.effects.delaySend.gain.value || 0;

      if (track.reverbSend) track.reverbSend.gain.value = masterReverb;
      if (track.delaySend) track.delaySend.gain.value = masterDelay;

      this.updateStatus(`Copied master FX to Track ${trackIndex + 1}`);
    } catch (e) {
      console.warn('copyMasterEffectsToTrack failed', e);
    }
  }

  function createTrackCard(trackIndex, mode) {
    const card = document.createElement('div');
    card.className = 'track-card';
    card.id = `track-${trackIndex}`;
    
    const viewPrefix = mode === 'unified' ? 'unified-tracks' : 'loopstation-tracks';
    
    card.innerHTML = `
      <div class="track-header">
          <div class="track-title">Track ${trackIndex + 1}</div>
          <div class="track-controls">
              <button class="btn mini-btn" onclick="engine.toggleMute(${trackIndex})" id="mute-btn-${trackIndex}" title="Mute track">M</button>
              <button class="btn mini-btn" onclick="engine.toggleSolo(${trackIndex})" id="solo-btn-${trackIndex}" title="Solo track">S</button>
              <button class="btn mini-btn" onclick="engine.toggleRecording(${trackIndex})" id="rec-btn-${trackIndex}">[REC]</button>
              <button class="btn mini-btn" onclick="engine.playTrack(${trackIndex})">[PLAY]</button>
              <button class="btn mini-btn" onclick="engine.stopTrack(${trackIndex})">[STOP]</button>
              <button class="btn mini-btn" onclick="engine.clearTrack(${trackIndex})">[CLR]</button>
          </div>
      </div>
      <div class="waveform-display">
          <canvas class="waveform-canvas" id="${viewPrefix}-waveform-${trackIndex}"></canvas>
          <div class="playhead" id="${viewPrefix}-playhead-${trackIndex}"></div>
          <div class="waveform-trim-controls" style="position: absolute; top: 2px; right: 2px; display: none;" id="${viewPrefix}-trim-controls-${trackIndex}">
              <button class="btn mini-btn" onclick="engine.applyTrackTrim(${trackIndex})" style="font-size: 10px; padding: 2px 6px;">Apply Trim</button>
              <button class="btn mini-btn" onclick="engine.resetTrackTrim(${trackIndex})" style="font-size: 10px; padding: 2px 6px;">Reset</button>
          </div>
      </div>
      <div class="control-row">
          <div class="control-item">
              <span class="control-label">Vol</span>
              <input type="range" id="track-vol-${trackIndex}" min="0" max="100" value="80">
              <span class="value-display">80%</span>
          </div>
          <div class="control-item">
              <span class="control-label">Pan</span>
              <input type="range" id="track-pan-${trackIndex}" min="-1" max="1" step="0.1" value="0">
              <span class="value-display">0</span>
          </div>
          <div class="control-item">
              <button class="btn mini-btn" onclick="engine.importTrackFromFileDialog(${trackIndex})">LOAD</button>
              <button class="btn mini-btn" onclick="engine.exportTrackWav(${trackIndex})">SAVE</button>
              <button class="btn mini-btn" onclick="engine.exportTrackToChopper(${trackIndex})">TO CHOP</button>
          </div>
      </div>
      <div class="control-row">
          <div class="control-item">
              <span class="control-label">Trim Start</span>
              <input type="number" id="trim-start-${trackIndex}" min="0" step="0.1" value="0" style="width: 80px;">
              <span style="margin-left: 5px;">s</span>
          </div>
          <div class="control-item">
              <span class="control-label">Trim End</span>
              <input type="number" id="trim-end-${trackIndex}" min="0" step="0.1" value="" placeholder="Full" style="width: 80px;">
              <span style="margin-left: 5px;">s</span>
          </div>
          <div class="control-item">
              <button class="btn mini-btn" onclick="engine.applyTrimFromInputs(${trackIndex})">SET TRIM</button>
              <button class="btn mini-btn" onclick="engine.resetTrackTrim(${trackIndex})">RESET</button>
              <button class="btn mini-btn" onclick="engine.applyTrackTrim(${trackIndex})">APPLY</button>
          </div>
      </div>
      <div class="control-row">
          <div class="control-item">
              <button class="btn mini-btn" onclick="engine.splitTrackAtTime(${trackIndex})" title="Split track at current position">[SPLIT]</button>
              <button class="btn mini-btn" onclick="engine.duplicateTrack(${trackIndex})" title="Duplicate to next empty track">[DUP]</button>
              <button class="btn mini-btn" onclick="engine.reverseTrack(${trackIndex})" title="Reverse audio">[REV]</button>
          </div>
          <div class="control-item">
              <button class="btn mini-btn" onclick="engine.normalizeTrack(${trackIndex})" title="Normalize volume">[NORM]</button>
              <button class="btn mini-btn" onclick="engine.fadeInTrack(${trackIndex})" title="Apply fade in">[FADE IN]</button>
              <button class="btn mini-btn" onclick="engine.fadeOutTrack(${trackIndex})" title="Apply fade out">[FADE OUT]</button>
          </div>
      </div>
          <div class="control-row fx-controls">
            <div class="control-item">
              <label class="control-label">FX Preset</label>
              <select id="track-effect-preset-${trackIndex}" style="max-width: 140px;">
                <option value="dry">Dry (no FX)</option>
                <option value="ambient">Ambient</option>
                <option value="lo-fi">Lo-Fi</option>
                <option value="space">Space</option>
                <option value="cathedral">Cathedral</option>
                <option value="hall">Hall</option>
                <option value="plate">Plate</option>
                <option value="spring">Spring</option>
                <option value="echo">Echo</option>
                <option value="slapback">Slapback</option>
                <option value="telephone">Telephone</option>
                <option value="radio">Radio</option>
                <option value="underwater">Underwater</option>
                <option value="cave">Cave</option>
                <option value="warm">Warm</option>
                <option value="bright">Bright</option>
                <option value="vintage">Vintage</option>
                <option value="dubby">Dubby</option>
              </select>
            </div>
            <div class="control-item">
              <button class="btn mini-btn" onclick="window.applyPresetToTrack(${trackIndex}, document.getElementById('track-effect-preset-${trackIndex}').value)">Apply</button>
              <button class="btn mini-btn" onclick="window.applyPresetToTrack(${trackIndex}, 'dry')">Dry</button>
            </div>
          </div>
    `;
    
    const volSlider = card.querySelector(`#track-vol-${trackIndex}`);
    const panSlider = card.querySelector(`#track-pan-${trackIndex}`);
    
    if (volSlider) {
      volSlider.addEventListener('input', (e) => {
        var track = this.tracks[trackIndex];
        if (track.gain) {
          track.gain.gain.value = e.target.value / 100;
        }
        e.target.nextElementSibling.textContent = e.target.value + '%';
      });
    }
    
    if (panSlider) {
      panSlider.addEventListener('input', (e) => {
        var track = this.tracks[trackIndex];
        track.pan = parseFloat(e.target.value);
        if (track.panner) {
          track.panner.pan.value = track.pan;
        }
        e.target.nextElementSibling.textContent = e.target.value;
      });
    }
    
    return card;
  }

  function importTrackFromFileDialog(trackIndex) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        this.importTrackFromFile(trackIndex, file);
      }
    };
    input.click();
  }

  async function startRecording(trackIndex) {
    try {
      if (!this.micStream) {
        this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      
      var track = this.tracks[trackIndex];
      if (track.isRecording) {
        this.stopRecording(trackIndex);
        return;
      }
      
      const isFirstTrack = !track.buffer;
      const recordingBars = isFirstTrack ? this.firstTrackBars : this.bars;
      const recordingDuration = recordingBars * 4 * (60 / this.bpm);
      
      if (this.recordMode === 'replace') {
        track.buffer = null;
        track.chunks = [];
      }
      
      // Count-in logic: only for first track if countInFirstTrackOnly is true
      const shouldCountIn = this.countInBars > 0 && (this.countInFirstTrackOnly ? isFirstTrack : true);
      
      // Sync metronome to the next downbeat for recording
      const now = this.context.currentTime;
      const countInDuration = shouldCountIn ? (this.countInBars * this.getBarDuration()) : 0;
      const recordingStartTime = this.getNextDownbeat(now) + countInDuration;
      
      // Set up the transport time for metronome synchronization
      this.transportStartTime = recordingStartTime;
      this.nextClickTime = recordingStartTime;
      
      // Start metronome if enabled and metronome during recording is enabled
      if (this.metronomeEnabled && this.metronomeDuringRecording) {
        if (!this.metronomeRunning) {
          this.metronomeRunning = true;
          this.startScheduler();
        }
      }
      
      // Do count-in if needed
      if (shouldCountIn) {
        await this.doCountIn();
      }
      
      // Re-sync after count-in to ensure precise alignment
      this.transportStartTime = recordingStartTime;
      this.nextClickTime = recordingStartTime;
      
      const source = this.context.createMediaStreamSource(this.micStream);
      
      track.chunks = [];
      track.maxRecordingLength = Math.floor(recordingDuration * this.context.sampleRate);
      track.recordedSamples = 0;

      let usedWorklet = false;
      if (this.context.audioWorklet) {
        try {
          await this.context.audioWorklet.addModule('recorder-processor.js');
          track.recorderNode = new AudioWorkletNode(this.context, 'recorder-processor');

          track.recorderNode.port.onmessage = (ev) => {
            const msg = ev.data;
            if (!msg) return;
            if (msg.type === 'data' && msg.payload) {
              const chunk = new Float32Array(msg.payload);
              const remaining = track.maxRecordingLength - track.recordedSamples;
              if (chunk.length > remaining) {
                track.chunks.push(chunk.subarray(0, remaining));
                track.recordedSamples += remaining;
              } else {
                track.chunks.push(chunk);
                track.recordedSamples += chunk.length;
              }

              if (track.recordedSamples >= track.maxRecordingLength) {
                setTimeout(() => this.stopRecording(trackIndex), 10);
              }
            }
          };

          source.connect(track.recorderNode);
          track.recorderNode.connect(this.inputGain);
          usedWorklet = true;
        } catch (err) {
          console.warn('AudioWorklet recorder unavailable, falling back', err);
          usedWorklet = false;
        }
      }

      if (!usedWorklet) {
        track.recorder = this.context.createScriptProcessor(4096, 1, 1);
        track.recorder.onaudioprocess = (e) => {
          if (track.isRecording && track.recordedSamples < track.maxRecordingLength) {
            const input = e.inputBuffer.getChannelData(0);
            const samplesToRecord = Math.min(input.length, track.maxRecordingLength - track.recordedSamples);

            if (samplesToRecord > 0) {
              const chunk = new Float32Array(samplesToRecord);
              chunk.set(input.subarray(0, samplesToRecord));
              track.chunks.push(chunk);
              track.recordedSamples += samplesToRecord;
            }

            if (track.recordedSamples >= track.maxRecordingLength) {
              setTimeout(() => this.stopRecording(trackIndex), 10);
            }
          }
        };

        source.connect(track.recorder);
        track.recorder.connect(this.context.destination);
      }
      
      track.isRecording = true;
      track._recordingStartTime = this.context.currentTime;
      
      const card = document.getElementById(`track-${trackIndex}`);
      if (card) card.classList.add('recording');
      
      const btn = document.getElementById(`rec-btn-${trackIndex}`);
      if (btn) {
        btn.innerHTML = '[STOP]';
        btn.classList.add('active');
      }
      
      this._updateRecordingPlayhead(trackIndex);
      
      this.updateStatus(`Recording on Track ${trackIndex + 1} (${this.recordMode} mode) - ${recordingBars} bars`);
    } catch (error) {
      console.error('Recording failed:', error);
      this.updateStatus('Recording failed - check microphone permissions');
    }
  }

  async function doCountIn() {
    return new Promise((resolve) => {
      if (this.countInBars === 0) {
        resolve();
        return;
      }
      
      const beatDuration = 60 / this.bpm;
      const totalBeats = this.countInBars * 4;
      let currentBeat = 0;
      
      this.updateStatus(`Count-in: ${this.countInBars} bar(s)...`);
      
      const playClick = () => {
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        
        osc.frequency.value = (currentBeat % 4 === 0) ? 2000 : 1200;
        gain.gain.setValueAtTime(0, this.context.currentTime);
        gain.gain.linearRampToValueAtTime(0.5, this.context.currentTime + 0.001);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + 0.05);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.context.currentTime + 0.06);
        
        currentBeat++;
        
        if (currentBeat < totalBeats) {
          setTimeout(playClick, beatDuration * 1000);
        } else {
          resolve();
        }
      };
      
      playClick();
    });
  }

  function _updateRecordingPlayhead(trackIndex) {
    var track = this.tracks[trackIndex];
    if (!track.isRecording) return;
    
    const loopDuration = this.bars * 4 * (60 / this.bpm);
    const elapsed = this.context.currentTime - track._recordingStartTime;
    const percent = (elapsed % loopDuration) / loopDuration;
    
    ['unified-tracks', 'loopstation-tracks'].forEach(viewId => {
      const playhead = document.getElementById(`${viewId}-playhead-${trackIndex}`);
      const canvas = document.getElementById(`${viewId}-waveform-${trackIndex}`);
      
      if (playhead && canvas) {
        const px = Math.floor(percent * canvas.offsetWidth);
        playhead.style.left = px + 'px';
      }
    });
    
    if (track.isRecording) {
      track._recordingRAF = requestAnimationFrame(() => this._updateRecordingPlayhead(trackIndex));
    }
  }

  function stopRecording(trackIndex) {
    const track = this.tracks[trackIndex];
    track.isRecording = false;
    
    if (track.recorder) {
      try { track.recorder.disconnect(); } catch(e){}
      track.recorder = null;
    }

    if (track.recorderNode) {
      try { track.recorderNode.port.postMessage({ type: 'stop' }); } catch(e){}
      try { track.recorderNode.disconnect(); } catch(e){}
      track.recorderNode = null;
    }
    
    if (track.chunks.length > 0) {
      const totalLength = track.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      
      // Safety check: don't create buffer with 0 length
      if (totalLength === 0) {
        console.warn('Recording is empty (0 samples), skipping buffer creation');
        this.updateStatus('Recording failed - no audio captured');
        track.chunks = [];
        
        // Reset UI
        const card = document.getElementById(`track-${trackIndex}`);
        if (card) card.classList.remove('recording');
        const btn = document.getElementById(`rec-btn-${trackIndex}`);
        if (btn) {
          const mode = this.recordMode === 'replace' ? '[R]' : '[O]';
          btn.innerHTML = `${mode} REC`;
          btn.classList.remove('active');
        }
        return;
      }
      
      const newBuffer = this.context.createBuffer(1, totalLength, this.context.sampleRate);
      const channelData = newBuffer.getChannelData(0);
      
      let offset = 0;
      track.chunks.forEach(chunk => {
        channelData.set(chunk, offset);
        offset += chunk.length;
      });
      
      if (this.recordMode === 'overdub' && track.buffer) {
        track.buffer = this.mixBuffersAligned(track.buffer, newBuffer);
      } else {
        track.buffer = newBuffer;
      }
      
      track.chunks = [];
      
      this.drawWaveform(trackIndex, track.buffer, 'unified-tracks');
      this.drawWaveform(trackIndex, track.buffer, 'loopstation-tracks');
      
      if (this.recordMode === 'play') {
        // Stop metronome when switching to playback
        if (this.metronomeRunning) {
          this.metronomeRunning = false;
          this.metronomeEnabled = false;
          if (this.timerID) {
            clearInterval(this.timerID);
            this.timerID = null;
          }
          const btn = document.getElementById('metronome-toggle');
          if (btn) btn.textContent = 'Metronome';
        }
        setTimeout(() => this.playTrack(trackIndex), 100);
      }
    }
    
    const card = document.getElementById(`track-${trackIndex}`);
    if (card) card.classList.remove('recording');
    
    const btn = document.getElementById(`rec-btn-${trackIndex}`);
    if (btn) {
      const mode = this.recordMode === 'replace' ? '[R]' : this.recordMode === 'overdub' ? '[O]' : '[P]';
      btn.innerHTML = `${mode} REC`;
      btn.classList.remove('active');
    }
    
    if (track._recordingRAF) {
      cancelAnimationFrame(track._recordingRAF);
      track._recordingRAF = null;
    }
    
    this.updateStatus(`Track ${trackIndex + 1} recording stopped`);
  }

  function mixBuffers(buffer1, buffer2) {
    const length = Math.max(buffer1.length, buffer2.length);
    const channels = Math.max(buffer1.numberOfChannels, buffer2.numberOfChannels);
    const sampleRate = buffer1.sampleRate;
    
    const mixedBuffer = this.context.createBuffer(channels, length, sampleRate);
    
    for (let channel = 0; channel < channels; channel++) {
      const mixedData = mixedBuffer.getChannelData(channel);
      const data1 = buffer1.getChannelData(Math.min(channel, buffer1.numberOfChannels - 1));
      const data2 = buffer2.getChannelData(Math.min(channel, buffer2.numberOfChannels - 1));
      
      for (let i = 0; i < length; i++) {
        const sample1 = i < data1.length ? data1[i] : 0;
        const sample2 = i < data2.length ? data2[i] : 0;
        mixedData[i] = Math.max(-1, Math.min(1, sample1 + sample2 * 0.5));
      }
    }
    
    return mixedBuffer;
  }

  function mixBuffersAligned(existingBuffer, newBuffer) {
    const length = Math.max(existingBuffer.length, newBuffer.length);
    const channels = Math.max(existingBuffer.numberOfChannels, newBuffer.numberOfChannels);
    const sampleRate = existingBuffer.sampleRate;
    
    const mixedBuffer = this.context.createBuffer(channels, length, sampleRate);
    
    for (let channel = 0; channel < channels; channel++) {
      const mixedData = mixedBuffer.getChannelData(channel);
      const existingData = existingBuffer.getChannelData(Math.min(channel, existingBuffer.numberOfChannels - 1));
      const newData = newBuffer.getChannelData(Math.min(channel, newBuffer.numberOfChannels - 1));
      
      for (let i = 0; i < length; i++) {
        const existingSample = i < existingData.length ? existingData[i] : 0;
        const newSample = i < newData.length ? newData[i] : 0;
        mixedData[i] = Math.max(-1, Math.min(1, existingSample * 0.7 + newSample * 0.7));
      }
    }
    
    return mixedBuffer;
  }

  function playTrack(trackIndex) {
    let track = this.tracks[trackIndex];
    
    if (!track.buffer) {
      this.updateStatus(`Track ${trackIndex + 1} is empty`);
      return;
    }
    
    // Check if audio context is suspended and try to resume
    if (this.context.state === 'suspended') {
      console.log('Audio context suspended, attempting to resume...');
      this.context.resume().then(() => {
        console.log('âœ… Audio context resumed, starting track playback');
        this._playTrackAfterResume(trackIndex);
      }).catch(e => {
        console.error('Failed to resume audio context:', e);
        this.updateStatus('Audio context suspended - click to activate');
      });
      return;
    }
    
    this._playTrackAfterResume(trackIndex);
  }

  function _playTrackAfterResume(trackIndex) {
    let track = this.tracks[trackIndex];
    
    if (track.isPlaying) {
      this.stopTrack(trackIndex);
    }
    
    track.source = this.context.createBufferSource();
    track.source.buffer = track.buffer;
    track.source.loop = true;
    
    track.gain = this.context.createGain();
    track.gain.gain.value = document.getElementById(`track-vol-${trackIndex}`).value / 100;
    
    track.panner = this.context.createStereoPanner();
    track.panner.pan.value = track.pan;
    
    track.source.connect(track.gain);
    track.gain.connect(track.panner);

    // Ensure per-track effect send nodes exist and are connected to global effects
    try { this.ensureTrackEffects(trackIndex); } catch (e) { console.warn('ensureTrackEffects failed', e); }

    // Connect panner -> master and to per-track sends (so each track can control its own wet levels)
    track.panner.connect(this.masterGain);
    if (track.reverbSend) track.panner.connect(track.reverbSend);
    if (track.delaySend) track.panner.connect(track.delaySend);
    
    const startTime = track.trimStart || 0;
    const duration = track.trimEnd ? (track.trimEnd - startTime) : undefined;
    
    if (duration) {
      track.source.start(0, startTime, duration);
    } else {
      track.source.start(0, startTime);
    }
    
    track.isPlaying = true;
    
    this.updateStatus(`Playing Track ${trackIndex + 1}${track.trimStart > 0 || track.trimEnd ? ' (trimmed)' : ''}`);
    const _track = this.tracks[trackIndex];
    _track._playheadStartTime = this.context.currentTime;
    _track._playheadRAF = requestAnimationFrame(() => this._updatePlayhead(trackIndex));
  }

  function _updatePlayhead(trackIndex) {
    const _track = this.tracks[trackIndex];
    if (!_track.isPlaying || !_track.buffer) return;
    
    const duration = _track.buffer.duration;
    const now = this.context.currentTime;
    const start = _track._playheadStartTime || now;
    const elapsed = ((now - start) % duration);
    const percent = duration ? (elapsed / duration) : 0;
    
    ['unified-tracks', 'loopstation-tracks'].forEach(viewId => {
      const playhead = document.getElementById(`${viewId}-playhead-${trackIndex}`);
      const canvas = document.getElementById(`${viewId}-waveform-${trackIndex}`);
      
      if (playhead && canvas) {
        const px = Math.floor(percent * canvas.offsetWidth);
        playhead.style.left = px + 'px';
      }
    });
    
    _track._playheadRAF = requestAnimationFrame(() => this._updatePlayhead(trackIndex));
  }

  // Ensure per-track effect send nodes exist and are connected to the global effect sends
  function ensureTrackEffects(trackIndex) {
    const track = this.tracks[trackIndex];
    if (!track) return;
    if (!track.reverbSend || !track.delaySend) {
      try {
        track.reverbSend = this.context.createGain();
        track.delaySend = this.context.createGain();
        track.reverbSend.gain.value = track.reverbSend.gain.value || 0;
        track.delaySend.gain.value = track.delaySend.gain.value || 0;
        // Connect per-track sends into the global effect buses
        try { track.reverbSend.connect(this.effects.reverbSend); } catch(e) { console.warn('reverbSend connect failed', e); }
        try { track.delaySend.connect(this.effects.delaySend); } catch(e) { console.warn('delaySend connect failed', e); }
      } catch (e) {
        console.warn('Failed to create per-track effect sends', e);
      }
    }
  }

  // Apply a preset to a specific track's base effects (controls per-track send levels and optional delay sync)
  function applyTrackEffectPreset(trackIndex, presetName = null) {
    const track = this.tracks[trackIndex]; if (!track) return;
    this.ensureTrackEffects(trackIndex);
    if (!presetName) {
      const sel = document.getElementById(`track-effect-preset-${trackIndex}`);
      presetName = sel ? sel.value : 'clean';
    }

    const presets = {
      'clean': { reverb: 0, delay: 0, filter: 100 },
      'warm-saturation': { reverb: 25, delay: 10, filter: 85 },
      'slap-delay': { reverb: 10, delay: 40, delaySyncFraction: 0.5, filter: 95 },
      'ambient': { reverb: 50, delay: 30, delaySyncFraction: 0.375, filter: 70 },
      'lo-fi': { reverb: 10, delay: 5, filter: 800 }
    };

    const settings = presets[presetName];
    if (!settings) return;

    try {
      if (track.reverbSend) track.reverbSend.gain.value = (settings.reverb || 0) / 100;
      if (track.delaySend) track.delaySend.gain.value = (settings.delay || 0) / 100;
      track.effects = track.effects || {};
      track.effects.filter = settings.filter || track.effects.filter;

      // If preset requests delay sync, update global delay time (keeps delays in tempo)
      if (settings.delaySyncFraction && this.bpm) {
        try { this.effects.delay.delayTime.value = 60 / this.bpm * settings.delaySyncFraction; } catch (e) { /* ignore */ }
      }

      this.updateStatus(`Applied "${presetName}" preset to Track ${trackIndex + 1}`);
    } catch (e) {
      console.warn('applyTrackEffectPreset failed', e);
    }
  }

  function stopTrack(trackIndex) {
    const _track = this.tracks[trackIndex];
    if (_track.source) {
      _track.source.stop();
      _track.source = null;
    }
    _track.isPlaying = false;
    
    if (_track._playheadRAF) {
      cancelAnimationFrame(_track._playheadRAF);
      _track._playheadRAF = null;
    }
    
    ['unified-tracks', 'loopstation-tracks'].forEach(viewId => {
      const playhead = document.getElementById(`${viewId}-playhead-${trackIndex}`);
      if (playhead) playhead.style.left = '0';
    });
    
    this.updateStatus(`Stopped Track ${trackIndex + 1}`);
  }

  function clearTrack(trackIndex) {
    this.stopTrack(trackIndex);
    const track = this.tracks[trackIndex];
    track.buffer = null;
    track.chunks = [];
    track.sliceMarkers = [];
    
    ['unified-tracks', 'loopstation-tracks'].forEach(viewId => {
      const canvas = document.getElementById(`${viewId}-waveform-${trackIndex}`);
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    });
    
    this.updateStatus(`Cleared Track ${trackIndex + 1}`);
  }

  function drawWaveform(trackIndex, buffer, containerId = null) {
    const containers = containerId ? [containerId] : ['unified-tracks', 'loopstation-tracks'];
    
    containers.forEach(cId => {
      const canvas = document.getElementById(`${cId}-waveform-${trackIndex}`);
      if (!canvas) return;
      
      let width = canvas.offsetWidth;
      let height = canvas.offsetHeight;
      if (!width || width < 10) width = 400;
      if (!height || height < 10) height = 100;

      try {
        if (this.drawWorker && canvas.transferControlToOffscreen) {
          if (!this._offscreenTransferred.has(canvas.id)) {
            const off = canvas.transferControlToOffscreen();
            this.drawWorker.postMessage({ type: 'init', canvas: off, width, height }, [off]);
            this._offscreenTransferred.add(canvas.id);
          }
          const samples = buffer.getChannelData(0).slice(0);
          this.drawWorker.postMessage({ type: 'draw', samples, width, height }, [samples.buffer]);
          return;
        }
      } catch (err) {
        console.warn('Offscreen draw failed, using main thread fallback', err);
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, width, height);
      
      const data = buffer.getChannelData(0);
      const step = Math.ceil(data.length / width);
      const amp = height / 2;
      
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 1;
      ctx.beginPath();
      
      for (let i = 0; i < width; i++) {
        let min = 1.0;
        let max = -1.0;
        for (let j = 0; j < step; j++) {
          const datum = data[(i * step) + j];
          if (datum < min) min = datum;
          if (datum > max) max = datum;
        }
        ctx.moveTo(i, (1 + min) * amp);
        ctx.lineTo(i, (1 + max) * amp);
      }
      ctx.stroke();

      const track = this.tracks[trackIndex];
      if (track && (track.trimStart > 0 || track.trimEnd !== null)) {
        const duration = buffer.duration;
        if (track.trimStart > 0) {
          const startX = (track.trimStart / duration) * width;
          ctx.strokeStyle = '#ff4444';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(startX, 0);
          ctx.lineTo(startX, height);
          ctx.stroke();
          ctx.fillStyle = '#ff4444';
          ctx.font = '10px monospace';
          ctx.fillText('START', startX + 2, 12);
        }
        if (track.trimEnd !== null) {
          const endX = (track.trimEnd / duration) * width;
          ctx.strokeStyle = '#ff4444';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(endX, 0);
          ctx.lineTo(endX, height);
          ctx.stroke();
          ctx.fillStyle = '#ff4444';
          ctx.font = '10px monospace';
          ctx.fillText('END', endX + 2, 12);
        }
        ctx.fillStyle = 'rgba(255, 68, 68, 0.1)';
        if (track.trimStart > 0) {
          const startX = (track.trimStart / duration) * width;
          ctx.fillRect(0, 0, startX, height);
        }
        if (track.trimEnd !== null) {
          const endX = (track.trimEnd / duration) * width;
          ctx.fillRect(endX, 0, width - endX, height);
        }
      }

      this.setupWaveformTrimInteraction(canvas, trackIndex, buffer.duration);
    });
  }

  function setupWaveformTrimInteraction(canvas, trackIndex, duration) {
    canvas.removeEventListener('mousedown', canvas._trimMouseDown);
    canvas.removeEventListener('mousemove', canvas._trimMouseMove);
    canvas.removeEventListener('mouseup', canvas._trimMouseUp);
    canvas.removeEventListener('click', canvas._trimClick);
    
    let isDragging = false;
    let dragType = null;
    let startDragX = 0;
    
    canvas._trimMouseDown = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const timePosition = (x / canvas.offsetWidth) * duration;
      
      const track = this.tracks[trackIndex];
      const tolerance = (10 / canvas.offsetWidth) * duration;
      
      if (track.trimStart > 0 && Math.abs(timePosition - track.trimStart) < tolerance) {
        dragType = 'start';
        isDragging = true;
      } else if (track.trimEnd !== null && Math.abs(timePosition - track.trimEnd) < tolerance) {
        dragType = 'end';
        isDragging = true;
      } else {
        dragType = 'new';
        isDragging = true;
        startDragX = x;
        track.trimStart = timePosition;
        track.trimEnd = timePosition;
      }
      
      e.preventDefault();
    };
    
    canvas._trimMouseMove = (e) => {
      if (!isDragging) return;
      
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const timePosition = Math.max(0, Math.min((x / canvas.offsetWidth) * duration, duration));
      
      const track = this.tracks[trackIndex];
      
      if (dragType === 'start') {
        track.trimStart = Math.min(timePosition, track.trimEnd || duration);
      } else if (dragType === 'end') {
        track.trimEnd = Math.max(timePosition, track.trimStart);
      } else if (dragType === 'new') {
        const startTime = (startDragX / canvas.offsetWidth) * duration;
        track.trimStart = Math.min(startTime, timePosition);
        track.trimEnd = Math.max(startTime, timePosition);
      }
      
      this.drawWaveform(trackIndex, this.tracks[trackIndex].buffer);
      this.showTrimControls(trackIndex);
    };
    
    canvas._trimMouseUp = (e) => {
      if (isDragging) {
        isDragging = false;
        dragType = null;
        
        const track = this.tracks[trackIndex];
        if (track.trimEnd - track.trimStart < 0.1) {
          track.trimStart = 0;
          track.trimEnd = null;
          this.drawWaveform(trackIndex, track.buffer);
          this.hideTrimControls(trackIndex);
        } else {
          this.showTrimControls(trackIndex);
          this.updateStatus(`Track ${trackIndex + 1} trim set: ${track.trimStart.toFixed(2)}s - ${track.trimEnd ? track.trimEnd.toFixed(2) + 's' : 'end'}`);
        }
      }
    };
    
    canvas.addEventListener('mousedown', canvas._trimMouseDown);
    canvas.addEventListener('mousemove', canvas._trimMouseMove);
    canvas.addEventListener('mouseup', canvas._trimMouseUp);
  }

  function showTrimControls(trackIndex) {
    ['unified-tracks', 'loopstation-tracks'].forEach(viewId => {
      const controls = document.getElementById(`${viewId}-trim-controls-${trackIndex}`);
      if (controls) {
        controls.style.display = 'flex';
      }
    });
  }

  function hideTrimControls(trackIndex) {
    ['unified-tracks', 'loopstation-tracks'].forEach(viewId => {
      const controls = document.getElementById(`${viewId}-trim-controls-${trackIndex}`);
      if (controls) {
        controls.style.display = 'none';
      }
    });
  }

  function showTrimAppliedFeedback(trackIndex) {
    ['unified-tracks', 'loopstation-tracks'].forEach(viewId => {
      const waveformDisplay = document.getElementById(`${viewId}-waveform-display-${trackIndex}`);
      if (waveformDisplay) {
        waveformDisplay.style.border = '3px solid #00ff88';
        waveformDisplay.style.boxShadow = '0 0 15px rgba(0, 255, 136, 0.5)';
        setTimeout(() => {
          waveformDisplay.style.border = '1px solid rgba(0, 255, 136, 0.2)';
          waveformDisplay.style.boxShadow = 'none';
        }, 1000);
      }
    });
  }

  // ===== STUDIO EDITING FEATURES =====
  
  // Initialize global undo stack for the engine
  if (!engine.undoStack) engine.undoStack = [];
  
  function saveToUndoStack(trackIndex, buffer) {
    const track = this.tracks[trackIndex];
    if (!this.undoStack) this.undoStack = [];
    this.undoStack.push({
      trackIndex,
      buffer: buffer ? buffer : (track.buffer ? track.buffer : null),
      timestamp: Date.now()
    });
    // Keep last 10 edits
    if (this.undoStack.length > 10) this.undoStack.shift();
    const undoBtn = document.getElementById('undo-edit');
    if (undoBtn) undoBtn.style.display = 'inline-block';
  }
  
  function undoLastEdit() {
    if (!this.undoStack || this.undoStack.length === 0) {
      this.updateStatus('Nothing to undo');
      return;
    }
    const lastEdit = this.undoStack.pop();
    const track = this.tracks[lastEdit.trackIndex];
    track.buffer = lastEdit.buffer;
    this.drawWaveform(lastEdit.trackIndex, track.buffer);
    this.updateStatus(`Undo: restored Track ${lastEdit.trackIndex + 1}`);
    if (this.undoStack.length === 0) {
      const undoBtn = document.getElementById('undo-edit');
      if (undoBtn) undoBtn.style.display = 'none';
    }
  }
  
  function toggleMute(trackIndex) {
    const track = this.tracks[trackIndex];
    track.muted = !track.muted;
    const btn = document.getElementById(`mute-btn-${trackIndex}`);
    if (btn) {
      btn.classList.toggle('active', track.muted);
      btn.style.backgroundColor = track.muted ? '#ff4444' : '';
    }
    if (track.gain) {
      track.gain.gain.value = track.muted ? 0 : (document.getElementById(`track-vol-${trackIndex}`).value / 100);
    }
    this.updateStatus(`Track ${trackIndex + 1} ${track.muted ? 'muted' : 'unmuted'}`);
  }
  
  function toggleSolo(trackIndex) {
    const track = this.tracks[trackIndex];
    track.soloed = !track.soloed;
    const btn = document.getElementById(`solo-btn-${trackIndex}`);
    if (btn) {
      btn.classList.toggle('active', track.soloed);
      btn.style.backgroundColor = track.soloed ? '#ffaa00' : '';
    }
    
    // If any track is soloed, mute all others
    const hasSolo = this.tracks.some(t => t.soloed);
    this.tracks.forEach((t, i) => {
      if (hasSolo && !t.soloed) {
        if (t.gain) t.gain.gain.value = 0;
      } else if (t.gain && !t.muted) {
        t.gain.gain.value = document.getElementById(`track-vol-${i}`).value / 100;
      }
    });
    this.updateStatus(`Track ${trackIndex + 1} ${track.soloed ? 'soloed' : 'un-soloed'}`);
  }
  
  function splitTrackAtTime(trackIndex) {
    const track = this.tracks[trackIndex];
    if (!track.buffer) {
      this.updateStatus('Track is empty');
      return;
    }
    
    const duration = track.buffer.duration;
    const splitTime = parseFloat(prompt(`Split at time (0 - ${duration.toFixed(2)}s):`, (duration / 2).toFixed(2)));
    
    if (isNaN(splitTime) || splitTime <= 0 || splitTime >= duration) {
      this.updateStatus('Invalid split time');
      return;
    }
    
    this.saveToUndoStack(trackIndex, track.buffer);
    
    // Create first part (0 to splitTime)
    const splitSample = Math.floor(splitTime * this.context.sampleRate);
    const firstBuffer = this.context.createBuffer(
      track.buffer.numberOfChannels,
      splitSample,
      this.context.sampleRate
    );
    
    for (let ch = 0; ch < track.buffer.numberOfChannels; ch++) {
      const sourceData = track.buffer.getChannelData(ch);
      const destData = firstBuffer.getChannelData(ch);
      destData.set(sourceData.subarray(0, splitSample));
    }
    
    // Find next empty track for second part
    const nextEmptyIndex = this.tracks.findIndex((t, i) => i > trackIndex && !t.buffer);
    if (nextEmptyIndex === -1) {
      this.updateStatus('No empty track for second part');
      return;
    }
    
    // Create second part (splitTime to end)
    const secondBuffer = this.context.createBuffer(
      track.buffer.numberOfChannels,
      track.buffer.length - splitSample,
      this.context.sampleRate
    );
    
    for (let ch = 0; ch < track.buffer.numberOfChannels; ch++) {
      const sourceData = track.buffer.getChannelData(ch);
      const destData = secondBuffer.getChannelData(ch);
      destData.set(sourceData.subarray(splitSample));
    }
    
    track.buffer = firstBuffer;
    this.tracks[nextEmptyIndex].buffer = secondBuffer;
    
    this.drawWaveform(trackIndex, firstBuffer);
    this.drawWaveform(nextEmptyIndex, secondBuffer);
    
    this.updateStatus(`Split Track ${trackIndex + 1} at ${splitTime.toFixed(2)}s -> Track ${nextEmptyIndex + 1}`);
  }
  
  function duplicateTrack(trackIndex) {
    const track = this.tracks[trackIndex];
    if (!track.buffer) {
      this.updateStatus('Track is empty');
      return;
    }
    
    const nextEmptyIndex = this.tracks.findIndex(t => !t.buffer);
    if (nextEmptyIndex === -1) {
      this.updateStatus('No empty track available');
      return;
    }
    
    // Clone the buffer
    const newBuffer = this.context.createBuffer(
      track.buffer.numberOfChannels,
      track.buffer.length,
      track.buffer.sampleRate
    );
    
    for (let ch = 0; ch < track.buffer.numberOfChannels; ch++) {
      newBuffer.getChannelData(ch).set(track.buffer.getChannelData(ch));
    }
    
    this.tracks[nextEmptyIndex].buffer = newBuffer;
    this.drawWaveform(nextEmptyIndex, newBuffer);
    this.updateStatus(`Duplicated Track ${trackIndex + 1} to Track ${nextEmptyIndex + 1}`);
  }
  
  function reverseTrack(trackIndex) {
    const track = this.tracks[trackIndex];
    if (!track.buffer) {
      this.updateStatus('Track is empty');
      return;
    }
    
    this.saveToUndoStack(trackIndex, track.buffer);
    
    const reversed = this.context.createBuffer(
      track.buffer.numberOfChannels,
      track.buffer.length,
      track.buffer.sampleRate
    );
    
    for (let ch = 0; ch < track.buffer.numberOfChannels; ch++) {
      const sourceData = track.buffer.getChannelData(ch);
      const destData = reversed.getChannelData(ch);
      for (let i = 0; i < sourceData.length; i++) {
        destData[i] = sourceData[sourceData.length - 1 - i];
      }
    }
    
    track.buffer = reversed;
    this.drawWaveform(trackIndex, reversed);
    this.updateStatus(`Reversed Track ${trackIndex + 1}`);
  }
  
  function normalizeTrack(trackIndex) {
    const track = this.tracks[trackIndex];
    if (!track.buffer) {
      this.updateStatus('Track is empty');
      return;
    }
    
    this.saveToUndoStack(trackIndex, track.buffer);
    
    // Find peak
    let peak = 0;
    for (let ch = 0; ch < track.buffer.numberOfChannels; ch++) {
      const data = track.buffer.getChannelData(ch);
      for (let i = 0; i < data.length; i++) {
        peak = Math.max(peak, Math.abs(data[i]));
      }
    }
    
    if (peak === 0) {
      this.updateStatus('Track is silent');
      return;
    }
    
    const gain = 0.95 / peak; // Normalize to -0.5dB
    
    for (let ch = 0; ch < track.buffer.numberOfChannels; ch++) {
      const data = track.buffer.getChannelData(ch);
      for (let i = 0; i < data.length; i++) {
        data[i] *= gain;
      }
    }
    
    this.drawWaveform(trackIndex, track.buffer);
    this.updateStatus(`Normalized Track ${trackIndex + 1} (${(gain * 100).toFixed(1)}%)`);
  }
  
  function fadeInTrack(trackIndex) {
    const track = this.tracks[trackIndex];
    if (!track.buffer) {
      this.updateStatus('Track is empty');
      return;
    }
    
    const fadeDuration = parseFloat(prompt('Fade in duration (seconds):', '0.5'));
    if (isNaN(fadeDuration) || fadeDuration <= 0) return;
    
    this.saveToUndoStack(trackIndex, track.buffer);
    
    const fadeSamples = Math.min(
      Math.floor(fadeDuration * this.context.sampleRate),
      track.buffer.length
    );
    
    for (let ch = 0; ch < track.buffer.numberOfChannels; ch++) {
      const data = track.buffer.getChannelData(ch);
      for (let i = 0; i < fadeSamples; i++) {
        data[i] *= (i / fadeSamples);
      }
    }
    
    this.drawWaveform(trackIndex, track.buffer);
    this.updateStatus(`Applied ${fadeDuration}s fade in to Track ${trackIndex + 1}`);
  }
  
  function fadeOutTrack(trackIndex) {
    const track = this.tracks[trackIndex];
    if (!track.buffer) {
      this.updateStatus('Track is empty');
      return;
    }
    
    const fadeDuration = parseFloat(prompt('Fade out duration (seconds):', '0.5'));
    if (isNaN(fadeDuration) || fadeDuration <= 0) return;
    
    this.saveToUndoStack(trackIndex, track.buffer);
    
    const fadeSamples = Math.min(
      Math.floor(fadeDuration * this.context.sampleRate),
      track.buffer.length
    );
    
    for (let ch = 0; ch < track.buffer.numberOfChannels; ch++) {
      const data = track.buffer.getChannelData(ch);
      const startPos = data.length - fadeSamples;
      for (let i = 0; i < fadeSamples; i++) {
        data[startPos + i] *= (1 - (i / fadeSamples));
      }
    }
    
    this.drawWaveform(trackIndex, track.buffer);
    this.updateStatus(`Applied ${fadeDuration}s fade out to Track ${trackIndex + 1}`);
  }

  const impls = {
    renderTracks, createTrackCard, importTrackFromFileDialog, startRecording, doCountIn,
    _updateRecordingPlayhead, stopRecording, mixBuffers, mixBuffersAligned, playTrack, _playTrackAfterResume, _updatePlayhead,
    stopTrack, clearTrack, drawWaveform, setupWaveformTrimInteraction, showTrimControls, hideTrimControls,
    showTrimAppliedFeedback, toggleMute, toggleSolo, splitTrackAtTime, duplicateTrack, reverseTrack,
    normalizeTrack, fadeInTrack, fadeOutTrack, undoLastEdit, saveToUndoStack
  };

  // Expose per-track effect utilities as implementations
  impls.ensureTrackEffects = ensureTrackEffects;
  impls.applyTrackEffectPreset = applyTrackEffectPreset;
  impls.copyMasterEffectsToTrack = copyMasterEffectsToTrack;

  Object.keys(impls).forEach(k => engine[k] = impls[k].bind(engine));
}

export function attachTracks(engine) {
  const methodNames = [
    'renderTracks', 'createTrackCard', 'importTrackFromFileDialog',
    'startRecording', 'doCountIn', '_updateRecordingPlayhead', 'stopRecording',
    'mixBuffers', 'mixBuffersAligned', 'playTrack', '_updatePlayhead', 'stopTrack',
    'clearTrack', 'drawWaveform', 'setupWaveformTrimInteraction',
    'showTrimControls', 'hideTrimControls', 'showTrimAppliedFeedback'
  ];

  // Add the per-track effect helpers to the attach list
  methodNames.push('ensureTrackEffects', 'applyTrackEffectPreset');
  methodNames.push('copyMasterEffectsToTrack');

  methodNames.forEach(name => {
    try {
      const fn = engine[name];
      if (typeof fn === 'function') {
        engine[name] = fn.bind(engine);
      }
    } catch (e) {
      console.warn('attachTracks: method not bound', name, e);
    }
  });

  engine.tracksModule = engine.tracksModule || {};
  engine.tracksModule.createUI = () => {
    try { engine.renderTracks(); } catch (e) { console.warn('renderTracks failed', e); }
  };
}
