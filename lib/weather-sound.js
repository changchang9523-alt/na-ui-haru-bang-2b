// v53: background weather sound for the room. On a rainy day there is a soft
// rain bed with drops tapping the window; on a snowy day a hushed wind. It plays
// whether or not the window is open, follows the day's weather, cross-fades
// when it changes, and is muted inside the mood gallery. Starts after the first
// click or key press (browsers block sound before that).
(function () {
  let ctx = null, rainBus = null, snowBus = null, dropTimer = 0, noise = null, want = "sunny", muted = false;
  function makeNoise(seconds) {
    const len = ctx.sampleRate * seconds, buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); let b = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = .97 * b + .03 * w; d[i] = w * .6 + b * 2.2; } }
    return buf;
  }
  function loop(buf, dest, type, freq, q, gain) {
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.loopStart = Math.random();
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || .7;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(dest); src.start(0, Math.random() * 2); return { src, f, g };
  }
  function init() {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return false;
    ctx = new C(); noise = makeNoise(4);
    const master = ctx.createGain(); master.gain.value = .9; master.connect(ctx.destination);
    rainBus = ctx.createGain(); rainBus.gain.value = 0; rainBus.connect(master);
    snowBus = ctx.createGain(); snowBus.gain.value = 0; snowBus.connect(master);
    // rain: a broad hiss on roofs and leaves + a low distant wash
    loop(noise, rainBus, "bandpass", 2600, .35, .055);
    loop(noise, rainBus, "lowpass", 700, .5, .09);
    // snow: a slow, breathing wind
    const wind = loop(noise, snowBus, "lowpass", 420, 1.2, .05);
    const lfo = ctx.createOscillator(), lfoGain = ctx.createGain(); lfo.frequency.value = .07; lfoGain.gain.value = 220; lfo.connect(lfoGain).connect(wind.f.frequency); lfo.start();
    const lfo2 = ctx.createOscillator(), lfo2Gain = ctx.createGain(); lfo2.frequency.value = .045; lfo2Gain.gain.value = .025; lfo2.connect(lfo2Gain).connect(wind.g.gain); lfo2.start();
    // individual drops tapping the glass
    const drop = () => {
      if (rainBus.gain.value > .01) {
        const t = ctx.currentTime + .02, src = ctx.createBufferSource(); src.buffer = noise;
        const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1800 + Math.random() * 4200; f.Q.value = 6 + Math.random() * 8;
        const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.05 + Math.random() * .07, t + .002); g.gain.exponentialRampToValueAtTime(.0005, t + .03 + Math.random() * .05);
        const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null; if (pan) pan.pan.value = Math.random() * 1.6 - .8;
        src.connect(f).connect(g); (pan ? g.connect(pan) : g).connect(rainBus); src.start(t, Math.random() * 3, .1);
      }
      dropTimer = setTimeout(drop, 35 + Math.random() * 140);
    };
    drop();
    return true;
  }
  function apply() {
    if (!ctx) return;
    const t = ctx.currentTime, r = !muted && want === "rain" ? .85 : 0, s = !muted && want === "snow" ? .8 : 0;
    for (const [bus, v] of [[rainBus, r], [snowBus, s]]) { bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(bus.gain.value, t); bus.gain.linearRampToValueAtTime(v, t + 2.5); }
  }
  function wake() {
    if (!ctx && !init()) return;
    ctx.resume?.(); apply();
  }
  ["pointerdown", "keydown"].forEach(ev => window.addEventListener(ev, wake, { capture: true, passive: true }));
  window.setWeatherSound = w => { want = w || "sunny"; apply(); };
  window.setWeatherSoundMuted = m => { muted = !!m; apply(); };
})();
