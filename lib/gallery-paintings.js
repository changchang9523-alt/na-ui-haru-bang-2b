// Mood gallery (v46): seven framed paintings, Monday to Sunday, hung on the
// three tapestry walls of the drawing room. Each day's painting is chosen from
// lib/painting-library.js by the mood found in that day's diary. Clicking a
// painting moves the camera to it and opens the day's diary notebook.
window.initGalleryPaintings = function () {
  const H = window.__galleryHooks;
  const lib = window.MoodPaintings;
  if (!H || !lib) return;
  const { THREE, galleryWorld, camera, controls, render } = H;

  // Tapestry centres and inward wall normals, measured in the gallery model.
  // Days read left to right: Mon-Wed, Thu-Fri, Sat-Sun.
  const walls = [
    { c: [3.57, 2.25, 0.52], n: [-0.67, 0, -0.745], days: [0, 1, 2], gap: 0.12 },
    { c: [0.09, 2.25, 3.63], n: [-0.67, 0, -0.745], days: [3, 4], gap: 0.26 },
    { c: [-2.42, 2.22, 3.66], n: [0.74, 0, -0.67], days: [5, 6], gap: 0.26 }
  ];
  // Carved, aged baroque frame (assets/paintings/baroque-frame.webp, 900x1200).
  // Its transparent opening is (176,176)-(724,1024); ornaments may reach 26px
  // past the moulding, so the solid back board is a little smaller than the plane.
  const CW = 900, CH = 1200, OX0 = 176, OY0 = 176, OX1 = 724, OY1 = 1024, FM = 26;
  const FW = 0.80, FH = FW * CH / CW;     // plane size in metres
  const L = {
    days: { zh: ["周一","周二","周三","周四","周五","周六","周日"], ko: ["월요일","화요일","수요일","목요일","금요일","토요일","일요일"], en: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"] },
    empty: { zh: "这一天还没有写日记", ko: "이날은 아직 일기가 없어요", en: "No diary for this day yet" },
    emptyShort: { zh: "未记录", ko: "기록 없음", en: "No entry" },
    diary: { zh: "日记", ko: "일기", en: "Diary" },
    thoughts: { zh: "想法", ko: "생각", en: "Thoughts" },
    drawing: { zh: "那天画的画", ko: "그날의 그림", en: "That day's drawing" },
    close: { zh: "返回画廊", ko: "갤러리로 돌아가기", en: "Back to gallery" },
    weekdays: { zh: ["星期一","星期二","星期三","星期四","星期五","星期六","星期日"] },
    weather: { sunny: { zh: "晴", ko: "맑음", en: "Sunny" }, cloudy: { zh: "多云", ko: "흐림", en: "Cloudy" }, rain: { zh: "雨", ko: "비", en: "Rain" }, snow: { zh: "雪", ko: "눈", en: "Snow" }, haze: { zh: "雾霾", ko: "미세먼지", en: "Haze" } },
    because: { zh: "根据这一天的日记，画廊挂上了代表「{m}」的画。", ko: "이날의 일기에서 「{m}」의 감정이 읽혀 이 그림을 걸었어요.", en: "This day's diary reads as \"{m}\", so this painting hangs here." }
  };
  const t = (k, lang) => (L[k][lang] || L[k].zh);
  const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const esc = s => String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- painting images ----------
  const imageCache = {};
  function loadImage(url) {
    return new Promise((ok, no) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => ok(im); im.onerror = no; im.src = url; });
  }
  function paintingImage(key) {
    if (imageCache[key]) return imageCache[key];
    const p = lib.paintings[key];
    const tryLocal = () => p.local ? window.roomAssetURL(p.local).then(loadImage) : Promise.reject();
    const tryRemote = () => p.remote ? loadImage(p.remote) : Promise.reject();
    imageCache[key] = tryLocal().catch(tryRemote).catch(() => null);
    return imageCache[key];
  }

  // ---------- baroque frame composed on a canvas ----------
  const framePromise = window.roomAssetURL("assets/paintings/baroque-frame.webp").then(loadImage).catch(() => null);
  let linenPattern = null;
  function linen(x) {
    if (linenPattern) return linenPattern;
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d"); g.fillStyle = "#3a2e22"; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 128; i += 2) {
      g.fillStyle = `rgba(${i % 4 ? "20,14,8" : "120,98,70"},${.10 + Math.random() * .10})`; g.fillRect(0, i, 128, 1);
      g.fillStyle = `rgba(${i % 4 ? "120,98,70" : "20,14,8"},${.06 + Math.random() * .08})`; g.fillRect(i, 0, 1, 128);
    }
    return (linenPattern = x.createPattern(c, "repeat"));
  }
  function drawFrame(img, frameImg, lang, empty) {
    const c = document.createElement("canvas"); c.width = CW; c.height = CH;
    const x = c.getContext("2d");
    // aged linen liner behind the opening (slightly under the moulding)
    const lx = OX0 - 14, ly = OY0 - 14, lw = OX1 - OX0 + 28, lh = OY1 - OY0 + 28;
    x.fillStyle = linen(x); x.fillRect(lx, ly, lw, lh);
    const vg = x.createRadialGradient(CW / 2, CH / 2, 120, CW / 2, CH / 2, 560);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(10,6,2,.55)");
    x.fillStyle = vg; x.fillRect(lx, ly, lw, lh);
    const ax = OX0 + 20, ay = OY0 + 20, aw = OX1 - OX0 - 40, ah = OY1 - OY0 - 40;
    if (img) {
      const s = Math.min(aw / img.width, ah / img.height), w = img.width * s, h = img.height * s;
      const px = Math.round(ax + (aw - w) / 2), py = Math.round(ay + (ah - h) / 2);
      x.fillStyle = "rgba(0,0,0,.45)"; x.fillRect(px - 6, py - 2, w + 16, h + 16);
      const slip = x.createLinearGradient(px, py, px + w, py + h);
      slip.addColorStop(0, "#7a5a26"); slip.addColorStop(.3, "#c9a45a"); slip.addColorStop(.6, "#8a6a32"); slip.addColorStop(1, "#b99550");
      x.fillStyle = slip; x.fillRect(px - 9, py - 9, w + 18, h + 18);
      x.drawImage(img, px, py, w, h);
      // old varnish: warm, slightly darkened edges
      const vv = x.createRadialGradient(px + w / 2, py + h / 2, Math.min(w, h) * .25, px + w / 2, py + h / 2, Math.max(w, h) * .75);
      vv.addColorStop(0, "rgba(120,80,20,.04)"); vv.addColorStop(1, "rgba(60,36,8,.32)");
      x.fillStyle = vv; x.fillRect(px, py, w, h);
    } else {
      x.fillStyle = "rgba(226,206,160,.55)"; x.textAlign = "center";
      x.font = "500 44px Georgia, 'Songti SC', 'Noto Serif KR', serif";
      x.fillText(empty ? t("emptyShort", lang) : "…", CW / 2, CH / 2 + 14);
    }
    if (frameImg) x.drawImage(frameImg, 0, 0, CW, CH);
    else { x.strokeStyle = "#8c6a33"; x.lineWidth = 150; x.strokeRect(FM + 75, FM + 75, CW - 2 * FM - 150, CH - 2 * FM - 150); }
    return c;
  }
  function drawPlaque(text1, text2) {
    const c = document.createElement("canvas"); c.width = 512; c.height = 128;
    const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, "#d9bc7c"); g.addColorStop(.5, "#a9874a"); g.addColorStop(1, "#7c5e2c");
    x.fillStyle = g; x.fillRect(0, 0, 512, 128);
    x.strokeStyle = "rgba(60,40,12,.6)"; x.lineWidth = 4; x.strokeRect(6, 6, 500, 116);
    x.fillStyle = "#2e200c"; x.textAlign = "center";
    x.font = "600 40px Georgia, 'Songti SC', 'Noto Serif KR', serif"; x.fillText(text1, 256, 58);
    x.font = "400 30px Georgia, 'Songti SC', 'Noto Serif KR', serif"; x.fillText(text2, 256, 100);
    return c;
  }
  function texture(canvas) { const tx = new THREE.CanvasTexture(canvas); tx.encoding = THREE.sRGBEncoding; tx.anisotropy = 8; return tx; }

  // ---------- build the seven frames ----------
  const group = new THREE.Group(); group.name = "mood paintings"; galleryWorld.add(group);
  const slots = [];
  const backMat = new THREE.MeshBasicMaterial({ color: 0x2a1c0c });
  for (const w of walls) {
    const n = new THREE.Vector3(...w.n).normalize();
    const right = new THREE.Vector3(n.z, 0, -n.x).normalize();
    const count = w.days.length, step = FW + w.gap;
    w.days.forEach((dayIndex, i) => {
      const off = (i - (count - 1) / 2) * step;
      const centre = new THREE.Vector3(...w.c).addScaledVector(right, off).addScaledVector(n, 0.07);
      const slot = new THREE.Group(); slot.position.copy(centre); slot.lookAt(centre.clone().add(n)); group.add(slot);
      const back = new THREE.Mesh(new THREE.BoxGeometry(FW * (CW - 2 * FM) / CW, FH * (CH - 2 * FM) / CH, 0.05), backMat); back.position.z = -0.027; slot.add(back);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(FW, FH), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, alphaTest: 0.5 }));
      face.position.z = 0.001; slot.add(face);
      const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.07), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      plaque.position.set(0, -FH / 2 - 0.07, 0.0); slot.add(plaque);
      face.userData.slotIndex = dayIndex;
      slots[dayIndex] = { slot, face, plaque, centre, n, record: null, mood: null, date: "" };
    });
  }

  let current = { lang: "zh", day: "" };
  async function refresh() {
    let data = { day: "", lang: "zh", records: [], draft: null };
    try { data = await window.galleryWeekData(); } catch (e) {}
    const lang = data.lang || "zh";
    const base = new Date((data.day || iso(new Date())) + "T12:00:00");
    const monday = new Date(base); monday.setDate(base.getDate() - ((base.getDay() + 6) % 7));
    const map = new Map((data.records || []).map(r => [r.date, r]));
    if (data.draft && data.draft.date) map.set(data.draft.date, Object.assign({}, map.get(data.draft.date) || {}, data.draft));
    current = { lang, day: data.day };
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      const date = iso(d), record = map.get(date) || null, mood = lib.detectMood(record), s = slots[i];
      s.record = record; s.mood = mood; s.date = date;
      const label = t("days", lang)[i] + "  " + (d.getMonth() + 1) + "." + d.getDate();
      const moodName = mood ? lib.moods[mood][lang] || lib.moods[mood].zh : t("emptyShort", lang);
      s.plaque.material.map?.dispose(); s.plaque.material.map = texture(drawPlaque(label, moodName)); s.plaque.material.needsUpdate = true;
      const want = mood;
      const setFace = (img, fr) => { if (s.mood !== want) return; s.face.material.map?.dispose(); s.face.material.map = texture(drawFrame(img, fr, lang, !mood)); s.face.material.needsUpdate = true; render(); };
      framePromise.then(fr => { setFace(null, fr); if (mood) paintingImage(mood).then(img => img && setFace(img, fr)); });
    }
    render();
  }

  // ---------- hover, click and focus ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), el = H.renderer.domElement;
  const faces = () => slots.map(s => s.face);
  function hit(e) {
    const r = el.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera); const h = ray.intersectObjects(faces(), false)[0];
    return h ? h.object.userData.slotIndex : -1;
  }
  let hovered = -1, down = null, focused = -1, tween = 0, saved = null;
  el.addEventListener("pointermove", e => {
    if (!H.isActive() || focused >= 0) return;
    const i = hit(e); if (i === hovered) return;
    if (hovered >= 0) slots[hovered].slot.scale.setScalar(1);
    hovered = i; if (i >= 0) slots[i].slot.scale.setScalar(1.035);
    el.style.cursor = i >= 0 ? "pointer" : ""; render();
  });
  el.addEventListener("pointerdown", e => { down = { x: e.clientX, y: e.clientY }; });
  el.addEventListener("pointerup", e => {
    if (!H.isActive() || focused >= 0 || !down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
    if (moved > 6) return;
    const i = hit(e); if (i >= 0) focus(i);
  });
  function animateCamera(toPos, toTarget, ms, done) {
    cancelAnimationFrame(tween);
    const p0 = camera.position.clone(), t0 = controls.target.clone(), start = performance.now();
    controls.enabled = false;
    const step = now => {
      const k = Math.min(1, (now - start) / ms), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      camera.position.lerpVectors(p0, toPos, e); controls.target.lerpVectors(t0, toTarget, e); camera.lookAt(controls.target); render();
      if (k < 1) tween = requestAnimationFrame(step); else { controls.enabled = true; done && done(); }
    };
    tween = requestAnimationFrame(step);
  }
  function focus(i) {
    const s = slots[i]; focused = i;
    if (hovered >= 0) { slots[hovered].slot.scale.setScalar(1); hovered = -1; el.style.cursor = ""; }
    saved = { pos: camera.position.clone(), target: controls.target.clone(), min: controls.minDistance, max: controls.maxDistance };
    controls.minDistance = .2; controls.maxDistance = 3;
    const to = s.centre.clone().addScaledVector(s.n, 1.6); to.y -= 0.08;
    animateCamera(to, s.centre.clone(), 900, () => openNotebook(i));
  }
  function unfocus() {
    const shade = document.getElementById("mpShade"); if (shade) { shade.classList.remove("open"); setTimeout(() => shade.remove(), 380); }
    if (!saved) { focused = -1; return; }
    const back = saved; saved = null;
    animateCamera(back.pos, back.target, 800, () => { controls.minDistance = back.min; controls.maxDistance = back.max; focused = -1; });
  }
  H.onLeave = () => { const shade = document.getElementById("mpShade"); if (shade) shade.remove(); if (saved) { camera.position.copy(saved.pos); controls.target.copy(saved.target); controls.minDistance = saved.min; controls.maxDistance = saved.max; saved = null; } controls.enabled = true; focused = -1; };

  // ---------- vintage diary overlay ----------
  // Handwriting font bundled with the page so Korean (and Latin) renders offline.
  window.roomAssetURL("assets/fonts/NanumPenScript-Regular.woff2")
    .then(u => new FontFace("Diary Hand", `url("${u}")`).load())
    .then(f => document.fonts.add(f)).catch(() => {});
  // Kraft paper fibre texture, drawn once.
  const KRAFT = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
    const im = g.createImageData(256, 256);
    for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 40; im.data[i] = 90 + v; im.data[i + 1] = 60 + v * .8; im.data[i + 2] = 28 + v * .5; im.data[i + 3] = 26; }
    g.putImageData(im, 0, 0);
    for (let k = 0; k < 420; k++) {
      const x = Math.random() * 256, y = Math.random() * 256, a = Math.random() * Math.PI, l = 4 + Math.random() * 16;
      g.strokeStyle = Math.random() < .5 ? "rgba(70,40,12,.22)" : "rgba(235,205,160,.20)"; g.lineWidth = .6 + Math.random() * .7;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l / 2 + Math.random() * 3, y + Math.sin(a) * l / 2, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    try { return c.toDataURL("image/png"); } catch (e) { return ""; }
  })();
  const HAND = "'Diary Hand','Nanum Pen Script','Ma Shan Zheng','HanziPen SC','Hannotate SC','Kaiti SC','STKaiti','KaiTi',cursive";
  const css = document.createElement("style");
  css.textContent = `
  .mp-shade{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:56px 28px 28px;background:rgba(14,10,6,.74);backdrop-filter:blur(6px);opacity:0;transition:opacity .38s ease}
  .mp-shade.open{opacity:1}
  .mp-card{position:relative;display:grid;grid-template-columns:minmax(0,.78fr) minmax(0,1.5fr);gap:36px;align-items:center;width:min(1300px,100%);max-height:calc(100vh - 84px);transform:translateY(14px) scale(.98);transition:transform .45s cubic-bezier(.2,.7,.2,1)}
  .mp-shade.open .mp-card{transform:none}
  .mp-art{margin:0;display:flex;flex-direction:column;align-items:center;gap:12px;min-height:0}
  .mp-framed{display:block;max-width:100%;max-height:66vh;filter:drop-shadow(0 22px 34px rgba(0,0,0,.6))}
  .mp-frame{padding:18px;background:linear-gradient(135deg,#5e4119,#b8955a 28%,#7c5e2c 52%,#c4a464 76%,#4e3614);box-shadow:0 24px 60px rgba(0,0,0,.55)}
  .mp-frame img{display:block;max-width:100%;max-height:56vh}
  .mp-cap{margin:0;color:#ead9b6;text-align:center;font:400 15px/1.55 Georgia,'Songti SC','Noto Serif KR',serif;max-width:440px}
  .mp-cap b{display:inline-block;margin-bottom:2px;padding:2px 12px;border:1px solid #d6b47388;border-radius:20px;color:#f3d79b;font-weight:600;letter-spacing:.06em}
  .mp-cap i{color:#fff3da}
  .mp-cap small{display:block;margin-top:4px;color:#bba98a}
  .mp-book{position:relative;padding:16px 18px;border-radius:12px;
    background:radial-gradient(ellipse at 28% 18%,rgba(140,84,44,.55),transparent 60%),radial-gradient(ellipse at 80% 90%,rgba(20,8,2,.5),transparent 55%),linear-gradient(135deg,#5a3119,#3b1d0d);
    box-shadow:0 34px 80px rgba(0,0,0,.65),inset 0 0 0 2px rgba(0,0,0,.45),inset 0 0 36px rgba(0,0,0,.55);font-family:${HAND}}
  .mp-book:before{content:"";position:absolute;inset:7px;border:2px dashed rgba(214,170,110,.42);border-radius:8px;pointer-events:none}
  .mp-spread{position:relative;display:grid;grid-template-columns:1fr 1fr;border-radius:3px;box-shadow:0 2px 0 #b8936a,0 4px 0 #a9845b,0 6px 0 #987349,0 10px 14px rgba(0,0,0,.4)}
  .mp-spread:after{content:"";position:absolute;left:50%;top:0;bottom:0;width:2px;margin-left:-1px;background:rgba(70,40,14,.45);pointer-events:none}
  .mp-page{position:relative;height:min(64vh,600px);overflow:auto;padding:38px 32px 30px;color:#2a1c10;scrollbar-width:thin;scrollbar-color:#8a6538 transparent;
    --paper:radial-gradient(circle at 16% 24%,rgba(90,52,18,.22) 0 2px,transparent 8px),radial-gradient(circle at 70% 66%,rgba(90,52,18,.18) 0 3px,transparent 10px),
      radial-gradient(circle at 42% 88%,rgba(80,46,14,.16) 0 4px,transparent 14px),radial-gradient(ellipse at 84% 18%,rgba(96,58,22,.18),transparent 26%),
      url(${KRAFT}),radial-gradient(ellipse at 50% 45%,#cfae80 30%,#c09a68 80%,#a98353 100%);background:var(--paper)}
  .mp-left{border-radius:3px 0 0 3px;box-shadow:inset 0 0 50px rgba(70,40,12,.42),inset -34px 0 30px -18px rgba(50,28,8,.5)}
  .mp-right{border-radius:0 3px 3px 0;padding-left:48px;box-shadow:inset 0 0 50px rgba(70,40,12,.42),inset 34px 0 30px -18px rgba(50,28,8,.5)}
  .mp-lines{background:repeating-linear-gradient(transparent 0 37px,rgba(70,42,16,.34) 37px 38px) 0 0/100% 100% local,var(--paper)}
  .mp-date{margin:0;font-size:40px;line-height:44px;color:#24160b}
  .mp-dow{margin:2px 0 18px;font-size:28px;line-height:32px;color:#4e3118}
  .mp-stamp{float:right;display:flex;flex-direction:column;align-items:center;justify-content:center;width:112px;height:112px;margin:-6px -4px 6px 10px;border:3px double rgba(150,42,30,.72);border-radius:50%;color:rgba(150,42,30,.8);transform:rotate(-13deg);font:600 13px/1.25 Georgia,'Songti SC','Noto Serif KR',serif;letter-spacing:.14em;text-align:center;opacity:.86}
  .mp-stamp b{display:block;margin:3px 0;font-size:19px;letter-spacing:.06em}
  .mp-moodline{clear:both;margin:6px 0 0;font-size:27px;line-height:36px;color:#2b1c10}
  .mp-photo{position:relative;display:inline-block;margin:24px 0 8px 6px;padding:10px 10px 28px;background:#faf5ea;box-shadow:0 8px 18px rgba(60,30,10,.3);transform:rotate(-2.4deg)}
  .mp-photo:before,.mp-photo:after{content:"";position:absolute;width:74px;height:22px;background:rgba(226,206,150,.72);box-shadow:0 1px 2px rgba(0,0,0,.08)}
  .mp-photo:before{left:-20px;top:-6px;transform:rotate(-38deg)}
  .mp-photo:after{right:-20px;top:-6px;transform:rotate(36deg)}
  .mp-photo img{display:block;max-width:100%;max-height:210px;filter:sepia(.18) contrast(.96)}
  .mp-photo figcaption{position:absolute;left:0;right:0;bottom:4px;text-align:center;font-size:20px;color:#6b4a2e}
  .mp-artnote{margin:16px 0 0;font-size:22px;line-height:28px;color:#4e3118}
  .mp-label{margin:0;font-size:24px;line-height:38px;color:#7a2a14}
  .mp-text{margin:0 0 38px;white-space:pre-wrap;font-size:28px;line-height:38px;color:#1f1510}
  .mp-ring{position:absolute;right:28px;bottom:24px;width:120px;height:120px;border-radius:50%;box-shadow:inset 0 0 0 3px rgba(128,78,30,.14),inset 0 0 14px rgba(128,78,30,.12);pointer-events:none}
  .mp-ribbon{position:absolute;left:calc(50% + 14px);top:6px;bottom:-30px;width:16px;z-index:3;pointer-events:none;background:linear-gradient(90deg,#6a1010,#a82626 50%,#601010);clip-path:polygon(0 0,100% 0,100% 100%,50% calc(100% - 12px),0 100%);filter:drop-shadow(1px 2px 2px rgba(0,0,0,.4))}
  .mp-close{position:absolute;right:0;top:-46px;padding:8px 16px;border:1px solid #d7b37488;border-radius:22px;background:#17120fdd;color:#f2e4cd;font:600 14px system-ui;cursor:pointer}
  @media (max-width:900px){.mp-card{grid-template-columns:1fr;overflow:auto}.mp-framed{max-height:40vh}.mp-spread{grid-template-columns:1fr}.mp-spread:after,.mp-ribbon{display:none}.mp-page{height:auto;overflow:visible}.mp-right{padding-left:32px}}`;
  document.head.appendChild(css);

  function longDate(dateStr, lang, i) {
    const d = new Date(dateStr + "T12:00:00"), y = d.getFullYear(), m = d.getMonth() + 1, dd = d.getDate();
    if (lang === "ko") return [`${y}년 ${m}월 ${dd}일`, L.days.ko[i]];
    if (lang === "en") return [d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), L.days.en[i]];
    return [`${y}年${m}月${dd}日`, L.weekdays.zh[i]];
  }
  function framedPicture(s, lang) {
    // The same composed canvas that hangs on the wall, so the frame matches.
    return framePromise.then(fr => Promise.resolve(s.mood ? paintingImage(s.mood) : null).then(img => {
      try { return drawFrame(img, fr, lang, !s.mood).toDataURL("image/webp", 0.92); } catch (e) { return null; }
    }));
  }
  function openNotebook(i) {
    const s = slots[i], lang = current.lang, r = s.record, p = s.mood ? lib.paintings[s.mood] : null;
    const [dateText, dowText] = longDate(s.date, lang, i);
    const moodName = s.mood ? (lib.moods[s.mood][lang] || lib.moods[s.mood].zh) : "";
    const shade = document.createElement("div"); shade.id = "mpShade"; shade.className = "mp-shade";
    let art = `<img class="mp-framed" id="mpFramed" alt="">`;
    if (p) art += `<p class="mp-cap"><b>${esc(moodName)}</b><br><i>${esc(p.title[lang] || p.title.en)}</i> · ${esc(p.artist)}, ${esc(p.year)}<small>${esc(t("because", lang).replace("{m}", moodName))}</small></p>`;
    const wx = r && L.weather[r.weather];
    let left = `<p class="mp-date">${esc(dateText)}</p><p class="mp-dow">${esc(dowText)}</p>`;
    if (wx || moodName) left = `<div class="mp-stamp">${wx ? `<span>${esc(wx[lang] || wx.zh)}</span>` : ""}${moodName ? `<b>${esc(moodName)}</b>` : ""}<span>${esc(s.date.slice(5).replace("-", "."))}</span></div>` + left;
    if (r && r.mood) left += `<p class="mp-moodline">${esc(r.mood)}</p>`;
    if (r && r.drawing) left += `<figure class="mp-photo"><img src="${r.drawing}" alt=""><figcaption>${esc(t("drawing", lang))}</figcaption></figure>`;
    if (p) left += `<p class="mp-artnote">— ${esc(p.title[lang] || p.title.en)}, ${esc(p.artist)}</p>`;
    let right = "";
    if (r && r.diary) right += `<p class="mp-label">${esc(t("diary", lang))}</p><p class="mp-text">${esc(r.diary)}</p>`;
    if (r && r.thoughts) right += `<p class="mp-label">${esc(t("thoughts", lang))}</p><p class="mp-text">${esc(r.thoughts)}</p>`;
    if (!right) right = `<p class="mp-text">${esc(t("empty", lang))}</p>`;
    const book = `<div class="mp-book"><div class="mp-spread"><section class="mp-page mp-left">${left}</section><section class="mp-page mp-right mp-lines">${right}<div class="mp-ring"></div></section></div><div class="mp-ribbon"></div></div>`;
    shade.innerHTML = `<div class="mp-card" role="dialog" aria-modal="true"><button class="mp-close" type="button">← ${esc(t("close", lang))}</button><figure class="mp-art">${art}</figure>${book}</div>`;
    document.body.appendChild(shade);
    framedPicture(s, lang).then(url => {
      const im = document.getElementById("mpFramed"); if (!im) return;
      if (url) { im.src = url; return; }
      // Canvas could not be exported (remote image without CORS): plain gilt frame instead.
      const box = document.createElement("div"); box.className = "mp-frame"; const pi = document.createElement("img"); box.appendChild(pi); im.replaceWith(box);
      if (s.mood) paintingImage(s.mood).then(img => { if (img) pi.src = img.src; });
    });
    requestAnimationFrame(() => shade.classList.add("open"));
    shade.querySelector(".mp-close").onclick = unfocus;
    shade.addEventListener("click", e => { if (e.target === shade) unfocus(); });
  }
  document.addEventListener("keydown", e => { if (e.key === "Escape" && document.getElementById("mpShade")) unfocus(); });

  H.refreshPaintings = refresh;
  refresh();
  // Start fetching every painting early so the walls fill quickly.
  Object.keys(lib.paintings).forEach(k => setTimeout(() => paintingImage(k), 600));
};
