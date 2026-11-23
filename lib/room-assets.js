// Lets the page work both from a local web server and when index.html is
// opened directly (file://). Browsers block WebGL textures and model fetches
// from file:// pages, so in that case each local asset is read from a copy
// embedded as a script under assets/embed/ and handed to three.js as a data URL.
(function () {
  const fileMode = location.protocol === "file:";
  const embeds = (window.__roomEmbeds = window.__roomEmbeds || {});
  const pending = {};
  const embedFile = (path) => "assets/embed/" + path.replace(/[\/]/g, "__") + ".js";
  function roomAssetURL(path) {
    if (!fileMode || /^(https?:|data:|blob:)/.test(path)) return Promise.resolve(path);
    if (embeds[path]) return Promise.resolve(embeds[path]);
    if (!pending[path]) {
      pending[path] = new Promise((resolve) => {
        const s = document.createElement("script");
        s.src = embedFile(path);
        s.onload = () => resolve(embeds[path] || path);
        s.onerror = () => { console.warn("Embedded asset missing:", path); resolve(path); };
        document.head.appendChild(s);
      });
    }
    return pending[path];
  }
  window.roomFileMode = fileMode;
  window.roomAssetURL = roomAssetURL;
  window.roomAssetsReady = (paths) => Promise.all(paths.map(roomAssetURL));
  // A loading manager that swaps local paths for their embedded copies.
  window.createRoomLoadingManager = () => {
    const manager = new THREE.LoadingManager();
    if (fileMode) manager.setURLModifier((url) => embeds[url] || url);
    return manager;
  };
})();
