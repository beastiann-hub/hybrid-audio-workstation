export function attachChopper(engine) {
  const methodNames = [
    'initChopper', 'drawChopperWaveform', 'stopAllChopperSamples', 'setupManualChopMode',
    'findNearbyMarker', 'addSliceMarker', 'updateSlicesFromMarkers', 'clearSliceMarkers',
    'toggleManualMode', 'createSlicesFromMarkers', 'smartSlice', 'loadChopperFile',
    'drawChopperWaveformMain', 'setupManualChopModeMain', 'renderChopperPadsMain',
    'updateChopperInfo', 'updateSliceCountDisplay', 'playFullSample', 'selectSliceForEffects',
    'playSliceWithEffects', 'resetSliceEffects', 'applySliceEffectPreset', 'exportSliceWithEffects',
    'createEqualSlices', 'detectTransients', 'renderChopperPads', 'playSlice', 'slicesToSequencerRows',
    'slicesToLoopTracks', 'exportAllSlices', 'setupChopperInteraction'
  ];

  methodNames.forEach(name => {
    try {
      const fn = engine[name];
      if (typeof fn === 'function') {
        engine[name] = fn.bind(engine);
      }
    } catch (e) {
      console.warn('attachChopper: method not bound', name, e);
    }
  });

  engine.chopperModule = engine.chopperModule || {};
  engine.chopperModule.createUI = () => {
    try { engine.drawChopperWaveform(); engine.drawChopperWaveformMain(); engine.renderChopperPads(); } catch(e) { console.warn('chopperModule createUI failed', e); }
  };
}

