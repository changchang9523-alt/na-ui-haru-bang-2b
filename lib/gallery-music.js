// v52: background music for the mood gallery. A soft instrumental played live
// with Web Audio (no file needed): a slow harp-and-strings arrangement of the
// baroque Canon progression (public domain), with room reverb. Starts when the
// gallery opens, fades out when you go back to the room.
(function () {
  let ctx = null, master = null, out = null, timer = 0, playing = false, nextTime = 0, step = 0;
  const BPM = 66, EIGHTH = 60 / BPM / 2;
  const CHORDS = [[50, 57, 62, 66, 69], [45, 52, 57, 61, 64], [47, 54, 59, 62, 66], [42, 49, 54, 57, 61], [43, 50, 55, 59, 62], [50, 57, 62, 66, 69], [43, 50, 55, 59, 62], [45, 52, 57, 61, 64]];
  const MEL_A = [78, 76, 74, 73, 71, 69, 71, 73];
  const MEL_B = [[74, 78], [73, 76], [71, 74], [69, 73], [67, 71], [66, 69], [67, 71], [69, 73]];
  const MEL_C = [[78, 76, 74, 76], [73, 71, 73, 76], [74, 73, 71, 74], [73, 71, 69, 73], [71, 69, 67, 71], [69, 67, 66, 69], [67, 71, 69, 67], [69, 73, 76, 73]];
  const ARP = [0, 1, 2, 3, 4, 3, 2, 1];
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  function impulse(seconds) {
    const len = ctx.sampleRate * seconds, buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    return buf;
  }
  function init() {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return false;
    ctx = new C();
    master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    const verb = ctx.createConvolver(); verb.buffer = impulse(3.4);
    const wet = ctx.createGain(); wet.gain.value = .5; const dry = ctx.createGain(); dry.gain.value = .75;
    out = ctx.createGain(); out.gain.value = 1;
    out.connect(dry).connect(master); out.connect(verb).connect(wet).connect(master);
    master.connect(comp).connect(ctx.destination);
    return true;
  }
  // plucked harp: a few partials with a fast attack and long natural decay
  function harp(m, t, vel, len) {
    const f = hz(m), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.setValueAtTime(Math.min(5200, f * 7), t); lp.frequency.exponentialRampToValueAtTime(Math.max(400, f * 2), t + len);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + .008); g.gain.exponentialRampToValueAtTime(.0008, t + len);
    lp.connect(g).connect(out);
    [[1, 1, "triangle"], [2, .32, "sine"], [3, .12, "sine"]].forEach(([mul, amp, type]) => {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = f * mul; o.detune.value = (Math.random() - .5) * 6; og.gain.value = amp;
      o.connect(og).connect(lp); o.start(t); o.stop(t + len + .05);
    });
  }
  // soft string pad under each chord
  function pad(notes, t, len) {
    const g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.045, t + len * .35); g.gain.linearRampToValueAtTime(.0001, t + len + .6);
    lp.connect(g).connect(out);
    notes.slice(0, 4).forEach(m => { for (const d of [-7, 7]) { const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = hz(m); o.detune.value = d; const og = ctx.createGain(); og.gain.value = .22; o.connect(og).connect(lp); o.start(t); o.stop(t + len + .7); } });
  }
  function schedule() {
    while (nextTime < ctx.currentTime + 1.4) {
      const bar = Math.floor(step / 8), sub = step % 8, chordIdx = bar % 8, cycle = Math.floor(bar / 8) % 4, chord = CHORDS[chordIdx], t = nextTime;
      if (sub === 0) { harp(chord[0] - 12, t, .16, 4.2); pad(chord, t, EIGHTH * 8); }
      harp(chord[ARP[sub]], t, sub === 0 ? .085 : .06, 2.4);
      if (cycle === 1 && sub === 0) harp(MEL_A[chordIdx], t, .12, 4);
      if (cycle === 2 && (sub === 0 || sub === 4)) harp(MEL_B[chordIdx][sub / 4], t, .11, 3);
      if (cycle === 3 && sub % 2 === 0) harp(MEL_C[chordIdx][sub / 2], t, .1, 2.4);
      nextTime += EIGHTH * (sub === 7 ? 1.04 : 1); step++;
    }
  }
  window.galleryMusic = {
    start() {
      if (!ctx && !init()) return;
      ctx.resume?.();
      if (!playing) { playing = true; step = 0; nextTime = ctx.currentTime + .25; schedule(); timer = setInterval(schedule, 250); }
      master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(master.gain.value, ctx.currentTime); master.gain.linearRampToValueAtTime(.8, ctx.currentTime + 2.5);
    },
    stop() {
      if (!ctx || !playing) return;
      master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(master.gain.value, ctx.currentTime); master.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
      setTimeout(() => { if (master.gain.value < .01) { playing = false; clearInterval(timer); ctx.suspend?.(); } }, 1400);
    },
    isPlaying: () => playing
  };
})();
