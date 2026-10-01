/* global AudioWorkletProcessor, registerProcessor, sampleRate */
class RecordingProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.recording = false;
    this.finished = false;
    this.buffer = new Float32Array(4096);
    this.offset = 0;
    this.samples = 0;
    this.port.onmessage = ({ data }) => {
      if (data === "start") this.recording = true;
      if (data === "stop") {
        this.recording = false;
        this.flush();
        this.port.postMessage({ type: "stopped" });
        this.finished = true;
      }
    };
  }

  flush() {
    if (!this.offset) return;
    const samples = this.buffer.slice(0, this.offset);
    this.port.postMessage({ type: "samples", samples }, [samples.buffer]);
    this.offset = 0;
  }

  process(inputs) {
    const channels = inputs[0];
    if (this.recording && channels?.length) {
      for (let i = 0; i < channels[0].length; i++) {
        // Bound memory even if WebView timers are suspended in the background.
        if (this.samples >= sampleRate * 60) break;
        let sample = 0;
        for (const channel of channels) sample += channel[i];
        this.buffer[this.offset++] = sample / channels.length;
        this.samples++;
        if (this.offset === this.buffer.length) this.flush();
      }
    }
    return !this.finished;
  }
}

registerProcessor("speakai-recorder", RecordingProcessor);
