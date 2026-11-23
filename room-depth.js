/* Builds a small view-dependent 3D relief mesh from the existing room artwork.
   The front view stays pixel-faithful; drag tilts the depth mesh. */
(() => {
  const room = document.getElementById("room");
  const layer = document.getElementById("sceneLayer");
  const image = document.getElementById("roomPhoto");
  if (!room || !layer || !image) return;

  const canvas = document.createElement("canvas");
  canvas.id = "depthParallax";
  canvas.setAttribute("aria-hidden", "true");
  layer.insertBefore(canvas, image.nextSibling);
  const gl = canvas.getContext("webgl", { alpha: false, antialias: true, powerPreference: "low-power" });
  if (!gl) { canvas.remove(); return; }

  const vertex = `
    attribute vec3 aPosition;
    attribute vec2 aUv;
    uniform sampler2D uDepth;
    uniform vec2 uImageSize;
    uniform vec2 uViewSize;
    uniform vec2 uTilt;
    varying vec2 vUv;
    varying float vDepth;
    vec2 coverUv(vec2 uv) {
      float ia = uImageSize.x / uImageSize.y;
      float va = uViewSize.x / uViewSize.y;
      if (va > ia) uv.y = 0.5 + (uv.y - 0.5) * ia / va;
      else uv.x = 0.5 + (uv.x - 0.5) * va / ia;
      return vec2(0.5) + (uv - vec2(0.5)) / 1.035;
    }
    void main() {
      vec2 uv = coverUv(aUv);
      float depth = texture2D(uDepth, uv).r;
      float z = (depth - 0.42) * 0.82;
      float camDist = 6.0;
      // Compensate the neutral front view so the original image framing remains exact.
      vec3 p = vec3(aPosition.xy * ((camDist - z) / camDist), z);
      float ax = uTilt.y * 0.075;
      float ay = uTilt.x * 0.12;
      float cx = cos(ax), sx = sin(ax), cy = cos(ay), sy = sin(ay);
      p = vec3(cy * p.x + sy * p.z, p.y, -sy * p.x + cy * p.z);
      p = vec3(p.x, cx * p.y - sx * p.z, sx * p.y + cx * p.z);
      float perspective = camDist / (camDist - p.z);
      float aspect = uViewSize.x / uViewSize.y;
      gl_Position = vec4(p.x * perspective / aspect, p.y * perspective, 0.0, 1.0);
      vUv = uv;
      vDepth = depth;
    }
  `;
  const fragment = `
    precision mediump float;
    uniform sampler2D uImage;
    varying vec2 vUv;
    varying float vDepth;
    void main() {
      vec4 color = texture2D(uImage, clamp(vUv, vec2(0.001), vec2(0.999)));
      vec3 tuned = (color.rgb - 0.5) * 1.035 + 0.5;
      float gray = dot(tuned, vec3(0.299, 0.587, 0.114));
      tuned = mix(vec3(gray), tuned, 0.94) * 0.97;
      gl_FragColor = vec4(tuned, 1.0);
    }
  `;
  function shader(type, source) {
    const out = gl.createShader(type);
    gl.shaderSource(out, source);
    gl.compileShader(out);
    if (!gl.getShaderParameter(out, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(out));
    return out;
  }
  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch {
    canvas.remove();
    return;
  }

  gl.useProgram(program);
  function makeTexture(unit) {
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }
  const imageTexture = makeTexture(0), depthTexture = makeTexture(1);
  gl.uniform1i(gl.getUniformLocation(program, "uImage"), 0);
  gl.uniform1i(gl.getUniformLocation(program, "uDepth"), 1);
  const imageSize = gl.getUniformLocation(program, "uImageSize");
  const viewSize = gl.getUniformLocation(program, "uViewSize");
  const tiltUniform = gl.getUniformLocation(program, "uTilt");

  const depthMap = document.createElement("canvas");
  depthMap.width = 768; depthMap.height = 512;
  const ctx = depthMap.getContext("2d", { willReadFrequently: true });
  let depthPixels = null, tiltX = 0, tiltY = 0, targetTiltX = 0, targetTiltY = 0, frame = 0, ready = false;
  let meshWidth = 0, meshHeight = 0;

  function gray(value) { return `rgb(${value},${value},${value})`; }
  function shape(points, value, softness = 0) {
    ctx.save();
    if (softness) ctx.filter = `blur(${softness}px)`;
    ctx.fillStyle = gray(value);
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x * 768, y * 512) : ctx.moveTo(x * 768, y * 512));
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function ellipse(x, y, rx, ry, value, softness = 2) {
    ctx.save(); if (softness) ctx.filter = `blur(${softness}px)`;
    ctx.fillStyle = gray(value); ctx.beginPath(); ctx.ellipse(x * 768, y * 512, rx * 768, ry * 512, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  function makeDepthMap() {
    const corner = layer.dataset.scene === "corner";
    const base = ctx.createLinearGradient(0, 0, 0, 512);
    base.addColorStop(0, gray(corner ? 98 : 91));
    base.addColorStop(.48, gray(corner ? 118 : 128));
    base.addColorStop(.66, gray(corner ? 150 : 176));
    base.addColorStop(1, gray(226));
    ctx.fillStyle = base; ctx.fillRect(0, 0, 768, 512);

    if (!corner) {
      // Far garden beyond the broad rear window.
      shape([[.30, 0], [.89, 0], [.89, .58], [.30, .58]], 34, 3);
      // Near window frame, back wall, and the sofa behind the work surface.
      shape([[.255, 0], [.30, 0], [.30, .63], [.255, .63]], 126, 1);
      shape([[.89, 0], [.94, 0], [.94, .63], [.89, .63]], 142, 1);
      shape([[.62, .43], [.87, .43], [.91, .59], [.88, .69], [.65, .68], [.59, .58]], 176, 5);
      // Desk is the closest large surface; foreground edge is closest to camera.
      shape([[0, .625], [1, .625], [1, 1], [0, 1]], 215, 2);
      shape([[0, .68], [1, .68], [1, 1], [0, 1]], 238, 1);
      // Match the prominent objects in the supplied frame with separate depth islands.
      shape([[.32, .32], [.67, .32], [.68, .71], [.32, .71]], 166, 2); // monitor
      shape([[.02, .62], [.15, .61], [.16, .94], [.01, .95]], 204, 3); // book stack
      shape([[.12, .32], [.29, .32], [.30, .74], [.12, .75]], 194, 3); // lamp and phone
      shape([[.69, .48], [.83, .47], [.86, .72], [.68, .73]], 203, 4); // plant and turntable
      shape([[.72, .66], [.87, .66], [.87, .84], [.72, .84]], 227, 2); // shredder
      shape([[.30, .82], [.69, .81], [.73, 1], [.27, 1]], 249, 2); // open diary
      ellipse(.18, .51, .105, .22, 209, 4); // lamp shade/arm
      ellipse(.77, .60, .09, .11, 218, 4); // plant canopy
    } else {
      // Preserve the lounge photograph while giving the window, sofa, record shelf,
      // picture and floor lamp distinct depth values.
      shape([[0, 0], [.20, 0], [.20, .90], [0, .90]], 31, 3);
      shape([[.13, .39], [.64, .38], [.67, .91], [.60, .98], [.13, .93]], 203, 5);
      shape([[.46, .27], [.62, .27], [.63, .61], [.46, .61]], 224, 3);
      shape([[.63, .43], [.88, .43], [.88, .95], [.63, .95]], 232, 3);
      shape([[.82, .03], [1, .03], [1, .95], [.82, .95]], 190, 3);
      shape([[0, .87], [1, .87], [1, 1], [0, 1]], 239, 2);
      ellipse(.49, .48, .07, .14, 224, 2); // cat
    }
    depthPixels = ctx.getImageData(0, 0, depthMap.width, depthMap.height).data;
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, depthTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, depthMap);
    if (ready) { draw(); updateHotspots(); }
  }

  function buildMesh(aspect) {
    const columns = 180;
    const rows = Math.max(2, Math.round(columns / aspect));
    const verts = new Float32Array((columns + 1) * (rows + 1) * 5);
    let n = 0;
    for (let y = 0; y <= rows; y++) for (let x = 0; x <= columns; x++) {
      const u = x / columns, v = y / rows;
      verts[n++] = (u * 2 - 1) * aspect;
      verts[n++] = 1 - v * 2;
      verts[n++] = 0;
      verts[n++] = u;
      verts[n++] = 1 - v;
    }
    const indices = new Uint16Array(columns * rows * 6);
    n = 0;
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
      const a = y * (columns + 1) + x, b = a + 1, c = a + columns + 1, d = c + 1;
      indices[n++] = a; indices[n++] = c; indices[n++] = b;
      indices[n++] = b; indices[n++] = c; indices[n++] = d;
    }
    const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const ebo = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    const stride = 5 * Float32Array.BYTES_PER_ELEMENT;
    const p = gl.getAttribLocation(program, "aPosition"), uv = gl.getAttribLocation(program, "aUv");
    gl.enableVertexAttribArray(p); gl.vertexAttribPointer(p, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(uv); gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);
    meshWidth = columns; meshHeight = rows;
    canvas.dataset.mesh = `${columns}×${rows}`;
  }

  function coverPoint(u, v, aspect) {
    const imageAspect = image.naturalWidth / image.naturalHeight;
    if (aspect > imageAspect) v = .5 + (v - .5) * imageAspect / aspect;
    else u = .5 + (u - .5) * aspect / imageAspect;
    return [Math.max(0, Math.min(1, u)), Math.max(0, Math.min(1, v))];
  }
  function pointDepth(u, v, aspect) {
    if (!depthPixels) return .42;
    const q = coverPoint(u, v, aspect), x = Math.min(depthMap.width - 1, Math.max(0, Math.round(q[0] * (depthMap.width - 1))));
    const y = Math.min(depthMap.height - 1, Math.max(0, Math.round(q[1] * (depthMap.height - 1))));
    return depthPixels[(y * depthMap.width + x) * 4] / 255;
  }
  const hotspotAnchors = new WeakMap();
  function project(u, v, depth, aspect) {
    const distance = 6, z = (depth - .42) * .82, compensation = (distance - z) / distance, x = (u * 2 - 1) * aspect * compensation, y = (1 - v * 2) * compensation;
    const ay = tiltX * .34, ax = tiltY * .20;
    let px = Math.cos(ay) * x + Math.sin(ay) * z;
    let pz = -Math.sin(ay) * x + Math.cos(ay) * z;
    let py = Math.cos(ax) * y - Math.sin(ax) * pz;
    pz = Math.sin(ax) * y + Math.cos(ax) * pz;
    const perspective = distance / (distance - pz);
    return [.5 + px * perspective / (2 * aspect * 1.055), .5 - py * perspective / (2 * 1.055)];
  }
  function updateHotspots() {
    if (room.classList.contains("has-three-room")) return;
    if (!ready) return;
    const aspect = room.clientWidth / room.clientHeight;
    const cornerPositions = { weather: [.35, .25], computer: [.08, .42], music: [.31, .39], light: [.85, .25] };
    const targets = [...layer.querySelectorAll(".hot"), document.getElementById("shredderObject"), document.getElementById("incense")].filter(Boolean);
    for (const el of targets) {
      const key = el.id === "incense" ? "incense" : el.id === "shredderObject" ? "shredder" : el.dataset.open;
      let anchor = layer.dataset.scene === "corner" ? (cornerPositions[key] || (key === "incense" ? [.37, .42] : null)) : null;
      if (layer.dataset.scene === "corner" && (key === "shredder" || key === "photo" || key === "diary")) { el.style.visibility = "hidden"; continue; }
      if (!anchor) anchor = hotspotAnchors.get(el);
      if (!anchor) {
        const style = getComputedStyle(el), rawX = style.getPropertyValue("--x").trim(), rawY = style.getPropertyValue("--y").trim();
        let u = parseFloat(rawX) / 100, v = parseFloat(rawY) / 100;
        if (!Number.isFinite(u) || !Number.isFinite(v)) { u = parseFloat(style.left) / room.clientWidth; v = parseFloat(style.top) / room.clientHeight; }
        if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
        anchor = [u, v]; hotspotAnchors.set(el, anchor);
      }
      const [u, v] = anchor;
      const xy = project(u, v, pointDepth(u, v, aspect), aspect);
      el.style.left = `${xy[0] * 100}%`; el.style.top = `${xy[1] * 100}%`;
      el.style.visibility = "visible";
    }
  }

  function draw() {
    if (!ready || !meshWidth) return;
    gl.uniform2f(tiltUniform, tiltX, tiltY);
    gl.drawElements(gl.TRIANGLES, meshWidth * meshHeight * 6, gl.UNSIGNED_SHORT, 0);
  }
  function resize() {
    if (!ready) return;
    const rect = room.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5), width = Math.round(rect.width * dpr), height = Math.round(rect.height * dpr);
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    gl.viewport(0, 0, width, height);
    gl.uniform2f(viewSize, rect.width, rect.height);
    buildMesh(rect.width / rect.height); draw(); updateHotspots();
  }
  function updateImage() {
    if (!image.complete || !image.naturalWidth) return;
    // The 3D room replaces this photo view; opened from file:// the photo cannot
    // be uploaded to WebGL, so stop quietly instead of throwing.
    if (room.classList.contains("has-three-room") || location.protocol === "file:") return;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, imageTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.uniform2f(imageSize, image.naturalWidth, image.naturalHeight);
    makeDepthMap(); ready = true;
    room.classList.add("depth-ready"); canvas.classList.remove("camera-fade"); resize();
  }
  function easeCamera() {
    frame = 0;
    const dx = targetTiltX - tiltX, dy = targetTiltY - tiltY;
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
      tiltX = targetTiltX; tiltY = targetTiltY;
    } else {
      tiltX += dx * 0.14; tiltY += dy * 0.14;
    }
    draw(); updateHotspots();
    if (Math.abs(targetTiltX - tiltX) >= 0.001 || Math.abs(targetTiltY - tiltY) >= 0.001) frame = requestAnimationFrame(easeCamera);
  }
  window.setRoomParallax = (x, y) => {
    targetTiltX = Math.max(-1, Math.min(1, x)); targetTiltY = Math.max(-1, Math.min(1, y));
    if (!frame) frame = requestAnimationFrame(easeCamera);
  };
  image.addEventListener("load", () => { canvas.classList.add("camera-fade"); updateImage(); });
  new MutationObserver(makeDepthMap).observe(layer, { attributes: true, attributeFilter: ["data-scene"] });
  new ResizeObserver(resize).observe(room);
  if (image.complete) updateImage();
})();
