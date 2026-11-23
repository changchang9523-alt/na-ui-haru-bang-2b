// v51: film camera darkroom. Clicking the film camera opens a red-safelight
// darkroom: the film canister, the strip of negatives pulled out of it, then
// "develop" — the strip feeds out of the processor and each frame slowly turns
// from an orange negative into a print. Only photos the user loads ("传入照片")
// are on the roll; nothing is added on its own.
(function () {
  const T = {
    ko: { exp: n => `${n} EXP · C-41`, back: "← 방으로", pull: "필름 꺼내기", load: "사진 넣기", more: "사진 더 넣기", empty: "필름에 아직 사진이 없어요 · 먼저 「사진 넣기」를 눌러 주세요", can: "필름 통을 눌러 필름을 꺼내요", drag: "드래그 / 스크롤로 네거티브 보기", develop: "현상하기", developing: "현상 중…", prints: "사진을 누르면 크게 보여요 · Esc 돌아가기", closer: "Esc · 필름으로 돌아가기", loading: "필름에 감는 중…", film: "COLOR NEGATIVE FILM" },
    zh: { exp: n => `${n} EXP · C-41`, back: "← 回到房间", pull: "拉出底片", load: "传入照片", more: "再传入照片", empty: "胶卷里还没有照片 · 先点「传入照片」", can: "点击胶卷，拉出底片", drag: "拖动 / 滚轮浏览底片", develop: "冲洗", developing: "显影中…", prints: "点击照片看大图 · Esc 返回", closer: "Esc · 回到胶片", loading: "正在装进胶卷…", film: "COLOR NEGATIVE FILM" },
    en: { exp: n => `${n} EXP · C-41`, back: "← back to room", pull: "Pull the film out", load: "Load photos", more: "Load more", empty: "No photos on the roll yet · press “Load photos” first", can: "Click the canister to pull the film out", drag: "Drag / scroll through the negatives", develop: "Develop", developing: "Developing…", prints: "Click a print to look closer · Esc to go back", closer: "Esc · back to the strip", loading: "Winding the film…", film: "COLOR NEGATIVE FILM" }
  };
  const B = () => window.roomPhotoBridge;
  const t = () => { const l = B()?.lang?.() || document.getElementById("lang")?.value || "ko"; return T[l] || T.ko; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const GRAIN = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#n)" opacity=".55"/></svg>');
  const css = document.createElement("style");
  css.textContent = `
#darkroom{position:fixed;inset:0;z-index:40;background:#0b0706;color:#e8b9a6;font:600 11px/1.5 "SFMono-Regular",Menlo,Consolas,monospace;letter-spacing:.08em;overflow:hidden;opacity:0;transition:opacity .5s}
#darkroom.on{opacity:1}
#darkroom:after{content:"";position:absolute;inset:0;pointer-events:none;background:url("${GRAIN}");opacity:.09;mix-blend-mode:screen}
#darkroom .dr-safe{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 35% 40%,rgba(210,40,20,.30),rgba(60,6,2,.2) 55%,rgba(0,0,0,.6));transition:opacity .9s}
#darkroom.prints .dr-safe{opacity:0}
#darkroom .dr-hud{position:absolute;left:18px;top:14px;z-index:5;color:#c98b78;text-transform:uppercase}
#darkroom .dr-hud b{display:block;font-weight:700;color:#f0c0ad}
#darkroom .dr-hud button{margin-top:10px;background:none;border:none;color:#c98b78;font:inherit;letter-spacing:inherit;cursor:pointer;padding:0;text-transform:uppercase}
#darkroom .dr-hud button:hover{color:#ffd9c8}
#darkroom .dr-stage{position:absolute;inset:0;display:flex;align-items:center}
#darkroom .dr-can{position:absolute;left:50%;top:50%;width:170px;height:250px;transform:translate(-50%,-50%) rotate(-6deg);cursor:pointer;transition:left 1s cubic-bezier(.3,.7,.2,1),transform 1s cubic-bezier(.3,.7,.2,1);z-index:3;filter:drop-shadow(0 30px 40px rgba(0,0,0,.7))}
#darkroom.strip .dr-can,#darkroom.developing .dr-can{left:calc(4vw + 85px);transform:translate(-50%,-50%) rotate(0deg) scale(1.25)}
#darkroom.prints .dr-can{opacity:0;pointer-events:none}
#darkroom .can-body{position:absolute;left:0;right:0;top:18px;bottom:18px;border-radius:6px;overflow:hidden;background:linear-gradient(90deg,#3d0a04,#a72413 18%,#ff4f2e 42%,#e8391e 58%,#8e1c0d 82%,#2c0702);color:#2a0502}
#darkroom .can-body:before{content:"";position:absolute;left:0;right:0;top:0;height:16%;background:linear-gradient(90deg,#2a0603,#6a1208 30%,#8a1a0c 50%,#4a0c05 80%,#1c0402)}
#darkroom .can-body i{position:absolute;left:12%;top:4%;font:800 12px/1 Georgia,serif;font-style:normal;color:#f3b49c;letter-spacing:.2em}
#darkroom .can-body strong{position:absolute;left:10%;top:28%;font:900 64px/1 "Arial Black",Impact,sans-serif;letter-spacing:-.02em;color:#2a0502}
#darkroom .can-body em{position:absolute;left:10%;top:57%;font:800 13px/1.1 Arial,sans-serif;font-style:normal;color:#2a0502;letter-spacing:.02em}
#darkroom .can-body small{position:absolute;left:10%;bottom:8%;font:700 9px/1 monospace;color:#4a0b04}
#darkroom .can-cap{position:absolute;left:-4px;right:-4px;height:24px;border-radius:50%/40%;background:linear-gradient(90deg,#140303,#4a1510 40%,#2a0806 70%,#0c0202)}
#darkroom .can-cap.top{top:6px}#darkroom .can-cap.bot{bottom:6px}
#darkroom .can-nub{position:absolute;left:50%;top:-4px;width:44px;height:18px;margin-left:-22px;border-radius:4px 4px 50% 50%;background:linear-gradient(90deg,#1a0404,#5a1a12,#1a0404)}
#darkroom .can-leader{position:absolute;right:-34px;top:70px;width:46px;height:96px;background:#4a1d10;border-radius:0 18px 6px 0;box-shadow:inset 0 0 0 1px #2a0c06;transition:opacity .4s}
#darkroom.strip .can-leader,#darkroom.developing .can-leader{opacity:0}
#darkroom .dr-view{position:absolute;left:calc(4vw + 160px);right:0;top:50%;height:300px;transform:translateY(-50%);overflow-x:auto;overflow-y:hidden;scrollbar-width:none;cursor:grab;z-index:2;pointer-events:none}
#darkroom .dr-view::-webkit-scrollbar{display:none}
#darkroom.strip .dr-view{pointer-events:auto}
#darkroom .dr-film{display:inline-flex;align-items:center;gap:0;padding:0 40vw 0 70px;transform:translateX(-110%);transition:transform 1.3s cubic-bezier(.25,.7,.2,1)}
#darkroom.strip .dr-film{transform:none}
#darkroom .fr{position:relative;flex:none;width:300px;height:250px;background:#3b170c;padding:38px 14px;box-shadow:inset 0 0 30px rgba(0,0,0,.35)}
#darkroom .fr:before,#darkroom .fr:after{content:"";position:absolute;left:0;right:0;height:13px;background:repeating-linear-gradient(90deg,transparent 0 7px,#0d0504 7px 19px,transparent 19px 25px)}
#darkroom .fr:before{top:10px}#darkroom .fr:after{bottom:10px}
#darkroom .fr .ed{position:absolute;left:18px;top:24px;font-size:8px;letter-spacing:.2em;color:#c4583a}
#darkroom .fr .no{position:absolute;right:20px;bottom:24px;font-size:9px;color:#c4583a}
#darkroom .fr img{display:block;width:100%;height:100%;object-fit:cover;filter:invert(1) sepia(1) saturate(3.2) hue-rotate(-22deg) brightness(.78) contrast(.92);opacity:.92}
#darkroom .fr.lead{width:150px;border-radius:0 0 40px 0}
#darkroom .fr.lead span{position:absolute;left:20px;top:50%;transform:translateY(-50%);font-size:18px;color:#d36a4c;letter-spacing:.12em}
#darkroom .fr.lead span small{display:block;font-size:9px;color:#a84a30}
#darkroom .dr-bottom{position:absolute;left:0;right:0;bottom:18px;z-index:6;display:flex;flex-direction:column;align-items:center;gap:8px;text-transform:uppercase;color:#b9786a}
#darkroom .dr-bottom .row{display:flex;gap:10px}
#darkroom .dr-bottom button{padding:9px 16px;border:1px solid #c45a40;border-radius:2px;background:rgba(30,6,3,.7);color:#f0b7a2;font:inherit;letter-spacing:.14em;text-transform:uppercase;cursor:pointer}
#darkroom .dr-bottom button.main{background:#c43d22;color:#1a0503;border-color:#c43d22}
#darkroom .dr-bottom button:hover{filter:brightness(1.15)}
#darkroom.prints .dr-bottom{color:#b9a48e}
#darkroom.prints .dr-bottom span{padding:6px 12px;border-radius:14px;background:rgba(10,8,6,.8)}
#darkroom.prints .dr-bottom button{border-color:#8f7d68;color:#e8dccb;background:rgba(20,16,12,.75)}
#darkroom .dr-dev{position:absolute;inset:0;z-index:7;background:#050302;display:flex;align-items:flex-end;justify-content:center;padding-bottom:28px;color:#8a5d50;letter-spacing:.3em;opacity:0;pointer-events:none;transition:opacity .6s}
#darkroom.developing .dr-dev{opacity:1}
#darkroom .dr-prints{position:absolute;inset:0;z-index:4;overflow-y:auto;scrollbar-width:none;opacity:0;pointer-events:none;transition:opacity .6s;background:radial-gradient(ellipse at 50% 30%,#2a211b,#0e0b09 70%)}
#darkroom .dr-prints::-webkit-scrollbar{display:none}
#darkroom.prints .dr-prints{opacity:1;pointer-events:auto}
#darkroom .dr-machine{position:sticky;top:0;z-index:3;margin:0 auto;width:min(440px,90vw);height:74px;border-radius:0 0 14px 14px;background:linear-gradient(#26201c,#141110);box-shadow:0 14px 30px rgba(0,0,0,.7),inset 0 -6px 0 #0a0807}
#darkroom .dr-machine:before{content:"";position:absolute;left:12%;right:12%;bottom:12px;height:8px;border-radius:4px;background:#030202;box-shadow:inset 0 2px 3px #000}
#darkroom .dr-machine span{position:absolute;left:16px;top:12px;color:#6d5c4e;font-size:9px;letter-spacing:.3em}
#darkroom .dr-machine i{position:absolute;right:16px;top:12px;width:8px;height:8px;border-radius:50%;background:#d23a1e;box-shadow:0 0 8px #ff4a26}
#darkroom .dr-col{width:min(330px,82vw);margin:-14px auto 120px;transform:translateY(-100%);transition:transform var(--feed,3s) cubic-bezier(.3,.6,.25,1)}
#darkroom.fed .dr-col{transform:none}
#darkroom .vf{position:relative;height:250px;background:#1d1713;padding:12px 38px;box-shadow:inset 0 0 26px rgba(0,0,0,.5);cursor:zoom-in}
#darkroom .vf:before,#darkroom .vf:after{content:"";position:absolute;top:0;bottom:0;width:13px;background:repeating-linear-gradient(transparent 0 7px,#070504 7px 19px,transparent 19px 25px)}
#darkroom .vf:before{left:11px}#darkroom .vf:after{right:11px}
#darkroom .vf .no{position:absolute;left:2px;bottom:16px;writing-mode:vertical-rl;font-size:9px;color:#8a6f55}
#darkroom .vf .ed{position:absolute;right:2px;top:20px;writing-mode:vertical-rl;font-size:8px;letter-spacing:.2em;color:#8a6f55}
#darkroom .vf img{display:block;width:100%;height:100%;object-fit:cover;filter:invert(1) sepia(1) saturate(3.2) hue-rotate(-22deg) brightness(.78) contrast(.92);transition:filter 2.6s ease-in-out}
#darkroom .vf.dev img{filter:invert(0) sepia(.28) saturate(.92) hue-rotate(0deg) brightness(1) contrast(1.06)}
#darkroom .vf:hover img{outline:1px solid #e8dccb55}
#darkroom .dr-light{position:absolute;inset:0;z-index:8;display:flex;align-items:center;justify-content:center;background:rgba(5,4,3,.86);opacity:0;pointer-events:none;transition:opacity .35s}
#darkroom .dr-light.on{opacity:1;pointer-events:auto}
#darkroom .dr-light figure{margin:0;padding:18px 18px 54px;background:#f1ebde;box-shadow:0 30px 70px rgba(0,0,0,.7);transform:rotate(-1.5deg) scale(.94);transition:transform .45s cubic-bezier(.2,.8,.2,1)}
#darkroom .dr-light.on figure{transform:rotate(-1.5deg) scale(1)}
#darkroom .dr-light img{display:block;max-width:min(76vw,900px);max-height:68vh;filter:sepia(.28) saturate(.92) contrast(1.06)}
#darkroom .dr-light figcaption{margin-top:14px;color:#5d4a38;font:24px/1 'Diary Hand','Nanum Pen Script',cursive;letter-spacing:0}
#darkroom .dr-light small{position:absolute;bottom:18px;left:0;right:0;text-align:center;color:#a8957f;text-transform:uppercase}
@media (max-width:820px){#darkroom .dr-can{width:130px;height:190px}#darkroom .can-body strong{font-size:46px}#darkroom.strip .dr-can,#darkroom.developing .dr-can{left:60px;transform:translate(-50%,-50%) scale(.9)}#darkroom .dr-view{left:100px}#darkroom .fr{width:220px;height:190px;padding:32px 10px}#darkroom .vf{height:200px}}`;
  document.head.appendChild(css);

  let root = null, state = "", input = null, devTimer = 0;
  function build() {
    root = document.createElement("div"); root.id = "darkroom"; root.hidden = true;
    root.innerHTML = `<div class="dr-safe"></div><div class="dr-hud"></div>
      <div class="dr-stage"><div class="dr-can" title=""><div class="can-leader"></div><div class="can-nub"></div><div class="can-body"><i>ROOM</i><strong>400</strong><em></em><small>135 · 24 EXP · ISO 400</small></div><div class="can-cap top"></div><div class="can-cap bot"></div></div>
      <div class="dr-view"><div class="dr-film"></div></div></div>
      <div class="dr-prints"><div class="dr-machine"><span>PROCESSOR · C-41</span><i></i></div><div class="dr-col"></div></div>
      <div class="dr-dev"></div><div class="dr-light"><figure><img alt=""><figcaption></figcaption></figure><small></small></div><div class="dr-bottom"></div>`;
    document.body.appendChild(root);
    input = document.createElement("input"); input.type = "file"; input.accept = "image/*"; input.multiple = true; input.hidden = true; document.body.appendChild(input);
    input.onchange = async () => {
      const files = [...input.files]; input.value = ""; if (!files.length) return;
      setBottom(`<span>${t().loading}</span>`);
      await B()?.add?.(files);
      fillFilm(); pullOut();
    };
    root.querySelector(".dr-can").onclick = () => { if (state === "canister") { if (photos().length) pullOut(); else input.click(); } };
    const view = root.querySelector(".dr-view");
    view.addEventListener("wheel", e => { if (state !== "strip") return; e.preventDefault(); view.scrollLeft += (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX); }, { passive: false });
    let drag = null;
    view.addEventListener("pointerdown", e => { drag = { x: e.clientX, s: view.scrollLeft }; view.setPointerCapture(e.pointerId); view.style.cursor = "grabbing"; });
    view.addEventListener("pointermove", e => { if (drag) view.scrollLeft = drag.s - (e.clientX - drag.x); });
    view.addEventListener("pointerup", () => { drag = null; view.style.cursor = ""; });
    root.querySelector(".dr-col").addEventListener("click", e => { const f = e.target.closest(".vf"); if (f) closer(+f.dataset.i); });
    root.querySelector(".dr-light").onclick = () => root.querySelector(".dr-light").classList.remove("on");
    document.addEventListener("keydown", e => {
      if (!root || root.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); back(); }
      else if (e.key.toLowerCase() === "u" && state !== "developing") { e.preventDefault(); e.stopImmediatePropagation(); input.click(); }
      else if (e.key === "Enter" && state === "strip") { e.preventDefault(); e.stopImmediatePropagation(); develop(); }
      else e.stopImmediatePropagation();
    }, true);
    document.getElementById("lang")?.addEventListener("change", () => setTimeout(() => { if (root && !root.hidden) { hud(); setState(state); } }, 0));
  }
  const photos = () => B()?.photos?.() || [];
  function hud() {
    const n = photos().length, day = B()?.day?.() || "";
    root.querySelector(".dr-hud").innerHTML = `<b>ROLL 01 · ${esc(day)}</b>${t().exp(n)}<br><button type="button">${t().back}</button>`;
    root.querySelector(".dr-hud button").onclick = close;
    root.querySelector(".can-body em").textContent = t().film;
  }
  function setBottom(html) { root.querySelector(".dr-bottom").innerHTML = html; }
  function fillFilm() {
    const list = photos();
    root.querySelector(".dr-film").innerHTML = `<div class="fr lead"><span>ROLL 01<small>${list.length} EXP · C-41</small></span></div>` +
      list.map((src, i) => `<div class="fr"><span class="ed">ROOM 400</span><img src="${src}" alt=""><span class="no">▸${String(i + 1).padStart(2, "0")}</span></div>`).join("");
    hud();
  }
  function setState(s) {
    state = s; root.className = "on " + s; const tt = t(), n = photos().length;
    if (s === "canister") setBottom(n ? `<span>${tt.can}</span><div class="row"><button class="main" data-a="pull">${tt.pull}</button><button data-a="load">${tt.more}</button></div>` : `<span>${tt.empty}</span><div class="row"><button class="main" data-a="load">${tt.load}</button></div>`);
    if (s === "strip") setBottom(`<div class="row"><button class="main" data-a="dev">${tt.develop}</button><button data-a="load">${tt.more}</button></div><span>${tt.drag}</span>`);
    if (s === "developing") { root.querySelector(".dr-dev").textContent = tt.developing; setBottom(""); }
    if (s === "prints") setBottom(`<span>${tt.prints}</span>`);
    root.querySelectorAll(".dr-bottom button").forEach(b => b.onclick = () => { const a = b.dataset.a; if (a === "load") input.click(); if (a === "pull") pullOut(); if (a === "dev") develop(); });
  }
  function pullOut() { if (!photos().length) { setState("canister"); return; } fillFilm(); setState("strip"); root.querySelector(".dr-view").scrollLeft = 0; }
  function develop() {
    if (state !== "strip") return;
    setState("developing");
    clearTimeout(devTimer);
    devTimer = setTimeout(() => {
      const list = photos(), col = root.querySelector(".dr-col");
      col.innerHTML = list.map((src, i) => `<div class="vf" data-i="${i}"><span class="ed">ROOM 400</span><img src="${src}" alt=""><span class="no">▸${String(i + 1).padStart(2, "0")}</span></div>`).join("");
      const feed = Math.min(9, 1.6 + list.length * .7);
      col.style.setProperty("--feed", feed + "s");
      root.querySelector(".dr-prints").scrollTop = 0;
      setState("prints");
      void col.offsetHeight;
      setTimeout(() => {
        void col.offsetHeight;
        root.classList.add("fed");
        // frames emerge last-first from the slot; each one develops as it comes out
        col.querySelectorAll(".vf").forEach((f, i) => { f.querySelector("img").style.transitionDelay = (.9 + (list.length - 1 - i) * (feed / Math.max(1, list.length)) * .8) + "s"; f.classList.add("dev"); });
      }, 60);
    }, 1900);
  }
  function closer(i) {
    const lb = root.querySelector(".dr-light"), src = photos()[i]; if (!src) return;
    lb.querySelector("img").src = src; lb.querySelector("figcaption").textContent = `${B()?.day?.() || ""} · №${String(i + 1).padStart(2, "0")}`;
    lb.querySelector("small").textContent = t().closer; lb.classList.add("on");
  }
  function back() {
    const lb = root.querySelector(".dr-light");
    if (lb.classList.contains("on")) { lb.classList.remove("on"); return; }
    if (state === "prints") { root.classList.remove("fed"); pullOut(); return; }
    close();
  }
  function open() {
    if (!root) build();
    root.hidden = false; hud(); fillFilm(); setState("canister");
    requestAnimationFrame(() => root.classList.add("on"));
    document.getElementById("hoverTag")?.classList.remove("on");
  }
  function close() {
    clearTimeout(devTimer); root.classList.remove("on");
    setTimeout(() => { root.hidden = true; root.querySelector(".dr-light").classList.remove("on"); }, 500);
  }
  window.openRoomDarkroom = open; window.closeRoomDarkroom = close;
  window.isRoomDarkroomOpen = () => !!root && !root.hidden;
})();
