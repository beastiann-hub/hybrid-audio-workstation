class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // No internal buffer; we forward frames to main thread
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input[0]) {
      // Copy the channel data out and post to main thread
      const channelData = input[0];
      // Create a transferable copy (Float32Array)
      this.port.postMessage({ type: 'data', payload: channelData.slice(0) }, [channelData.slice(0).buffer]);
    }
    return true; // keep processor alive
  }
}

registerProcessor('recorder-processor', RecorderProcessor);
