let canvas = null;
let ctx = null;

function initOffscreen(offscreen, width, height) {
  canvas = offscreen;
  ctx = canvas.getContext('2d');
  canvas.width = width;
  canvas.height = height;
}

function drawWaveformFromData(samples, width, height) {
  if (!ctx) return;
  // Resize if needed
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, width, height);

  const data = samples;
  const step = Math.max(1, Math.floor(data.length / width));
  const amp = height / 2;

  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let i = 0; i < width; i++) {
    let min = 1.0;
    let max = -1.0;
    for (let j = 0; j < step; j++) {
      const idx = i * step + j;
      if (idx >= data.length) break;
      const v = data[idx];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    ctx.moveTo(i, (1 + min) * amp);
    ctx.lineTo(i, (1 + max) * amp);
  }
  ctx.stroke();
}

self.onmessage = (e) => {
  const msg = e.data;
  if (!msg) return;

  if (msg.type === 'init') {
    // msg.canvas is an OffscreenCanvas transferred
    initOffscreen(msg.canvas, msg.width || 400, msg.height || 100);
  } else if (msg.type === 'draw') {
    try {
      const samples = msg.samples;
      drawWaveformFromData(samples, msg.width || (canvas ? canvas.width : 400), msg.height || (canvas ? canvas.height : 100));
    } catch (err) {
      // fallback: nothing
    }
  }
};
