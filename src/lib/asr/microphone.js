// Captures microphone audio as Float32 frames via an AudioWorklet.

const WORKLET = `
class Tap extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(2048);
    this.n = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        this.buf[this.n++] = ch[i];
        if (this.n === this.buf.length) {
          let sum = 0;
          for (let j = 0; j < this.buf.length; j++) sum += this.buf[j] * this.buf[j];
          this.port.postMessage({ samples: this.buf, rms: Math.sqrt(sum / this.buf.length) }, [this.buf.buffer]);
          this.buf = new Float32Array(2048);
          this.n = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('tap', Tap);
`;

export async function openMicrophone({ deviceId, onFrame }) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      channelCount: 1,
      // Echo cancellation helps when the Spanish voice plays from a speaker
      // in the same room, but headphones / a transmitter work best.
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  const ctx = new AudioContext();
  const url = URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' }));
  await ctx.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);
  const source = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, 'tap');
  node.port.onmessage = (e) => onFrame(e.data.samples, ctx.sampleRate, e.data.rms);
  source.connect(node);
  // Keep the graph pulling audio without making any sound.
  const mute = ctx.createGain();
  mute.gain.value = 0;
  node.connect(mute).connect(ctx.destination);
  if (ctx.state === 'suspended') await ctx.resume();

  return {
    sampleRate: ctx.sampleRate,
    close() {
      node.port.onmessage = null;
      stream.getTracks().forEach((t) => t.stop());
      ctx.close();
    },
  };
}

/** Level meter for engines that don't hand us raw audio (Web Speech). */
export async function openLevelMeter({ deviceId, onLevel }) {
  return openMicrophone({ deviceId, onFrame: (_s, _r, rms) => onLevel(rms) });
}
