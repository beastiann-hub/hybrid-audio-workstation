export function attachSequencer(engine) {
  const methodNames = [
    'getBeatDuration', 'getBarDuration', 'getStepDuration', 'getNextDownbeat', 'getNextStepTime',
    'playAll', 'stopAll', 'startMetronome', 'stopMetronome', '_scheduleClick',
    'startScheduler', '_schedulerTick', 'renderSequencer', 'tapTempo'
  ];

  methodNames.forEach(name => {
    try {
      const fn = engine[name];
      if (typeof fn === 'function') engine[name] = fn.bind(engine);
    } catch (e) {
      console.warn('attachSequencer: method not bound', name, e);
    }
  });

  engine.sequencerModule = engine.sequencerModule || {};
  engine.sequencerModule.createUI = () => {
    try { engine.renderSequencer(); } catch (e) { console.warn('renderSequencer failed', e); }
  };
}

// === Sequencer implementations ===
function getBeatDuration() { return 60 / this.bpm; }
function getBarDuration() { return this.beatsPerBar * this.getBeatDuration(); }
function getStepDuration() { return this.getBarDuration() / this.sequencer.stepDiv; }
function getNextDownbeat(fromTime = this.context.currentTime) {
  const bar = this.getBarDuration();
  return Math.ceil(fromTime / bar) * bar;
}
function getNextStepTime(fromTime = this.context.currentTime) {
  const step = this.getStepDuration();
  return Math.ceil(fromTime / step) * step;
}

function playAll() {
  if (this.isPlaying) return;
  
  // Check if audio context is suspended and try to resume
  if (this.context.state === 'suspended') {
    console.log('Audio context suspended, attempting to resume...');
    this.context.resume().then(() => {
      console.log('✅ Audio context resumed, continuing playback');
      this._playAllAfterResume();
    }).catch(e => {
      console.error('Failed to resume audio context:', e);
      this.updateStatus('Audio context suspended - click to activate');
    });
    return;
  }
  
  this._playAllAfterResume();
}

function _playAllAfterResume() {
  const now = this.context.currentTime;
  const start = this.getNextDownbeat(now) + (this.countInBars * this.getBarDuration());
  this.transportStartTime = start;
  this.isPlaying = true;

  // Prepare metronome & sequencer
  this.nextClickTime = start;
  this.sequencer.nextStepTime = start;
  this.sequencer.currentStep = 0;

  // Start scheduler loop
  this.startScheduler();
  this.updateStatus('Playing all tracks');
}

function stopAll() {
  this.isPlaying = false;
  this.transportStartTime = null;
  if (this.timerID) {
    clearInterval(this.timerID);
    this.timerID = null;
  }
  this.tracks.forEach((t, idx) => {
    if (t.source) { try { t.source.stop(); } catch(e){} t.source = null; }
    t.isPlaying = false;
    ['unified-tracks', 'loopstation-tracks'].forEach(viewId => {
      const playhead = document.getElementById(`${viewId}-playhead-${idx}`);
      if (playhead) playhead.style.left = '0';
    });
  });

  // Stop all chopper samples
  try { this.stopAllChopperSamples(); } catch(e){}

  this.activeBuffers.forEach((source, key) => {
    try { source.stop(); } catch(e){}
  });
  this.activeBuffers.clear();

  this.updateStatus('Stopped all audio');
}

function startMetronome() {
  if (!this.metGain) {
    this.metGain = this.context.createGain();
    this.metGain.gain.value = 0.2;
    this.metGain.connect(this.masterGain);
  }
  this.metronomeEnabled = true;
  this.metronomeRunning = true;
  if (!this.isPlaying) {
    const now = this.context.currentTime;
    const start = this.getNextDownbeat(now) + (this.countInBars * this.getBarDuration());
    this.transportStartTime = start;
    this.nextClickTime = start;
    this.sequencer.nextStepTime = start;
    this.startScheduler();
  }
  this.updateStatus('Metronome on');
}

function stopMetronome() {
  this.metronomeEnabled = false;
  this.metronomeRunning = false;
  this.updateStatus('Metronome off');
}

function _scheduleClick(atTime, accented=false) {
  const osc = this.context.createOscillator();
  const gain = this.context.createGain();
  osc.frequency.value = accented ? 2000 : 1200;
  gain.gain.setValueAtTime(0, atTime);
  gain.gain.linearRampToValueAtTime(accented ? 0.6 : 0.4, atTime + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.0001, atTime + 0.05);
  osc.connect(gain);
  gain.connect(this.metGain || this.masterGain);
  osc.start(atTime);
  osc.stop(atTime + 0.06);
}

function startScheduler() {
  if (this.timerID) return;
  const lookaheadMs = this.lookahead;
  this.timerID = setInterval(() => this._schedulerTick(), lookaheadMs);
}

