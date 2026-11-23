// v53: mood shredder. Clicking the shredder keeps the room in the background,
// slides a tear-off note pad in on the left and the shredder machine on the
// right. Write what you want to let go of, then drag the page off the pad
// (it tears along the perforation) and drop it into the slot, or press
// "tear & shred". The page is pulled into the machine, paper strips rain out
// underneath and the counter goes up. The words are never saved.
(function () {
  const T = {
    ko: { title: "마음 분쇄기", hint: "놓아주고 싶은 오늘의 마음을 적고, 종이를 뜯어 분쇄기에 넣어 주세요. 이 글은 저장되지 않아요.", ph: "여기에 적어 주세요…", tear: "✂ 뜯어서 분쇄하기", file: "텍스트 파일 불러오기", close: "내려놓기", drag: "종이를 잡아끌어 분쇄기에 넣어도 돼요", empty: "먼저 마음을 적어 주세요", done: "잘 보냈어요. 오늘 {n}장째", machine: "MIND SHREDDER" },
    zh: { title: "心情碎纸机", hint: "写下今天想放下的心情，把这页纸撕下来放进碎纸机。这些字不会被保存。", ph: "写在这里……", tear: "✂ 撕下来碎掉", file: "导入文本文件", close: "放下", drag: "也可以直接拖动纸张放进碎纸机", empty: "先写下想放下的心情吧", done: "已经放下了。今天第 {n} 张", machine: "MIND SHREDDER" },
    en: { title: "Mood shredder", hint: "Write what you want to let go of today, tear the page off and feed it to the shredder. It is never saved.", ph: "Write it here…", tear: "✂ Tear off & shred", file: "Load a text file", close: "Put down", drag: "You can also drag the page into the slot", empty: "Write something first", done: "Let go. Page {n} today", machine: "MIND SHREDDER" }
  };
  const lang = () => { const l = document.getElementById("lang")?.value || "ko"; return T[l] ? l : "ko"; };
  const t = () => T[lang()];
  const css = document.createElement("style");
  css.textContent = `
#shredRoom{position:fixed;inset:0;z-index:30;background:linear-gradient(90deg,rgba(10,6,3,.55),rgba(10,6,3,.25) 45%,rgba(10,6,3,.5));opacity:0;transition:opacity .4s;overflow:hidden}
#shredRoom.on{opacity:1}
#shredRoom .sr-pad{position:absolute;left:max(24px,9vw);top:50%;width:min(420px,40vw);transform:translate(-30px,-50%) rotate(-2deg);opacity:0;transition:transform .6s cubic-bezier(.2,.8,.2,1),opacity .5s}
#shredRoom.on .sr-pad{transform:translate(0,-50%) rotate(-2deg);opacity:1}
#shredRoom .sr-binding{height:26px;border-radius:3px 3px 0 0;background:linear-gradient(#8b2f24,#6b231b);box-shadow:0 3px 5px rgba(0,0,0,.35)}
#shredRoom .sr-stack{position:relative}
#shredRoom .sr-stack:before,#shredRoom .sr-stack:after{content:"";position:absolute;left:4px;right:-3px;bottom:-5px;height:100%;background:#e6d48d;z-index:-1;border-radius:0 0 3px 3px;box-shadow:0 20px 40px rgba(0,0,0,.5)}
#shredRoom .sr-stack:after{left:8px;right:-6px;bottom:-9px;background:#dccb85}
.sr-page{position:relative;height:min(460px,58vh);padding:30px 24px 20px 64px;color:#24201a;font-family:'Diary Hand','Nanum Pen Script',cursive;
  background-color:#f2e19b;background-image:linear-gradient(90deg,transparent 46px,rgba(196,72,60,.55) 46px,rgba(196,72,60,.55) 48px,transparent 48px),repeating-linear-gradient(transparent 0 31px,rgba(82,112,150,.34) 31px 32px),radial-gradient(ellipse at 30% 20%,rgba(255,250,215,.5),transparent 60%);
  border-top:2px dotted rgba(80,60,30,.35);cursor:grab;user-select:none}
.sr-page h3{margin:0 0 2px;font:400 36px/40px inherit;font-family:inherit}
.sr-page p{margin:0 0 8px;font-size:19px;line-height:32px;color:#5d4c30}
.sr-page textarea{width:100%;height:calc(100% - 120px);border:none;background:transparent;resize:none;outline:none;font:400 26px/32px 'Diary Hand','Nanum Pen Script',cursive;color:#1d2846;cursor:text}
.sr-sheet{position:fixed;z-index:33;pointer-events:none;box-shadow:0 18px 40px rgba(0,0,0,.45);clip-path:polygon(0 3px,4% 0,8% 4px,12% 1px,16% 5px,20% 0,24% 3px,28% 1px,32% 5px,36% 0,40% 4px,44% 1px,48% 5px,52% 0,56% 3px,60% 1px,64% 5px,68% 0,72% 4px,76% 1px,80% 5px,84% 0,88% 3px,92% 1px,96% 4px,100% 0,100% 100%,0 100%)}
#shredRoom .sr-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px;transform:rotate(2deg)}
#shredRoom button{padding:10px 15px;border:1px solid #d7b37466;border-radius:20px;background:#120d0add;color:#f2e4cd;font:600 12px/1 "SFMono-Regular",Menlo,Consolas,monospace;letter-spacing:.08em;cursor:pointer}
#shredRoom button.main{background:#e9be7a;color:#1b130c;border-color:#e9be7a}
#shredRoom .sr-note{margin-top:10px;color:#f2e4cd;font:600 11px/1.4 "SFMono-Regular",Menlo,Consolas,monospace;letter-spacing:.06em;text-shadow:0 1px 3px #000;transform:rotate(2deg);min-height:15px}
#shredRoom .sr-machine{position:absolute;right:max(30px,9vw);top:44%;width:min(380px,34vw);transform:translateY(30px);opacity:0;transition:transform .6s .1s cubic-bezier(.2,.8,.2,1),opacity .5s .1s}
#shredRoom.on .sr-machine{transform:none;opacity:1}
#shredRoom .sr-feed{position:absolute;left:4%;right:4%;bottom:calc(100% - 15px);height:70vh;overflow:hidden;pointer-events:none}
#shredRoom .sr-body{position:relative;height:110px;border-radius:16px 16px 12px 12px;background:linear-gradient(#2c2c2e,#161618 45%,#0e0e10);box-shadow:0 30px 50px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.12),inset 0 -3px 0 rgba(0,0,0,.6)}
#shredRoom .sr-top{position:absolute;left:0;right:0;top:0;height:30px;border-radius:16px 16px 0 0;background:linear-gradient(#3a3a3d,#202022);box-shadow:inset 0 1px 0 rgba(255,255,255,.15)}
#shredRoom .sr-slot{position:absolute;left:6%;right:6%;top:11px;height:9px;border-radius:5px;background:#020202;box-shadow:inset 0 2px 3px #000,0 1px 0 rgba(255,255,255,.08);transition:box-shadow .3s}
#shredRoom.shredding .sr-slot{box-shadow:inset 0 2px 3px #000,0 0 18px 4px rgba(255,70,40,.55),0 0 40px rgba(255,70,40,.35)}
#shredRoom .sr-label{position:absolute;left:22px;bottom:26px;color:#8a8a8e;font:700 11px/1 "SFMono-Regular",Menlo,Consolas,monospace;letter-spacing:.22em}
#shredRoom .sr-count{position:absolute;right:46px;bottom:20px;width:58px;height:30px;border-radius:5px;background:#050806;box-shadow:inset 0 1px 4px #000;color:#5df08a;font:600 20px/30px "SFMono-Regular",Menlo,Consolas,monospace;text-align:center;text-shadow:0 0 8px rgba(93,240,138,.7);letter-spacing:.1em}
#shredRoom .sr-led{position:absolute;right:22px;bottom:31px;width:9px;height:9px;border-radius:50%;background:#e3a233;box-shadow:0 0 8px #e3a233}
#shredRoom.shredding .sr-led{background:#ff4a2a;box-shadow:0 0 10px #ff4a2a}
#shredRoom .sr-mouth{position:absolute;left:8%;right:8%;bottom:-2px;height:6px;border-radius:0 0 6px 6px;background:#050505}
#shredRoom .sr-machine.hot .sr-body{box-shadow:0 30px 50px rgba(0,0,0,.6),0 0 0 2px rgba(233,190,122,.6),inset 0 1px 0 rgba(255,255,255,.12)}
#shredRoom canvas{position:absolute;inset:0;pointer-events:none}
@media (max-width:820px){#shredRoom .sr-pad{left:12px;top:36%;width:calc(100vw - 24px)}#shredRoom .sr-page{height:42vh}#shredRoom .sr-machine{right:50%;top:auto;bottom:90px;width:300px;margin-right:-150px}}`;
  document.head.appendChild(css);

  let root, canvas, ctx2, strips = [], raf = 0, busy = false, audio = null;
  function build() {
    root = document.createElement("div"); root.id = "shredRoom"; root.hidden = true;
    root.innerHTML = `<canvas></canvas><div class="sr-pad"><div class="sr-binding"></div><div class="sr-stack"><div class="sr-page"></div></div>
      <div class="sr-actions"><button class="main" data-a="tear"></button><button data-a="file"></button><button data-a="close"></button></div><div class="sr-note"></div></div>
      <div class="sr-machine"><div class="sr-feed"></div><div class="sr-body"><div class="sr-top"><div class="sr-slot"></div></div><div class="sr-label"></div><div class="sr-count">00</div><div class="sr-led"></div><div class="sr-mouth"></div></div></div>`;
    document.body.appendChild(root);
    canvas = root.querySelector("canvas"); ctx2 = canvas.getContext("2d");
    const fileIn = document.createElement("input"); fileIn.type = "file"; fileIn.accept = ".txt,text/plain"; fileIn.hidden = true; root.appendChild(fileIn);
    fileIn.onchange = async () => { const f = fileIn.files[0]; fileIn.value = ""; if (!f) return; const ta = root.querySelector("textarea"); ta.value = (await f.text()).slice(0, 4000); };
    root.querySelector("[data-a=tear]").onclick = () => tearAndShred();
    root.querySelector("[data-a=file]").onclick = () => fileIn.click();
    root.querySelector("[data-a=close]").onclick = close;
    root.addEventListener("pointerdown", e => { if (e.target === root || e.target === canvas) close(); });
    document.addEventListener("keydown", e => { if (!root.hidden && e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); close(); } }, true);
    window.addEventListener("resize", sizeCanvas);
  }
  function sizeCanvas() { if (!canvas) return; canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio; ctx2.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); }
  function freshPage() {
    const tt = t(), page = root.querySelector(".sr-page");
    page.innerHTML = `<h3>${tt.title}</h3><p>${tt.hint}</p><textarea placeholder="${tt.ph}"></textarea>`;
    page.onpointerdown = startDrag;
  }
  function labels() {
    const tt = t();
    root.querySelector("[data-a=tear]").textContent = tt.tear; root.querySelector("[data-a=file]").textContent = tt.file; root.querySelector("[data-a=close]").textContent = tt.close + " · Esc";
    root.querySelector(".sr-label").textContent = tt.machine; root.querySelector(".sr-note").textContent = tt.drag;
    root.querySelector(".sr-count").textContent = String(window.roomShredBridge?.count?.() || 0).padStart(2, "0");
  }
  // --- tearing: the written page becomes a loose sheet; the pad gets a fresh page ---
  function tearOff() {
    const page = root.querySelector(".sr-page"), ta = page.querySelector("textarea"), text = ta.value.trim();
    if (!text) { root.querySelector(".sr-note").textContent = t().empty; ta.focus(); return null; }
    const r = page.getBoundingClientRect(), sheet = page.cloneNode(true);
    sheet.classList.add("sr-sheet"); sheet.querySelector("textarea").value = ta.value; sheet.querySelector("textarea").readOnly = true;
    Object.assign(sheet.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", margin: 0, transformOrigin: "50% 0" });
    document.body.appendChild(sheet); tearSound();
    sheet.animate([{ transform: "rotate(-2deg)" }, { transform: "rotate(-5deg) translateY(-8px)" }, { transform: "rotate(-3deg) translateY(-14px)" }], { duration: 260, fill: "forwards", easing: "ease-out" });
    freshPage();
    root.querySelector(".sr-page").animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
    return { sheet, rect: r };
  }
  function slotRect() { return root.querySelector(".sr-slot").getBoundingClientRect(); }
  function startDrag(e) {
    if (busy || e.target.tagName === "TEXTAREA" || e.button > 0) return;
    const x0 = e.clientX, y0 = e.clientY; let torn = null, ox = 0, oy = 0;
    const move = ev => {
      if (!torn) { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 14) return; torn = tearOff(); if (!torn) { end(); return; } ox = x0 - torn.rect.left; oy = y0 - torn.rect.top; busy = true; }
      const s = torn.sheet; s.getAnimations().forEach(a => a.cancel());
      const sr = slotRect(), over = ev.clientX > sr.left - 60 && ev.clientX < sr.right + 60 && ev.clientY > sr.top - 260 && ev.clientY < sr.bottom + 60;
      root.querySelector(".sr-machine").classList.toggle("hot", over);
      s.style.left = ev.clientX - ox + "px"; s.style.top = ev.clientY - oy + "px"; s.style.transform = `rotate(${Math.max(-12, Math.min(12, (ev.clientX - x0) * .02))}deg) scale(.82)`;
    };
    const end = ev => {
      removeEventListener("pointermove", move); removeEventListener("pointerup", end);
      if (!torn) return;
      root.querySelector(".sr-machine").classList.remove("hot");
      feed(torn.sheet);
    };
    addEventListener("pointermove", move); addEventListener("pointerup", end);
  }
  function tearAndShred() { if (busy) return; const torn = tearOff(); if (!torn) return; busy = true; setTimeout(() => feed(torn.sheet), 300); }
  // --- feeding: fly over the slot, then slide down into it while strips fall out ---
  function feed(sheet) {
    const sr = slotRect(), w = sr.width * .92, scale = w / sheet.offsetWidth, h = sheet.offsetHeight * scale;
    const W0 = sheet.offsetWidth, H0 = sheet.offsetHeight, from = sheet.getBoundingClientRect();
    sheet.getAnimations().forEach(a => a.cancel());
    Object.assign(sheet.style, { left: sheet.style.left || from.left + "px", top: sheet.style.top || from.top + "px", width: W0 + "px", height: H0 + "px", transformOrigin: "0 0" });
    const x0 = parseFloat(sheet.style.left), y0 = parseFloat(sheet.style.top), s0 = from.width / W0 || 1;
    const tx = sr.left + (sr.width - w) / 2, ty = sr.top - h + 6;
    const fly = sheet.animate([{ left: x0 + "px", top: y0 + "px", transform: `scale(${s0}) rotate(-4deg)` },
      { left: tx + "px", top: ty + "px", transform: `scale(${scale}) rotate(0deg)` }], { duration: 650, easing: "cubic-bezier(.3,.7,.2,1)", fill: "forwards" });
    fly.onfinish = () => {
      const feedBox = root.querySelector(".sr-feed"), fr = feedBox.getBoundingClientRect();
      sheet.getAnimations().forEach(a => a.cancel());
      Object.assign(sheet.style, { position: "absolute", left: tx - fr.left + "px", top: ty - fr.top + "px", transform: `scale(${scale})` });
      feedBox.appendChild(sheet);
      root.classList.add("shredding"); motorSound(2.2);
      const dur = 2100, start = performance.now();
      const step = now => {
        const k = Math.min(1, (now - start) / dur), y = (ty - fr.top) + k * (h + 10);
        sheet.style.top = y + "px"; sheet.style.transform = `translateX(${Math.sin(now * .09) * .8}px) scale(${scale})`;
        if (k < 1) { emitStrips(sr, w, 3); requestAnimationFrame(step); }
        else { sheet.remove(); root.classList.remove("shredding"); busy = false; const n = window.roomShredBridge?.add?.() || 0; root.querySelector(".sr-count").textContent = String(n).padStart(2, "0"); root.querySelector(".sr-note").textContent = t().done.replace("{n}", n); }
      };
      requestAnimationFrame(step);
    };
  }
  const STRIP_COLORS = ["#f2e19b", "#ecd88c", "#f5e7ae", "#e4cf80"];
  function emitStrips(sr, w, n) {
    const mouth = root.querySelector(".sr-mouth").getBoundingClientRect();
    for (let i = 0; i < n; i++) {
      strips.push({ x: mouth.left + Math.random() * mouth.width, y: mouth.bottom - 4, vx: (Math.random() - .5) * 1.6, vy: 1 + Math.random() * 1.5, rot: (Math.random() - .5) * .5, vr: (Math.random() - .5) * .12, w: 4 + Math.random() * 4, h: 26 + Math.random() * 50,
        c: STRIP_COLORS[Math.random() * STRIP_COLORS.length | 0], ink: Math.random() < .55, line: Math.random() < .5, life: 0, rest: false });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick() {
    raf = 0; const H = innerHeight; ctx2.clearRect(0, 0, innerWidth, H);
    strips = strips.filter(s => s.life < 520);
    for (const s of strips) {
      s.life++;
      if (!s.rest) { s.vy += .22; s.vx *= .99; s.x += s.vx + Math.sin(s.life * .15 + s.h) * .6; s.y += s.vy; s.rot += s.vr; if (s.y > H - 12 - Math.random() * 30) { s.rest = true; s.rot = Math.PI / 2 + (Math.random() - .5) * 1.2; } }
      const fade = s.life > 400 ? 1 - (s.life - 400) / 120 : 1;
      ctx2.save(); ctx2.globalAlpha = fade; ctx2.translate(s.x, s.y); ctx2.rotate(s.rot);
      ctx2.fillStyle = s.c; ctx2.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
      if (s.line) { ctx2.fillStyle = "rgba(82,112,150,.5)"; ctx2.fillRect(-s.w / 2, -s.h / 2 + s.h * .4, s.w, 1); }
      if (s.ink) { ctx2.fillStyle = "#1d2846"; ctx2.fillRect(-s.w / 2 + 1, -s.h / 2 + s.h * (.2 + (s.h % .5)), s.w - 2, 2 + (s.w % 3)); }
      ctx2.restore();
    }
    if (strips.length) raf = requestAnimationFrame(tick);
  }
  // --- sounds (Web Audio, generated) ---
  function ac() { if (!audio) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; audio = new C(); } audio.resume?.(); return audio; }
  function noiseBuf(a, s) { const b = a.createBuffer(1, a.sampleRate * s, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
  function tearSound() {
    const a = ac(); if (!a) return; const t0 = a.currentTime, src = a.createBufferSource(); src.buffer = noiseBuf(a, .35);
    const f = a.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 2600; f.Q.value = .8; const g = a.createGain();
    for (let i = 0; i < 14; i++) { const tt = t0 + i * .018; g.gain.setValueAtTime(.05 + Math.random() * .09, tt); g.gain.setValueAtTime(.01, tt + .009); }
    g.gain.linearRampToValueAtTime(0, t0 + .3); src.connect(f).connect(g).connect(a.destination); src.start();
  }
  function motorSound(sec) {
    const a = ac(); if (!a) return; const t0 = a.currentTime;
    const o = a.createOscillator(); o.type = "sawtooth"; o.frequency.value = 92; const og = a.createGain(); og.gain.value = .025;
    const src = a.createBufferSource(); src.buffer = noiseBuf(a, sec + .3); const f = a.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1400; f.Q.value = .6;
    const g = a.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.11, t0 + .08); g.gain.setValueAtTime(.11, t0 + sec - .15); g.gain.linearRampToValueAtTime(0, t0 + sec);
    const lfo = a.createOscillator(); lfo.frequency.value = 23; const lg = a.createGain(); lg.gain.value = .04; lfo.connect(lg).connect(g.gain);
    o.connect(og).connect(g); src.connect(f).connect(g); g.connect(a.destination);
    o.start(t0); src.start(t0); lfo.start(t0); o.stop(t0 + sec + .05); src.stop(t0 + sec + .05); lfo.stop(t0 + sec + .05);
  }
  function open() {
    if (!root) build();
    sizeCanvas(); freshPage(); labels(); root.hidden = false; requestAnimationFrame(() => root.classList.add("on"));
    document.getElementById("hoverTag")?.classList.remove("on");
    setTimeout(() => root.querySelector("textarea")?.focus(), 500);
  }
  function close() {
    if (!root || busy) return; root.classList.remove("on");
    setTimeout(() => { root.hidden = true; strips = []; ctx2.clearRect(0, 0, innerWidth, innerHeight); }, 400);
  }
  window.openRoomShredder = open;
  document.getElementById("lang")?.addEventListener("change", () => { if (root && !root.hidden) { labels(); } });
})();
