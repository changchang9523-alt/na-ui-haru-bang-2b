// v53: designed typefaces for the page (SIL OFL, bundled in assets/fonts):
// Gowun Batang (titles), Gowun Dodum (interface), Noto Serif SC (Chinese),
// Cormorant Garamond (dates and numbers). Loaded through roomAssetURL so they
// also work when index.html is opened by double-click.
(function () {
  const list = [["Gowun Batang", "assets/fonts/GowunBatang-Regular.woff2", "400"], ["Gowun Batang", "assets/fonts/GowunBatang-Bold.woff2", "700"], ["Gowun Dodum", "assets/fonts/GowunDodum-Regular.woff2", "400"], ["Noto Serif SC Sub", "assets/fonts/NotoSerifSC.woff2", "200 900"], ["Cormorant Garamond", "assets/fonts/CormorantGaramond.woff2", "300 700"]];
  for (const [family, path, weight] of list) {
    window.roomAssetURL?.(path).then(u => new FontFace(family, `url("${u}")`, { weight, display: "swap" }).load()).then(f => document.fonts.add(f)).catch(() => {});
  }
  const s = document.createElement("style");
  s.textContent = `
:root{--ui-font:"Gowun Dodum","Noto Serif SC Sub",system-ui,"Malgun Gothic",sans-serif;--title-font:"Gowun Batang","Noto Serif SC Sub","Batang",serif;--num-font:"Cormorant Garamond","Gowun Batang",serif}
html,body{font-family:var(--ui-font)}
:root{font-family:var(--ui-font)}
.head h1{font-family:var(--title-font)!important;font-weight:700!important;letter-spacing:.02em}
.head .eyebrow{font-family:var(--title-font);letter-spacing:.32em}
.head .button,.head select,.lang,.button,button,select,input{font-family:var(--ui-font)}
input[type=date],#dayPicker,.date-input{font-family:var(--num-font)!important;font-weight:600;font-size:1.12em;letter-spacing:.04em}
.objectbar,.objectbar summary,.scene-toggle button,#roomHints{font-family:var(--ui-font)}.objectbar summary{grid-column:1/-1;white-space:nowrap}
#roomHints kbd{font-family:var(--num-font);font-weight:600}
#hoverTag,#putDown,#vinylDeck button,#windowDeck,#shredRoom button{font-family:var(--ui-font)!important;letter-spacing:.06em!important}
#darkroom .dr-hud b{font-family:var(--num-font);font-size:13px;letter-spacing:.12em}
`;
  document.head.appendChild(s);
})();