function _schedulerTick() {
  if (this.transportStartTime == null) return;
  const now = this.context.currentTime;
  const scheduleUntil = now + this.scheduleAheadTime;

  if (this.metronomeEnabled) {
    const beatDur = this.getBeatDuration();
    while (this.nextClickTime < scheduleUntil) {
      const pos = (this.nextClickTime - this.transportStartTime) / beatDur;
      const beatIndex = Math.round(pos) % this.beatsPerBar;
      this._scheduleClick(this.nextClickTime, beatIndex === 0);
      this.nextClickTime += beatDur;
    }
  }

  if (this.sequencer.enabled) {
    const stepDur = this.getStepDuration();
    while (this.sequencer.nextStepTime < scheduleUntil) {
      const stepIdx = this.sequencer.currentStep % this.sequencer.numSteps;
      const isOdd = (stepIdx % 2) === 1;
      const swingOffset = isOdd ? (this.sequencer.swing * stepDur) : 0;
      const when = this.sequencer.nextStepTime + swingOffset;

      for (let r = 0; r < this.sequencer.numRows; r++) {
        if (this.sequencer.grid[r][stepIdx]) {
          const slot = this.sequencer.rowSample[r];
          if (slot != null && this.sampleBank.has(slot)) {
            const entry = this.sampleBank.get(slot);
            const buf = entry.buffer || entry;
            try {
              const src = this.context.createBufferSource();
              src.buffer = buf;
              const g = this.context.createGain();
              const p = this.context.createStereoPanner();
              const rs = this.context.createGain();
              const ds = this.context.createGain();
              const vel = this.sequencer.velGrid[r][stepIdx] || 0.8;
              g.gain.value = Math.max(0, this.sequencer.rowGain[r] * vel);
              p.pan.value = this.sequencer.rowPan[r] || 0;
              rs.gain.value = Math.max(0, this.sequencer.rowRev[r] * vel);
              ds.gain.value = Math.max(0, this.sequencer.rowDel[r] * vel);
              src.connect(g);
              g.connect(p);
              p.connect(this.masterGain);
              p.connect(rs);
              rs.connect(this.effects.reverbSend);
              p.connect(ds);
              ds.connect(this.effects.delaySend);
              src.start(when);
            } catch (e) {
              console.warn('schedule sample failed', e);
            }
          }
        }
      }

      this.sequencer.currentStep = (this.sequencer.currentStep + 1) % this.sequencer.numSteps;
      this.sequencer.nextStepTime += stepDur;

      const el = document.getElementById('sequencer-grid');
      if (el) {
        const stepHeads = el.querySelectorAll('.step-head');
        stepHeads.forEach((h, idx) => h.classList.toggle('active', idx === stepIdx));
      }
    }
  }
}

function renderSequencer() {
  const grid = document.getElementById('sequencer-grid');
  if (!grid) return;
  const rows = this.sequencer.numRows;
  const steps = this.sequencer.numSteps;
  grid.innerHTML = '';

  const headLabel = document.createElement('div');
  headLabel.className = 'seq-row-label';
  headLabel.textContent = 'Row / Step';
  grid.appendChild(headLabel);

  for (let sIdx = 0; sIdx < steps; sIdx++) {
    const h = document.createElement('div');
    h.className = 'step-head';
    h.title = 'Step ' + (sIdx + 1);
    grid.appendChild(h);
  }

  for (let r = 0; r < rows; r++) {
    const label = document.createElement('div');
    label.className = 'seq-row-label';
    const slotIdx = this.sequencer.rowSample[r];
    label.innerHTML = `<div><strong>Row ${r+1}</strong><div style="opacity:.7;font-size:11px">${slotIdx!=null?('Slot '+(slotIdx+1)):'â€”'}</div></div>`;

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
          this.sequencer.grid[rr][ss] = !this.sequencer.grid[rr][ss];
          cell.classList.toggle('active', this.sequencer.grid[rr][ss]);
        }
      });

      grid.appendChild(cell);
    }
  }
}

function tapTempo() {
  const now = performance.now();
  if (now - this.lastTapTime > 2000) {
    this.tapTimes = [];
  }
  this.tapTimes.push(now);
  this.lastTapTime = now;
  if (this.tapTimes.length > 1) {
    const intervals = [];
    for (let i = 1; i < this.tapTimes.length; i++) intervals.push(this.tapTimes[i] - this.tapTimes[i-1]);
    const avgInterval = intervals.reduce((a,b)=>a+b)/intervals.length;
    const bpm = Math.round(60000 / avgInterval);
    if (bpm >= 60 && bpm <= 200) {
      this.bpm = bpm;
      const el = document.getElementById('master-bpm');
      if (el) el.value = bpm;
      try { this.effects.delay.delayTime.value = 60 / this.bpm * 0.25; } catch(e){}
      this.updateStatus(`BPM tapped: ${bpm}`);
    }
  }
  if (this.tapTimes.length > 8) this.tapTimes.shift();
}

// attach exported implementations onto engine
export function installSequencerImpls(engine) {
  const impls = {
    getBeatDuration, getBarDuration, getStepDuration, getNextDownbeat, getNextStepTime,
    playAll, _playAllAfterResume, stopAll, startMetronome, stopMetronome, _scheduleClick,
    startScheduler, _schedulerTick, renderSequencer, tapTempo
  };
  Object.keys(impls).forEach(k => engine[k] = impls[k].bind(engine));
}
