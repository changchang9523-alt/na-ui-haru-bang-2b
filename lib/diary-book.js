// v54: the desk diary as a real notebook. Clicking the diary (or N) lifts a
// white cloth-bound notebook up from the desk, the cover swings open, and you
// read / write on a two-page spread. ‹ › (or ← →, or the curled page corner)
// turn pages with a 3D page flip. Spread 1: the day's writing (left) and a
// drawing page (right). Following spreads: the day's developed photos, taped in.
// Esc, "Put down" or a click outside the book closes it and lays it back down.
(function () {
  const T = {
    ko: { title: "나의 하루", write: "오늘 있었던 일을 적어 보세요…", draw: "오늘의 그림", clear: "지우기", photos: "오늘의 사진", noPhotos: "아직 현상한 사진이 없어요.\n필름 카메라에서 사진을 현상하면 여기에 붙어요.", toDark: "사진 현상하러 가기", song: "오늘의 음악", put: "내려놓기", saved: "저장했어요", week: ["일", "월", "화", "수", "목", "금", "토"], w: { sunny: "맑음", rain: "비", snow: "눈", cloudy: "흐림", haze: "안개" } },
    zh: { title: "我的一天", write: "写下今天发生的事…", draw: "今天的画", clear: "擦掉", photos: "今天的照片", noPhotos: "还没有冲洗的照片。\n在胶片相机里冲洗照片后，会贴在这里。", toDark: "去冲洗照片", song: "今天的音乐", put: "放下", saved: "已保存", week: ["日", "一", "二", "三", "四", "五", "六"], w: { sunny: "晴", rain: "雨", snow: "雪", cloudy: "阴", haze: "雾" } },
    en: { title: "My Day", write: "Write about today…", draw: "Today's drawing", clear: "Clear", photos: "Photos of the day", noPhotos: "No developed photos yet.\nDevelop some with the film camera and they'll be taped in here.", toDark: "Develop photos", song: "Music of the day", put: "Put down", saved: "Saved", week: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], w: { sunny: "Clear", rain: "Rain", snow: "Snow", cloudy: "Cloudy", haze: "Haze" } }
  };
  const ICON = { sunny: "☀", rain: "☂", snow: "❄", cloudy: "☁", haze: "≋" };
  const B = () => window.roomDiaryBridge;
  const L = () => T[B()?.lang?.()] || T.ko;
  const esc = s => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  const css = `
  #diaryBook{position:fixed;inset:0;z-index:60;display:grid;place-items:center;perspective:2200px;font-family:var(--ui-font,system-ui)}
  #diaryBook[hidden]{display:none}
  #diaryBook .db-shade{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 55%,#0004,#000b);backdrop-filter:blur(7px) brightness(.8);opacity:0;transition:opacity .6s}
  #diaryBook.on .db-shade{opacity:1}
  #diaryBook .db-stage{position:relative;width:min(1080px,90vw,calc(78vh*1.46));aspect-ratio:1.46;transform-style:preserve-3d;
    transform:translateY(62vh) rotateX(62deg) scale(.42);opacity:0;transition:transform .9s cubic-bezier(.22,.8,.25,1),opacity .5s}
  #diaryBook.on .db-stage{transform:translateY(0) rotateX(6deg) scale(1);opacity:1}
  #diaryBook .db-book{position:absolute;inset:0;transform-style:preserve-3d;transition:transform .8s cubic-bezier(.4,.1,.2,1)}
  #diaryBook.closed .db-book{transform:translateX(-25%)}
  /* page block: the stack of paper edges under each page */
  #diaryBook .db-block{position:absolute;top:0;bottom:0;width:50%;border-radius:4px;background:#e9e5da;
    box-shadow:0 30px 60px -18px #000c,0 8px 18px #0007}
  #diaryBook .db-block.l{left:0;border-radius:6px 2px 2px 6px;box-shadow:-3px 3px 0 #dcd6c8,-6px 6px 0 #cfc8b8,0 30px 60px -18px #000c,0 8px 18px #0007}
  #diaryBook .db-block.r{right:0;border-radius:2px 6px 6px 2px;box-shadow:3px 3px 0 #dcd6c8,6px 6px 0 #cfc8b8,0 30px 60px -18px #000c,0 8px 18px #0007}
  #diaryBook .db-block.l,#diaryBook .db-page.l{transition:opacity .35s .3s}
  #diaryBook.closed .db-block.l,#diaryBook.closed .db-page.l{opacity:0;transition-delay:0s}
  #diaryBook .db-page{position:absolute;top:0;bottom:0;width:50%;overflow:hidden;color:#34302a;
    background:#f7f5ef radial-gradient(#d9d3c6 1px,transparent 1.3px) 0 0/22px 22px;backface-visibility:hidden}
  #diaryBook .db-page:before{content:"";position:absolute;inset:0;pointer-events:none;z-index:3}
  #diaryBook .db-page.l{left:0;border-radius:5px 0 0 5px}
  #diaryBook .db-page.l:before{background:linear-gradient(90deg,transparent 78%,#0000000d 92%,#00000038)}
  #diaryBook .db-page.r{right:0;border-radius:0 5px 5px 0}
  #diaryBook .db-page.r:before{background:linear-gradient(270deg,transparent 78%,#0000000d 92%,#00000038)}
  #diaryBook .db-in{position:absolute;inset:7% 9% 7% 9%;display:flex;flex-direction:column;z-index:2}
  #diaryBook .db-page.r .db-in{inset:7% 9% 7% 9%}
  #diaryBook .db-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;border-bottom:1px solid #cfc6b4;padding-bottom:.5em;margin-bottom:.7em}
  #diaryBook .db-date{font:600 clamp(18px,2.1vw,28px)/1 var(--num-font,Georgia,serif);letter-spacing:.02em;color:#2d2924}
  #diaryBook .db-sub{font-size:clamp(10px,1vw,13px);color:#8a7f6d;letter-spacing:.08em}
  #diaryBook .db-label{font:600 clamp(10px,.95vw,12px)/1 var(--ui-font,system-ui);letter-spacing:.22em;color:#9b8f7b;text-transform:uppercase}
  #diaryBook textarea{flex:1;width:100%;resize:none;border:0;outline:0;background:transparent;color:#2f2a24;padding:0;
    font:clamp(17px,1.75vw,24px)/2.05em "Diary Hand","Noto Serif SC Sub",var(--ui-font,serif);
    background-image:linear-gradient(transparent calc(2.05em - 1px),#b9c6d4 calc(2.05em - 1px),#b9c6d4 2.05em,transparent 2.05em);background-size:100% 2.05em;background-attachment:local}
  #diaryBook textarea::placeholder{color:#b2a895}
  #diaryBook .db-canvas{flex:1;width:100%;min-height:0;border-radius:3px;cursor:crosshair;touch-action:none;margin-top:.6em;
    background:#fbfaf6;box-shadow:inset 0 0 0 1px #e2dccf}
  #diaryBook .db-tools{display:flex;align-items:center;gap:8px;margin-top:.6em}
  #diaryBook .db-ink{width:18px;height:18px;border-radius:50%;border:2px solid #f7f5ef;box-shadow:0 0 0 1px #bdb4a2;cursor:pointer;padding:0}
  #diaryBook .db-ink.on{box-shadow:0 0 0 2px #2d2924}
  #diaryBook .db-tool{margin-left:auto;border:1px solid #cfc6b4;background:#fff8;border-radius:14px;padding:3px 12px;color:#5d5446;font:inherit;font-size:12px;cursor:pointer}
  #diaryBook .db-photos{flex:1;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:9% 8%;padding:4% 0 2%}
  #diaryBook .db-photo{position:relative;align-self:center;background:#fff;padding:5px 5px 5px;box-shadow:0 2px 5px #0003,0 0 0 1px #0000000d}
  #diaryBook .db-photo img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;filter:saturate(.92) contrast(.97)}
  #diaryBook .db-photo:before,#diaryBook .db-photo:after{content:"";position:absolute;width:34%;height:15px;background:#efe5c9cc;box-shadow:0 1px 1px #0001}
  #diaryBook .db-photo:before{top:-8px;left:-9px;transform:rotate(-32deg)}
  #diaryBook .db-photo:after{bottom:-7px;right:-9px;transform:rotate(-32deg)}
  #diaryBook .db-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;white-space:pre-line;color:#8a7f6d;font-size:clamp(12px,1.15vw,15px);line-height:1.7}
  #diaryBook .db-empty button{border:1px solid #2d2924;background:#2d2924;color:#f7f5ef;border-radius:16px;padding:6px 16px;font:inherit;font-size:13px;cursor:pointer}
  #diaryBook .db-foot{display:flex;justify-content:space-between;margin-top:.5em;font:clamp(10px,.9vw,12px)/1 var(--num-font,Georgia,serif);color:#a39882}
  #diaryBook .db-curl{position:absolute;right:0;bottom:0;width:9%;aspect-ratio:1;z-index:4;cursor:pointer;
    background:linear-gradient(135deg,transparent 49%,#d8d1c2 50%,#f3efe6 62%,#fff 74%);border-radius:0 0 5px 0;box-shadow:-3px -3px 6px #0000001a;transition:width .25s}
  #diaryBook .db-curl:hover{width:12%}
  #diaryBook .db-leaf{position:absolute;top:0;bottom:0;width:50%;transform-style:preserve-3d;z-index:10}
  #diaryBook .db-leaf.fwd{left:50%;transform-origin:0 50%}
  #diaryBook .db-leaf.back{left:0;transform-origin:100% 50%}
  #diaryBook .db-leaf>.db-page{width:100%;left:0;right:auto}
  #diaryBook .db-leaf>.db-face-b{transform:rotateY(180deg)}
  #diaryBook .db-leaf .db-page:after{content:"";position:absolute;inset:0;z-index:5;pointer-events:none;background:linear-gradient(90deg,#0000,#0000);transition:background .7s}
  /* cloth cover */
  #diaryBook .db-cover{position:absolute;inset:0;border-radius:2px 7px 7px 2px;backface-visibility:hidden;
    background:#ecebe6 repeating-linear-gradient(0deg,#0000000a 0 1px,transparent 1px 3px),repeating-linear-gradient(90deg,#ffffff40 0 1px,transparent 1px 3px);
    box-shadow:inset 6px 0 10px -4px #0003,inset 0 0 0 1px #00000014}
  #diaryBook .db-cover .db-band{position:absolute;top:0;bottom:0;right:11%;width:3.2%;background:linear-gradient(90deg,#8a8378,#a9a297 40%,#8a8378);box-shadow:1px 0 3px #0003}
  #diaryBook .db-cover .db-emb{position:absolute;left:12%;top:16%;color:#a7a196;text-shadow:0 1px 0 #fff,0 -1px 0 #0000001f}
  #diaryBook .db-cover .db-emb b{display:block;font:600 clamp(22px,2.6vw,36px)/1.1 var(--title-font,Georgia,serif);letter-spacing:.04em}
  #diaryBook .db-cover .db-emb span{display:block;margin-top:.6em;font:clamp(11px,1.1vw,14px)/1 var(--num-font,Georgia,serif);letter-spacing:.3em}
  #diaryBook .db-inner{position:absolute;inset:0;background:#efede6;border-radius:7px 2px 2px 7px;backface-visibility:hidden;transform:rotateY(180deg);box-shadow:inset -8px 0 14px -8px #0003}
  #diaryBook .db-ribbon{position:absolute;left:calc(50% + 12px);top:-4px;width:12px;height:calc(100% + 38px);background:linear-gradient(90deg,#8e2f2a,#b4433b 50%,#8e2f2a);clip-path:polygon(0 0,100% 0,100% 100%,50% calc(100% - 9px),0 100%);z-index:1;opacity:0;transition:opacity .4s .5s}
  #diaryBook.on:not(.closed) .db-ribbon{opacity:1}
  #diaryBook .db-nav{position:fixed;top:50%;transform:translateY(-50%);width:54px;height:54px;border-radius:50%;border:0;background:#2a2520b3;color:#f6efe2;font-size:26px;line-height:1;cursor:pointer;backdrop-filter:blur(6px);opacity:0;transition:opacity .4s,background .2s;z-index:3}
  #diaryBook .db-nav:hover{background:#3d352dd9}
  #diaryBook.on:not(.closed) .db-nav{opacity:1}
  #diaryBook .db-nav[disabled]{opacity:.25!important;cursor:default}
  #diaryBook .db-prev{left:max(18px,calc(50vw - min(1080px,90vw,calc(78vh*1.46))/2 - 80px))}
  #diaryBook .db-next{right:max(18px,calc(50vw - min(1080px,90vw,calc(78vh*1.46))/2 - 80px))}
  #diaryBook .db-close{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);border:1px solid #f1dcb566;background:#1d1713d9;color:#f6e9d2;border-radius:20px;padding:8px 18px;font:inherit;font-size:13px;cursor:pointer;z-index:3;opacity:0;transition:opacity .4s}
  #diaryBook.on .db-close{opacity:1}
  #diaryBook .db-close kbd{margin-left:8px;padding:1px 5px;border:1px solid #f1dcb566;border-radius:3px;font:inherit;font-size:11px}
  #diaryBook .db-pager{position:fixed;left:50%;bottom:66px;transform:translateX(-50%);color:#f1e5cfaa;font:13px/1 var(--num-font,Georgia,serif);letter-spacing:.2em;z-index:3}
  @media (max-width:700px){#diaryBook .db-stage{width:96vw}#diaryBook .db-nav{width:40px;height:40px;font-size:20px}}`;

  let root, stage, book, pages = {}, spreads = [], idx = 0, busy = false, ink = "#2d2924", drawCanvas = null, saveTimer = 0;
  function build() {
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    root = document.createElement("div"); root.id = "diaryBook"; root.hidden = true;
    root.innerHTML = `<div class="db-shade"></div>
      <div class="db-stage"><div class="db-ribbon"></div><div class="db-book">
        <div class="db-block l"></div><div class="db-block r"></div>
        <div class="db-page l" data-side="l"></div><div class="db-page r" data-side="r"></div>
      </div></div>
      <button class="db-nav db-prev" type="button">‹</button><button class="db-nav db-next" type="button">›</button>
      <div class="db-pager"></div><button class="db-close" type="button"></button>`;
    document.body.appendChild(root);
    stage = root.querySelector(".db-stage"); book = root.querySelector(".db-book");
    pages.l = book.querySelector(".db-page.l"); pages.r = book.querySelector(".db-page.r");
    root.querySelector(".db-shade").onclick = close;
    root.querySelector(".db-close").onclick = close;
    root.querySelector(".db-prev").onclick = () => turn(-1);
    root.querySelector(".db-next").onclick = () => turn(1);
    document.addEventListener("keydown", e => {
      if (root.hidden) return;
      const typing = e.target && e.target.tagName === "TEXTAREA";
      e.stopImmediatePropagation();
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (!typing && e.key === "ArrowRight") { e.preventDefault(); turn(1); }
      else if (!typing && e.key === "ArrowLeft") { e.preventDefault(); turn(-1); }
    }, true);
  }

  function dateLine(d) {
    const t = L(), dt = new Date((d || "") + "T12:00:00");
    const wd = isNaN(dt) ? "" : t.week[dt.getDay()];
    return { big: (d || "").replace(/-/g, "."), wd };
  }
  // ---------- page renderers: each returns a fresh element for a page ----------
  function pageWriting(data, live) {
    const t = L(), dl = dateLine(data.date), w = data.weather || "sunny";
    const el = document.createElement("div"); el.className = "db-in";
    el.innerHTML = `<div class="db-head"><span class="db-date">${esc(dl.big)}</span><span class="db-sub">${esc(dl.wd)} · ${ICON[w] || ""} ${esc(t.w[w] || "")}</span></div>
      <textarea spellcheck="false" placeholder="${esc(t.write)}"></textarea>
      <div class="db-foot"><span>${esc(data.mood ? "“" + data.mood.slice(0, 40) + "”" : "")}</span><span>1</span></div>`;
    const ta = el.querySelector("textarea"); ta.value = data.diary || "";
    if (live) ta.oninput = () => { B()?.setDiary?.(ta.value); queueSave(); }; else ta.readOnly = true;
    return el;
  }
  function pageDrawing(data, live) {
    const t = L(), el = document.createElement("div"); el.className = "db-in";
    const inks = ["#2d2924", "#2f4f7a", "#a8432f", "#4f6b3a", "#c08a2d"];
    el.innerHTML = `<div class="db-head"><span class="db-label">${esc(t.draw)}</span><span class="db-sub">${data.song ? "♪ " + esc(data.song.slice(0, 26)) : ""}</span></div>
      <canvas class="db-canvas"></canvas>
      <div class="db-tools">${inks.map(c => `<button class="db-ink${c === ink ? " on" : ""}" style="background:${c}" data-ink="${c}" type="button"></button>`).join("")}<button class="db-tool" type="button">${esc(t.clear)}</button></div>
      <div class="db-foot"><span></span><span>2</span></div>`;
    const cv = el.querySelector("canvas");
    requestAnimationFrame(() => setupCanvas(cv, data.drawing, live));
    if (live) {
      el.querySelectorAll("[data-ink]").forEach(b => b.onclick = () => { ink = b.dataset.ink; el.querySelectorAll("[data-ink]").forEach(x => x.classList.toggle("on", x === b)); });
      el.querySelector(".db-tool").onclick = () => { const c = cv.getContext("2d"); c.clearRect(0, 0, cv.width, cv.height); B()?.setDrawing?.(""); queueSave(); };
    }
    return el;
  }
  function setupCanvas(cv, src, live) {
    const r = cv.getBoundingClientRect(), k = 2;
    cv.width = Math.max(10, Math.round(r.width * k)); cv.height = Math.max(10, Math.round(r.height * k));
    const c = cv.getContext("2d");
    if (src) { const im = new Image(); im.onload = () => { const s = Math.min(cv.width / im.width, cv.height / im.height); c.drawImage(im, (cv.width - im.width * s) / 2, (cv.height - im.height * s) / 2, im.width * s, im.height * s); }; im.src = src; }
    if (!live) return;
    drawCanvas = cv;
    let drawing = false, last = null;
    const pos = e => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) / b.width * cv.width, (e.clientY - b.top) / b.height * cv.height]; };
    cv.onpointerdown = e => { drawing = true; last = pos(e); cv.setPointerCapture(e.pointerId); };
    cv.onpointermove = e => {
      if (!drawing) return; const p = pos(e);
      c.strokeStyle = ink; c.lineCap = c.lineJoin = "round"; c.lineWidth = 3.4 * (e.pressure && e.pointerType === "pen" ? .5 + e.pressure : 1);
      c.beginPath(); c.moveTo(...last); c.lineTo(...p); c.stroke(); last = p;
    };
    cv.onpointerup = cv.onpointercancel = () => { if (!drawing) return; drawing = false; B()?.setDrawing?.(cv.toDataURL("image/png")); queueSave(); };
  }
  function pagePhotos(list, start, pageNo, data) {
    const t = L(), el = document.createElement("div"); el.className = "db-in";
    const slice = list.slice(start, start + 4);
    if (!list.length && start === 0) {
      el.innerHTML = `<div class="db-head"><span class="db-label">${esc(t.photos)}</span><span class="db-sub"></span></div>
        <div class="db-empty">${esc(t.noPhotos)}<button type="button">${esc(t.toDark)}</button></div><div class="db-foot"><span></span><span>${pageNo}</span></div>`;
      el.querySelector("button").onclick = () => { closeNow(); window.openRoomDarkroom?.(); };
      return el;
    }
    if (!slice.length) {
      el.innerHTML = `<div class="db-head"><span class="db-label">${start === 4 && data.song ? esc(t.song) : ""}</span></div>
        <div class="db-empty">${start === 4 && data.song ? "♪ " + esc(data.song) : ""}</div><div class="db-foot"><span></span><span>${pageNo}</span></div>`;
      return el;
    }
    el.innerHTML = `<div class="db-head"><span class="db-label">${start % 8 === 0 ? esc(t.photos) : "&nbsp;"}</span><span class="db-sub">${start % 8 === 0 ? esc(dateLine(data.date).big) : ""}</span></div>
      <div class="db-photos">${slice.map((u, i) => `<figure class="db-photo" style="margin:0;transform:rotate(${[-2.2, 1.6, 1.2, -1.4][i]}deg)"><img alt="" src="${esc(u)}"></figure>`).join("")}</div>
      <div class="db-foot"><span></span><span>${pageNo}</span></div>`;
    return el;
  }
  function makeSpreads(data) {
    const list = data.photos || [], out = [[d => pageWriting(d, true), d => pageDrawing(d, true), d => pageWriting(d, false), d => pageDrawing(d, false)]];
    const n = Math.max(1, Math.ceil(list.length / 8));
    for (let s = 0; s < n; s++) {
      const a = s * 8, pn = 3 + s * 2;
      const L_ = d => pagePhotos(list, a, pn, d), R_ = d => pagePhotos(list, a + 4, pn + 1, d);
      out.push([L_, R_, L_, R_]);
    }
    return out;
  }
  // [liveLeft, liveRight, staticLeft, staticRight]
  function fill(page, el) { page.querySelectorAll(".db-in,.db-curl").forEach(n => n.remove()); page.appendChild(el); }
  function renderSpread() {
    const data = B()?.get?.() || {};
    fill(pages.l, spreads[idx][0](data)); fill(pages.r, spreads[idx][1](data));
    if (idx < spreads.length - 1) { const c = document.createElement("div"); c.className = "db-curl"; c.onclick = () => turn(1); pages.r.appendChild(c); }
    root.querySelector(".db-prev").disabled = idx === 0;
    root.querySelector(".db-next").disabled = idx >= spreads.length - 1;
    root.querySelector(".db-pager").textContent = `${idx + 1} / ${spreads.length}`;
  }
  function staticFace(cls, side, el) { const p = document.createElement("div"); p.className = "db-page " + side + " " + cls; p.appendChild(el); return p; }
  function snapshotCanvasInto(from, to) {
    const a = from && from.querySelector("canvas"), b = to && to.querySelector("canvas");
    if (a && b) requestAnimationFrame(() => { b.width = a.width; b.height = a.height; b.getContext("2d").drawImage(a, 0, 0); });
  }
  // a single leaf turns over the gutter; underneath, the new pages are already in place
  function turn(dir) {
    if (busy || root.hidden || root.classList.contains("closed")) return;
    const to = idx + dir; if (to < 0 || to >= spreads.length) return;
    busy = true; flushSave();
    const data = B()?.get?.() || {}, from = idx;
    const leaf = document.createElement("div"); leaf.className = "db-leaf " + (dir > 0 ? "fwd" : "back");
    if (dir > 0) {
      const front = staticFace("db-face-a", "r", spreads[from][3](data)), backF = staticFace("db-face-b", "l", spreads[to][2](data));
      snapshotCanvasInto(pages.r, front); leaf.append(front, backF);
      book.appendChild(leaf);
      idx = to; fill(pages.r, spreads[to][1](data)); // new right page sits underneath
    } else {
      const front = staticFace("db-face-a", "l", spreads[from][2](data)), backF = staticFace("db-face-b", "r", spreads[to][3](data));
      snapshotCanvasInto(pages.l, front); leaf.append(front, backF);
      book.appendChild(leaf);
      idx = to; fill(pages.l, spreads[to][0](data));
    }
    page("flip");
    const ang = dir > 0 ? -180 : 180;
    leaf.animate([{ transform: "rotateY(0deg)" }, { transform: `rotateY(${ang * .5}deg) translateZ(30px)`, offset: .5 }, { transform: `rotateY(${ang}deg)` }], { duration: 900, easing: "cubic-bezier(.45,.05,.35,1)", fill: "forwards" })
      .onfinish = () => { leaf.remove(); renderSpread(); busy = false; };
  }
  // tiny paper sound
  let actx = null;
  function page() {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const len = actx.sampleRate * .45, buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) { const x = i / len; d[i] = (Math.random() * 2 - 1) * Math.pow(Math.sin(Math.PI * x), 2) * (.5 + .5 * Math.random()); }
      const s = actx.createBufferSource(); s.buffer = buf; const f = actx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 2600; f.Q.value = .6;
      const g = actx.createGain(); g.gain.value = .16; s.connect(f).connect(g).connect(actx.destination); s.start();
    } catch (e) {}
  }
  function queueSave() { clearTimeout(saveTimer); saveTimer = setTimeout(() => B()?.save?.(), 1200); }
  function flushSave() { if (saveTimer) { clearTimeout(saveTimer); saveTimer = 0; B()?.save?.(); } }

  function open() {
    if (!root) build();
    if (!root.hidden) return;
    const data = B()?.get?.() || {}, t = L();
    spreads = makeSpreads(data); idx = 0;
    root.querySelector(".db-close").innerHTML = `${esc(t.put)}<kbd>Esc</kbd>`;
    // closed book: the cover lies over the right half, the whole book shifted to centre
    const cover = document.createElement("div"); cover.className = "db-leaf fwd db-coverleaf";
    cover.innerHTML = `<div class="db-cover"><div class="db-band"></div><div class="db-emb"><b>${esc(t.title)}</b><span>${esc((data.date || "").slice(0, 4))}</span></div></div><div class="db-inner"></div>`;
    renderSpread(); book.appendChild(cover);
    root.classList.add("closed"); root.classList.remove("on"); root.hidden = false;
    void root.offsetWidth; root.classList.add("on");
    // after the lift, swing the cover open and slide the book to the centre
    setTimeout(() => {
      if (root.hidden) return;
      page();
      root.classList.remove("closed");
      cover.animate([{ transform: "rotateY(0deg)" }, { transform: "rotateY(-90deg) translateZ(20px)", offset: .5 }, { transform: "rotateY(-180deg)" }], { duration: 1000, easing: "cubic-bezier(.45,.05,.35,1)", fill: "forwards" })
        .onfinish = () => { cover.remove(); const ta = pages.l.querySelector("textarea"); if (ta && !ta.value) ta.focus({ preventScroll: true }); };
    }, 820);
    window.dispatchEvent(new CustomEvent("roomdiary", { detail: true }));
  }
  function closeNow() { if (!root || root.hidden) return; flushSave(); root.hidden = true; root.classList.remove("on"); book.querySelectorAll(".db-leaf").forEach(n => n.remove()); busy = false; window.dispatchEvent(new CustomEvent("roomdiary", { detail: false })); }
  function close() {
    if (!root || root.hidden || root.dataset.closing) return;
    flushSave(); root.dataset.closing = "1"; busy = true;
    book.querySelectorAll(".db-leaf").forEach(n => n.remove());
    const t = L(), data = B()?.get?.() || {};
    const cover = document.createElement("div"); cover.className = "db-leaf fwd db-coverleaf";
    cover.innerHTML = `<div class="db-cover"><div class="db-band"></div><div class="db-emb"><b>${esc(t.title)}</b><span>${esc((data.date || "").slice(0, 4))}</span></div></div><div class="db-inner"></div>`;
    book.appendChild(cover); page();
    cover.animate([{ transform: "rotateY(-180deg)" }, { transform: "rotateY(-90deg) translateZ(20px)", offset: .5 }, { transform: "rotateY(0deg)" }], { duration: 750, easing: "cubic-bezier(.45,.05,.35,1)", fill: "forwards" });
    root.classList.add("closed");
    setTimeout(() => root.classList.remove("on"), 650);
    setTimeout(() => { delete root.dataset.closing; closeNow(); }, 1550);
  }
  window.openRoomDiary = open;
  window.closeRoomDiary = close;
  window.isRoomDiaryOpen = () => !!root && !root.hidden;
})();