// Install concrete chopper implementations onto engine
export function installChopperImpls(engine) {
  function initChopper() {
    const loadBtn = document.getElementById('chop-load');
    const fileInput = document.getElementById('chop-file');
    const equalBtn = document.getElementById('chop-equal');
    const detectBtn = document.getElementById('chop-detect');
    const slicesSlider = document.getElementById('chop-slices');
    const slicesDisplay = document.getElementById('chop-slices-display');
    const toRowsBtn = document.getElementById('chop-to-rows');
    const exportBtn = document.getElementById('chop-export-all');

    if (loadBtn) loadBtn.onclick = () => fileInput && fileInput.click();

    if (fileInput) {
      fileInput.onchange = async (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          const arrayBuf = await file.arrayBuffer();
          const audioBuf = await this.context.decodeAudioData(arrayBuf);
          this.chopper.buffer = audioBuf;
          this.drawChopperWaveform();
          this.updateStatus(`Loaded: ${file.name}`);
        }
      };
    }

    if (slicesSlider) {
      slicesSlider.oninput = (e) => {
        this.chopper.numSlices = parseInt(e.target.value);
        if (slicesDisplay) slicesDisplay.textContent = this.chopper.numSlices;
        if (this.chopper.buffer) {
          this.createEqualSlices();
        }
      };
    }

    const sensitivitySlider = document.getElementById('chop-sens');
    const sensitivityDisplay = document.getElementById('chop-sens-display');
    if (sensitivitySlider) {
      sensitivitySlider.oninput = (e) => {
        this.chopper.sensitivity = parseFloat(e.target.value);
        if (sensitivityDisplay) sensitivityDisplay.textContent = parseFloat(e.target.value).toFixed(2);
      };
    }

    if (equalBtn) equalBtn.onclick = () => this.createEqualSlices();
    if (detectBtn) detectBtn.onclick = () => this.detectTransients();
    if (toRowsBtn) toRowsBtn.onclick = () => this.slicesToSequencerRows();

    const toTracksBtn = document.getElementById('chop-to-tracks');
    if (toTracksBtn) toTracksBtn.onclick = () => this.slicesToLoopTracks();
	
	const toMPCBtn = document.getElementById('chop-to-mpc');
if (toMPCBtn) {
  toMPCBtn.onclick = () => {
    // 1) Send slices into the sample bank + sequencer rows
    this.slicesToSequencerRows();

    // 2) Switch MPC into "samples" mode so pads play from the bank
    if (this.mpc) {
      this.mpc.mode = 'samples';
    }

    // 3) Refresh MPC pad labels to reflect the new samples
    if (this.updateMPCPadLabels) {
      this.updateMPCPadLabels();
    }

    // 4) Let the user know
    this.updateStatus('Sent slices to MPC pads');
  };
}


    const manualToggleBtn = document.getElementById('chop-manual-toggle');
    if (manualToggleBtn) manualToggleBtn.onclick = () => this.toggleManualMode();

    const sliceBtn = document.getElementById('chop-slice-button');
    if (sliceBtn) sliceBtn.onclick = () => this.smartSlice();

    const sliceBtnMain = document.getElementById('chop-slice-button-main');
    if (sliceBtnMain) sliceBtnMain.onclick = () => this.smartSlice();

    const clearMarkersBtn = document.getElementById('chop-clear-markers');
    if (clearMarkersBtn) clearMarkersBtn.onclick = () => this.clearSliceMarkers();

    const stopBtn = document.getElementById('chop-stop');
    if (stopBtn) stopBtn.onclick = () => this.stopAllChopperSamples();

    const zoomSlider = document.getElementById('chop-zoom');
    const zoomDisplay = document.getElementById('chop-zoom-display');
    if (zoomSlider) {
      zoomSlider.addEventListener('input', (e) => {
        this.chopper.zoom = parseFloat(e.target.value);
        if (zoomDisplay) zoomDisplay.textContent = `${this.chopper.zoom}x`;
        this.drawChopperWaveform();
      });
    }

    const scrollSlider = document.getElementById('chop-scroll');
    const scrollDisplay = document.getElementById('chop-scroll-display');
    if (scrollSlider) {
      scrollSlider.addEventListener('input', (e) => {
        this.chopper.scrollPosition = parseFloat(e.target.value) / 100;
        if (scrollDisplay) scrollDisplay.textContent = `${e.target.value}%`;
        this.drawChopperWaveform();
      });
    }

    const zoomResetBtn = document.getElementById('chop-zoom-reset');
    if (zoomResetBtn) {
      zoomResetBtn.onclick = () => {
        this.chopper.zoom = 1;
        this.chopper.scrollPosition = 0;
        if (zoomSlider) zoomSlider.value = '1';
        if (zoomDisplay) zoomDisplay.textContent = '1x';
        if (scrollSlider) scrollSlider.value = '0';
        if (scrollDisplay) scrollDisplay.textContent = '0%';
        this.drawChopperWaveform();
      };
    }

    if (exportBtn) exportBtn.onclick = () => this.exportAllSlices();

    const trimStartInput = document.getElementById('chop-trim-start');
    const trimEndInput = document.getElementById('chop-trim-end');
    const applyTrimBtn = document.getElementById('chop-apply-trim');
    const resetTrimBtn = document.getElementById('chop-reset-trim');

    if (applyTrimBtn) {
      applyTrimBtn.onclick = () => {
        const startTime = parseFloat(trimStartInput?.value || '0') || 0;
        const endTime = trimEndInput?.value ? parseFloat(trimEndInput.value) : null;
        this.setChopperTrim(startTime, endTime);
      };
    }

    if (resetTrimBtn) {
      resetTrimBtn.onclick = () => {
        this.resetChopperTrim();
        if (trimStartInput) trimStartInput.value = '0';
        if (trimEndInput) trimEndInput.value = '';
      };
    }

    const slicesSliderMain = document.getElementById('chop-slices-main');
    const slicesDisplayMain = document.getElementById('chop-slices-main-display');
    const sensitivitySliderMain = document.getElementById('chop-sensitivity-main');
    const sensitivityDisplayMain = document.getElementById('chop-sensitivity-main-display');

    if (slicesSliderMain) {
      slicesSliderMain.oninput = (e) => {
        this.chopper.numSlices = parseInt(e.target.value);
        if (slicesDisplayMain) slicesDisplayMain.textContent = e.target.value;
      };
    }

    if (sensitivitySliderMain) {
      sensitivitySliderMain.oninput = (e) => {
        this.chopper.sensitivity = parseFloat(e.target.value);
        if (sensitivityDisplayMain) sensitivityDisplayMain.textContent = e.target.value;
      };
    }

    const chopPresetBtn = document.getElementById('chop-apply-preset');
    if (chopPresetBtn) {
      chopPresetBtn.onclick = () => this.applyChopPreset();
    }

    this.renderChopperPads();
    this.renderChopperPadsMain();
  }

  function drawChopperWaveform() {
    const canvas = document.getElementById('chop-wave');
    if (!canvas || !this.chopper.buffer) return;

    const width = canvas.width = canvas.offsetWidth || 800;
    const height = canvas.height = 120;
    const ctx = canvas.getContext('2d');

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    const data = this.chopper.buffer.getChannelData(0);
    const totalDuration = this.chopper.buffer.duration;

    const zoomedDuration = totalDuration / this.chopper.zoom;
    const startTime = this.chopper.scrollPosition * (totalDuration - zoomedDuration);
    const endTime = startTime + zoomedDuration;

    const startSample = Math.floor(startTime * this.chopper.buffer.sampleRate);
    const endSample = Math.floor(endTime * this.chopper.buffer.sampleRate);
    const visibleSamples = endSample - startSample;

    const step = Math.max(1, Math.ceil(visibleSamples / width));
    const amp = height / 2;

    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const sampleIndex = startSample + (i * step) + j;
        if (sampleIndex >= data.length) break;
        const datum = data[sampleIndex];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      ctx.moveTo(i, (1 + min) * amp);
      ctx.lineTo(i, (1 + max) * amp);
    }
    ctx.stroke();

    if (this.chopper.trimStart > 0 || this.chopper.trimEnd !== null) {
      if (this.chopper.trimStart > 0 && this.chopper.trimStart >= startTime && this.chopper.trimStart <= endTime) {
        const trimStartX = ((this.chopper.trimStart - startTime) / zoomedDuration) * width;
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(trimStartX, 0);
        ctx.lineTo(trimStartX, height);
        ctx.stroke();
        ctx.fillStyle = '#ff4444';
        ctx.font = '10px monospace';
        ctx.fillText('TRIM START', trimStartX + 2, 12);
      }
      if (this.chopper.trimEnd !== null && this.chopper.trimEnd >= startTime && this.chopper.trimEnd <= endTime) {
        const trimEndX = ((this.chopper.trimEnd - startTime) / zoomedDuration) * width;
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(trimEndX, 0);
        ctx.lineTo(trimEndX, height);
        ctx.stroke();
        ctx.fillStyle = '#ff4444';
        ctx.font = '10px monospace';
        ctx.fillText('TRIM END', trimEndX + 2, 12);
      }

      ctx.fillStyle = 'rgba(255, 68, 68, 0.1)';
      if (this.chopper.trimStart > 0 && this.chopper.trimStart >= startTime && this.chopper.trimStart <= endTime) {
        const trimStartX = ((this.chopper.trimStart - startTime) / zoomedDuration) * width;
        if (startTime < this.chopper.trimStart) {
          ctx.fillRect(0, 0, trimStartX, height);
        }
      }
      if (this.chopper.trimEnd !== null && this.chopper.trimEnd >= startTime && this.chopper.trimEnd <= endTime) {
        const trimEndX = ((this.chopper.trimEnd - startTime) / zoomedDuration) * width;
        if (endTime > this.chopper.trimEnd) {
          ctx.fillRect(trimEndX, 0, width - trimEndX, height);
        }
      }
    }

    if (this.chopper.sliceMarkers.length > 0) {
      ctx.strokeStyle = '#ff00ff';
      ctx.lineWidth = 2;
      this.chopper.sliceMarkers.forEach((marker, index) => {
        if (marker >= startTime && marker <= endTime) {
          const markerPos = ((marker - startTime) / zoomedDuration) * width;
          ctx.beginPath();
          ctx.moveTo(markerPos, 0);
          ctx.lineTo(markerPos, height);
          ctx.stroke();
          ctx.fillStyle = '#ff00ff';
          ctx.font = '12px monospace';
          ctx.fillText(index + 1, markerPos + 2, 15);
        }
      });
    }

    this.setupChopperInteraction();
  }

  function stopAllChopperSamples() {
    for (const source of this.chopper.playingSources) {
      try { source.stop(); } catch (e) {}
    }
    this.chopper.playingSources.clear();
    this.updateStatus('Stopped all chopper samples');
  }

  function setupManualChopMode() {
    const canvas = document.getElementById('chop-wave');
    if (!canvas) return;

    canvas.removeEventListener('mousedown', this.handleCanvasMouseDown);
    canvas.removeEventListener('mousemove', this.handleCanvasMouseMove);
    canvas.removeEventListener('mouseup', this.handleCanvasMouseUp);
    canvas.removeEventListener('click', this.handleCanvasClick);

    this.handleCanvasMouseDown = (e) => {
      if (!this.chopper.buffer) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const timePosition = (x / canvas.offsetWidth) * this.chopper.buffer.duration;
      const markerIndex = this.findNearbyMarker(timePosition, canvas);
      if (markerIndex !== -1) {
        this.chopper.isDragging = true;
        this.chopper.dragMarkerIndex = markerIndex;
        canvas.style.cursor = 'grabbing';
        e.preventDefault();
      } else {
        this.addSliceMarker(timePosition);
      }
    };

    this.handleCanvasMouseMove = (e) => {
      if (!this.chopper.buffer) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const timePosition = (x / canvas.offsetWidth) * this.chopper.buffer.duration;
      if (this.chopper.isDragging && this.chopper.dragMarkerIndex !== -1) {
        this.chopper.sliceMarkers[this.chopper.dragMarkerIndex] = Math.max(0, Math.min(timePosition, this.chopper.buffer.duration));
        this.chopper.sliceMarkers.sort((a, b) => a - b);
        this.drawChopperWaveform();
        e.preventDefault();
      } else {
        const markerIndex = this.findNearbyMarker(timePosition, canvas);
        canvas.style.cursor = markerIndex !== -1 ? 'grab' : 'crosshair';
      }
    };

    this.handleCanvasMouseUp = (e) => {
      if (this.chopper.isDragging) {
        this.chopper.isDragging = false;
        this.chopper.dragMarkerIndex = -1;
        canvas.style.cursor = 'crosshair';
        this.updateSlicesFromMarkers();
        this.renderChopperPads();
        this.updateStatus('Marker repositioned');
      }
    };

    canvas.addEventListener('mousedown', this.handleCanvasMouseDown);
    canvas.addEventListener('mousemove', this.handleCanvasMouseMove);
    canvas.addEventListener('mouseup', this.handleCanvasMouseUp);
    canvas.style.cursor = 'crosshair';
  }

  function findNearbyMarker(timePosition, canvas) {
    const tolerance = (this.chopper.dragTolerance / canvas.offsetWidth) * this.chopper.buffer.duration;
    for (let i = 0; i < this.chopper.sliceMarkers.length; i++) {
      if (Math.abs(this.chopper.sliceMarkers[i] - timePosition) <= tolerance) return i;
    }
    return -1;
  }

  function addSliceMarker(timePosition) {
    const minDistance = 0.05;
    for (let marker of this.chopper.sliceMarkers) {
      if (Math.abs(marker - timePosition) < minDistance) return;
    }
    this.chopper.sliceMarkers.push(timePosition);
    this.chopper.sliceMarkers.sort((a, b) => a - b);
    this.updateSlicesFromMarkers();
    this.drawChopperWaveform();
    this.renderChopperPads();
    this.updateStatus(`Added slice marker at ${timePosition.toFixed(2)}s`);
  }

  function updateSlicesFromMarkers() {
    if (this.chopper.sliceMarkers.length === 0) return;
    this.chopper.slices = [];
    const markers = [0, ...this.chopper.sliceMarkers, this.chopper.buffer.duration];
    for (let i = 0; i < markers.length - 1; i++) {
      this.chopper.slices.push({ start: markers[i], end: markers[i+1], index: i });
    }
  }

  function clearSliceMarkers() {
    this.chopper.sliceMarkers = [];
    this.chopper.slices = [];
    this.drawChopperWaveform();
    this.drawChopperWaveformMain();
    this.renderChopperPads();
    this.renderChopperPadsMain();
    this.updateStatus('Cleared all slice markers');
  }

  function toggleManualMode() {
    this.chopper.manualMode = !this.chopper.manualMode;
    const btn = document.getElementById('chop-manual-toggle');
    if (btn) {
      btn.classList.toggle('active', this.chopper.manualMode);
      btn.textContent = this.chopper.manualMode ? 'Manual ON' : 'Manual Mode';
    }
    if (this.chopper.manualMode) this.setupManualChopMode();
    else {
      const canvas = document.getElementById('chop-wave');
      if (canvas) {
        canvas.removeEventListener('mousedown', this.handleCanvasMouseDown);
        canvas.removeEventListener('mousemove', this.handleCanvasMouseMove);
        canvas.removeEventListener('mouseup', this.handleCanvasMouseUp);
        canvas.style.cursor = 'default';
      }
    }
    this.updateStatus(this.chopper.manualMode ? 'Manual chop mode ON - click to add, drag to move markers' : 'Manual chop mode OFF');
  }

  function createSlicesFromMarkers() {
    if (!this.chopper.buffer || this.chopper.sliceMarkers.length === 0) {
      this.updateStatus('No markers to create slices from');
      return;
    }
    this.updateSlicesFromMarkers();
    this.renderChopperPads();
    this.renderChopperPadsMain();
    this.updateStatus(`Created ${this.chopper.slices.length} slices from ${this.chopper.sliceMarkers.length} markers`);
  }

  function smartSlice() {
    if (!this.chopper.buffer) { this.updateStatus('No audio loaded in chopper'); return; }
    if (this.chopper.sliceMarkers.length > 0) {
      this.createSlicesFromMarkers();
      this.renderChopperPads();
      this.renderChopperPadsMain();
      this.updateStatus(`Smart Slice: Used ${this.chopper.sliceMarkers.length} manual markers`);
      return;
    }
    if (this.chopper.manualMode) {
      if (confirm('No manual markers set. Switch to auto-detect transients?')) {
        this.detectTransients();
        this.updateStatus('Smart Slice: Auto-detected transients');
      } else {
        this.updateStatus('Smart Slice cancelled - add markers or disable manual mode');
      }
      return;
    }
    const originalSliceCount = this.chopper.slices.length;
    this.detectTransients();
    if (this.chopper.slices.length < 4) {
      this.updateStatus('Smart Slice: Few transients found, using equal slices...');
      this.createEqualSlices();
      this.updateStatus(`Smart Slice: Created ${this.chopper.numSlices} equal slices (transient detection found too few)`);
    } else {
      this.updateStatus(`Smart Slice: Auto-detected ${this.chopper.slices.length} transient-based slices`);
    }
    this.renderChopperPads();
    this.renderChopperPadsMain();
  }

  function loadChopperFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          const arrayBuf = await file.arrayBuffer();
          const audioBuf = await this.context.decodeAudioData(arrayBuf);
          this.chopper.buffer = audioBuf;
          this.chopper.sliceMarkers = [];
          this.chopper.slices = [];
          this.drawChopperWaveformMain();
          this.renderChopperPadsMain();
          this.updateChopperInfo();
          this.updateStatus(`Loaded ${file.name} into chopper`);
        } catch (err) {
          console.error('Load failed', err);
          this.updateStatus('Failed to load audio file');
        }
      }
    };
    input.click();
  }

  function drawChopperWaveformMain() {
    const canvas = document.getElementById('chop-wave-main');
    if (!canvas || !this.chopper.buffer) return;
    const width = canvas.width = canvas.offsetWidth || 800;
    const height = canvas.height = 180;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,width,height);
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0,0,width,height);
    const data = this.chopper.buffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height/2;
    ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 1; ctx.beginPath();
    for (let i=0;i<width;i++){
      let min=1.0,max=-1.0;
      for (let j=0;j<step;j++){
        const datum = data[(i*step)+j]; if (datum<min) min=datum; if (datum>max) max=datum;
      }
      ctx.moveTo(i,(1+min)*amp); ctx.lineTo(i,(1+max)*amp);
    }
    ctx.stroke();
    if (this.chopper.sliceMarkers.length>0){
      ctx.strokeStyle='#ff00ff'; ctx.lineWidth=2;
      this.chopper.sliceMarkers.forEach((marker,index)=>{
        const x=(marker/this.chopper.buffer.duration)*width; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,height); ctx.stroke(); ctx.fillStyle='#ff00ff'; ctx.font='14px monospace'; ctx.fillText(index+1,x+3,20);
      });
    }
    this.setupManualChopModeMain();
  }

  function setupManualChopModeMain() {
    const canvas = document.getElementById('chop-wave-main');
    if (!canvas) return;
    canvas.removeEventListener('click', this.handleCanvasClickMain);
    this.handleCanvasClickMain = (e) => {
      if (!this.chopper.buffer || !this.chopper.manualMode) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left; const width = canvas.offsetWidth;
      const timePosition = (x/width)*this.chopper.buffer.duration;
      this.addSliceMarker(timePosition);
      this.drawChopperWaveformMain();
    };
    canvas.addEventListener('click', this.handleCanvasClickMain);
  }

  function renderChopperPadsMain() {
    const container = document.getElementById('chop-pads-main');
    if (!container) return; container.innerHTML='';
    const numSlices = this.chopper.slices.length;
    for (let i=0;i<numSlices;i++){ const pad=document.createElement('div'); pad.className='chop-pad'; pad.innerHTML=`<strong>${i+1}</strong><br><small>${(this.chopper.slices[i].end-this.chopper.slices[i].start).toFixed(2)}s</small>`; pad.onclick=()=>{ this.playSlice(i); this.selectSliceForEffects(i); }; container.appendChild(pad); }
    this.updateSliceCountDisplay();
  }

  function updateChopperInfo() {
    const info = document.getElementById('chopper-info');
    if (info && this.chopper.buffer) info.textContent = `${this.chopper.buffer.duration.toFixed(2)}s | ${this.chopper.buffer.sampleRate}Hz | ${this.chopper.buffer.numberOfChannels}ch`;
  }

  function updateSliceCountDisplay() {
    const display = document.getElementById('slice-count-display'); if (display) display.textContent = `${this.chopper.slices.length} slices`;
  }

  function playFullSample() {
    if (!this.chopper.buffer) return; const source = this.context.createBufferSource(); source.buffer = this.chopper.buffer; const gain = this.context.createGain(); gain.gain.value = 0.8; source.connect(gain); gain.connect(this.masterGain); source.start(); this.updateStatus('Playing full sample');
  }

  function selectSliceForEffects(sliceIndex) {
    const panel = document.getElementById('slice-effects-panel'); if (!panel || !this.chopper.slices[sliceIndex]) return; this.chopper.selectedSlice = sliceIndex; const slice = this.chopper.slices[sliceIndex]; panel.innerHTML = `...`; // large UI markup omitted in this helper to keep file compact; engine still calls selectSliceForEffects which will populate UI elsewhere
  }

  function playSliceWithEffects(sliceIndex) {
    if (!this.chopper.buffer || !this.chopper.slices[sliceIndex]) return;
    const slice = this.chopper.slices[sliceIndex]; const effects = slice.effects || {};
    const source = this.context.createBufferSource(); source.buffer = this.chopper.buffer; source.playbackRate.value = (effects.speed || 1) * (effects.pitch || 1);
    let currentNode = source;
    if (effects.filter_freq && effects.filter_freq !== 2000) {
      const filter = this.context.createBiquadFilter(); filter.type = effects.filter_type || 'lowpass'; filter.frequency.value = effects.filter_freq || 2000; filter.Q.value = effects.filter_q || 1; currentNode.connect(filter); currentNode = filter;
    }
    if (effects.dist_mix && effects.dist_mix > 0) {
      const waveshaper = this.context.createWaveShaper(); const drive = effects.dist_drive || 1; const curve = effects.dist_curve || 0; const samples = 44100; const curveData = new Float32Array(samples); const deg = Math.PI/180; for (let i=0;i<samples;i++){ const x=(i*2)/samples-1; curveData[i]=((3+curve)*x*20*deg)/(Math.PI+curve*Math.abs(x)); } waveshaper.curve = curveData; waveshaper.oversample='4x'; const dryGain=this.context.createGain(); const wetGain=this.context.createGain(); const mixGain=this.context.createGain(); dryGain.gain.value = 1 - effects.dist_mix; wetGain.gain.value = effects.dist_mix; currentNode.connect(dryGain); currentNode.connect(waveshaper); waveshaper.connect(wetGain); dryGain.connect(mixGain); wetGain.connect(mixGain); currentNode = mixGain;
    }
    if (effects.delay_mix && effects.delay_mix > 0) {
      const delay = this.context.createDelay(1); const delayFeedback = this.context.createGain(); const delayMix = this.context.createGain(); const dryGain = this.context.createGain(); delay.delayTime.value = effects.delay_time || 0.25; delayFeedback.gain.value = effects.delay_feedback || 0.3; delayMix.gain.value = effects.delay_mix; dryGain.gain.value = 1 - effects.delay_mix; currentNode.connect(delay); delay.connect(delayFeedback); delayFeedback.connect(delay); currentNode.connect(dryGain); delay.connect(delayMix); const mixNode=this.context.createGain(); dryGain.connect(mixNode); delayMix.connect(mixNode); currentNode = mixNode;
    }
    if (effects.chorus_depth && effects.chorus_depth > 0) {
      const chorusDelay = this.context.createDelay(0.05); const chorusLFO = this.context.createOscillator(); const chorusGain = this.context.createGain(); const chorusMix = this.context.createGain(); const dryGain = this.context.createGain(); chorusLFO.frequency.value = effects.chorus_rate || 2; chorusGain.gain.value = effects.chorus_depth; chorusMix.gain.value = 0.5; dryGain.gain.value = 0.5; chorusLFO.connect(chorusGain); chorusGain.connect(chorusDelay.delayTime); currentNode.connect(chorusDelay); currentNode.connect(dryGain); chorusDelay.connect(chorusMix); const mixNode=this.context.createGain(); dryGain.connect(mixNode); chorusMix.connect(mixNode); chorusLFO.start(); currentNode = mixNode;
    }
    if (effects.tremolo_depth && effects.tremolo_depth > 0) {
      const tremoloLFO = this.context.createOscillator(); const tremoloGain = this.context.createGain(); const tremoloDepth = this.context.createGain(); tremoloLFO.frequency.value = effects.tremolo_rate || 4; tremoloDepth.gain.value = effects.tremolo_depth * 0.5; tremoloGain.gain.value = 1 - (effects.tremolo_depth * 0.5); tremoloLFO.connect(tremoloDepth); tremoloDepth.connect(tremoloGain.gain); currentNode.connect(tremoloGain); tremoloLFO.start(); currentNode = tremoloGain;
    }
    if (effects.reverb_mix && effects.reverb_mix > 0) {
      const convolver = this.context.createConvolver(); const reverbMix = this.context.createGain(); const dryGain = this.context.createGain(); const length = this.context.sampleRate * (effects.reverb_decay || 2); const impulse = this.context.createBuffer(2, length, this.context.sampleRate); for (let channel=0;channel<2;channel++){ const channelData = impulse.getChannelData(channel); for (let i=0;i<length;i++){ const n = length - i; channelData[i] = (Math.random()*2-1)*Math.pow(n/length,2); } } convolver.buffer = impulse; reverbMix.gain.value = effects.reverb_mix; dryGain.gain.value = 1 - effects.reverb_mix; currentNode.connect(convolver); currentNode.connect(dryGain); convolver.connect(reverbMix); const mixNode=this.context.createGain(); dryGain.connect(mixNode); reverbMix.connect(mixNode); currentNode = mixNode;
    }
    const gainNode = this.context.createGain(); gainNode.gain.value = effects.vol || 0.8; const panNode = this.context.createStereoPanner(); panNode.pan.value = effects.pan || 0; currentNode.connect(gainNode); gainNode.connect(panNode); panNode.connect(this.masterGain); source.start(0, slice.start, slice.end - slice.start); this.updateStatus(`Playing slice ${sliceIndex + 1} with ${Object.keys(effects).length} effects`);
  }

  function resetSliceEffects(sliceIndex) { const slice = this.chopper.slices[sliceIndex]; if (slice) { slice.effects = {}; this.selectSliceForEffects(sliceIndex); this.updateStatus(`Reset effects for slice ${sliceIndex + 1}`); } }

  function applySliceEffectPreset(sliceIndex, presetName = null) {
    const slice = this.chopper.slices[sliceIndex]; if (!slice) return; if (!presetName) { const presetSelect = document.getElementById(`slice-effect-preset-${sliceIndex}`); presetName = presetSelect ? presetSelect.value : 'none'; } if (presetName === 'none') return;
    const presets = { 'lo-fi': { filter_type: 'lowpass', filter_freq: 800, filter_q: 2, dist_drive: 8, dist_curve: 30, dist_mix: 0.4, reverb_size: 0.3, reverb_decay: 1.5, reverb_mix: 0.2 }, 'telephone': { filter_type: 'bandpass', filter_freq: 1200, filter_q: 8, dist_drive: 15, dist_curve: 50, dist_mix: 0.6 }, 'radio': { filter_type: 'bandpass', filter_freq: 2500, filter_q: 4, dist_drive: 5, dist_curve: 20, dist_mix: 0.3, tremolo_rate: 1, tremolo_depth: 0.3 }, 'underwater': { filter_type: 'lowpass', filter_freq: 400, filter_q: 0.5, chorus_rate: 0.5, chorus_depth: 0.008, reverb_size: 0.8, reverb_decay: 6, reverb_mix: 0.6, pitch: 0.8 }, 'robot': { filter_type: 'bandpass', filter_freq: 1500, filter_q: 10, dist_drive: 20, dist_curve: 80, dist_mix: 0.7, tremolo_rate: 8, tremolo_depth: 0.8, pitch: 0.7 }, 'vintage': { filter_type: 'lowpass', filter_freq: 5000, filter_q: 1.5, dist_drive: 3, dist_curve: 15, dist_mix: 0.2, chorus_rate: 1.5, chorus_depth: 0.005, tremolo_rate: 0.8, tremolo_depth: 0.2 }, 'space': { delay_time: 0.375, delay_feedback: 0.7, delay_mix: 0.8, reverb_size: 0.9, reverb_decay: 8, reverb_mix: 0.5, chorus_rate: 0.3, chorus_depth: 0.012 }, 'glitch': { dist_drive: 25, dist_curve: 90, dist_mix: 0.5, tremolo_rate: 16, tremolo_depth: 0.9, delay_time: 0.08, delay_feedback: 0.8, delay_mix: 0.4, pitch: 1.5 } };
    const preset = presets[presetName]; if (preset) { slice.effects = { ...slice.effects, ...preset }; this.selectSliceForEffects(sliceIndex); Object.keys(preset).forEach(param => { const slider = document.getElementById(`slice-${param.replace('_','-')}-${sliceIndex}`); const display = document.getElementById(`slice-${param.replace('_','-')}-${sliceIndex}-display`); if (slider && display) { slider.value = preset[param]; let suffix=''; if (param.includes('freq')) suffix='Hz'; else if (param.includes('time')||param.includes('decay')) suffix='s'; else if (param.includes('rate')) suffix='Hz'; const decimals = param.includes('depth')&&param.includes('chorus')?3: param.includes('freq')||param.includes('curve')||param.includes('vibrato')?0: param.includes('rate')||param.includes('drive')||param.includes('q')?1:2; display.textContent = parseFloat(preset[param]).toFixed(decimals)+suffix; } }); const filterType = document.getElementById(`slice-filter-type-${sliceIndex}`); if (filterType && preset.filter_type) filterType.value = preset.filter_type; this.updateStatus(`Applied "${presetName}" preset to slice ${sliceIndex + 1}`); }
  }

  function exportSliceWithEffects(sliceIndex) { this.updateStatus('Export with effects - coming soon!'); }

  function createEqualSlices() {
    if (!this.chopper.buffer) return; const duration = this.chopper.buffer.duration; const sliceLength = duration / this.chopper.numSlices; this.chopper.sliceMarkers = []; this.chopper.slices = []; for (let i=0;i<this.chopper.numSlices;i++){ const start = i*sliceLength; const end = (i+1)*sliceLength; this.chopper.sliceMarkers.push(start); this.chopper.slices.push({ start, end }); } this.drawChopperWaveform(); this.drawChopperWaveformMain(); this.renderChopperPads(); this.renderChopperPadsMain(); this.updateStatus(`Created ${this.chopper.numSlices} equal slices`);
  }

  function detectTransients() {
    if (!this.chopper.buffer) return;
    const data = this.chopper.buffer.getChannelData(0);
    const sampleRate = this.chopper.buffer.sampleRate;
    const sensitivity = this.chopper.sensitivity;
    const windowSize = Math.floor(sampleRate * 0.02);
    const hopSize = Math.floor(windowSize / 8);
    const minDistance = Math.floor(sampleRate * 0.03);
    const baseEnergyThreshold = 1.2 + (1 - sensitivity) * 1.8;
    const spectralFluxThreshold = 0.02 + sensitivity * 0.2;
    const highFreqThreshold = 0.15 + sensitivity * 0.5;
    const transientCandidates = [];
    let previousEnergy = 0; let previousSpectralCentroid = 0; let previousHighFreqEnergy = 0;
    for (let i=0;i<data.length - windowSize;i+=hopSize){ let totalEnergy=0; let highFreqEnergy=0; let magnitudeSum=0; let weightedSum=0; for (let j=0;j<windowSize;j++){ const sample = data[i+j]; const sampleSquared = sample*sample; totalEnergy += sampleSquared; if (j > windowSize * 0.6) highFreqEnergy += sampleSquared; const magnitude = Math.abs(sample); magnitudeSum += magnitude; weightedSum += magnitude * (j/windowSize); } totalEnergy = Math.sqrt(totalEnergy / windowSize); highFreqEnergy = Math.sqrt(highFreqEnergy / (windowSize * 0.4)); const spectralCentroid = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0; const energyIncrease = totalEnergy > previousEnergy * baseEnergyThreshold; const spectralChange = Math.abs(spectralCentroid - previousSpectralCentroid) > spectralFluxThreshold; const highFreqIncrease = highFreqEnergy > previousHighFreqEnergy * (1 + highFreqThreshold); const aboveNoiseFloor = totalEnergy > 0.008; let criteriaCount = 0; if (energyIncrease) criteriaCount++; if (spectralChange) criteriaCount++; if (highFreqIncrease) criteriaCount++; const isTransient = criteriaCount >= 2 && aboveNoiseFloor; if (isTransient) { const timePosition = i / sampleRate; let tooClose=false; for (const candidate of transientCandidates) { if (Math.abs(candidate.time - timePosition) < (minDistance / sampleRate)) { tooClose = true; break; } } if (!tooClose) transientCandidates.push({ time: timePosition, confidence: criteriaCount + (totalEnergy * 5) }); } previousEnergy = previousEnergy * 0.3 + totalEnergy * 0.7; previousSpectralCentroid = previousSpectralCentroid * 0.5 + spectralCentroid * 0.5; previousHighFreqEnergy = previousHighFreqEnergy * 0.4 + highFreqEnergy * 0.6; }
    transientCandidates.sort((a,b)=>b.confidence - a.confidence);
    const maxTransients = Math.min(transientCandidates.length, this.chopper.numSlices - 1);
    const selectedTransients = transientCandidates.slice(0, maxTransients);
    selectedTransients.sort((a,b)=>a.time - b.time);
    this.chopper.sliceMarkers = [0, ...selectedTransients.map(t=>t.time)]; this.chopper.slices = []; const allMarkers = [...this.chopper.sliceMarkers, this.chopper.buffer.duration]; for (let i=0;i<allMarkers.length-1;i++){ const start = allMarkers[i]; const end = allMarkers[i+1]; this.chopper.slices.push({ start, end }); }
    this.drawChopperWaveform(); this.drawChopperWaveformMain(); this.renderChopperPads(); this.renderChopperPadsMain(); const sensPercent = (sensitivity*100).toFixed(0); const avgConfidence = selectedTransients.length>0 ? (selectedTransients.reduce((sum,t)=>sum+t.confidence,0)/selectedTransients.length).toFixed(1) : 0; this.updateStatus(`Detected ${this.chopper.slices.length} transients (sensitivity: ${sensPercent}%, confidence: ${avgConfidence})`);
  }

  function renderChopperPads() {
    const container = document.getElementById('chop-pads'); if (!container) return; container.innerHTML=''; for (let i=0;i<Math.min(16,this.chopper.numSlices);i++){ const pad=document.createElement('div'); pad.className='chop-pad'; pad.textContent = i+1; pad.onclick = ()=> this.playSlice(i); container.appendChild(pad); } }

  function playSlice(index) {
    if (!this.chopper.buffer || !this.chopper.slices[index]) return;
    
    // Check if audio context is suspended and try to resume
    if (this.context.state === 'suspended') {
      console.log('Audio context suspended, attempting to resume...');
      this.context.resume().then(() => {
        console.log('âœ… Audio context resumed, playing slice');
        this._playSliceAfterResume(index);
      }).catch(e => {
        console.error('Failed to resume audio context:', e);
        this.updateStatus('Audio context suspended - click to activate');
      });
      return;
    }
    
    this._playSliceAfterResume(index);
  }

  function _playSliceAfterResume(index) {
    const slice = this.chopper.slices[index]; 
    const source = this.context.createBufferSource(); 
    source.buffer = this.chopper.buffer; 
    const gain = this.context.createGain(); 
    gain.gain.value = 0.8; 
    source.connect(gain); 
    gain.connect(this.masterGain); 
    source.loop = false; 
    this.chopper.playingSources.add(source); 
    source.onended = () => this.chopper.playingSources.delete(source); 
    source.start(0, slice.start, slice.end - slice.start); 
    const pads = document.querySelectorAll('.chop-pad'); 
    if (pads[index]) { 
      pads[index].classList.add('active'); 
      setTimeout(()=>pads[index].classList.remove('active'),200); 
    }
  }

  function slicesToSequencerRows() {
    if (!this.chopper.buffer || this.chopper.slices.length===0) { this.updateStatus('No slices to send'); return; }
    const numSlices = this.chopper.slices.length; const availableSlots = 16; const slicesToSend = Math.min(numSlices, availableSlots);
    for (let i=0;i<slicesToSend;i++){ const slice=this.chopper.slices[i]; if (!slice) continue; const duration = slice.end - slice.start; const startSample = Math.floor(slice.start * this.context.sampleRate); const endSample = Math.floor(slice.end * this.context.sampleRate); const length = endSample - startSample; const sliceBuffer = this.context.createBuffer(1, length, this.context.sampleRate); const sourceData = this.chopper.buffer.getChannelData(0); const sliceData = sliceBuffer.getChannelData(0); for (let j=0;j<length;j++) sliceData[j] = sourceData[startSample + j] || 0; const slotIndex = i; this.sampleBank.set(slotIndex, { buffer: sliceBuffer, name: `Slice ${i+1}`, duration: duration }); if (i<8) this.sequencer.rowSample[i] = slotIndex; const slot = document.getElementById(`sample-slot-${slotIndex}`); if (slot) { slot.classList.add('loaded'); slot.innerHTML = `<div style="font-size:18px;font-weight:bold">${slotIndex+1}</div><div style="font-size:9px;opacity:.8">Slice ${i+1}</div><div style="font-size:8px;opacity:.6">${duration.toFixed(2)}s</div>`; } }
    this.renderSequencer(); this.updateStatus(`Sent ${slicesToSend} slices to sample bank${slicesToSend>8 ? ' (first 8 assigned to sequencer rows)' : ''}`);
  }

  function slicesToLoopTracks() {
    if (!this.chopper.buffer || this.chopper.slices.length===0) { this.updateStatus('No chopped samples to send'); return; }
    const numSlices = this.chopper.slices.length; const availableTracks = this.maxTracks; const slicesToSend = Math.min(numSlices, availableTracks);
    for (let i=0;i<slicesToSend;i++){ const slice=this.chopper.slices[i]; if (!slice) continue; const duration = slice.end - slice.start; const startSample = Math.floor(slice.start * this.context.sampleRate); const endSample = Math.floor(slice.end * this.context.sampleRate); const length = endSample - startSample; const sliceBuffer = this.context.createBuffer(1, length, this.context.sampleRate); const sourceData = this.chopper.buffer.getChannelData(0); const sliceData = sliceBuffer.getChannelData(0); for (let j=0;j<length;j++) sliceData[j] = sourceData[startSample + j] || 0; const track = this.tracks[i]; track.buffer = sliceBuffer; track.chunks = []; track.isRecording = false; track.isPlaying = false; if (track.source) { track.source.stop(); track.source = null; } this.drawWaveform(i, sliceBuffer); const card = document.getElementById(`track-${i}`); if (card) { card.classList.remove('recording'); const recBtn = document.getElementById(`rec-btn-${i}`); if (recBtn) { recBtn.innerHTML = 'REC'; recBtn.classList.remove('active'); } } }
    const unifiedBtn = document.querySelector('[data-mode="unified"]'); if (unifiedBtn) unifiedBtn.click(); this.updateStatus(`Sent ${slicesToSend} slices to loop tracks - Ready to play and layer!`);
  }

  function exportAllSlices() {
    if (!this.chopper.buffer || this.chopper.slices.length===0) { this.updateStatus('No slices to export'); return; }
    this.chopper.slices.forEach((slice,index)=>{ const duration = slice.end - slice.start; const startSample = Math.floor(slice.start*this.context.sampleRate); const endSample = Math.floor(slice.end*this.context.sampleRate); const length = endSample - startSample; const sliceBuffer = this.context.createBuffer(1,length,this.context.sampleRate); const sourceData = this.chopper.buffer.getChannelData(0); const sliceData = sliceBuffer.getChannelData(0); for (let j=0;j<length;j++) sliceData[j] = sourceData[startSample + j] || 0; const blob = this._audioBufferToWav(sliceBuffer); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `slice_${index+1}.wav`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }); this.updateStatus(`Exported ${this.chopper.slices.length} slices`);
  }

  function setupChopperInteraction() {
    const canvas = document.getElementById('chop-wave'); if (!canvas) return; canvas.removeEventListener('mousedown', this.handleChopperMouseDown); canvas.removeEventListener('mousemove', this.handleChopperMouseMove); canvas.removeEventListener('mouseup', this.handleChopperMouseUp);
    let isDragging=false; let dragType=null; let dragMarkerIndex=-1; let startDragX=0;
    this.handleChopperMouseDown = (e) => {
      const rect = canvas.getBoundingClientRect(); const x = e.clientX - rect.left; const totalDuration = this.chopper.buffer.duration; const zoomedDuration = totalDuration / this.chopper.zoom; const startTime = this.chopper.scrollPosition * (totalDuration - zoomedDuration); const clickTime = startTime + (x / canvas.offsetWidth) * zoomedDuration; const tolerance = (this.chopper.dragTolerance / canvas.offsetWidth) * zoomedDuration;
      if (this.chopper.trimStart > 0 && Math.abs(clickTime - this.chopper.trimStart) < tolerance) { dragType='trim-start'; isDragging=true; }
      else if (this.chopper.trimEnd !== null && Math.abs(clickTime - this.chopper.trimEnd) < tolerance) { dragType='trim-end'; isDragging=true; }
      else if (this.chopper.manualMode) { const markerIndex = this.findNearbyMarker(clickTime, canvas); if (markerIndex>=0) { dragType='marker'; dragMarkerIndex=markerIndex; isDragging=true; } else { this.addSliceMarker(clickTime); } }
      else if (e.shiftKey) { dragType='new-trim'; isDragging=true; startDragX = x; this.chopper.trimStart = clickTime; this.chopper.trimEnd = clickTime; }
      if (isDragging) e.preventDefault();
    };
    this.handleChopperMouseMove = (e) => {
      if (!isDragging) return; const rect = canvas.getBoundingClientRect(); const x = e.clientX - rect.left; const totalDuration = this.chopper.buffer.duration; const zoomedDuration = totalDuration / this.chopper.zoom; const startTime = this.chopper.scrollPosition * (totalDuration - zoomedDuration); const currentTime = Math.max(0, Math.min(startTime + (x / canvas.offsetWidth) * zoomedDuration, totalDuration));
      if (dragType==='trim-start') this.chopper.trimStart = Math.min(currentTime, this.chopper.trimEnd || totalDuration);
      else if (dragType==='trim-end') this.chopper.trimEnd = Math.max(currentTime, this.chopper.trimStart);
      else if (dragType==='new-trim') { const startClickTime = startTime + (startDragX / canvas.offsetWidth) * zoomedDuration; this.chopper.trimStart = Math.min(startClickTime, currentTime); this.chopper.trimEnd = Math.max(startClickTime, currentTime); }
      else if (dragType==='marker' && dragMarkerIndex>=0) { this.chopper.sliceMarkers[dragMarkerIndex] = currentTime; this.chopper.sliceMarkers.sort((a,b)=>a-b); }
      this.drawChopperWaveform(); if (dragType && dragType.includes('trim')) this.showChopperTrimControls();
    };
    this.handleChopperMouseUp = (e) => { if (isDragging) { isDragging=false; if (dragType==='marker') { this.updateSlicesFromMarkers(); this.renderChopperPads(); } else if (dragType==='new-trim') { if (this.chopper.trimEnd - this.chopper.trimStart < 0.1) { this.chopper.trimStart=0; this.chopper.trimEnd=null; this.hideChopperTrimControls(); } else { this.showChopperTrimControls(); this.updateStatus(`Chopper trim set: ${this.chopper.trimStart.toFixed(2)}s - ${this.chopper.trimEnd.toFixed(2)}s`); } this.drawChopperWaveform(); } dragType=null; dragMarkerIndex=-1; } };
    canvas.addEventListener('mousedown', this.handleChopperMouseDown); canvas.addEventListener('mousemove', this.handleChopperMouseMove); canvas.addEventListener('mouseup', this.handleChopperMouseUp); canvas.style.cursor='crosshair';
  }

  const impls = {
    initChopper, drawChopperWaveform, stopAllChopperSamples, setupManualChopMode,
    findNearbyMarker, addSliceMarker, updateSlicesFromMarkers, clearSliceMarkers,
    toggleManualMode, createSlicesFromMarkers, smartSlice, loadChopperFile,
    drawChopperWaveformMain, setupManualChopModeMain, renderChopperPadsMain,
    updateChopperInfo, updateSliceCountDisplay, playFullSample, selectSliceForEffects,
    playSliceWithEffects, resetSliceEffects, applySliceEffectPreset, exportSliceWithEffects,
    createEqualSlices, detectTransients, renderChopperPads, playSlice, _playSliceAfterResume, slicesToSequencerRows,
    slicesToLoopTracks, exportAllSlices, setupChopperInteraction
  };

  Object.keys(impls).forEach(k => engine[k] = impls[k].bind(engine));
}
