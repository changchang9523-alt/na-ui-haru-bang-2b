/* 3D reconstruction of the existing Korean study room. It gracefully leaves
   the photo/depth-parallax view in place if Three.js cannot be loaded. */
(() => {
  if (!window.THREE || !THREE.OrbitControls) return;
  const room = document.getElementById("room");
  const layer = document.getElementById("sceneLayer");
  const photo = document.getElementById("roomPhoto");
  if (!room || !layer || !photo) return;

  const scene = new THREE.Scene();
  // The gallery model is an alternate destination behind the physical door.
  const galleryWorld = new THREE.Group(); galleryWorld.name = "gallery destination"; galleryWorld.visible = false; scene.add(galleryWorld);
  let galleryMode = false, galleryVisibility = new Map(), galleryReturnButton = null, galleryHeight = 4;
  let windowMode = false, vinylMode = false, pcMode = false, pcScreenEl = null; // computer (monitor) close-up mode
  let gallerySunTick = null;
  // A warm room-colored exterior fill prevents black voids where the cutaway
  // model does not cover the full viewport.
  scene.background = new THREE.Color(0x111522);
  scene.fog = new THREE.Fog(0x111522, 20, 38);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
  camera.position.set(0, 2.2, 5.5);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // Keep pale upholstery and the oak desktop from clipping to white. The
  // reference has warm, readable shadows rather than a bright showroom wash.
  renderer.toneMappingExposure = .8;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.id = "room3dCanvas";
  renderer.domElement.setAttribute("aria-hidden", "true");
  layer.insertBefore(renderer.domElement, photo);
  // Soft equirectangular room illumination gives the imported PBR surfaces
  // believable broad reflections without changing the room background.
  const environmentCanvas = document.createElement("canvas"); environmentCanvas.width = 1024; environmentCanvas.height = 512;
  const environmentContext = environmentCanvas.getContext("2d");
  const environmentGradient = environmentContext.createLinearGradient(0, 0, 0, 512);
  environmentGradient.addColorStop(0, "#111725"); environmentGradient.addColorStop(.38, "#29303a"); environmentGradient.addColorStop(.66, "#46382b"); environmentGradient.addColorStop(1, "#0b0c12");
  environmentContext.fillStyle = environmentGradient; environmentContext.fillRect(0, 0, 1024, 512);
  environmentContext.filter = "blur(24px)";
  environmentContext.fillStyle = "#647b9a"; environmentContext.fillRect(90, 110, 290, 160);
  environmentContext.fillStyle = "#8d6040"; environmentContext.fillRect(650, 180, 150, 48);
  environmentContext.fillStyle = "#98774f"; environmentContext.fillRect(830, 86, 80, 210);
  environmentContext.filter = "none";
  const environmentMap = new THREE.CanvasTexture(environmentCanvas);
  environmentMap.mapping = THREE.EquirectangularReflectionMapping; environmentMap.encoding = THREE.sRGBEncoding; environmentMap.needsUpdate = true;
  scene.environment = environmentMap;

  const mat = (color, roughness = 0.78, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const plaster = mat(0xe5ddcf), trim = mat(0x63452f, .52), wood = mat(0x835a39, .55), lightWood = mat(0xc39b6a, .58),
    darkWood = mat(0x493426, .55), cream = mat(0xf0e6d5, .8), black = mat(0x171918, .38), screen = mat(0x233232, .24),
    metal = mat(0x907654, .34, .72), fabric = mat(0x57483d, .97), pillowMat = mat(0x796655, .95), green = mat(0x455a36, .8), paper = mat(0xe9dfc6, .9);
  function addMesh(geometry, material, position, parent = scene, cast = true, receive = true) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    parent.add(mesh);
    return mesh;
  }
  function box(w, h, d, material, x, y, z, parent = scene, bevel = false) {
    const geometry = bevel ? new THREE.BoxGeometry(w, h, d, 1, 1, 1) : new THREE.BoxGeometry(w, h, d);
    return addMesh(geometry, material, [x, y, z], parent);
  }
  function roundedBox(w, h, d, radius, material, x, y, z, parent = scene) {
    const r = Math.min(radius, w * .45, h * .45), shape = new THREE.Shape();
    shape.moveTo(-w / 2 + r, -h / 2);
    shape.lineTo(w / 2 - r, -h / 2); shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    shape.lineTo(w / 2, h / 2 - r); shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    shape.lineTo(-w / 2 + r, h / 2); shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    shape.lineTo(-w / 2, -h / 2 + r); shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: d, steps: 1, bevelEnabled: true, bevelSegments: 4, bevelSize: Math.min(.025, r * .28), bevelThickness: Math.min(.018, d * .16), curveSegments: 8 });
    geometry.translate(0, 0, -d / 2); geometry.computeVertexNormals();
    return addMesh(geometry, material, [x, y, z], parent);
  }
  function cylinder(rt, rb, h, material, x, y, z, parent = scene, seg = 24) {
    return addMesh(new THREE.CylinderGeometry(rt, rb, h, seg), material, [x, y, z], parent);
  }
  function sphere(r, material, x, y, z, parent = scene) {
    return addMesh(new THREE.SphereGeometry(r, 20, 14), material, [x, y, z], parent);
  }
  function line(a, b, radius, material, parent = scene) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
    const mesh = addMesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 10), material, start.clone().add(end).multiplyScalar(.5).toArray(), parent);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return mesh;
  }
  function curve(points, radius, material, parent = scene, tubular = 40) {
    const path = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    return addMesh(new THREE.TubeGeometry(path, tubular, radius, 8, false), material, [0, 0, 0], parent);
  }
  function lathe(profile, material, position, parent = scene, segments = 48) {
    return addMesh(new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(p[0], p[1])), segments), material, position, parent);
  }
  function torus(radius, tube, material, position, parent = scene, radial = 10, tubular = 40) {
    return addMesh(new THREE.TorusGeometry(radius, tube, radial, tubular), material, position, parent);
  }
  function ellipsoid(rx, ry, rz, material, position, parent = scene, detail = 32) {
    const mesh = addMesh(new THREE.SphereGeometry(1, detail, Math.max(18, detail >> 1)), material, position, parent);
    mesh.scale.set(rx, ry, rz); return mesh;
  }
  function roundedPlate(w, h, d, radius, material, position, parent = scene) {
    const mesh = roundedBox(w, h, d, radius, material, ...position, parent);
    return mesh;
  }
  function leafMesh(length, width, material, start, end, parent = scene, twist = 0) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(-width * .58, length * .24, -width * .22, length * .68);
    shape.quadraticCurveTo(0, length, width * .22, length * .68);
    shape.quadraticCurveTo(width * .58, length * .24, 0, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: .012, bevelEnabled: true, bevelSegments: 2, bevelSize: .008, bevelThickness: .008, curveSegments: 12 });
    const mesh = addMesh(geo, material, start, parent);
    const direction = new THREE.Vector3(...end).sub(new THREE.Vector3(...start));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    mesh.rotateY(twist);
    return mesh;
  }
  function woodTexture() {
    const c = document.createElement("canvas"); c.width = 1024; c.height = 512;
    const x = c.getContext("2d"); x.fillStyle = "#c7a575"; x.fillRect(0, 0, 1024, 512);
    // Layered, fine oak grain with small tone shifts reads as finished wood
    // under the broad window light instead of a single painted brown surface.
    for (let i = 0; i < 1150; i++) {
      x.strokeStyle = i % 5 ? "#e2c394" : "#89613b";
      x.globalAlpha = .018 + Math.random() * .075;
      x.lineWidth = .35 + Math.random() * 2.2;
      const y = Math.random() * 512, drift = (Math.random() - .5) * 14;
      x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(280, y + drift, 700, y - drift * .6, 1024, y + (Math.random() - .5) * 8); x.stroke();
    }
    for (let i = 0; i < 7; i++) {
      const y = 38 + i * 71, cx = 110 + Math.random() * 800;
      x.globalAlpha = .035; x.strokeStyle = "#74502f"; x.lineWidth = 1;
      for (let r = 4; r < 28; r += 5) { x.beginPath(); x.ellipse(cx, y, r * 2.8, r * .38, .02, 0, Math.PI * 2); x.stroke(); }
    }
    x.globalAlpha = 1;
    const texture = new THREE.CanvasTexture(c); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(2.4, 1.2); texture.anisotropy = renderer.capabilities.getMaxAnisotropy(); texture.encoding = THREE.sRGBEncoding;
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: .62 });
    material.bumpMap = texture; material.bumpScale = .018; return material;
  }
  function plasterFinish(material) {
    const c = document.createElement("canvas"); c.width = c.height = 512;
    const x = c.getContext("2d"); x.fillStyle = "#f2f0eb"; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 24000; i++) { const shade = 150 + Math.floor(Math.random() * 90); x.fillStyle = `rgba(${shade},${shade},${shade},${.025 + Math.random() * .05})`; const size = .4 + Math.random() * 1.4; x.fillRect(Math.random() * 512, Math.random() * 512, size, size); }
    const texture = new THREE.CanvasTexture(c); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(2.2, 1.5); texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    material.map = texture; material.bumpMap = texture; material.bumpScale = .012; material.roughness = .96; material.needsUpdate = true;
  }
  function leatherFinish(color, colorCode) {
    const c = document.createElement("canvas"); c.width = c.height = 512;
    const x = c.getContext("2d"); x.fillStyle = color; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 19000; i++) { x.fillStyle = i % 2 ? "rgba(255,255,255,.055)" : "rgba(58,45,31,.045)"; const size = .45 + Math.random() * 1.1; x.beginPath(); x.ellipse(Math.random() * 512, Math.random() * 512, size * 1.4, size, Math.random(), 0, Math.PI * 2); x.fill(); }
    const texture = new THREE.CanvasTexture(c); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(1.3, 1.6); texture.anisotropy = renderer.capabilities.getMaxAnisotropy(); texture.encoding = THREE.sRGBEncoding;
    const material = new THREE.MeshStandardMaterial({ color: colorCode, map: texture, roughness: .78, metalness: 0 });
    material.bumpMap = texture; material.bumpScale = .008; return material;
  }
  function wovenMaterial(color, colorCode) {
    const c=document.createElement("canvas");c.width=c.height=128;
    const g=c.getContext("2d");g.fillStyle=color;g.fillRect(0,0,128,128);
    for(let i=0;i<128;i+=3){g.strokeStyle=i%6?"#ffffff":"#000000";g.globalAlpha=.045;g.lineWidth=1;g.beginPath();g.moveTo(i,0);g.lineTo(i,128);g.stroke();g.beginPath();g.moveTo(0,i);g.lineTo(128,i);g.stroke();}
    g.globalAlpha=1;
    const texture=new THREE.CanvasTexture(c);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(2,2);texture.encoding=THREE.sRGBEncoding;texture.anisotropy=renderer.capabilities.getMaxAnisotropy();
    return new THREE.MeshStandardMaterial({color:colorCode,map:texture,bumpMap:texture,bumpScale:.018,roughness:.94});
  }
  function drapedFabric(width,height,folds,material,position,parent=scene) {
    const cols=32,rows=24,vertices=[],uv=[],indices=[];
    for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
      const u=col/cols,v=row/rows,x=(u-.5)*width;
      const z=Math.cos(u*Math.PI*2*folds)*.035 + Math.cos(u*Math.PI*2*folds*2)*.009;
      vertices.push(x,height*(.5-v),z);
      uv.push(u*2,v*2);
      if(row<rows&&col<cols){const a=row*(cols+1)+col,b=a+cols+1;indices.push(a,b,a+1,b,b+1,a+1);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
    const mesh=addMesh(geo,material,position,parent);mesh.material.side=THREE.DoubleSide;return mesh;
  }
  const grainWood = woodTexture();
  grainWood.color.set(0xc3925e);
  grainWood.roughness = .66;
  const floorGrain = grainWood.clone();
  floorGrain.name = "oak floor boards";
  floorGrain.map = grainWood.map.clone();
  floorGrain.map.repeat.set(.8, 5.4);
  floorGrain.map.rotation = Math.PI / 2;
  floorGrain.map.center.set(.5, .5);
  floorGrain.map.needsUpdate = true;
  floorGrain.bumpMap = floorGrain.map;
  const wallpaperTexture = new THREE.Texture();
  window.roomAssetURL("assets/final-room/stranger-wallpaper-seamless.png").then(url => new THREE.TextureLoader().load(url, t => { wallpaperTexture.image = t.image; wallpaperTexture.needsUpdate = true; render(); }));
  wallpaperTexture.wrapS = wallpaperTexture.wrapT = THREE.RepeatWrapping;
  wallpaperTexture.repeat.set(1.15, .9); wallpaperTexture.encoding = THREE.sRGBEncoding;
  wallpaperTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  plaster.map = wallpaperTexture; plaster.bumpMap = wallpaperTexture; plaster.bumpScale = .006; plaster.color.setHex(0xffffff); plaster.roughness = .96; plaster.needsUpdate = true;

  // Photo-scanned CC0 materials replace the procedural color swatches on the
  // largest surfaces. Maps load progressively, so the room remains usable if
  // a texture host is unavailable.
  const pbrLoader = new THREE.TextureLoader();
  pbrLoader.setCrossOrigin("anonymous");
  const pbrRoot = "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/";
  function loadSurfaceMap(url, repeat, srgb = false) {
    const texture = pbrLoader.load(url, undefined, undefined, () => console.warn("Surface detail texture unavailable:", url));
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (srgb) texture.encoding = THREE.sRGBEncoding;
    return texture;
  }
  function useWoodPbr(material, asset, repeat, tint = 0xffffff) {
    const base = `${pbrRoot}${asset}/${asset}_`;
    material.map = loadSurfaceMap(`${base}diff_2k.jpg`, repeat, true);
    material.roughnessMap = loadSurfaceMap(`${base}rough_2k.jpg`, repeat);
    material.normalMap = loadSurfaceMap(`${base}nor_gl_2k.jpg`, repeat);
    material.normalScale.set(.32,.32);
    material.bumpMap = null;
    material.color.setHex(tint);
    material.roughness = .66;
    material.needsUpdate = true;
  }
  useWoodPbr(grainWood, "oak_veneer_02", [4.2,1.45], 0xe2c69f);
  useWoodPbr(floorGrain, "oak_wood_planks", [.72,4.4], 0xe4c9a2);
  // Use the scanned oak grain for individual, realistically sized boards.
  // Each board gets a small UV variation so the whole floor does not read as
  // one stretched image or as oversized, uninterrupted strips.
  const floorPlankVariants = Array.from({length: 12}, (_, index) => {
    const material = grainWood.clone();
    for (const key of ["map", "roughnessMap", "normalMap"]) {
      if (!material[key]) continue;
      material[key] = material[key].clone();
      material[key].wrapS = material[key].wrapT = THREE.RepeatWrapping;
      material[key].repeat.set(.32, .72);
      material[key].rotation = Math.PI / 2;
      material[key].center.set(.5, .5);
      material[key].offset.set((index % 4) * .19, Math.floor(index / 4) * .23);
      material[key].needsUpdate = true;
    }
    material.color.setHex([0xf1d9b5,0xe8cca1,0xf5dfbd,0xe7c79c][index % 4]);
    material.roughness = .74;
    if (material.normalMap) material.normalScale.set(.22,.22);
    material.bumpMap = null;
    material.needsUpdate = true;
    return material;
  });
  function tintLeatherTexture(source, hex) {
    const image = source.image;
    if (!image || !image.width || !image.height) return source;
    const c = document.createElement("canvas"); c.width = image.width; c.height = image.height;
    const cx = c.getContext("2d", { willReadFrequently: true });
    cx.drawImage(image,0,0);
    const pixels = cx.getImageData(0,0,c.width,c.height), data = pixels.data;
    const base = new THREE.Color(hex); const br = Math.round(base.r*255), bg = Math.round(base.g*255), bb = Math.round(base.b*255);
    for(let i=0;i<data.length;i+=4){
      const l=(data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722)/255;
      const factor=.58+l*.54;
      data[i]=Math.min(255,br*factor);data[i+1]=Math.min(255,bg*factor);data[i+2]=Math.min(255,bb*factor);
    }
    cx.putImageData(pixels,0,0);
    const out = new THREE.CanvasTexture(c); out.wrapS=out.wrapT=THREE.RepeatWrapping;out.repeat.set(2,2);out.encoding=THREE.sRGBEncoding;out.anisotropy=renderer.capabilities.getMaxAnisotropy();return out;
  }
  function useLeatherPbr(material, hex, repeat=[1.5,1.6]) {
    const root="https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/fabric_leather_01/fabric_leather_01_";
    pbrLoader.load(`${root}diff_2k.jpg`, tex=>{material.map=tintLeatherTexture(tex,hex);material.color.setHex(0xffffff);material.needsUpdate=true;},undefined,()=>{});
    const rough=pbrLoader.load(`${root}rough_2k.jpg`,tex=>{tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(...repeat);material.roughnessMap=tex;material.needsUpdate=true;},undefined,()=>{});
    rough.wrapS=rough.wrapT=THREE.RepeatWrapping;rough.repeat.set(...repeat);
    const normal=pbrLoader.load(`${root}nor_gl_2k.jpg`,tex=>{tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(...repeat);material.normalMap=tex;material.normalScale.set(.28,.28);material.needsUpdate=true;},undefined,()=>{});
    normal.wrapS=normal.wrapT=THREE.RepeatWrapping;normal.repeat.set(...repeat);
    material.roughness=.82;
  }

  // Korean home study nook: warm plaster, timber trim, window, desk and lounge corner.
  const backWall = new THREE.Group(); backWall.name = "inferred rear wall"; scene.add(backWall);
  // Leave a real opening behind the existing window image. This lets the
  // window-side sun cast into the room without changing the outdoor artwork.
  box(.925, 4.4, .18, plaster, -3.9375, 2.2, -3.05, backWall);
  box(1.625, 4.4, .18, plaster, 3.5875, 2.2, -3.05, backWall);
  box(6.25, 1.31, .18, plaster, -.35, .655, -3.05, backWall);
  box(6.25, .27, .18, plaster, -.35, 4.265, -3.05, backWall);
  const leftWall = new THREE.Group(); leftWall.name = "left wall"; scene.add(leftWall);
  const rightWall = new THREE.Group(); rightWall.name = "right wall"; scene.add(rightWall);
  // Give the left side wall a real doorway opening for the mood gallery.
  // The full-height wall is split around the opening instead of hiding a flat
  // door decal over solid plaster.
  box(.18, 4.4, 1.95, plaster, -4.4, 2.2, -2.125, leftWall);
  box(.18, 4.4, 4.25, plaster, -4.4, 2.2, 2.375, leftWall);
  box(.18, 2.1, 1.4, plaster, -4.4, 3.35, -.45, leftWall);
  box(.18, .08, 1.4, plaster, -4.4, .04, -.45, leftWall);
  box(.18, 4.4, 7.6, plaster, 4.4, 2.2, .7, rightWall);
  // A paneled oak door and trim sit within the new side-wall opening.
  box(.13,.13,1.40,trim,-4.27,2.29,-.45,leftWall);
  box(.13,2.24,.13,trim,-4.27,1.13,-1.085,leftWall);
  box(.13,2.24,.13,trim,-4.27,1.13,.185,leftWall);
  roundedBox(.12,.04,1.34,.012,lightWood,-4.28,.06,-.45,leftWall);
  const galleryDoorHinge = new THREE.Group(); galleryDoorHinge.position.set(-4.285,0,-1.02); leftWall.add(galleryDoorHinge);
  const galleryDoorLeaf = new THREE.Group(); galleryDoorHinge.add(galleryDoorLeaf);
  roundedBox(.085,2.17,1.08,.025,grainWood,-.02,1.13,.54,galleryDoorLeaf);
  roundedBox(.045,.68,.36,.018,wood,.03,.57,.53,galleryDoorLeaf);
  roundedBox(.045,.68,.36,.018,wood,.03,1.47,.53,galleryDoorLeaf);
  for(const y of [.35,1.91]){
    roundedBox(.025,.13,.11,.018,metal,.045,y,.10,galleryDoorLeaf);
    box(.018,.075,.025,trim,.065,y,.10,galleryDoorLeaf);
  }
  const doorKnob = sphere(.055,metal,.105,1.08,.92,galleryDoorLeaf);
  cylinder(.024,.024,.09,metal,.075,1.08,.92,galleryDoorLeaf,20).rotation.z=Math.PI/2;
  const doorKnobBack = sphere(.045,metal,-.075,1.08,.92,galleryDoorLeaf);
  let galleryDoorAngle=0, galleryDoorMotion=0;
  function swingGalleryDoor(target){
    cancelAnimationFrame(galleryDoorMotion);
    const from=galleryDoorHinge.rotation.y, started=performance.now(), duration=360;
    const move=now=>{const t=Math.min(1,(now-started)/duration),e=1-Math.pow(1-t,3);galleryDoorHinge.rotation.y=from+(target-from)*e;render();if(t<1)galleryDoorMotion=requestAnimationFrame(move);else galleryDoorMotion=0;};
    galleryDoorAngle=target;galleryDoorMotion=requestAnimationFrame(move);
  }
  window.openMoodGalleryDoor=()=>{
    window.__leaveRoomModesNow?.();
    swingGalleryDoor(1.08);
    setTimeout(()=>window.enterGreatDrawingRoom?.(),390);
  };
  // The open-front cutaway keeps the modeled room easy to inspect while the
  // rear and side walls remain visible as the camera moves around the room.
  box(8.8, .18, 7.6, darkWood, 0, -.1, .7);
  const floorMinX = -4.4, floorMaxX = 4.4, floorMinZ = -3.1, floorMaxZ = 4.5;
  const plankWidth = .275, plankLength = 1.08, seam = .008;
  const plankRows = Math.ceil((floorMaxX - floorMinX) / plankWidth);
  for (let row = 0; row < plankRows; row++) {
    const x0 = floorMinX + row * plankWidth;
    const width = Math.min(plankWidth, floorMaxX - x0) - seam;
    const stagger = (row % 2) * plankLength * .5;
    for (let start = floorMinZ - stagger; start < floorMaxZ; start += plankLength) {
      const z0 = Math.max(floorMinZ, start), z1 = Math.min(floorMaxZ, start + plankLength);
      if (z1 - z0 <= .04) continue;
      const board = floorPlankVariants[(row * 7 + Math.floor((start + 8) / plankLength) * 5) % floorPlankVariants.length];
      box(width, .018, z1 - z0 - seam, board, x0 + (plankWidth - seam) / 2, -.001, (z0 + z1) / 2, scene, false);
    }
  }
  box(8.8, .15, .16, trim, 0, .26, -2.94);
  box(.11, 4.2, .15, trim, -4.25, 2.15, -2.92);
  box(.11, 4.2, .15, trim, 4.25, 2.15, -2.92);
  // Keep the room open above the camera view; omit a roofline beam that read
  // like an exposed ceiling edge in the full-screen framing.

  // A photographic Han River night view fills the window within this room camera.
  const windowPanel = box(6.25, 2.82, .035, mat(0x090d16, .2, .05), -.35, 2.72, -2.91, scene, false);
  windowPanel.visible = false;
  const cityCanvas = document.createElement("canvas"); cityCanvas.width = 1200; cityCanvas.height = 544;
  // Async image/resize callbacks can request an early frame before the
  // projected interaction anchors and overlay rectangles have been declared.
  let interactionProjectionReady = false;
  const cityContext = cityCanvas.getContext("2d");
  const cityLightCanvas=document.createElement("canvas"); cityLightCanvas.width=1200; cityLightCanvas.height=544;
  const cityLightContext=cityLightCanvas.getContext("2d"); let cityWindowCells=[];
  const cityPhoto = new Image();
  cityPhoto.onload = () => {
    const cropHeight = cityPhoto.width / (cityCanvas.width / cityCanvas.height);
    cityContext.drawImage(cityPhoto, 0, (cityPhoto.height-cropHeight)/2, cityPhoto.width, cropHeight, 0, 0, cityCanvas.width, cityCanvas.height);
    const pixels=cityContext.getImageData(0,0,cityCanvas.width,cityCanvas.height).data;
    for(let y=120;y<245;y+=2)for(let x=8;x<1190;x+=3){const p=(y*cityCanvas.width+x)*4,r=pixels[p],g=pixels[p+1],b=pixels[p+2];if(r>90&&g>70&&b>38&&r>=g*.91&&r-g<100&&Math.random()<.18)cityWindowCells.push({x,y,w:1+Math.random()*2,h:2+Math.random()*3,phase:Math.random()*6.28,level:.28+Math.random()*.58});}
    refreshCityWindows(performance.now()); cityTexture.needsUpdate = true; window.__setupCityBeacons?.(cityWindowCells); render();
  };
  window.roomAssetURL("assets/final-room/han-river-night.png").then(url => { cityPhoto.src = url; });
  const cityTexture = new THREE.CanvasTexture(cityCanvas); cityTexture.encoding = THREE.sRGBEncoding;
  cityTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const cityMaterial = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: cityTexture }, uTime: { value: 0 }, uWeather: { value: 0 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader: "uniform sampler2D uMap; uniform float uTime; uniform float uWeather; varying vec2 vUv; void main(){ vec2 uv=vUv; float water=1.0-smoothstep(.39,.52,vUv.y); float wave=sin(vUv.y*118.0+uTime*1.35)+sin(vUv.y*73.0-uTime*1.05)+sin(vUv.y*39.0+uTime*.72); uv.x+=water*wave*.0022; uv.y+=water*sin(vUv.x*30.0+uTime*1.1)*.003; vec4 color=texture2D(uMap,uv); float haze=smoothstep(1.5,2.5,uWeather)*(.32+.25*(1.0-vUv.y)); color.rgb=mix(color.rgb,vec3(.48,.50,.52),haze); float rain=(1.0-smoothstep(1.5,2.5,uWeather))*smoothstep(.5,1.5,uWeather); color.rgb*=1.0-.12*rain; gl_FragColor=color; }",
    toneMapped: false
  });
  const cityBackdrop = new THREE.Mesh(new THREE.PlaneGeometry(14, 6.35), cityMaterial);
  cityBackdrop.position.set(-.35, 2.72, -12.8); scene.add(cityBackdrop);
  const cityLightTexture=new THREE.CanvasTexture(cityLightCanvas); cityLightTexture.encoding=THREE.sRGBEncoding;
  const cityLightPlane=new THREE.Mesh(new THREE.PlaneGeometry(14,6.35),new THREE.MeshBasicMaterial({map:cityLightTexture,transparent:true,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending}));
  cityLightPlane.position.set(-.35,2.72,-12.77); scene.add(cityLightPlane);
  function refreshCityWindows(now){
    cityLightContext.clearRect(0,0,1200,544);
    for(const c of cityWindowCells){const pulse=.58+.26*Math.sin(now*.0013+c.phase);const blink=Math.random()<.003?Math.random()*.12:1;cityLightContext.globalAlpha=c.level*pulse*blink*.30;cityLightContext.fillStyle=(c.phase%3<1)?"#ffd99b":"#fff0cf";cityLightContext.shadowColor="#ffc66d";cityLightContext.shadowBlur=2.5;cityLightContext.fillRect(c.x,c.y,c.w,c.h);}
    // Moving headlights and tail lamps follow the bridge in the night photo.
    const roadY=324, travel=(now*.018)%1380;
    for(let i=0;i<7;i++){
      const x=170+((travel+i*203)%900), y=roadY+Math.sin((x-170)/730*Math.PI)*8;
      const fade=Math.min(1,(x-170)/75,(1070-x)/80);
      cityLightContext.globalAlpha=Math.max(0,fade)*(.58+.22*Math.sin(now*.004+i));
      cityLightContext.shadowColor="#fff0d1";cityLightContext.shadowBlur=8;cityLightContext.fillStyle="#fff0d1";
      cityLightContext.beginPath();cityLightContext.ellipse(x,y,4.4,1.45,-.05,0,Math.PI*2);cityLightContext.fill();
      cityLightContext.shadowColor="#ff4a54";cityLightContext.shadowBlur=5;cityLightContext.fillStyle="#ff4a54";
      cityLightContext.beginPath();cityLightContext.ellipse(x-12,y+1,2.6,1.05,-.05,0,Math.PI*2);cityLightContext.fill();
    }
    cityLightContext.globalAlpha=1;cityLightContext.shadowBlur=0;cityLightTexture.needsUpdate=true;
  }
  let lastCityWindowFrame=0;
  // Distant fireworks use smooth glowing sparks, short trails and a brief glow
  // over the skyline, rather than the earlier square pixel particles.
  const fireworkCount=300,fireworkPositions=new Float32Array(fireworkCount*3),fireworkColors=new Float32Array(fireworkCount*3),fireworkBaseColors=new Float32Array(fireworkCount*3),fireworkAlpha=new Float32Array(fireworkCount),fireworkSizes=new Float32Array(fireworkCount),fireworkPrevious=new Float32Array(fireworkCount*3),fireworkVelocity=Array.from({length:fireworkCount},()=>new THREE.Vector3());
  const fireworkGeometry=new THREE.BufferGeometry();fireworkGeometry.setAttribute("position",new THREE.BufferAttribute(fireworkPositions,3));fireworkGeometry.setAttribute("color",new THREE.BufferAttribute(fireworkColors,3));fireworkGeometry.setAttribute("aAlpha",new THREE.BufferAttribute(fireworkAlpha,1));fireworkGeometry.setAttribute("aSize",new THREE.BufferAttribute(fireworkSizes,1));
  const glowCanvas=document.createElement("canvas");glowCanvas.width=glowCanvas.height=64;const glowCtx=glowCanvas.getContext("2d"),glowGradient=glowCtx.createRadialGradient(32,32,0,32,32,32);glowGradient.addColorStop(0,"rgba(255,255,255,1)");glowGradient.addColorStop(.12,"rgba(255,255,255,.9)");glowGradient.addColorStop(.42,"rgba(255,255,255,.28)");glowGradient.addColorStop(1,"rgba(255,255,255,0)");glowCtx.fillStyle=glowGradient;glowCtx.fillRect(0,0,64,64);const glowTexture=new THREE.CanvasTexture(glowCanvas);
  const fireworkMaterial=new THREE.PointsMaterial({map:glowTexture,size:13,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:1,alphaTest:.005,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
  const fireworkPoints=new THREE.Points(fireworkGeometry,fireworkMaterial);fireworkPoints.frustumCulled=false;scene.add(fireworkPoints);fireworkPoints.visible=false;
  const fireworkTrailPositions=new Float32Array(fireworkCount*6),fireworkTrailColors=new Float32Array(fireworkCount*6),fireworkTrailGeometry=new THREE.BufferGeometry();fireworkTrailGeometry.setAttribute("position",new THREE.BufferAttribute(fireworkTrailPositions,3));fireworkTrailGeometry.setAttribute("color",new THREE.BufferAttribute(fireworkTrailColors,3));
  const fireworkTrail=new THREE.LineSegments(fireworkTrailGeometry,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.40,depthWrite:false,blending:THREE.AdditiveBlending}));fireworkTrail.frustumCulled=false;scene.add(fireworkTrail);fireworkTrail.visible=false;
  const fireworkLight=new THREE.PointLight(0xffc38a,0,3.8,2);
  let nextFireworkAt=performance.now()+13800+Math.random()*500,fireworkStarted=0,fireworkLife=4.6,fireworkPalette=0;
  const fireworkPaletteColors=[new THREE.Color(0xff4f78),new THREE.Color(0x3ccaff),new THREE.Color(0xffd66f),new THREE.Color(0x69edaa),new THREE.Color(0xf06bff),new THREE.Color(0xffefd1)];
  let fireworkAudio=null;
  function unlockFireworkAudio(){if(fireworkAudio)return;const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;fireworkAudio=new Audio();fireworkAudio.resume().catch(()=>{});}
  // Fireworks are switched off (v44) to keep the page light.
  function playFireworkSound(){if(!fireworkAudio||fireworkAudio.state!=="running")return;const t=fireworkAudio.currentTime,osc=fireworkAudio.createOscillator(),og=fireworkAudio.createGain();osc.type="sine";osc.frequency.setValueAtTime(78,t);osc.frequency.exponentialRampToValueAtTime(34,t+.78);og.gain.setValueAtTime(.0001,t);og.gain.exponentialRampToValueAtTime(.09,t+.035);og.gain.exponentialRampToValueAtTime(.0001,t+1.1);osc.connect(og).connect(fireworkAudio.destination);osc.start(t);osc.stop(t+1.12);}
  function launchFirework(now){fireworkStarted=now;fireworkPalette=Math.floor(Math.random()*fireworkPaletteColors.length);const cx=-2.7+Math.random()*4.9,cy=3.62+Math.random()*.34,color=fireworkPaletteColors[fireworkPalette];fireworkLight.color.copy(color);fireworkLight.position.set(cx,cy,-2.63);fireworkPoints.visible=true;fireworkTrail.visible=true;for(let i=0;i<fireworkCount;i++){const j=i*3,angle=Math.random()*Math.PI*2,vertical=Math.random()*2-1,speed=.72+Math.random()*1.1,flat=Math.sqrt(1-vertical*vertical);fireworkPositions[j]=cx;fireworkPositions[j+1]=cy;fireworkPositions[j+2]=-2.64;fireworkPrevious[j]=cx;fireworkPrevious[j+1]=cy;fireworkPrevious[j+2]=-2.64;fireworkVelocity[i].set(Math.cos(angle)*flat*speed,vertical*speed,Math.sin(angle)*.035);const c=fireworkPaletteColors[(fireworkPalette+(Math.random()<.18?Math.ceil(Math.random()*3):0))%fireworkPaletteColors.length];fireworkBaseColors[j]=fireworkColors[j]=c.r;fireworkBaseColors[j+1]=fireworkColors[j+1]=c.g;fireworkBaseColors[j+2]=fireworkColors[j+2]=c.b;fireworkAlpha[i]=.98;fireworkSizes[i]=2.0+Math.random()*2.5;}fireworkGeometry.attributes.position.needsUpdate=true;fireworkGeometry.attributes.color.needsUpdate=true;fireworkGeometry.attributes.aAlpha.needsUpdate=true;fireworkGeometry.attributes.aSize.needsUpdate=true;playFireworkSound();}
  function animateExterior(now,delta){
    if(now-lastCityWindowFrame>720){refreshCityWindows(now);lastCityWindowFrame=now;}
    if(fireworkPoints.visible){const elapsed=Math.min((now-fireworkStarted)/1000,fireworkLife),fade=Math.max(0,1-elapsed/fireworkLife);for(let i=0;i<fireworkCount;i++){const j=i*3,k=i*6;fireworkPrevious[j]=fireworkPositions[j]-fireworkVelocity[i].x*.14;fireworkPrevious[j+1]=fireworkPositions[j+1]-fireworkVelocity[i].y*.14;fireworkPrevious[j+2]=fireworkPositions[j+2];fireworkPositions[j]+=fireworkVelocity[i].x*delta*.001;fireworkPositions[j+1]+=fireworkVelocity[i].y*delta*.001-.13*delta*.001*elapsed;fireworkPositions[j+2]+=fireworkVelocity[i].z*delta*.001;fireworkVelocity[i].multiplyScalar(.999);const particleFade=fade*Math.max(.16,Math.sin(Math.min(1,elapsed/.12)*Math.PI*.5));fireworkColors[j]=fireworkBaseColors[j]*particleFade;fireworkColors[j+1]=fireworkBaseColors[j+1]*particleFade;fireworkColors[j+2]=fireworkBaseColors[j+2]*particleFade;fireworkAlpha[i]=particleFade;fireworkTrailPositions[k]=fireworkPrevious[j];fireworkTrailPositions[k+1]=fireworkPrevious[j+1];fireworkTrailPositions[k+2]=fireworkPrevious[j+2];fireworkTrailPositions[k+3]=fireworkPositions[j];fireworkTrailPositions[k+4]=fireworkPositions[j+1];fireworkTrailPositions[k+5]=fireworkPositions[j+2];for(let q=0;q<2;q++){fireworkTrailColors[k+q*3]=fireworkColors[j];fireworkTrailColors[k+q*3+1]=fireworkColors[j+1];fireworkTrailColors[k+q*3+2]=fireworkColors[j+2];}}fireworkGeometry.attributes.position.needsUpdate=true;fireworkGeometry.attributes.color.needsUpdate=true;fireworkGeometry.attributes.aAlpha.needsUpdate=true;fireworkTrailGeometry.attributes.position.needsUpdate=true;fireworkTrailGeometry.attributes.color.needsUpdate=true;fireworkLight.intensity=elapsed<.24?.85*Math.sin(Math.PI*elapsed/.24):Math.max(0,1-(elapsed-.24)/.55)*.12;if(elapsed>=fireworkLife){fireworkPoints.visible=false;fireworkTrail.visible=false;fireworkLight.intensity=0;}}
  }
  // v52: weather outside the window lives in depth between the glass and the
  // skyline, so rain and snow read as real and blend with the photo.
  // Presets cross-fade (no hard switch) and the backdrop shader picks up a
  // matching mood: rain = darker wet mist, snow = soft bright night haze.
  const weatherGroup = new THREE.Group(); weatherGroup.name = "outside weather"; scene.add(weatherGroup);
  const WIN = { cx: -.35, cy: 2.72, hw: 3.15, hh: 1.42, z: -2.95, eye: 5.6 };
  const spanAt = z => (WIN.eye - z) / (WIN.eye - WIN.z);
  function spawn(arr, i, top) {
    const z = -3.25 - Math.random() * 7.5, k = spanAt(z) * 1.08;
    arr[i * 3] = WIN.cx + (Math.random() * 2 - 1) * WIN.hw * k;
    arr[i * 3 + 1] = top ? WIN.cy + WIN.hh * k + Math.random() * .4 * k : WIN.cy + (Math.random() * 2 - 1) * WIN.hh * k;
    arr[i * 3 + 2] = z;
  }
  const RAIN_N = 650, rainHead = new Float32Array(RAIN_N * 3), rainSpeed = new Float32Array(RAIN_N);
  for (let i = 0; i < RAIN_N; i++) { spawn(rainHead, i, false); rainSpeed[i] = .0075 + Math.random() * .0045; }
  const rainPos = new Float32Array(RAIN_N * 6), rainAlpha = new Float32Array(RAIN_N * 2);
  for (let i = 0; i < RAIN_N; i++) { const a = .25 + Math.random() * .55; rainAlpha[i * 2] = 0; rainAlpha[i * 2 + 1] = a; }
  const rainGeometry = new THREE.BufferGeometry();
  rainGeometry.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
  rainGeometry.setAttribute("aAlpha", new THREE.BufferAttribute(rainAlpha, 1));
  const rainMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uAmount: { value: 0 } },
    vertexShader: "attribute float aAlpha; varying float vA; varying vec3 vW; varying vec2 vH; void main(){ vA=aAlpha; vW=(modelMatrix*vec4(position,1.)).xyz; vec3 cp=cameraPosition; float tt=(-2.92-cp.z)/(vW.z-cp.z); vH=(cp+(vW-cp)*tt).xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: "uniform float uAmount; varying float vA; varying vec3 vW; varying vec2 vH; void main(){ if(vW.z>-2.95||vH.x<-3.45||vH.x>2.76||vH.y<1.32||vH.y>4.11) discard; gl_FragColor=vec4(vec3(.62,.68,.74)*vA*uAmount*.5,1.); }"
  });
  const rainStreaks = new THREE.LineSegments(rainGeometry, rainMat); rainStreaks.frustumCulled = false; weatherGroup.add(rainStreaks);
  const SNOW_N = 1100, snowPos = new Float32Array(SNOW_N * 3), snowSize = new Float32Array(SNOW_N), snowSeed = new Float32Array(SNOW_N);
  for (let i = 0; i < SNOW_N; i++) { spawn(snowPos, i, false); snowSize[i] = .02 + Math.random() * .035; snowSeed[i] = Math.random() * 100; }
  const snowGeometry = new THREE.BufferGeometry();
  snowGeometry.setAttribute("position", new THREE.BufferAttribute(snowPos, 3));
  snowGeometry.setAttribute("aSize", new THREE.BufferAttribute(snowSize, 1));
  snowGeometry.setAttribute("aSeed", new THREE.BufferAttribute(snowSeed, 1));
  const snowMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uAmount: { value: 0 }, uScale: { value: 600 } },
    vertexShader: "attribute float aSize; attribute float aSeed; varying float vA; varying vec3 vW; varying vec2 vH; void main(){ vW=(modelMatrix*vec4(position,1.)).xyz; vec3 cp=cameraPosition; float tt=(-2.92-cp.z)/(vW.z-cp.z); vH=(cp+(vW-cp)*tt).xy; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=aSize*600./-mv.z; vA=.55+.45*fract(aSeed); gl_Position=projectionMatrix*mv; }",
    fragmentShader: "uniform float uAmount; varying float vA; varying vec3 vW; varying vec2 vH; void main(){ if(vW.z>-2.95||vH.x<-3.45||vH.x>2.76||vH.y<1.32||vH.y>4.11) discard; float d=length(gl_PointCoord-.5); float a=smoothstep(.5,.08,d); gl_FragColor=vec4(vec3(.95,.93,.9),a*vA*uAmount*.8); }"
  });
  const snowFlakes = new THREE.Points(snowGeometry, snowMat); snowFlakes.frustumCulled = false; weatherGroup.add(snowFlakes);
  // smoothed preset weights
  const weatherNow = { rain: 0, snow: 0, haze: 0 }, weatherTarget = { rain: 0, snow: 0, haze: 0 };
  cityMaterial.uniforms.uRain = { value: 0 }; cityMaterial.uniforms.uSnow = { value: 0 }; cityMaterial.uniforms.uHaze = { value: 0 };
  cityMaterial.fragmentShader = "uniform sampler2D uMap; uniform float uTime; uniform float uWeather; uniform float uRain; uniform float uSnow; uniform float uHaze; varying vec2 vUv; void main(){ vec2 uv=vUv; float water=1.0-smoothstep(.39,.52,vUv.y); float wave=sin(vUv.y*118.0+uTime*1.35)+sin(vUv.y*73.0-uTime*1.05)+sin(vUv.y*39.0+uTime*.72); uv.x+=water*wave*.0022*(1.0+uRain*.8); uv.y+=water*sin(vUv.x*30.0+uTime*1.1)*.003; vec4 color=texture2D(uMap,uv); vec3 soft=(texture2D(uMap,uv+vec2(.0025,0.)).rgb+texture2D(uMap,uv-vec2(.0025,0.)).rgb+texture2D(uMap,uv+vec2(0.,.004)).rgb+texture2D(uMap,uv-vec2(0.,.004)).rgb)*.25; float wet=uRain+uSnow*.6; color.rgb=mix(color.rgb,soft*1.08,wet*.55); float lum=dot(color.rgb,vec3(.3,.59,.11)); color.rgb=mix(color.rgb,vec3(lum),uRain*.18+uSnow*.25); color.rgb*=1.0-.2*uRain; float mist=(1.0-vUv.y)*.35+.12; color.rgb=mix(color.rgb,vec3(.11,.12,.14),uRain*mist*.55); color.rgb=mix(color.rgb,vec3(.30,.27,.26),uSnow*(.18+.22*vUv.y)); color.rgb+=vec3(.05,.035,.02)*uSnow*vUv.y; color.rgb=mix(color.rgb,vec3(.48,.50,.52),uHaze*(.32+.25*(1.0-vUv.y))); gl_FragColor=color; }";
  cityMaterial.needsUpdate = true;
  window.setRoomWeather = weather => {
    cityMaterial.uniforms.uWeather.value = weather === "rain" ? 1 : weather === "haze" ? 2 : weather === "snow" ? 3 : 0;
    weatherTarget.rain = weather === "rain" ? 1 : 0; window.setWeatherSound?.(weather); weatherTarget.snow = weather === "snow" ? 1 : 0; weatherTarget.haze = weather === "haze" || weather === "cloudy" ? .6 : 0;
  };
  function animateWeather(now, dt) {
    dt = Math.min(dt, 60);
    const k = 1 - Math.exp(-dt / 900);
    for (const key in weatherNow) weatherNow[key] += (weatherTarget[key] - weatherNow[key]) * k;
    const r = weatherNow.rain, sn = weatherNow.snow;
    cityMaterial.uniforms.uRain.value = r; cityMaterial.uniforms.uSnow.value = sn; cityMaterial.uniforms.uHaze.value = weatherNow.haze;
    rainMat.uniforms.uAmount.value = r; snowMat.uniforms.uAmount.value = sn;
    rainStreaks.visible = r > .01; snowFlakes.visible = sn > .01;
    if (rainStreaks.visible) {
      for (let i = 0; i < RAIN_N; i++) {
        const j = i * 3, z = rainHead[j + 2], k2 = spanAt(z), sp = rainSpeed[i] * dt * (.75 + .25 * k2);
        rainHead[j + 1] -= sp; rainHead[j] -= sp * .12;
        if (rainHead[j + 1] < WIN.cy - WIN.hh * k2 * 1.1) spawn(rainHead, i, true);
        const len = .16 + .1 * k2, o = i * 6;
        rainPos[o] = rainHead[j] + len * .12; rainPos[o + 1] = rainHead[j + 1] + len; rainPos[o + 2] = rainHead[j + 2];
        rainPos[o + 3] = rainHead[j]; rainPos[o + 4] = rainHead[j + 1]; rainPos[o + 5] = rainHead[j + 2];
      }
      rainGeometry.attributes.position.needsUpdate = true;
    }
    if (snowFlakes.visible) {
      for (let i = 0; i < SNOW_N; i++) {
        const j = i * 3, z = snowPos[j + 2], k2 = spanAt(z), s = snowSeed[i];
        snowPos[j + 1] -= dt * (.00016 + .00012 * fract(s)) * (.7 + .3 * k2);
        snowPos[j] += Math.sin(now * .0006 + s) * dt * .00008 + dt * .00003;
        if (snowPos[j + 1] < WIN.cy - WIN.hh * k2 * 1.1) spawn(snowPos, i, true);
      }
      snowGeometry.attributes.position.needsUpdate = true;
    }
  }
  const fract = x => x - Math.floor(x);
  // Aviation beacons and strobes on the tallest buildings of the night photo.
  const beacons = [];
  window.__setupCityBeacons = cells => {
    if (beacons.length || !cells.length) return;
    const bins = new Map();
    for (const c of cells) { const b = Math.floor(c.x / 70); const cur = bins.get(b); if (!cur || c.y < cur.y) bins.set(b, c); }
    const tops = [...bins.values()].sort((a, b) => a.y - b.y).slice(0, 10);
    tops.forEach((c, n) => {
      const strobe = n < 3, mat2 = new THREE.SpriteMaterial({ map: glowTexture, color: strobe ? 0xfff4e6 : 0xff3a24, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0 });
      const sp = new THREE.Sprite(mat2);
      const px = c.x, py = Math.max(0, c.y - 6 - Math.random() * 6);
      sp.position.set(-.35 + (px / 1200 - .5) * 14, 2.72 + (.5 - py / 544) * 6.35, -12.74);
      const size = strobe ? .5 : .34; sp.scale.set(size, size, 1); scene.add(sp);
      sp.userData.base = sp.position.clone();
      beacons.push({ sp, strobe, period: strobe ? 2600 + Math.random() * 1400 : 1500 + Math.random() * 1300, phase: Math.random() * 4000 });
    });
  };
  // When the camera walks up to the window, the skyline photo is scaled so it
  // still fills the glass (like seeing more of the city from closer).
  function fitBackdrop() {
    const cz = camera.position.z, sc = Math.min(2.2, Math.max(1, ((cz + 12.8) / Math.max(.2, cz + 2.92)) / 2.12));
    if (Math.abs(cityBackdrop.scale.x - sc) < .002) return;
    cityBackdrop.scale.set(sc, sc, 1); cityLightPlane.scale.set(sc, sc, 1);
    for (const b of beacons) { const p0 = b.sp.userData.base; b.sp.position.set(-.35 + (p0.x + .35) * sc, 2.72 + (p0.y - 2.72) * sc, p0.z); }
  }
  function animateBeacons(now) {
    fitBackdrop();
    for (const b of beacons) {
      const t = (now + b.phase) % b.period;
      let a;
      if (b.strobe) a = (t < 70 ? 1 : t > 180 && t < 250 ? .85 : 0);
      else a = t < 650 ? Math.sin(Math.PI * t / 650) : 0;
      b.sp.material.opacity = a * (1 - .35 * weatherNow.rain - .3 * weatherNow.snow);
    }
  }
  for (const x of [-3.48, 2.78]) box(.15, 2.98, .16, trim, x, 2.72, -2.82);
  for (const y of [1.23, 4.21]) box(6.38, .15, .16, trim, -.35, y, -2.82);
  box(.09, 2.78, .1, lightWood, -.35, 2.72, -2.77);
  box(6.15, .075, .12, lightWood, -.35, 2.72, -2.77);
  for (const x of [-2.45, 1.65]) box(.035, 2.78, .07, cream, x, 2.72, -2.75);
  // Short, warm fabric curtains and a timber sill add modeled depth at the window.
  const curtain = wovenMaterial("#b6a28a",0xb6a28a);
  for (const x of [-3.72, 3.03]) {
    drapedFabric(.52,2.85,5,curtain,[x,2.75,-2.66]);
    for (let i = 0; i < 5; i++) {
      const rx=x-.20+i*.10;
      curve([[rx,4.12,-2.64],[rx+.012,3.60,-2.62],[rx-.012,2.75,-2.62],[rx+.008,1.39,-2.64]],.006,mat(i%2?0x6f4932:0x936445,.95));
    }
    roundedBox(.08,.055,.045,.018,mat(0x9b7854,.5,.38),x,4.20,-2.63);
  }
  cylinder(.018,.018,6.55,mat(0x443126,.42,.58),-.35,4.26,-2.60,scene,24).rotation.z=Math.PI/2;
  box(6.35, .11, .34, lightWood, -.35, 1.18, -2.73);

  // Writing desk and its original, recognizable daily objects.
  roundedBox(7.65, .16, 2.45, .055, grainWood, 0, .88, .55);
  for (const x of [-3.55, -1.4, 1.4, 3.55]) {
    roundedBox(.14, .82, .14, .025, darkWood, x, .4, .55);
    box(.19, .045, .2, trim, x, .08, .55);
  }
  // A shaped front nosing, inset apron and drawer runners give the desk a
  // proper Korean light-oak furniture profile instead of a floating slab.
  roundedBox(7.48, .11, .09, .025, lightWood, 0, .845, 1.765);
  box(7.55, .12, .12, trim, 0, .68, -.58);
  // Shallow drawer fronts, pulls and apron make the desk read as a built object.
  box(6.8, .25, .18, darkWood, 0, .69, 1.42);
  for (const x of [-2.25, -.75, .75, 2.25]) {
    roundedBox(1.25,.18,.05,.018,mat(0xa77a46,.58),x,.69,1.52);
    roundedBox(1.13,.12,.018,.014,mat(0xc39a60,.55),x,.69,1.552);
    for(const dx of [-.45,.45])cylinder(.014,.014,.014,mat(0x695137,.44,.32),x+dx,.69,1.567,scene,16);
    roundedBox(.24,.035,.04,.012,mat(0x3c3022,.3,.68),x,.69,1.59);
    roundedBox(.18,.012,.012,.006,mat(0xc4a36b,.32,.64),x,.69,1.616);
  }
  // Monitor, stand and keyboard.
  roundedBox(1.66, 1.06, .16, .085, mat(0x25292a, .42, .22), -.12, 1.63, -.39);
  roundedBox(1.60, 1.00, .045, .075, mat(0x747d78, .36, .38), -.12, 1.63, -.285);
  roundedBox(1.48, .86, .024, .055, mat(0x111918, .19, .08), -.12, 1.65, -.252);
  // Thin glass lip, lower control bar, speaker perforations and a tiny webcam.
  roundedBox(1.44, .82, .008, .05, mat(0x202a28,.13,.12), -.12, 1.65, -.235);
  roundedBox(1.6, .058, .034, .018, mat(0x333938,.48,.24), -.12, 1.125, -.245);
  for (let i=0;i<9;i++) sphere(.006,mat(0x858b85,.42,.18),-.48+i*.09,1.123,-.224);
  torus(.018,.004,metal,[-.12,2.12,-.226],scene,8,24);
  sphere(.009,black,-.12,2.12,-.221);
  roundedBox(1.28,.74,.025,.055,mat(0x343a39,.68,.18),-.12,1.64,-.485);
  roundedBox(.78,.40,.018,.04,mat(0x2a302f,.76,.12),-.12,1.67,-.505);
  for(let row=0;row<5;row++)for(let col=0;col<11;col++)box(.018,.012,.008,mat(0x626765,.72,.12),-.57+col*.09,1.52+row*.055,-.516,scene,false);
  roundedBox(.22,.13,.02,.018,mat(0x414746,.55,.32),-.12,1.10,-.49);
  for(let i=0;i<4;i++)roundedBox(.035,.045,.01,.006,mat(0x151918,.52,.16),-.22+i*.06,1.10,-.506);
  curve([[-.12,1.11,-.50],[-.12,.99,-.53],[-.12,.89,-.40],[-.12,.86,.00]],.014,black);
  box(.13, .28, .18, metal, -.12, 1.04, -.42);
  box(.83, .08, .48, mat(0x777d78,.38,.48), -.12, .94, -.37);
  for (const x of [-.47,.23]) { cylinder(.018,.018,.012,black,x,.94,-.12,scene,20); }
  // Distinct monitor housing, screen glass, lower bezel and small camera eye.
  box(1.69, .075, .035, darkWood, -.12, 1.14, -.285);
  sphere(.025, metal, -.12, 2.14, -.276);
  roundedBox(1.72, .09, .56, .035, mat(0x555a57,.55,.24), -.08, 1.015, .13);
  roundedBox(1.64, .035, .49, .018, mat(0xbab8b0,.68,.12), -.08, 1.071, .13);
  const keyMat = mat(0xe1ded5,.58,.08), keySide = mat(0xaaa9a1,.66,.04);
  for (let row = 0; row < 5; row++) {
    const count = row===4 ? 12 : row===3 ? 13 : 15;
    const start=-.83+(15-count)*.045;
    for (let col = 0; col < count; col++) {
      const width=(row===4&&col>3&&col<9)?.13:.078;
      const key=roundedBox(width,.035,.073,.012,keyMat,start+col*.105,1.106,-.065+row*.094);
      key.scale.z=row===4?.95:1;
      box(width*.72,.002,.003,keySide,start+col*.105,1.126,-.065+row*.094);
    }
  }
  roundedBox(.22,.025,.018,.008,mat(0x5b5d5a,.6),-.08,1.075,.39);
  // Phone and incense retain the small personal details in the source scene.
  // The upright black diary-like object from the desk reference is removed;
  // the open book in front of the chair is now the sole diary object.
  // Everyday desk pieces visible in the original image: coaster and mug,
  // mouse, pencil cup, compact camera and a small catch-all tray.
  const coaster = roundedBox(.58,.045,.54,.10,mat(0x765b40,.92),-2.95,.985,.78);
  coaster.rotation.y=.08;
  lathe([[0,-.145],[.13,-.145],[.17,-.13],[.19,-.10],[.205,.105],[.20,.135],[.175,.145],[.151,.132],[.15,-.07],[.13,-.10],[0,-.10]],mat(0xe7e2d7,.22),[-2.95,1.15,.78],scene,56);
  torus(.184,.009,mat(0xf3eee4,.22),[-2.95,1.289,.78],scene,10,48);
  const coffee=lathe([[0,0],[.145,0],[.15,.01]],mat(0x30251e,.18),[-2.95,1.245,.78],scene,48);
  const mugHandle = addMesh(new THREE.TorusGeometry(.105, .028, 12, 32), mat(0xe7e2d7,.22), [-2.73, 1.17, .78]);
  mugHandle.rotation.y = Math.PI / 2;
  // Ergonomic two-button mouse with separated buttons, a knurled wheel and
  // subtle side grip panels rather than a single oval primitive.
  ellipsoid(.115,.067,.18,mat(0x333837,.34),[.98,1.035,.26]);
  roundedBox(.092,.018,.102,.028,mat(0x414746,.28),.93,1.084,.205);
  roundedBox(.092,.018,.102,.028,mat(0x414746,.28),1.03,1.084,.205);
  const wheel=torus(.026,.012,mat(0x181c1c,.36),[.98,1.091,.26],scene,8,24);wheel.rotation.x=Math.PI/2;
  curve([[.98,1.10,.26],[.99,1.14,.05],[1.02,1.18,-.12]],.009,black);
  for(const side of [-1,1]) for(let i=0;i<4;i++) line([.98+side*.094,1.02,.18+i*.035],[.98+side*.10,1.02,.20+i*.035],.003,mat(0x777d7a,.82));
  lathe([[.09,-.13],[.18,-.13],[.20,-.09],[.19,.12],[.16,.14],[.12,.13],[.12,-.08],[.09,-.1]],mat(0xd9d5cb,.72),[-.92,1.12,.08],scene,40);
  torus(.185,.012,mat(0xeee9de,.65),[-.92,1.25,.08],scene,8,36);
  for (let i = 0; i < 5; i++) {
    const x=-1.01+i*.045, tip=[x-.018,1.65+(i%2)*.09,.075], base=[x,1.22,.08];
    curve([base,[x+.018,1.36,.08],tip],.012,[trim,lightWood,green,metal,darkWood][i]);
    const nib=addMesh(new THREE.ConeGeometry(.012,.045,12),mat(0x3a3025),[tip[0],tip[1]+.015,tip[2]]);nib.rotation.z=-.04;
    cylinder(.013,.013,.12,mat(0xc9b78e,.45,.15),x,1.35,.08,scene,12);
  }
  roundedBox(.64,.055,.42,.04,mat(0xaaa18d,.62,.15),-3.48,.995,.43);
  roundedBox(.48,.024,.25,.035,mat(0x464b4a,.4,.25),-3.48,1.034,.43);
  for(let i=0;i<4;i++)box(.018,.004,.18,mat(0x6f7773,.65),-3.63+i*.1,1.049,.43);
  // Ceramic incense holder and a slender natural-wood stick.
  lathe([[.025,0],[.075,0],[.085,.025],[.075,.10],[.05,.12],[.025,.11]],mat(0x9a7552,.72),[1.16,1.04,.46],scene,32);
  curve([[1.16,1.14,.46],[1.18,1.28,.46],[1.20,1.52,.44]],.007,mat(0x3e3022,.88));
  // Open diary and pen in the foreground.
  roundedBox(1.48, .045, .98, .035, darkWood, -.1, .99, 1.28);
  roundedBox(1.42, .038, .92, .028, paper, -.1, 1.019, 1.28);
  roundedBox(.035,.014,.91,.009,mat(0xc4a96f,.55),-.1,1.046,1.28);
  for(let i=0;i<6;i++)box(.007,.003,.88,mat(i%2?0xf8f0de:0xd9cfba,.82),-.81+i*.012,1.041,1.28,scene,false);
  // Page rules and a few quiet ink marks are separate geometry, not added text.
  const inkLine = mat(0x9b896e, .9);
  for (let row = 0; row < 7; row++) for (const side of [-1, 1]) {
    const x = -.1 + side * (.13 + (row % 3) * .025);
    box(.48 + (row % 2) * .08, .004, .006, inkLine, x, 1.016, .94 + row * .105, scene, false);
  }
  line([-.55, 1.04, 1.28], [.28, 1.04, 1.28], .018, darkWood);
  roundedBox(.018,.018,.20,.007,metal,.24,1.06,1.12);
  cylinder(.012,.012,.045,mat(0x28231e,.5,.24),.24,1.06,1.01,scene,16);
  // The physical open notebook displays the selected day's text and one of
  // its saved pictures without changing the book's modeled size.
  const diaryCanvas=document.createElement("canvas"); diaryCanvas.width=1024; diaryCanvas.height=640;
  const diaryContext=diaryCanvas.getContext("2d");
  const diaryTexture=new THREE.CanvasTexture(diaryCanvas); diaryTexture.encoding=THREE.sRGBEncoding; diaryTexture.anisotropy=renderer.capabilities.getMaxAnisotropy();
  const diaryPageMesh=new THREE.Mesh(new THREE.PlaneGeometry(1.36,.82),new THREE.MeshBasicMaterial({map:diaryTexture,transparent:true,opacity:.96,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));
  diaryPageMesh.rotation.x=-Math.PI/2; diaryPageMesh.position.set(-.1,1.043,1.28); scene.add(diaryPageMesh);
  window.setDiaryPage=(entry={})=>{
    const c=diaryContext,w=diaryCanvas.width,h=diaryCanvas.height;
    c.clearRect(0,0,w,h); c.fillStyle="rgba(248,241,226,.90)"; c.fillRect(6,8,w-12,h-16);
    c.strokeStyle="rgba(133,102,66,.22)";c.lineWidth=2;c.beginPath();c.moveTo(w/2,24);c.lineTo(w/2,h-24);c.stroke();
    c.fillStyle="#72583e";c.font="600 25px Georgia,serif";c.fillText(entry.date||"",42,50);
    c.fillStyle="#9a704b";c.font="italic 23px Georgia,serif";c.fillText((entry.mood||"").slice(0,24),42,88);
    c.strokeStyle="rgba(144,123,95,.24)";c.lineWidth=1;
    for(let y=126;y<580;y+=42){c.beginPath();c.moveTo(42,y);c.lineTo(470,y);c.stroke();}
    c.fillStyle="#51473c";c.font="24px Georgia,serif";
    const words=(entry.diary||"").replace(/\s+/g," ").trim().split(" ");let line="",y=158;
    for(const word of words){const next=line?line+" "+word:word;if(c.measureText(next).width>410&&line){c.fillText(line,42,y);line=word;y+=34;if(y>550)break;}else line=next;}
    if(line&&y<=550)c.fillText(line,42,y);
    const picture=entry.drawing||entry.photo||entry.art;
    if(picture){const img=new Image();img.onload=()=>{c.save();c.beginPath();c.roundRect(548,98,420,420,18);c.clip();const scale=Math.max(420/img.width,420/img.height);const iw=img.width*scale,ih=img.height*scale;c.drawImage(img,548+(420-iw)/2,98+(420-ih)/2,iw,ih);c.restore();diaryTexture.needsUpdate=true;};img.src=typeof picture==="string"?picture:URL.createObjectURL(picture);}
    else {c.fillStyle="rgba(181,158,126,.25)";c.strokeStyle="rgba(133,102,66,.22)";c.lineWidth=2;c.strokeRect(548,98,420,420);c.fillStyle="#8a765d";c.font="italic 23px Georgia,serif";c.fillText("A small moment from today",574,322);}
    c.fillStyle="#94795a";c.font="19px Georgia,serif";c.fillText(entry.song||"",548,566); diaryTexture.needsUpdate=true;
  };
  window.setDiaryPage(window.currentDiaryRecord||{});
  // Desk lamp rebuilt from the user's video: a warm copper-pink shade,
  // gently curved stem, and low circular rose-colored base. It now sits at the
  // blue-marked desk position, close to the notebook and monitor.
  const deskLampGroup=new THREE.Group(), lampX=-1.72, lampZ=.18;
  // Keep the lamp close to the blue-marked writing spot while matching the
  // compact scale of the reference desk lamp instead of towering over the monitor.
  deskLampGroup.position.set(lampX,.22,lampZ); deskLampGroup.scale.setScalar(.78); scene.add(deskLampGroup);
  const lampRose=mat(0xa8392c,.5,.12), lampRoseDark=mat(0x93372c,.42,.2);
  const lampMetal=mat(0xb8875a,.28,.85), lampInside=new THREE.MeshStandardMaterial({color:0xffcfb7,emissive:0xff9b73,emissiveIntensity:0,roughness:.54,side:THREE.DoubleSide});
  // (v48) Rebuilt after the user's reference lamp: low round coral base, slim
  // brass stem with one knuckle, and a coral cone shade tipped down at the desk.
  const lampCoral=new THREE.MeshStandardMaterial({color:0xa33d2f,roughness:.42,metalness:.15,side:THREE.DoubleSide});
  const lampBase=new THREE.Mesh(new THREE.LatheGeometry([[0,0],[.30,0],[.315,.012],[.31,.035],[.26,.06],[.12,.075],[.06,.085],[0,.088]].map(p=>new THREE.Vector2(p[0],p[1])),64),lampCoral);
  lampBase.position.set(.31,.965,-.18); lampBase.castShadow=true; lampBase.receiveShadow=true; deskLampGroup.add(lampBase);
  cylinder(.045,.055,.05,lampMetal,.31,1.07,-.18,deskLampGroup,24);
  // straight slim stem straight up to the shade, as in the reference video
  cylinder(.014,.014,1.1,lampMetal,.31,1.62,-.18,deskLampGroup,16);
  cylinder(.03,.03,.05,lampRoseDark,.31,2.17,-.18,deskLampGroup,16);
  const shadeProfile=[[.05,.2],[.09,.19],[.13,.12],[.19,.02],[.26,-.1],[.31,-.18],[.32,-.2]];
  const shade=new THREE.Mesh(new THREE.LatheGeometry(shadeProfile.map(p=>new THREE.Vector2(p[0],p[1])),64),lampCoral);
  shade.position.set(.31,2.33,-.18); shade.rotation.z=.18; shade.scale.setScalar(.82); shade.castShadow=true; shade.receiveShadow=true; deskLampGroup.add(shade);
  const shadeInnerCone=new THREE.Mesh(new THREE.LatheGeometry(shadeProfile.map(p=>new THREE.Vector2(p[0]-.008,p[1])),64),lampInside);
  shadeInnerCone.position.copy(shade.position); shadeInnerCone.rotation.z=.18; shadeInnerCone.scale.setScalar(.82); deskLampGroup.add(shadeInnerCone);
  cylinder(.05,.06,.03,lampRoseDark,0,.2,0,shade,32);
  const shadeLip=torus(.32,.008,lampRoseDark,[0,-.2,0],shade,8,64); shadeLip.rotation.x=Math.PI/2;
  const bulbGlass=mat(0xffe8cf,.22,.04); bulbGlass.emissive.setHex(0xffb477); bulbGlass.emissiveIntensity=0;
  ellipsoid(.07,.06,.07,bulbGlass,[.35,2.2,-.18],deskLampGroup);
  const lampGlowMaterial=new THREE.ShaderMaterial({uniforms:{uOn:{value:0}},transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,vertexShader:"varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",fragmentShader:"uniform float uOn; varying vec2 vUv; void main(){float d=length((vUv-.5)*2.0);float a=pow(max(0.0,1.0-smoothstep(.08,1.0,d)),2.0)*.34*uOn;gl_FragColor=vec4(1.0,.59,.35,a);}"});
  const lampGlow=new THREE.Mesh(new THREE.PlaneGeometry(1.28,.94),lampGlowMaterial); lampGlow.rotation.x=-Math.PI/2; lampGlow.position.set(lampX-.10,.968,lampZ+.48); scene.add(lampGlow);
  const bulb = new THREE.PointLight(0xffbd91, 0, 2.55, 2.0); bulb.position.set(.31,2.12,-.18); bulb.visible=false; deskLampGroup.add(bulb);
  const lampSpot=new THREE.SpotLight(0xffb78d,0,3.25,Math.PI*.24,.78,2.0); lampSpot.position.set(.26,2.18,-.18); lampSpot.target.position.set(-.16,.96,.60); lampSpot.visible=false; lampSpot.castShadow=true; lampSpot.shadow.mapSize.set(1024,1024); lampSpot.shadow.bias=-.0004; lampSpot.shadow.radius=4; deskLampGroup.add(lampSpot,lampSpot.target);
  let deskLampOn=true, deskLampLevel=0;
  window.toggleDeskLamp = () => { deskLampOn=!deskLampOn; if(deskLampOn)bulb.visible=true; render(); };
  // Remove the duplicate vertical books at the left; the open notebook in the
  // foreground remains the single diary object and keeps the diary action.
  // Terracotta pot with a leafy arrowhead plant (Syngonium), after the user's
  // reference photo. Built here so it works offline; stands at the old plant spot.
  function buildTerracottaPlant(px, py, pz) {
    const group = new THREE.Group(); group.name = "terracotta pot plant"; group.position.set(px, py, pz); scene.add(group);
    // weathered terracotta texture: warm clay, darker water marks, white mineral bloom
    const tc = document.createElement("canvas"); tc.width = 512; tc.height = 256; const tg = tc.getContext("2d");
    const base = tg.createLinearGradient(0, 0, 0, 256); base.addColorStop(0, "#cf7a46"); base.addColorStop(.55, "#bb6638"); base.addColorStop(1, "#9a5230");
    tg.fillStyle = base; tg.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 2600; i++) { tg.fillStyle = `rgba(${Math.random() < .5 ? "70,32,14" : "236,190,150"},${Math.random() * .12})`; tg.fillRect(Math.random() * 512, Math.random() * 256, 1 + Math.random() * 3, 1 + Math.random() * 3); }
    for (let i = 0; i < 26; i++) { const x = Math.random() * 512, y = 150 + Math.random() * 100, r = 18 + Math.random() * 46; const g = tg.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, "rgba(238,226,206,.42)"); g.addColorStop(1, "rgba(238,226,206,0)"); tg.fillStyle = g; tg.fillRect(x - r, y - r, r * 2, r * 2); }
    for (let i = 0; i < 14; i++) { const x = Math.random() * 512; const g = tg.createLinearGradient(0, 30, 0, 140); g.addColorStop(0, "rgba(80,36,16,.22)"); g.addColorStop(1, "rgba(80,36,16,0)"); tg.fillStyle = g; tg.fillRect(x, 30, 8 + Math.random() * 18, 110); }
    const clayMap = new THREE.CanvasTexture(tc); clayMap.encoding = THREE.sRGBEncoding; clayMap.wrapS = THREE.RepeatWrapping;
    const clay = new THREE.MeshStandardMaterial({ map: clayMap, roughness: .92, metalness: 0 });
    // rounded belly pot with a rolled rim
    const potProfile = [[0, 0], [.15, 0], [.17, .008], [.215, .07], [.245, .16], [.25, .24], [.238, .31], [.222, .345], [.232, .352], [.25, .362], [.256, .385], [.248, .405], [.226, .41], [.214, .39], [.21, .35]];
    const pot = new THREE.Mesh(new THREE.LatheGeometry(potProfile.map(p => new THREE.Vector2(p[0], p[1])), 64), clay);
    pot.castShadow = pot.receiveShadow = true; group.add(pot);
    const saucer = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [.2, 0], [.22, .012], [.225, .035], [.212, .038], [.2, .016], [0, .016]].map(p => new THREE.Vector2(p[0], p[1])), 48), clay);
    saucer.receiveShadow = true; group.add(saucer);
    const soil = new THREE.Mesh(new THREE.CircleGeometry(.212, 40), new THREE.MeshStandardMaterial({ color: 0x2c2118, roughness: 1 }));
    soil.rotation.x = -Math.PI / 2; soil.position.y = .37; group.add(soil);
    // arrowhead leaf texture with veins; alpha cut-out
    const lc = document.createElement("canvas"); lc.width = 256; lc.height = 320; const lg = lc.getContext("2d");
    const leafPath = () => { lg.beginPath(); lg.moveTo(128, 318); lg.bezierCurveTo(60, 250, 20, 150, 36, 70); lg.bezierCurveTo(40, 40, 70, 34, 96, 58); lg.lineTo(128, 6 + 70); lg.lineTo(160, 58); lg.bezierCurveTo(186, 34, 216, 40, 220, 70); lg.bezierCurveTo(236, 150, 196, 250, 128, 318); lg.closePath(); };
    // drawn upside down: tip at bottom (v=0), base lobes at top
    const lgrad = lg.createLinearGradient(0, 0, 256, 0); lgrad.addColorStop(0, "#2a5a22"); lgrad.addColorStop(.5, "#4d9136"); lgrad.addColorStop(1, "#285320");
    leafPath(); lg.fillStyle = lgrad; lg.fill();
    lg.save(); leafPath(); lg.clip();
    for (let i = 0; i < 900; i++) { lg.fillStyle = `rgba(${Math.random() < .5 ? "20,50,15" : "150,200,110"},${Math.random() * .08})`; lg.fillRect(Math.random() * 256, Math.random() * 320, 2, 2); }
    lg.strokeStyle = "rgba(196,226,160,.75)"; lg.lineWidth = 4; lg.beginPath(); lg.moveTo(128, 316); lg.lineTo(128, 80); lg.stroke();
    lg.lineWidth = 2; lg.strokeStyle = "rgba(186,220,150,.5)";
    for (let k = 0; k < 6; k++) { const y = 110 + k * 34; for (const s of [-1, 1]) { lg.beginPath(); lg.moveTo(128, y + 20); lg.quadraticCurveTo(128 + s * 40, y, 128 + s * (70 - k * 6), y - 36); lg.stroke(); } }
    for (const s of [-1, 1]) { lg.beginPath(); lg.moveTo(128, 90); lg.quadraticCurveTo(128 + s * 50, 70, 128 + s * 84, 58); lg.stroke(); }
    lg.restore();
    const leafMap = new THREE.CanvasTexture(lc); leafMap.encoding = THREE.sRGBEncoding;
    const leafMat = new THREE.MeshStandardMaterial({ map: leafMap, alphaTest: .5, side: THREE.DoubleSide, roughness: .5, metalness: 0 });
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x5e7f3e, roughness: .7 });
    const leafGeom = (len, wid, curl, fold) => {
      const g = new THREE.PlaneGeometry(wid, len, 8, 12); const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i) / wid * 2, v = p.getY(i) / len + .5; // v: 0 = tip, 1 = base
        p.setZ(i, curl * (1 - v) * (1 - v) * len + fold * Math.abs(u) * wid);
        p.setY(i, (v - 1) * len); // base at origin, tip down -y
      }
      g.computeVertexNormals(); return g;
    };
    const rand = (a, b) => a + Math.random() * (b - a);
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const leaves = 30;
    for (let i = 0; i < leaves; i++) {
      const a = i * 2.399 + rnd() * .3, ring = .35 + rnd() * .65;
      const h = .12 + rnd() * .36, reach = .10 + ring * .30;
      const sx = Math.cos(a) * .05, sz = Math.sin(a) * .05;
      const ex = Math.cos(a) * reach, ez = Math.sin(a) * reach, ey = .37 + h;
      const stem = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(sx, .37, sz), new THREE.Vector3(sx + Math.cos(a) * .04, .37 + h * .55, sz + Math.sin(a) * .04), new THREE.Vector3(ex, ey, ez)]), 16, .006, 6, false), stemMat);
      stem.castShadow = true; group.add(stem);
      const len = .26 + rnd() * .12;
      const leaf = new THREE.Mesh(leafGeom(len, len * .8, .18 + rnd() * .12, .08), leafMat);
      leaf.position.set(ex, ey, ez);
      // point the leaf outward and droop it: tip hangs out and down from the stem end
      leaf.rotation.order = "YXZ"; leaf.rotation.y = -a + Math.PI / 2; leaf.rotation.x = -(.9 + rnd() * .6); leaf.rotation.z = (rnd() - .5) * .5;
      leaf.castShadow = true; group.add(leaf);
    }
    return group;
  }
  buildTerracottaPlant(2.02, .96, -.10);
  // Soft contact shadows so the props sit on the desk (camera, cup, plant, lamp).
  const contactCanvas=document.createElement("canvas"); contactCanvas.width=contactCanvas.height=128;
  { const g=contactCanvas.getContext("2d"), r=g.createRadialGradient(64,64,4,64,64,62); r.addColorStop(0,"rgba(0,0,0,.62)"); r.addColorStop(.45,"rgba(0,0,0,.34)"); r.addColorStop(1,"rgba(0,0,0,0)"); g.fillStyle=r; g.fillRect(0,0,128,128); }
  const contactMap=new THREE.CanvasTexture(contactCanvas);
  for (const [x,y,z,w,d,rot] of [[2.02,.9785,-.1,.62,.62,0],[-1.48,.9785,.06,.5,.5,0]]) {
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({map:contactMap,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,toneMapped:false}));
    m.rotation.x=-Math.PI/2; m.rotation.z=rot; m.position.set(x,y,z); m.renderOrder=2; scene.add(m);
  }
  // v53: 35mm rangefinder rebuilt with real proportions and surface detail:
  // pebbled leatherette, brushed chrome plates with engraving, knurled focus
  // ring, coated glass, rounded body ends and a leather strap lying on the desk.
  const filmCam=new THREE.Group();filmCam.name="35mm film camera";filmCam.position.set(-1.6,.968,.95);filmCam.rotation.y=-.22;filmCam.scale.setScalar(.86);scene.add(filmCam);
  const leatherCanvas=document.createElement("canvas");leatherCanvas.width=leatherCanvas.height=256;
  {const c=leatherCanvas.getContext("2d");c.fillStyle="#808080";c.fillRect(0,0,256,256);for(let i=0;i<5200;i++){const v=90+Math.random()*90|0;c.fillStyle=`rgb(${v},${v},${v})`;c.beginPath();c.arc(Math.random()*256,Math.random()*256,1+Math.random()*1.8,0,7);c.fill();}}
  const leatherTex=new THREE.CanvasTexture(leatherCanvas);leatherTex.wrapS=leatherTex.wrapT=THREE.RepeatWrapping;leatherTex.repeat.set(3,1.2);
  const camLeather=new THREE.MeshStandardMaterial({color:0x161514,roughness:.78,metalness:0,bumpMap:leatherTex,bumpScale:.006});
  const brushCanvas=document.createElement("canvas");brushCanvas.width=512;brushCanvas.height=64;
  {const c=brushCanvas.getContext("2d");c.fillStyle="#cfcbc3";c.fillRect(0,0,512,64);for(let y=0;y<64;y++){c.fillStyle=`rgba(${Math.random()<.5?255:120},${Math.random()<.5?255:120},${Math.random()<.5?255:120},.06)`;c.fillRect(0,y,512,1);}
   c.fillStyle="#1b1a18";c.font="600 15px Georgia,serif";c.textAlign="left";c.fillText("ROOM  35",22,40);c.font="9px monospace";c.fillText("No. 1124",420,40);}
  const chromeTex=new THREE.CanvasTexture(brushCanvas);if("encoding" in chromeTex)chromeTex.encoding=THREE.sRGBEncoding;
  const camChrome=new THREE.MeshStandardMaterial({color:0xe2ded6,roughness:.3,metalness:.88});
  const camChromeFront=new THREE.MeshStandardMaterial({map:chromeTex,roughness:.32,metalness:.8});
  const camBlack=new THREE.MeshStandardMaterial({color:0x111111,roughness:.42,metalness:.35});
  roundedBox(.5,.19,.125,.05,camLeather,0,.125,0,filmCam);
  const topPlate=roundedBox(.505,.062,.132,.03,camChrome,0,.252,0,filmCam);
  const plateFront=new THREE.Mesh(new THREE.PlaneGeometry(.42,.05),camChromeFront);plateFront.position.set(0,.252,.0665);filmCam.add(plateFront);
  roundedBox(.505,.026,.132,.012,camChrome,0,.024,0,filmCam);
  box(.08,.034,.004,new THREE.MeshPhysicalMaterial({color:0x2a3440,roughness:.05,metalness:.2,clearcoat:1}),-.17,.258,.068,filmCam,false);
  box(.052,.034,.004,new THREE.MeshStandardMaterial({color:0xf3efe4,roughness:.25,emissive:0x3a3326,emissiveIntensity:.4}),.07,.258,.068,filmCam,false);
  box(.03,.028,.004,new THREE.MeshPhysicalMaterial({color:0x2a3440,roughness:.05,clearcoat:1}),.185,.258,.068,filmCam,false);
  const knurlCanvas=document.createElement("canvas");knurlCanvas.width=256;knurlCanvas.height=16;
  {const c=knurlCanvas.getContext("2d");for(let x=0;x<256;x+=4){c.fillStyle="#2a2a2a";c.fillRect(x,0,2,16);c.fillStyle="#0c0c0c";c.fillRect(x+2,0,2,16);}}
  const knurlTex=new THREE.CanvasTexture(knurlCanvas);knurlTex.wrapS=THREE.RepeatWrapping;knurlTex.repeat.set(4,1);
  const lensX=-.025,lensY=.13;
  const mount=cylinder(.068,.068,.018,camChrome,lensX,lensY,.07,filmCam,40);mount.rotation.x=Math.PI/2;
  const barrel=cylinder(.058,.062,.05,camBlack,lensX,lensY,.104,filmCam,40);barrel.rotation.x=Math.PI/2;
  const focus=cylinder(.064,.064,.026,new THREE.MeshStandardMaterial({map:knurlTex,roughness:.6,metalness:.3}),lensX,lensY,.142,filmCam,48);focus.rotation.x=Math.PI/2;
  const aperture=cylinder(.059,.059,.016,camChrome,lensX,lensY,.163,filmCam,40);aperture.rotation.x=Math.PI/2;
  const lip=cylinder(.056,.052,.012,camBlack,lensX,lensY,.176,filmCam,40);lip.rotation.x=Math.PI/2;
  const glass=cylinder(.042,.042,.004,new THREE.MeshPhysicalMaterial({color:0x1a1630,roughness:.02,metalness:.1,clearcoat:1,clearcoatRoughness:0,emissive:0x1a1240,emissiveIntensity:.25}),lensX,lensY,.181,filmCam,40);glass.rotation.x=Math.PI/2;
  const rewind=cylinder(.04,.044,.028,camChrome,-.17,.296,-.01,filmCam,28);
  cylinder(.03,.03,.008,camBlack,-.17,.314,-.01,filmCam,28);
  cylinder(.036,.036,.02,camChrome,.165,.293,-.02,filmCam,32);
  cylinder(.029,.029,.008,camBlack,.165,.307,-.02,filmCam,32);
  cylinder(.011,.011,.022,camChrome,.095,.296,.03,filmCam,12);
  const lever=box(.11,.006,.02,camChrome,.19,.3,.04,filmCam,false);lever.rotation.y=.55;
  box(.055,.01,.045,camBlack,.01,.288,-.01,filmCam,false);
  for(const x of [-.255,.255]){const lug=torus(.012,.004,camChrome,[x,.21,0],filmCam,6,16);lug.rotation.y=Math.PI/2;}
  const strapMat=new THREE.MeshStandardMaterial({color:0x5a3a24,roughness:.7});
  const strapG=new THREE.Group();scene.add(strapG);
  curve([[-1.87,1.15,.95],[-1.95,1.02,1.08],[-1.9,.975,1.28],[-1.62,.972,1.36],[-1.35,.975,1.27],[-1.3,1.02,1.1],[-1.33,1.15,.95]].map(([x,y,z])=>[x,y-.005,z]),.009,strapMat,strapG,48);
  // v53 desk dressing so the long desk doesn't read empty.
  const deskTop=.965;
  function book(x,z,w,h,d,color,rotY,parent=scene,y=deskTop){
    const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rotY;parent.add(g);
    roundedBox(w,h,d,.008,mat(color,.82),0,h/2,0,g);
    box(w-.03,h-.016,d-.012,mat(0xe9dfc8,.92),.006,h/2,.0,g,false).position.x=.008;
    roundedBox(.012,h+.004,d+.004,.006,mat(color,.75),-w/2+.004,h/2,0,g);
    return g;
  }
  // books stacked at the back-left with a brass alarm clock on top
  book(-2.55,.12,.5,.07,.36,0x6b2f26,.12);book(-2.53,.12,.46,.06,.33,0x2f4a45,-.06,scene,deskTop+.07);book(-2.56,.12,.42,.055,.3,0xb39b6a,.2,scene,deskTop+.13);
  const clock=new THREE.Group();clock.position.set(-2.55,deskTop+.185,.13);clock.rotation.y=.25;scene.add(clock);
  const brass=new THREE.MeshStandardMaterial({color:0xc9a15a,roughness:.32,metalness:.85});
  const clockBody=cylinder(.085,.085,.05,brass,0,.1,0,clock,40);clockBody.rotation.x=Math.PI/2;
  const faceCanvas=document.createElement("canvas");faceCanvas.width=faceCanvas.height=128;
  {const c=faceCanvas.getContext("2d");c.fillStyle="#f1e8d2";c.beginPath();c.arc(64,64,62,0,7);c.fill();c.fillStyle="#2a2018";for(let i=0;i<12;i++){const a=i/12*Math.PI*2;c.fillRect(64+Math.sin(a)*50-1.5,64-Math.cos(a)*50-4,3,8);}
   c.strokeStyle="#1d1610";c.lineCap="round";c.lineWidth=5;c.beginPath();c.moveTo(64,64);c.lineTo(64+Math.sin(5.3)*30,64-Math.cos(5.3)*30);c.stroke();c.lineWidth=3;c.beginPath();c.moveTo(64,64);c.lineTo(64+Math.sin(1.2)*44,64-Math.cos(1.2)*44);c.stroke();}
  const face=new THREE.Mesh(new THREE.CircleGeometry(.072,40),new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(faceCanvas),roughness:.5}));face.position.set(0,.1,.026);clock.add(face);
  for(const x of [-.055,.055]){const bell=sphere(.035,brass,x,.18,-.005,clock);bell.scale.y=.7;}
  cylinder(.008,.008,.03,brass,0,.2,0,clock,10);
  for(const x of [-.05,.05])cylinder(.008,.012,.05,brass,x,.02,0,clock,10);
  // candle in an amber glass jar, with a soft flickering flame
  const candle=new THREE.Group();candle.position.set(-2.2,deskTop,.6);scene.add(candle);
  cylinder(.065,.065,.13,new THREE.MeshPhysicalMaterial({color:0xc58a3a,transparent:true,opacity:.42,roughness:.08,transmission:.2,thickness:.01}),0,.065,0,candle,32);
  cylinder(.058,.058,.085,mat(0xf0e4cc,.85),0,.043,0,candle,32);
  cylinder(.0025,.0025,.02,mat(0x1a1612,.9),0,.095,0,candle,6);
  const flameMat=new THREE.MeshBasicMaterial({color:0xffc46a,transparent:true,opacity:.95,toneMapped:false});
  const flame=sphere(.012,flameMat,0,.112,0,candle);flame.scale.set(1,2.1,1);
  const candleLight=new THREE.PointLight(0xffa24a,.55,1.5,2);candleLight.position.set(-2.2,deskTop+.2,.6);scene.add(candleLight);
  window.__deskFlicker=now=>{const f=.82+.12*Math.sin(now*.011)+.08*Math.sin(now*.027+1.3)+.05*Math.random();candleLight.intensity=.55*f;flame.scale.set(1,2.1*f,1);};
  // open book with reading glasses, right of the diary
  const openBook=new THREE.Group();openBook.position.set(1.5,deskTop,.95);openBook.rotation.y=-.35;scene.add(openBook);
  roundedBox(.62,.014,.42,.006,mat(0x3c2a22,.8),0,.007,0,openBook);
  for(const s of [-1,1]){const pg=box(.29,.022,.39,mat(0xeee4cc,.92),s*.152,.024,0,openBook,false);pg.rotation.z=-s*.05;
    for(let i=0;i<9;i++)box(.2,.0015,.006,mat(0x8c8070,.9),s*.152,.0365+Math.abs(s)*.0,-.13+i*.032,openBook,false).rotation.z=-s*.05;}
  const glassesMat=new THREE.MeshStandardMaterial({color:0x1d1814,roughness:.35,metalness:.3});
  const glasses=new THREE.Group();glasses.position.set(1.5,deskTop+.045,1.02);glasses.rotation.set(-Math.PI/2+.05,0,.4);scene.add(glasses);
  for(const x of [-.052,.052]){torus(.042,.0045,glassesMat,[x,0,0],glasses,8,32);}
  box(.025,.004,.004,glassesMat,0,.012,0,glasses,false);
  for(const x of [-.094,.094]){const arm=box(.004,.004,.14,glassesMat,x,0,-.07,glasses,false);arm.rotation.y=x>0?-.18:.18;}
  // small standing frame with a pressed-flower print, next to the monitor
  const frameG=new THREE.Group();frameG.position.set(.95,deskTop,-.2);frameG.rotation.y=-.3;scene.add(frameG);
  roundedBox(.24,.3,.022,.006,mat(0x3a2619,.6),0,.15,0,frameG).rotation.x=-.12;
  const pressCanvas=document.createElement("canvas");pressCanvas.width=160;pressCanvas.height=200;
  {const c=pressCanvas.getContext("2d");c.fillStyle="#efe4c9";c.fillRect(0,0,160,200);c.strokeStyle="#6b5a36";c.lineWidth=2;c.beginPath();c.moveTo(80,180);c.quadraticCurveTo(70,110,86,30);c.stroke();
   for(let i=0;i<7;i++){const y=160-i*18,s=i%2?1:-1;c.fillStyle=i%3?"#7d7a44":"#9c8a4a";c.beginPath();c.ellipse(80+s*16,y,15,6,s*.6,0,7);c.fill();}
   c.fillStyle="#b4553b";for(let i=0;i<5;i++){c.beginPath();c.arc(86+Math.cos(i*1.26)*9,30+Math.sin(i*1.26)*9,7,0,7);c.fill();}c.fillStyle="#e2b04a";c.beginPath();c.arc(86,30,5,0,7);c.fill();}
  const print=new THREE.Mesh(new THREE.PlaneGeometry(.18,.24),new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(pressCanvas),roughness:.85}));
  print.position.set(0,.15,.0125);print.rotation.x=-.12;frameG.add(print);
  box(.02,.2,.12,mat(0x3a2619,.6),0,.1,-.06,frameG,false).rotation.x=.5;
  // fountain pen and a little brass tray where the keyboard used to be
  const penTray=new THREE.Group();scene.add(penTray);
  roundedBox(.44,.018,.16,.03,brass,-.05,deskTop+.009,.12,penTray);
  const pen=cylinder(.011,.009,.2,mat(0x1a1a1a,.25,.4),-.08,deskTop+.03,.12,penTray,16);pen.rotation.z=Math.PI/2;pen.rotation.y=.15;
  const nib=cylinder(.002,.009,.035,brass,-.2,deskTop+.03,.1,penTray,12);nib.rotation.z=Math.PI/2;
  for(const [x,z,w,d,rot] of [[-1.6,1.0,.58,.34,0],[-2.55,.12,.62,.48,0],[-2.2,.6,.22,.22,0],[1.5,.95,.72,.55,0],[-2.5,1.3,.42,.36,0]]){
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({map:contactMap,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,toneMapped:false}));
    m.rotation.x=-Math.PI/2;m.rotation.z=rot;m.position.set(x,.9785,z);m.renderOrder=2;scene.add(m);
  }
  // Shredder beside the writing space.
  roundedBox(.76, .59, .62, .065, mat(0xddd8ca,.42), 2.78, 1.24, 1.15);
  roundedBox(.78, .16, .66, .065, mat(0xd1cbbb,.38), 2.78, 1.59, 1.15);
  roundedBox(.52, .025, .055, .012, mat(0x272a29,.28), 2.78, 1.685, 1.15);
  roundedBox(.64,.025,.04,.012,mat(0x242827,.34),2.78,1.672,1.15);
  for(let i=0;i<13;i++)box(.008,.004,.026,mat(0x777c76,.5,.25),2.52+i*.043,1.674,1.15,scene,false);
  for(let i=0;i<8;i++)box(.025,.008,.012,mat(0x8d938b,.62),2.50+i*.075,1.672,1.47,scene,false);
  roundedBox(.08,.035,.018,.012,mat(0x2f3431,.38),2.78,1.69,1.45);
  sphere(.012,mat(0x79a985,.28),2.78,1.696,1.46);
  // Front moulding, paper-bin seam, handle recess and discreet ventilation.
  curve([[2.40,1.43,1.47],[2.58,1.40,1.47],[2.78,1.39,1.47],[2.98,1.40,1.47],[3.16,1.43,1.47]],.004,mat(0xb3ac9d,.55));
  roundedBox(.23,.018,.012,.008,mat(0xaaa392,.52),2.78,1.20,1.468);
  for(let i=0;i<8;i++)box(.012,.12,.008,mat(0xaaa494,.62),2.48+i*.025,1.17,1.466,scene,false);
  for(const x of [2.53,3.03])cylinder(.018,.018,.016,mat(0x888579,.48,.22),x,.96,1.15,scene,20);
  // Turntable and record shelf at the right side of the room.
  roundedBox(1.35,.15,1.02,.045,grainWood,3.2,1.0,-.84);
  for(const x of [2.68,3.72])for(const z of [-1.2,-.48])cylinder(.045,.045,.075,mat(0x292b2a,.38),x,.86,z,scene,24);
  roundedBox(1.23,.14,.90,.035,mat(0x292b2d,.3,.32),3.2,1.15,-.84);
  roundedBox(1.10,.035,.78,.018,mat(0x444849,.34,.25),3.2,1.235,-.84);
  cylinder(.37,.37,.035,mat(0x565a5b,.28,.48),3.16,1.27,-.87,scene,64);
  // v51: the record already on the platter is its own group so it can be lifted off.
  const platterDisc=new THREE.Group();platterDisc.name="record on platter";platterDisc.position.set(3.16,1.296,-.87);scene.add(platterDisc);
  cylinder(.345,.345,.018,mat(0x18191a,.32,.12),0,0,0,platterDisc,64);
  for(let i=0;i<7;i++){const r=.12+i*.033;const groove=torus(r,.0018,mat(0x55585a,.4,.12),[0,.011,0],platterDisc,4,80);groove.rotation.x=Math.PI/2;}
  cylinder(.046,.046,.022,mat(0xd3b66e,.36,.22),0,.016,0,platterDisc,32);
  cylinder(.013,.013,.05,mat(0x92805e,.34,.4),3.16,1.33,-.87,scene,24);
  // Tonearm assembly and counterweight placed beside the platter.
  cylinder(.075,.075,.04,mat(0x353b3d,.32,.56),3.66,1.28,-.58,scene,32);
  curve([[3.66,1.33,-.58],[3.59,1.37,-.67],[3.48,1.39,-.78],[3.37,1.38,-.88]],.014,metal);
  cylinder(.035,.035,.06,mat(0x7d8584,.32,.58),3.66,1.34,-.58,scene,24);
  curve([[3.37,1.38,-.88],[3.31,1.34,-.88],[3.29,1.31,-.91]],.008,black);
  const dustCover=new THREE.Mesh(new THREE.BoxGeometry(1.19,.42,.84),new THREE.MeshPhysicalMaterial({color:0xdce3dc,transparent:true,opacity:.12,roughness:.16,metalness:.05,thickness:.02}));
  dustCover.position.set(3.2,1.47,-.84);dustCover.castShadow=false;dustCover.receiveShadow=false;scene.add(dustCover);
  for(const [x,z] of [[2.605,-1.26],[3.795,-1.26],[2.605,-.42],[3.795,-.42]])line([x,1.26,z],[x,1.66,z],.008,mat(0xa8b1ad,.24,.3));
  roundedBox(1.42,.14,.78,.035,darkWood,3.2,.46,-.84);
  // LP jackets, colored spine labels, paper sleeves and a few visible discs.
  for(let i=0;i<10;i++){
    const x=2.62+i*.12, tone=[0x8b5749,0x31474b,0x746342,0x4b5945,0x534051][i%5];
    roundedBox(.095,.44,.31,.012,mat(tone,.74),x,.75,-.86);
    box(.078,.31,.004,mat(i%2?0xc3ae83:0xe1d3b8,.82),x,.75,-.695,scene,false);
    box(.055,.018,.005,mat(0x4a4034,.72),x,.72,-.689,scene,false);
    box(.09,.012,.31,mat(0x272625,.68),x,.523,-.86,scene,false);
  }
  // A hinged record crate sits on the desk just below the turntable controls. Each
  // sleeve stays in the box; clicking it moves that record to the platter.
  const vinylCrate=new THREE.Group();vinylCrate.name="vinyl record box";vinylCrate.position.set(3.2,.96,-.10);scene.add(vinylCrate);
  const crateWood=mat(0x4a3024,.66),crateEdge=mat(0x8e6745,.54),vinylBlack=mat(0x101215,.24,.22);
  roundedBox(.62,.075,.48,.025,crateWood,0,.06,0,vinylCrate);
  for(const x of [-.29,.29])roundedBox(.045,.28,.48,.018,crateWood,x,.23,0,vinylCrate);
  for(const z of [-.22,.22])roundedBox(.58,.28,.045,.015,crateWood,0,.23,z,vinylCrate);
  roundedBox(.58,.018,.018,.006,crateEdge,0,.375,.239,vinylCrate);
  roundedBox(.30,.11,.018,.015,crateEdge,0,.22,.247,vinylCrate);
  box(.13,.008,.005,mat(0x422c21,.78),0,.22,.259,vinylCrate,false);
  const crateLidHinge=new THREE.Group();crateLidHinge.position.set(0,.37,-.22);vinylCrate.add(crateLidHinge);
  roundedBox(.62,.035,.48,.018,crateWood,0,0,.22,crateLidHinge);
  for(const x of [-.24,.24])cylinder(.018,.018,.028,crateEdge,x,0,-.225,crateLidHinge,16).rotation.x=Math.PI/2;
  const albumColors=[0xb88d57,0x8b5d6d,0x607a81],vinylRecords=[];
  for(let i=0;i<3;i++){
    const disc=new THREE.Group();disc.name="LP record "+(i+1);scene.add(disc);
    cylinder(.315,.315,.014,vinylBlack,0,0,0,disc,72);
    for(let r=.16;r<.30;r+=.025){const groove=torus(r,.0013,mat(0x414448,.34,.18),[0,.009,0],disc,4,64);groove.rotation.x=Math.PI/2;}
    cylinder(.102,.102,.009,mat(albumColors[i],.56,.04),0,.012,0,disc,48);
    cylinder(.012,.012,.012,mat(0xc8b993,.42,.2),0,.018,0,disc,24);
    disc.position.set(3.2+(i-1)*.035,1.075+i*.016,-.10+(i%2)*.025);vinylRecords.push(disc);
  }
  let activeVinyl=-1,vinylBusy=false,crateOpen=false,vinylMotion=0;
  function easeVinyl(start,duration,step,done){const frame=now=>{const t=Math.min(1,(now-start)/duration),e=1-Math.pow(1-t,3);step(e);if(t<1)vinylMotion=requestAnimationFrame(frame);else done?.();};vinylMotion=requestAnimationFrame(frame);}
  window.swapRoomVinyl=()=>{
    if(vinylBusy)return;vinylBusy=true;window.__vinylStopSpin?.();const next=(activeVinyl+1)%vinylRecords.length,record=vinylRecords[next],old=activeVinyl>=0?vinylRecords[activeVinyl]:null;
    const closedAngle=crateLidHinge.rotation.x,targetAngle=crateOpen?0:1.08,started=performance.now();
    easeVinyl(started,340,e=>{crateLidHinge.rotation.x=closedAngle+(targetAngle-closedAngle)*e;render();},()=>{
      crateOpen=targetAngle>.5;
      if(old){const from=old.position.clone(),to=new THREE.Vector3(3.2+(activeVinyl-1)*.035,.115+activeVinyl*.016,-.84+(activeVinyl%2)*.025);const begin=performance.now();easeVinyl(begin,460,e=>{old.position.lerpVectors(from,to,e);old.rotation.y*=.92;render();},()=>{old.rotation.y=0;});}
      const from=record.position.clone(),to=new THREE.Vector3(3.16,1.344,-.87),begin=performance.now();easeVinyl(begin,520,e=>{record.position.lerpVectors(from,to,e);record.position.y+=Math.sin(e*Math.PI)*.22;record.rotation.z=Math.sin(e*Math.PI)*.16;render();},()=>{record.rotation.z=0;activeVinyl=next;vinylBusy=false;window.playRoomVinyl?.(next);setTimeout(()=>{const a=crateLidHinge.rotation.x,t=performance.now();easeVinyl(t,300,e=>{crateLidHinge.rotation.x=a*(1-e);render();},()=>{crateOpen=false;});},220);});
    });
  };
  // v54: linen tablecloth over the desk (top + soft front/side drop) and a
  // hand-knotted wool rug under the chair.
  {
    const linen=(w,h,stripes)=>{
      const c=document.createElement("canvas");c.width=w;c.height=h;const g=c.getContext("2d");
      g.fillStyle="#e8e0cf";g.fillRect(0,0,w,h);
      for(let y=0;y<h;y+=2){g.fillStyle=`rgba(${Math.random()<.5?"255,255,255":"90,70,45"},${.03+Math.random()*.05})`;g.fillRect(0,y,w,1);}
      for(let x=0;x<w;x+=2){g.fillStyle=`rgba(${Math.random()<.5?"255,255,255":"90,70,45"},${.025+Math.random()*.045})`;g.fillRect(x,0,1,h);}
      for(let i=0;i<w*h/90;i++){g.fillStyle=`rgba(110,90,60,${Math.random()*.12})`;g.fillRect(Math.random()*w,Math.random()*h,1+Math.random()*5,1);}
      if(stripes)for(const [pos,th] of stripes){g.fillStyle="rgba(150,52,40,.72)";g.fillRect(0,pos,w,th);}
      const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=renderer.capabilities.getMaxAnisotropy();return t;
    };
    const topTex=linen(2048,672,[[36,7],[52,3],[620,3],[632,7]]);
    const clothMat=new THREE.MeshStandardMaterial({map:topTex,bumpMap:topTex,bumpScale:.006,roughness:.96,side:THREE.DoubleSide});
    const cloth=new THREE.Group();cloth.name="linen tablecloth";scene.add(cloth);
    const top=new THREE.Mesh(new THREE.PlaneGeometry(7.86,2.58),clothMat);top.rotation.x=-Math.PI/2;top.position.set(0,.977,.55);top.receiveShadow=true;cloth.add(top);
    // hanging edges with gentle folds
    const drop=(len,depth,place)=>{
      const geo=new THREE.PlaneGeometry(len,depth,Math.ceil(len*18),6),pos=geo.attributes.position;
      for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),k=(depth/2-y)/depth;pos.setZ(i,(Math.sin(x*7.3)*.018+Math.sin(x*17.1+1.2)*.006)*k+k*k*.02);}
      geo.computeVertexNormals();
      const tex=linen(1024,96,[[18,5],[28,2]]);tex.wrapS=THREE.RepeatWrapping;tex.repeat.set(len/3.9,1);
      const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:tex,bumpMap:tex,bumpScale:.006,roughness:.96,side:THREE.DoubleSide}));
      m.castShadow=true;m.receiveShadow=true;place(m);cloth.add(m);
    };
    drop(7.86,.24,m=>{m.position.set(0,.977-.12,1.85);});
    drop(2.58,.24,m=>{m.rotation.y=-Math.PI/2;m.position.set(-3.95,.977-.12,.55);});
    drop(2.58,.24,m=>{m.rotation.y=Math.PI/2;m.position.set(3.95,.977-.12,.55);});
    // rug
    const rc=document.createElement("canvas");rc.width=1536;rc.height=1024;const r=rc.getContext("2d");
    r.fillStyle="#ddd2bd";r.fillRect(0,0,1536,1024);
    for(let i=0;i<90000;i++){const v=Math.random();r.fillStyle=v<.5?`rgba(255,250,238,${Math.random()*.22})`:`rgba(120,100,72,${Math.random()*.16})`;r.beginPath();r.arc(Math.random()*1536,Math.random()*1024,1+Math.random()*2.6,0,6.3);r.fill();}
    // hand-drawn diamond lattice in charcoal wool
    r.strokeStyle="rgba(46,40,34,.86)";r.lineCap="round";
    const cell=190,ox=1536/2,oy=1024/2;
    for(let k=-12;k<=12;k++)for(const s of [1,-1]){
      r.lineWidth=13+Math.random()*5;r.beginPath();
      for(let t=-1100;t<=1100;t+=40){const x=ox+t+k*cell*s*0+0,y=oy+t*.68*s+k*cell*.68;const jx=(Math.random()-.5)*9,jy=(Math.random()-.5)*9;if(t===-1100)r.moveTo(x+jx,y+jy);else r.lineTo(x+jx,y+jy);}
      r.stroke();
    }
    // a border band
    r.lineWidth=16;r.strokeStyle="rgba(46,40,34,.8)";r.strokeRect(54,54,1536-108,1024-108);
    r.lineWidth=5;r.strokeRect(84,84,1536-168,1024-168);
    const rugTex=new THREE.CanvasTexture(rc);rugTex.encoding=THREE.sRGBEncoding;rugTex.anisotropy=renderer.capabilities.getMaxAnisotropy();
    const rug=new THREE.Group();rug.name="wool rug";rug.position.set(.15,0,2.75);rug.rotation.y=.04;scene.add(rug);
    const rugMat=new THREE.MeshStandardMaterial({map:rugTex,bumpMap:rugTex,bumpScale:.03,roughness:1});
    const pile=new THREE.Mesh(new THREE.PlaneGeometry(4.4,2.9),rugMat);pile.rotation.x=-Math.PI/2;pile.position.y=.034;pile.receiveShadow=true;rug.add(pile);
    box(4.4,.024,2.9,mat(0xb9ac93,1),0,.021,0,rug,false);
    // knotted fringe on the short ends
    const fringeMat=mat(0xe7dcc6,.95);
    for(const sx of [-1,1])for(let i=0;i<70;i++){const f=box(.075,.004,.006,fringeMat,sx*(2.2+.035),.014,-1.42+i*(2.84/69),rug,false);f.rotation.y=(Math.random()-.5)*.5;}
  }
  // v52: black tufted leather sofa (deep buttoned back and rolled arms).
  const tuftCanvas=document.createElement("canvas");tuftCanvas.width=512;tuftCanvas.height=256;
  {const c=tuftCanvas.getContext("2d");c.fillStyle="#808080";c.fillRect(0,0,512,256);const sx=64,sy=64;
   c.strokeStyle="#5a5a5a";c.lineWidth=3;
   for(let k=-8;k<16;k++){c.beginPath();c.moveTo(k*sx,0);c.lineTo(k*sx+256,256);c.stroke();c.beginPath();c.moveTo(k*sx+256,0);c.lineTo(k*sx,256);c.stroke();}
   for(let y=0;y<=256;y+=sy/2)for(let x=((y/(sy/2))%2)*sx/2;x<=512;x+=sx){const g=c.createRadialGradient(x,y,0,x,y,22);g.addColorStop(0,"#202020");g.addColorStop(1,"rgba(128,128,128,0)");c.fillStyle=g;c.fillRect(x-22,y-22,44,44);}
   for(let y=sy/4;y<256;y+=sy/2)for(let x=(((y-sy/4)/(sy/2))%2)*sx/2+sx/4;x<=512;x+=sx/2){const g=c.createRadialGradient(x,y,0,x,y,26);g.addColorStop(0,"rgba(190,190,190,.55)");g.addColorStop(1,"rgba(128,128,128,0)");c.fillStyle=g;c.fillRect(x-26,y-26,52,52);}}
  const tuftTex=new THREE.CanvasTexture(tuftCanvas);tuftTex.wrapS=tuftTex.wrapT=THREE.RepeatWrapping;tuftTex.repeat.set(2.2,1.2);
  const leather=new THREE.MeshPhysicalMaterial({color:0x151311,roughness:.44,metalness:0,clearcoat:.35,clearcoatRoughness:.5,sheen:.3,sheenColor:new THREE.Color(0x3a3029)});
  const leatherTuft=leather.clone();leatherTuft.bumpMap=tuftTex;leatherTuft.bumpScale=.035;
  const sofa=new THREE.Group();sofa.name="black tufted leather sofa";scene.add(sofa);
  roundedBox(2.9,.26,1.12,.06,leather,2.1,.31,-1.86,sofa);
  roundedBox(2.86,.62,.30,.11,leatherTuft,2.1,.92,-2.29,sofa);
  const backRoll=cylinder(.13,.13,2.86,leather,2.1,1.22,-2.27,sofa,32);backRoll.rotation.z=Math.PI/2;
  for(const x of [.79,3.41]){
    roundedBox(.28,.48,1.1,.1,leatherTuft,x,.66,-1.84,sofa);
    const roll=cylinder(.15,.15,1.1,leather,x,.9,-1.84,sofa,28);roll.rotation.x=Math.PI/2;
    const cap=cylinder(.15,.15,.02,mat(0x0e0c0b,.5),x,.9,-1.28,sofa,28);cap.rotation.x=Math.PI/2;
  }
  for(const x of [1.45,2.75]){roundedBox(1.29,.2,.84,.09,leather,x,.53,-1.72,sofa);box(1.2,.006,.004,mat(0x070606,.7),x,.635,-1.3,sofa,false);}
  const buttonMat=mat(0x0d0b0a,.38,.1);
  for(let r=0;r<3;r++)for(let i=0;i<9;i++){const x=1.0+i*.275+(r%2)*.1375;if(x>3.18)continue;sphere(.013,buttonMat,x,.74+r*.16,-2.135,sofa);}
  for(const x of [.82,3.38])for(const z of [-2.3,-1.42])cylinder(.035,.028,.17,mat(0x9b7a45,.3,.75),x,.13,z,sofa,16);
  roundedBox(.46,.4,.13,.08,wovenMaterial("#b6a183",0xb6a183),1.15,.83,-2.03,sofa).rotation.set(-.22,.18,.06);
  // Rear-wall frames and a low cabinet are inferred from a restrained Korean
  // home interior, filling only areas that are not visible in the reference.
  // (v48) The two small frames beside the window curtain were removed: the
  // paintings now live in the gallery.
  box(1.55, .65, .5, wood, -3.75, .58, -2.45);
  roundedBox(1.46,.43,.06,.025,lightWood,-3.75,.58,-2.17);
  for (const x of [-4.15, -3.35]) {
    roundedBox(.70,.40,.035,.018,mat(0x85552f,.54),x,.58,-2.12);
    roundedBox(.15,.045,.026,.012,mat(0x322319,.32,.62),x,.60,-2.085);
    roundedBox(.105,.018,.012,.006,metal,x,.60,-2.068);
  }
  for(const x of [-4.28,-3.22])for(const z of [-2.62,-2.28])cylinder(.045,.05,.2,darkWood,x,.14,z,scene,20);
  // Reference-inspired media corner, modeled as original geometry for this room.
  // The compact CRT and video player sit on the existing cabinet; tapes stay
  // beside them so the writing desk and its current equipment remain clear.
  // v53: TV and video deck removed; a stoneware vase of dried grasses instead.
  lathe([[0,0],[.09,0],[.13,.06],[.14,.16],[.1,.3],[.06,.36],[.065,.4]],mat(0xb9a58a,.86),[-3.95,.905,-2.3],scene,40);
  for(let i=0;i<14;i++){const a2=i/14*Math.PI*2,r=.05+Math.random()*.25,h=.9+Math.random()*.55;curve([[-3.95,1.25,-2.3],[-3.95+Math.cos(a2)*r*.4,1.25+h*.5,-2.3+Math.sin(a2)*r*.3],[-3.95+Math.cos(a2)*r,1.25+h,-2.3+Math.sin(a2)*r*.6]],.004,mat(0xb89d6c,.9),scene,10);
    const plume=sphere(.05,mat(0xe6d4ae,.95),-3.95+Math.cos(a2)*r,1.25+h+.04,-2.3+Math.sin(a2)*r*.6);plume.scale.set(.55,1.9,.55);}
  book(-3.45,-2.3,.42,.05,.3,0x4a3a2e,.3,scene,.905);book(-3.45,-2.3,.38,.05,.28,0x7d5a3c,.1,scene,.955);
  const tapeColors = [0x6b493b, 0x354a4d, 0x8a6844];
  for (let i = 0; i < tapeColors.length; i++) {
    const z = -2.38 + i * .015, y = .96 + i * .09;
    roundedBox(.34,.075,.22,.009,mat(tapeColors[i],.78),-3.13,y,z);
    roundedBox(.245,.026,.012,.004,mat(0xe0d3b8,.9),-3.13,y,z+.116);
    box(.19,.003,.006,mat(0x514436,.82),-3.13,y,z+.124,scene,false);
    for(const x of [-3.21,-3.05])cylinder(.027,.027,.01,mat(0x171918,.52),x,y,z,scene,20);
  }
  // Wall art and a soft floor lamp for the lounge corner.
  const galleryFrame = box(1.35, 1.55, .08, darkWood, 4.255, 3.0, -.15);
  galleryFrame.rotation.y = -Math.PI / 2; galleryFrame.visible = false;
  const galleryMat = box(1.2, 1.4, .03, cream, 4.205, 3.0, -.15);
  galleryMat.rotation.y = -Math.PI / 2; galleryMat.visible = false;
  // A transparent alphabet mural sits over the matching floral wallpaper.
  // The string lights are modeled bulbs with real emissive materials and light.
  const alphabetCanvas = document.createElement("canvas"); alphabetCanvas.width = 1100; alphabetCanvas.height = 760;
  const alphabetContext = alphabetCanvas.getContext("2d");
  alphabetContext.textAlign = "center"; alphabetContext.textBaseline = "middle";
  alphabetContext.fillStyle = "#211b17"; alphabetContext.shadowColor = "#211b17"; alphabetContext.shadowBlur = 2;
  alphabetContext.font = "700 78px 'Comic Sans MS','Segoe Print',cursive";
  const alphabetRows = ["ABCDEFGH", "IJKLMNOPQ", "RSTUVWXYZ"], alphabetY = [232, 438, 640];
  alphabetRows.forEach((row,ri) => {
    const spacing = 930 / row.length;
    [...row].forEach((letter,i) => {
      const x = 85 + spacing * (i + .5), y = alphabetY[ri] + ((i * 7 + ri * 3) % 9 - 4);
      alphabetContext.save(); alphabetContext.translate(x,y); alphabetContext.rotate(((i * 13 + ri * 5) % 11 - 5) * .008);
      alphabetContext.fillText(letter,0,0); alphabetContext.restore();
    });
  });
  const lightRows = [172, 376, 580];
  alphabetContext.shadowBlur = 0; alphabetContext.strokeStyle = "#3c3027"; alphabetContext.lineWidth = 5;
  lightRows.forEach((y,i) => { alphabetContext.beginPath(); alphabetContext.moveTo(48,y); alphabetContext.bezierCurveTo(340,y-37,760,y+35,1050,y-12); alphabetContext.stroke(); });
  const alphabetTexture = new THREE.CanvasTexture(alphabetCanvas); alphabetTexture.encoding = THREE.sRGBEncoding;
  const alphabetPanel = new THREE.Mesh(new THREE.PlaneGeometry(3.45,2.38),new THREE.MeshBasicMaterial({map:alphabetTexture,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));
  alphabetPanel.position.set(4.265,2.82,-.15); alphabetPanel.rotation.y=-Math.PI/2; scene.add(alphabetPanel);
  const storyBulbs = [], bulbColors = [0xff315f,0x32c9ff,0xffd12e,0x52f078,0xff4fe1,0xff7c32];
  const wireMaterial = mat(0x342b25,.86), socketMaterial = mat(0x392e28,.68);
  lightRows.forEach((pixelY,row) => {
    const wirePoints=[];
    for(let j=0;j<=12;j++){
      const t=j/12, px=48+1002*t, py=pixelY-37*Math.sin(Math.PI*t)+(row===1?18*Math.sin(Math.PI*t):0);
      const localX=(px/1100-.5)*3.45, worldY=4.01-(py/760)*2.38;
      wirePoints.push([4.245,worldY,-.15+localX]);
    }
    curve(wirePoints,.009,wireMaterial,scene,36);
    for(let i=0;i<8;i++){
      const t=.09+i*.117, px=48+1002*t, py=pixelY-37*Math.sin(Math.PI*t)+(row===1?18*Math.sin(Math.PI*t):0);
      const x=4.225, z=-.15+(px/1100-.5)*3.45, y=4.01-(py/760)*2.38-.055;
      const color=bulbColors[(i+row)%bulbColors.length];
      const material=new THREE.MeshStandardMaterial({color:0x514137,emissive:0x000000,emissiveIntensity:0,roughness:.22,metalness:.01});
      const bulb=sphere(.043,material,x,y,z,scene); storyBulbs.push({mesh:bulb,material});
      cylinder(.014,.014,.035,socketMaterial,x,y+.045,z,scene,10);
    }
  });
  const storyGlow=new THREE.PointLight(0xff315f,2.4,2.8,1.6); storyGlow.visible=false; scene.add(storyGlow);
  let activeStoryBulb=-1, nextStoryFlash=0;
  // v52: warm amber bulbs that light up one after another at irregular
  // intervals (sometimes two overlap), each fading in and out softly.
  const storyLevels=storyBulbs.map(()=>0), storyTargets=storyBulbs.map(()=>0), storyOffAt=storyBulbs.map(()=>0);
  storyBulbs.forEach(b=>{b.material.color.setHex(0x6b5139);b.material.emissive.setHex(0xffa940);b.material.emissiveIntensity=.04;});
  storyGlow.color.setHex(0xffa940);
  function updateStoryLights(now){
    if(now>=nextStoryFlash){
      let i=Math.floor(Math.random()*storyBulbs.length); if(i===activeStoryBulb)i=(i+1+Math.floor(Math.random()*3))%storyBulbs.length;
      activeStoryBulb=i; storyTargets[i]=1; storyOffAt[i]=now+260+Math.random()*700;
      nextStoryFlash=now+(Math.random()<.25?140+Math.random()*200:450+Math.random()*1500);
    }
    let best=-1,bestLevel=0;
    for(let i=0;i<storyBulbs.length;i++){
      if(storyTargets[i]&&now>storyOffAt[i])storyTargets[i]=0;
      storyLevels[i]+=(storyTargets[i]-storyLevels[i])*(storyTargets[i]?.55:.22);
      const m=storyBulbs[i].material, l=storyLevels[i];
      m.emissiveIntensity=.04+3.2*l; m.color.setRGB(.42+.58*l,.32+.55*l,.22+.38*l);
      if(l>bestLevel){bestLevel=l;best=i;}
    }
    if(best>=0&&bestLevel>.02){storyGlow.visible=true;storyGlow.position.copy(storyBulbs[best].mesh.position);storyGlow.position.x-=.12;storyGlow.intensity=1.6*bestLevel;}else storyGlow.visible=false;
  }
  lathe([[0,0],[.21,0],[.29,.035],[.31,.07],[.30,.09],[.25,.50],[.23,.53],[.13,.53],[.12,.50],[.18,.09],[0,.08]],wovenMaterial("#e7dfd0",0xe7dfd0),[3.83,2.42,-1.75],scene,56);
  torus(.30,.012,mat(0x9a8d78,.6,.18),[3.83,2.50,-1.75],scene,8,48);
  lathe([[0,0],[.23,.02],[.28,.055],[.27,.09],[.18,.10],[.16,.12]],mat(0x777064,.36,.55),[3.83,.04,-1.75],scene,48);
  curve([[3.83,.12,-1.75],[3.82,.85,-1.75],[3.85,1.6,-1.75],[3.83,2.42,-1.75]],.025,mat(0x958a78,.32,.62));
  for(const y of [.34,1.12,1.88]){const collar=torus(.032,.008,metal,[3.83,y,-1.75],scene,8,24);collar.rotation.x=Math.PI/2;}
  curve([[3.84,.30,-1.74],[3.91,.24,-1.65],[3.98,.10,-1.58]],.006,black);
  const floorBulbMaterial=new THREE.MeshStandardMaterial({color:0xffe9c4,emissive:0xffb85c,emissiveIntensity:2.2,roughness:.2});
  ellipsoid(.075,.10,.075,floorBulbMaterial,[3.83,2.55,-1.75]);
  let floorLampOn=false, floorLampLevel=0;
  floorBulbMaterial.emissiveIntensity=0;
  const warm = new THREE.PointLight(0xffb878, 0, 5.2, 2); warm.position.set(3.65, 2.35, -1.7); warm.visible=floorLampOn; scene.add(warm);
  window.toggleFloorLamp = () => { floorLampOn=!floorLampOn; if(floorLampOn)warm.visible=true; render(); };

  // Warm, lived-in evening light (after the user's reference): a soft amber
  // ambient wash and a low ceiling fill, with the lamps on when the room opens.
  scene.add(new THREE.HemisphereLight(0xffc98a, 0x3a2210, .2));
  const roomFill = new THREE.PointLight(0xffb86e, .5, 11, 1.4); roomFill.position.set(.4, 3.7, 2.4); scene.add(roomFill);
  const deskWarm = new THREE.PointLight(0xffa04a, .9, 3.6, 2); deskWarm.position.set(-1.45, 1.75, .25); scene.add(deskWarm);
  const sunlight = new THREE.DirectionalLight(0x9dadce, .42);
  sunlight.position.set(-3.8, 5.2, -5.4);
  sunlight.target.position.set(-.15, 1.05, 1.15);
  sunlight.intensity=0; sunlight.castShadow = true; sunlight.shadow.mapSize.set(3072, 3072); sunlight.shadow.bias = -0.00025; sunlight.shadow.normalBias = 0.018; sunlight.shadow.radius = 3; sunlight.shadow.camera.left = -7; sunlight.shadow.camera.right = 7; sunlight.shadow.camera.top = 7; sunlight.shadow.camera.bottom = -4; scene.add(sunlight, sunlight.target);
  const windowBounce = new THREE.DirectionalLight(0x849ac0, .03); windowBounce.position.set(-.4, 4.6, -4.5); windowBounce.target.position.set(-.2, 1.1, 1.2); scene.add(windowBounce, windowBounce.target);

  // Import detailed PBR assets while keeping the existing desk, room layout,
  // camera constraints, and interaction anchor coordinates intact.
  function buildReferenceChair() {
    const chair = new THREE.Group();
    chair.name = "warm ivory upholstered gaming chair";
    const leather = leatherFinish("#bdab95", 0xbca68d);
    const sideLeather = leatherFinish("#9c8872", 0x9c8872);
    useLeatherPbr(leather,0xc7b29a);
    useLeatherPbr(sideLeather,0xb29d86);
    const stitch = mat(0xe0cfb9, .92);
    const graphite = mat(0x292a29, .34, .42);
    const rubber = mat(0x171918, .7, .04);
    const z = 2.23;

    // Sculpted, single broad back shell with softly raised shoulder wings.
    const backShape = new THREE.Shape();
    backShape.moveTo(-.29,.42); backShape.bezierCurveTo(-.39,.48,-.40,.61,-.37,.76);
    backShape.lineTo(-.32,1.34); backShape.bezierCurveTo(-.31,1.58,-.24,1.72,-.12,1.77);
    backShape.bezierCurveTo(-.06,1.80,.06,1.80,.12,1.77);
    backShape.bezierCurveTo(.24,1.72,.31,1.58,.32,1.34); backShape.lineTo(.37,.76);
    backShape.bezierCurveTo(.40,.61,.39,.48,.29,.42); backShape.bezierCurveTo(.15,.36,-.15,.36,-.29,.42);
    const backGeo = new THREE.ExtrudeGeometry(backShape,{depth:.17,bevelEnabled:true,bevelSegments:7,bevelSize:.055,bevelThickness:.045,curveSegments:20});
    backGeo.translate(0,0,-.085);
    addMesh(backGeo,leather,[0,.02,z+.20],chair);
    // An inset centre pad and curved piping create upholstered volume and
    // visible panel construction while keeping a calm, one-piece silhouette.
    const padShape = new THREE.Shape();
    padShape.moveTo(-.205,.51);padShape.bezierCurveTo(-.25,.59,-.22,.74,-.205,.88);
    padShape.lineTo(-.18,1.34);padShape.bezierCurveTo(-.17,1.49,-.11,1.58,0,1.60);
    padShape.bezierCurveTo(.11,1.58,.17,1.49,.18,1.34);padShape.lineTo(.205,.88);
    padShape.bezierCurveTo(.22,.74,.25,.59,.205,.51);padShape.bezierCurveTo(.12,.47,-.12,.47,-.205,.51);
    const padGeo=new THREE.ExtrudeGeometry(padShape,{depth:.04,bevelEnabled:true,bevelSegments:6,bevelSize:.024,bevelThickness:.022,curveSegments:18});
    padGeo.translate(0,0,-.02);addMesh(padGeo,leather,[0,.02,z+.30],chair);
    curve([[-.255,.58,z+.35],[-.27,.92,z+.35],[-.24,1.35,z+.35],[-.15,1.53,z+.35],[0,1.56,z+.35],[.15,1.53,z+.35],[.24,1.35,z+.35],[.27,.92,z+.35],[.255,.58,z+.35]],.005,stitch,chair,70);
    // Separate, softly stuffed head and lumbar cushions, wrapped in the same
    // warm leather as the body. Their rounded corners follow real chair pads.
    roundedBox(.40,.22,.15,.09,leather,0,1.69,z+.29,chair);
    curve([[-.14,1.72,z+.37],[-.10,1.785,z+.37],[0,1.80,z+.37],[.10,1.785,z+.37],[.14,1.72,z+.37]],.004,stitch,chair,30);
    roundedBox(.42,.25,.12,.095,leather,0,.72,z+.31,chair);
    curve([[-.16,.67,z+.38],[-.11,.63,z+.38],[0,.62,z+.38],[.11,.63,z+.38],[.16,.67,z+.38]],.004,stitch,chair,30);
    // Thick seat cushion with rounded front edge and subtle stitched welt.
    roundedBox(.67,.27,.66,.12,leather,0,.62,z-.10,chair);
    curve([[-.29,.57,z-.40],[-.24,.50,z-.41],[0,.48,z-.41],[.24,.50,z-.41],[.29,.57,z-.40]],.005,stitch,chair,34);
    // Upholstered side bolsters, arm supports and broad padded arm tops.
    for(const side of [-1,1]){
      const bolster=roundedBox(.105,.76,.18,.05,sideLeather,side*.335,.95,z+.16,chair);bolster.rotation.x=-.08;
      const armPost=roundedBox(.075,.29,.12,.028,graphite,side*.43,.73,z-.12,chair);
      roundedBox(.14,.075,.38,.035,mat(0x393a38,.62,.12),side*.45,.89,z-.13,chair);
      roundedBox(.18,.065,.40,.045,sideLeather,side*.45,.94,z-.13,chair);
      curve([[side*.37,.64,z-.34],[side*.46,.64,z-.34],[side*.50,.64,z+.02]],.008,graphite,chair,24);
    }
    // A real five-spoke swivel base, gas lift, casters and soft black wheels.
    cylinder(.065,.085,.30,graphite,0,.37,z-.1,chair,32);
    cylinder(.04,.055,.28,mat(0x5c5c58,.3,.72),0,.20,z-.1,chair,32);
    for(let i=0;i<5;i++){
      const a=Math.PI*2*i/5+.15, ex=Math.cos(a)*.46, ez=z-.1+Math.sin(a)*.46;
      line([0,.11,z-.1],[ex,.105,ez],.034,graphite,chair);
      cylinder(.045,.045,.075,graphite,ex,.085,ez,chair,20).rotation.z=Math.PI/2;
      const wheel=addMesh(new THREE.TorusGeometry(.065,.025,12,24),rubber,[ex,.075,ez],chair);wheel.rotation.y=Math.PI/2;
    }
    scene.add(chair);
  }
  window.installRealRoomModels = function ({ GLTFLoader, KTX2Loader, MeshoptDecoder }) {
    if (!GLTFLoader || !KTX2Loader || !MeshoptDecoder) return;
    const assetManager = window.createRoomLoadingManager();
    const ktx2 = new KTX2Loader(assetManager).setTranscoderPath("lib/basis/");
    ktx2.detectSupport(renderer);
    const loader = new GLTFLoader(assetManager);
    const transcoderReady = window.roomAssetsReady(["lib/basis/basis_transcoder.js", "lib/basis/basis_transcoder.wasm"]);
    loader.setKTX2Loader(ktx2);
    loader.setMeshoptDecoder(MeshoptDecoder);

    const hideLegacyProps = (bounds) => {
      const target = new THREE.Box3(new THREE.Vector3(...bounds[0]), new THREE.Vector3(...bounds[1]));
      for (const child of scene.children) {
        if (!child.isMesh || !child.visible) continue;
        const box = new THREE.Box3().setFromObject(child);
        if (box.intersectsBox(target)) child.visible = false;
      }
    };
    const placeImported = (path, options) => Promise.all([window.roomAssetURL(path), transcoderReady]).then(([url]) => loader.load(url, (gltf) => {
      const model = gltf.scene;
      model.rotation.y = options.rotationY || 0;
      model.scale.set(options.scale, options.scaleY || options.scale, options.scale);
      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model);
      const center = bounds.getCenter(new THREE.Vector3());
      model.position.set(options.x - center.x, options.floorY - bounds.min.y, options.z - center.z);
      model.traverse((node) => {
        if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; if (node.material && "envMapIntensity" in node.material) node.material.envMapIntensity = .82; }
      });
      model.name = options.name;
      if (options.hideBounds) hideLegacyProps(options.hideBounds);
      if (options.hideLegacyChair) {
        const legacyChair = scene.getObjectByName("warm ivory upholstered gaming chair");
        if (legacyChair) legacyChair.visible = false;
      }
      scene.add(model);
      if (galleryMode) { galleryVisibility.set(model, true); model.visible = false; }
      if (options.name === "realistic table lamp") deskLampGroup.visible = false;
      render();
    }, undefined, (error) => { if (options.name === "realistic table lamp") deskLampGroup.visible = true; console.warn("3D model could not be loaded:", options.name, error); }));


    // These source meshes are true 3D product assets with embedded PBR maps.
    // Uniform scaling preserves each object's modeled proportions.
    // Real-scale 24-inch monitor with a separate thin bezel, glass, housing,
    // stand and base; its PBR surfaces replace the oversized stylized screen.
    placeImported("https://files.innerscene.com/library/desktop-monitor-24-inch-326dfa17/54902a0b9f353f7eb942/desktop-monitor-24-inch.glb", { name: "photoreal 24-inch desktop monitor", x: -.12, floorY: .96, z: -.43, scale: 2.7, hideBounds: [[-1.18, .99, -1.2], [.94, 2.24, .20]] });
    // (v53) keyboard removed: hide the old procedural keyboard too
    hideLegacyProps([[-1.08, .98, -.28], [.68, 1.22, .52]]);
    placeImported("assets/models/tevy-gaming-mouse-v1.glb", { name: "realistic gaming mouse and pad", x: .98, floorY: .96, z: .31, scale: 1.9, hideBounds: [[.72, .98, -.02], [1.34, 1.25, .62]] });
    // Replace the remaining foreground props whose earlier hand-built forms
    // read as toy geometry. Keep their original positions and interaction areas.
    placeImported("assets/models/tevy-cappuccino-cup-and-saucer-v1.glb", { name: "porcelain coffee cup and saucer", x: -2.5, floorY: .99, z: 1.3, scale: 2.15, hideBounds: [[-3.18, 1.00, .58], [-2.70, 1.43, .98]] });
    //(v52 tevy sofa removed) [[.70, .32, -2.55], [3.55, 1.70, -1.25]] });
    // Replace only the chair with the official glTF SheenChair sample, keeping
    // the existing desk position, facing, camera controls and hotspots intact.
    placeImported("assets/models/sheen-chair/SheenChair.glb", { name: "SheenChair velvet wood-frame chair", x: .02, floorY: .015, z: 2.08, scale: 1.4, scaleY: 1.62, rotationY: Math.PI, hideLegacyChair: true });
    // Use the textured, real-scale ivory-bin shredder from the target reference.
    // If the remote model is unavailable, the detailed room-built version stays visible.
    placeImported("https://files.innerscene.com/library/shred-bin-paper-shredder-b68dfbd8/6a150c17aeceedcf10c9/desktop-paper-shredder.glb", { name: "textured ivory paper shredder", x: 2.78, floorY: .96, z: 1.15, scale: 1.55, hideBounds: [[2.39, .98, .80], [3.17, 1.72, 1.50]] });

    // Load the user's supplied room as a navigable place behind the gallery door.
    const galleryLamp = new THREE.HemisphereLight(0xc8d8ff, 0x3b271d, 1.9); galleryWorld.add(galleryLamp);
    const galleryKey = new THREE.DirectionalLight(0xffd6a2, 2.1); galleryKey.position.set(-4, 8, 5); galleryWorld.add(galleryKey);
    // Drawing-room windows measured in the gallery model (centre, inward normal,
    // opening size). The afternoon sun comes in from that corner at about 35°.
    const GALLERY_WINDOWS = [
      { c: [0.38, 2.2, -3.45], n: [.68, 0, .73], w: 1.0, h: 2.0 },
      { c: [-3.45, 2.2, 0.0], n: [.68, 0, .73], w: 1.0, h: 2.0 }
    ];
    const SUN_DIR = new THREE.Vector3(.68 * Math.cos(.62), -Math.sin(.62), .73 * Math.cos(.62)).normalize();
    const GALLERY_FLOOR = .25;   // parquet height in the scan
    // Soft afternoon sun through the drawing-room windows: warm light shafts with
    // drifting dust, sunlit patches on the floor, and a slightly warmer scan.
    function addGallerySunlight(model) {
      model.traverse(node => {
        if (!node.isMesh) return;
        for (const m of [].concat(node.material)) if (m && m.color) m.color.setRGB(1.1, 1.03, .93);
      });
      const sun = new THREE.Group(); sun.name = "gallery sunlight"; galleryWorld.add(sun);
      const beamMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xffd9a0) }, uStrength: { value: .38 } },
        vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
        fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uStrength; varying vec3 vP;
          float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
          float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
          void main(){
            // vP.x, vP.y in [-.5,.5] across the window, vP.z in [0,1] along the beam
            float edge = smoothstep(.5, .32, abs(vP.x)) * smoothstep(.5, .3, abs(vP.y));
            float along = smoothstep(0., .08, vP.z) * (1. - smoothstep(.35, 1., vP.z));
            float streak = .75 + .25 * n(vec2(vP.x * 9. + uTime * .05, vP.z * 2.));
            gl_FragColor = vec4(uColor * uStrength * edge * along * streak, 1.);
          }`
      });
      const patchCanvas = document.createElement("canvas"); patchCanvas.width = 256; patchCanvas.height = 256;
      const pc = patchCanvas.getContext("2d");
      pc.filter = "blur(6px)"; pc.fillStyle = "#fff";
      for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) pc.fillRect(24 + i * 108, 20 + j * 74, 96, 64);
      const patchMap = new THREE.CanvasTexture(patchCanvas);
      const patchMat = new THREE.MeshBasicMaterial({ map: patchMap, color: 0xffcf8f, transparent: true, opacity: .62, blending: THREE.AdditiveBlending, depthWrite: false });
      const dir = SUN_DIR.clone();
      for (const w of GALLERY_WINDOWS) {
        const n = new THREE.Vector3(...w.n).normalize(), slant = Math.abs(n.x * dir.x + n.z * dir.z) / Math.hypot(dir.x, dir.z);
        const length = (w.c[1] - GALLERY_FLOOR) / -dir.y;                                // window centre to the floor
        const geo = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1); geo.translate(0, 0, .5);
        const beam = new THREE.Mesh(geo, beamMat);
        beam.position.set(...w.c); beam.scale.set(w.w * slant, w.h * .92, length * 1.15);
        beam.lookAt(beam.position.clone().add(dir)); beam.renderOrder = 5; sun.add(beam);
        const hit = new THREE.Vector3(...w.c).addScaledVector(dir, length);
        const holder = new THREE.Group(); holder.position.set(hit.x, GALLERY_FLOOR + .012, hit.z); holder.rotation.y = Math.atan2(dir.x, dir.z); sun.add(holder);
        const patch = new THREE.Mesh(new THREE.PlaneGeometry(w.w * slant, w.h / Math.tan(Math.asin(-dir.y)) * .9), patchMat);
        patch.rotation.x = -Math.PI / 2; patch.renderOrder = 4; holder.add(patch);
      }
      // dust motes drifting inside the shafts
      const count = 260, pos = new Float32Array(count * 3), seeds = new Float32Array(count);
      const wins = GALLERY_WINDOWS;
      for (let i = 0; i < count; i++) {
        const w = wins[i % wins.length], d = SUN_DIR;
        const right = new THREE.Vector3(d.z, 0, -d.x).normalize().multiplyScalar(.75), t = Math.random() * (w.c[1] - .3) / -d.y * .8;
        const p = new THREE.Vector3(...w.c).addScaledVector(d, t).addScaledVector(right, (Math.random() - .5) * w.w * .8).add(new THREE.Vector3(0, (Math.random() - .5) * w.h * .8, 0));
        pos.set([p.x, p.y, p.z], i * 3); seeds[i] = Math.random() * 100;
      }
      const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffd9a0, size: .018, transparent: true, opacity: .45, blending: THREE.AdditiveBlending, depthWrite: false }));
      sun.add(dust);
      const base = pos.slice();
      gallerySunTick = now => {
        beamMat.uniforms.uTime.value = now * .001;
        for (let i = 0; i < count; i++) {
          const s = seeds[i], t = now * .00012 + s;
          pos[i * 3] = base[i * 3] + Math.sin(t * 1.3) * .05; pos[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * .9 + s) * .06; pos[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 1.1) * .05;
        }
        dustGeo.attributes.position.needsUpdate = true;
      };
    }
    let galleryLoaded = false, galleryLoading = false, queuedGalleryEntrance = false, loadingHint = null;
    const loadGallery = () => {
      if (galleryLoaded || galleryLoading) return;
      galleryLoading = true;
      window.roomAssetURL("assets/models/the_great_drawing_room.glb").then(url => loader.load(url, gltf => {
        const model = gltf.scene; galleryWorld.add(model); model.updateMatrixWorld(true);
        let bounds = new THREE.Box3().setFromObject(model), span = bounds.getSize(new THREE.Vector3());
        const scale = 11 / Math.max(span.x, span.y, span.z, 1); model.scale.setScalar(scale); model.updateMatrixWorld(true);
        galleryHeight = span.y * scale;
        bounds = new THREE.Box3().setFromObject(model); const center = bounds.getCenter(new THREE.Vector3());
        model.position.set(-center.x, -bounds.min.y, -center.z);
        // The scan uses unlit materials, so it never needs the shadow pass.
        model.traverse(node => { if (node.isMesh) { node.castShadow = false; node.receiveShadow = false; } });
        try { addGallerySunlight(model); } catch (e) { console.warn("Gallery sunlight could not be added", e); }
        galleryLoaded = true; galleryLoading = false; loadingHint?.remove(); loadingHint = null;
        window.__galleryHooks = { THREE, galleryWorld, camera, controls, renderer, render, isActive: () => galleryMode };
        try { window.initGalleryPaintings?.(); } catch (e) { console.warn("Mood paintings could not be set up", e); }
        if (queuedGalleryEntrance) { queuedGalleryEntrance = false; showGalleryDestination(); }
      }, undefined, error => { galleryLoading = false; queuedGalleryEntrance = false; loadingHint?.remove(); loadingHint = null; console.warn("Gallery destination could not be loaded", error); }));
    };
    window.enterGreatDrawingRoom = () => {
      if (galleryLoaded) { showGalleryDestination(); return; }
      queuedGalleryEntrance = true;
      if (!loadingHint) {
        loadingHint = document.createElement("div"); loadingHint.textContent = "正在进入…";
        Object.assign(loadingHint.style,{position:"absolute",zIndex:"12",left:"50%",top:"50%",transform:"translate(-50%,-50%)",padding:"12px 20px",borderRadius:"22px",background:"#17120fdd",color:"#f2e4cd",font:"600 14px system-ui",pointerEvents:"none"});
        room.appendChild(loadingHint);
      }
      loadGallery();
    };
    // The gallery is the main destination: start loading it quietly once the room is up.
    setTimeout(loadGallery, 2500);
  };
  // Closer default framing of the desk, like the reference room.
  const ROOM_VIEW = { pos: [0, 2.2, 5.5], target: [0, 1.4, .5], min: 3.4, max: 6.4, az: .4, polar: [1.22, 1.5] };
  // Vintage warm-yellow grade for the room (after the user's reference): a
  // light sepia film tone on the 3D view plus a soft amber vignette.
  const ROOM_GRADE = "sepia(.42) saturate(1.25) contrast(1.08) brightness(.95) hue-rotate(-8deg)";
  renderer.domElement.style.filter = ROOM_GRADE;
  const roomVignette = document.createElement("div"); roomVignette.id = "roomVignette";
  Object.assign(roomVignette.style, { position: "absolute", inset: "0", zIndex: "3", pointerEvents: "none", background: "radial-gradient(ellipse at 50% 46%, rgba(255,190,110,.05) 0%, rgba(80,44,14,0) 48%, rgba(36,18,4,.62) 100%)", mixBlendMode: "multiply" });
  room.appendChild(roomVignette);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  // Keep the tabletop, rather than the room shell, at the center of rotation.
  controls.target.set(0, 1.4, .5);
  controls.enableDamping = true; controls.dampingFactor = .075;
  controls.enablePan = false; controls.enableZoom = true;
  // Keep the camera in front of the chair and inside the room: the old 1.5
  // minimum let a zoom or drag pass through the chair and desk.
  controls.minDistance = ROOM_VIEW.min; controls.maxDistance = ROOM_VIEW.max;
  controls.minAzimuthAngle = -ROOM_VIEW.az; controls.maxAzimuthAngle = ROOM_VIEW.az;
  controls.minPolarAngle = ROOM_VIEW.polar[0]; controls.maxPolarAngle = ROOM_VIEW.polar[1];
  controls.cursorStyle = "grab";
  controls.update();

  function showGalleryDestination(){
    if(galleryMode)return;
    galleryMode=true;galleryVisibility.clear();
    window.roomMusicBridge?.pause?.(); window.__pcVideoPause?.(); window.galleryMusic?.start(); window.setWeatherSoundMuted?.(true);
    for(const child of scene.children){if(child===galleryWorld)continue;galleryVisibility.set(child,child.visible);child.visible=false;}
    galleryWorld.visible=true;scene.background.set(0x15161b);scene.fog=null;renderer.domElement.style.filter="";roomVignette.style.display="none";window.__galleryHooks?.refreshPaintings?.();if(!document.getElementById("gallerySunGlow")){const glow=document.createElement("div");glow.id="gallerySunGlow";Object.assign(glow.style,{position:"absolute",inset:"0",zIndex:"3",pointerEvents:"none",mixBlendMode:"screen",background:"linear-gradient(125deg,rgba(255,205,130,.20) 0%,rgba(255,196,120,.07) 32%,rgba(255,190,110,0) 60%),radial-gradient(ellipse at 8% 0%,rgba(255,226,170,.22),transparent 45%)"});room.appendChild(glow);}document.getElementById("roomHints")?.style.setProperty("opacity","0");
    layer.style.visibility="hidden";renderer.domElement.style.visibility="visible";
    for(const el of [...layer.querySelectorAll("[style*=visibility]"),document.getElementById("incense"),document.getElementById("shredderObject"),document.getElementById("crt"),document.getElementById("wall")])if(el&&el!==renderer.domElement)el.style.visibility="hidden";
    renderer.domElement.style.transition="opacity .42s ease";renderer.domElement.style.opacity="0";
    setTimeout(()=>{
      // Stand inside the drawing room (the scan's outer shell is not meant to be seen).
      // Face the painting walls (Mon-Fri ahead, Sat-Sun to the right) and look around in place.
      camera.position.set(-0.9,1.75,-1.0);
      controls.target.copy(new THREE.Vector3(2.45,2.05,1.55).sub(camera.position).normalize().multiplyScalar(1.2).add(camera.position));controls.minDistance=.4;controls.maxDistance=1.8;controls.minPolarAngle=.9;controls.maxPolarAngle=2.15;controls.minAzimuthAngle=-Infinity;controls.maxAzimuthAngle=Infinity;
      controls.update();
      galleryReturnButton=document.createElement("button");galleryReturnButton.type="button";galleryReturnButton.textContent="← 房间";
      Object.assign(galleryReturnButton.style,{position:"absolute",zIndex:"12",left:"24px",top:"124px",padding:"10px 15px",border:"1px solid #d7b37488",borderRadius:"22px",background:"#17120fdd",backdropFilter:"blur(12px)",color:"#f2e4cd",font:"600 14px system-ui",cursor:"pointer"});
      galleryReturnButton.onclick=leaveGalleryDestination;room.appendChild(galleryReturnButton);
      renderer.domElement.style.opacity="1";render();
    },420);
  }
  function leaveGalleryDestination(){
    if(!galleryMode)return;
    window.galleryMusic?.stop(); window.setWeatherSoundMuted?.(false);
    renderer.domElement.style.opacity="0";
    setTimeout(()=>{
      window.__galleryHooks?.onLeave?.();galleryWorld.visible=false;galleryVisibility.forEach((visible,object)=>{if(object!==galleryWorld)object.visible=visible;});galleryVisibility.clear();
      scene.background.set(0x111522);scene.fog=new THREE.Fog(0x111522,20,38);layer.style.visibility="";renderer.domElement.style.visibility="";
      camera.position.set(...ROOM_VIEW.pos);controls.target.set(...ROOM_VIEW.target);controls.minDistance=ROOM_VIEW.min;controls.maxDistance=ROOM_VIEW.max;controls.minPolarAngle=ROOM_VIEW.polar[0];controls.maxPolarAngle=ROOM_VIEW.polar[1];controls.minAzimuthAngle=-ROOM_VIEW.az;controls.maxAzimuthAngle=ROOM_VIEW.az;controls.update();
      galleryReturnButton?.remove();galleryReturnButton=null;document.getElementById("gallerySunGlow")?.remove();renderer.domElement.style.filter=ROOM_GRADE;roomVignette.style.display="";galleryMode=false;document.getElementById("roomHints")?.style.setProperty("opacity","1");swingGalleryDoor(0);renderer.domElement.style.opacity="1";render();
    },420);
  }

  const anchors = {
    weather: [-1.35, 2.58, -2.73], computer: [-.12, 1.63, -.27], photo: [-2.16, 1.2, .66],
    music: [3.2, 1.28, -.84], diary: [-.10, 1.08, 1.28], light: [lampX, 2.18, lampZ],
    gallery: [-4.12, 1.28, -.45], memory: [0, 1.4, -2.65], shredder: [2.78, 1.67, 1.15]
  };
  // Invisible ray targets sit over existing objects. The room meshes remain
  // the visible controls; these only translate pointer hits to actions.
  const interactiveObjects = [
    { name: "weather", center: [-.35,2.72,-2.86], size: [6.25,2.82,.18] },
    { name: "power", center: [.50,1.36,.05], size: [.24,.22,.06] },
    { name: "computer", center: [-.12,1.61,-.30], size: [1.82,1.36,.62] },
    { name: "diary", center: [-.10,1.04,1.28], size: [1.58,.25,1.08] },
    { name: "music", center: [3.18,1.22,-.82], size: [1.48,.72,1.35] },
    { name: "vinyl-box", center: [3.2,1.15,-.10], size: [.82,.52,.68] },
    { name: "photo", center: [-1.55,1.16,.98], size: [.92,.72,.75] },
    { name: "light", center: [lampX,1.75,lampZ], size: [.92,1.40,.82] },
    { name: "floor-lamp", center: [3.83,1.44,-1.75], size: [.82,2.88,.82] },
    { name: "shredder", center: [2.78,1.30,1.15], size: [.82,.86,.82] },
    { name: "stranger-lights", center: [4.18,2.82,-.15], size: [.18,2.38,3.45] },
    { name: "gallery", center: [-4.12,1.22,-.45], size: [.62,2.28,1.42] }
  ];
  const interactionZones = interactiveObjects.map(item => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...item.size), new THREE.MeshBasicMaterial({ transparent:true, opacity:0, colorWrite:false, depthWrite:false, side:THREE.DoubleSide }));
    mesh.position.set(...item.center); mesh.userData.interactionName=item.name; mesh.userData.interactionProxy=true; scene.add(mesh);
    return { ...item, mesh, bounds:new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(...item.center),new THREE.Vector3(...item.size)) };
  });
  const interactionRaycaster = new THREE.Raycaster(), interactionPointer = new THREE.Vector2();
  let hoveredObject = null, pointerDown = null, cameraDragging = false, highlighted = [];
  function clearObjectHighlight() { for (const entry of highlighted) entry.mesh.material=entry.material; highlighted=[]; }
  function setHoveredObject(name) {
    if (hoveredObject===name) return;
    clearObjectHighlight(); hoveredObject=name; layer.dataset.hover=name||"";
    if (name && name!=="stranger-lights") {
      const zone=interactionZones.find(item=>item.name===name);
      scene.traverse(mesh=>{
        if (!mesh.isMesh || mesh.userData.interactionProxy) return;
        mesh.updateWorldMatrix(true,false);
        if (!zone.bounds.containsPoint(mesh.getWorldPosition(new THREE.Vector3()))) return;
        const original=mesh.material;
        const brighten=material=>{
          if (!material || !material.clone) return material;
          const copy=material.clone();
          if (copy.emissive) { copy.emissive.setHex(0x6d4a24); copy.emissiveIntensity=.12; }
          else if (copy.color) copy.color.lerp(new THREE.Color(0xe6bd79),.12);
          return copy;
        };
        mesh.material=Array.isArray(original)?original.map(brighten):brighten(original);
        highlighted.push({mesh,material:original});
      });
    }
    renderer.domElement.style.cursor=name?"pointer":"grab";
  }
  function pickObject(event) {
    const rect=renderer.domElement.getBoundingClientRect();
    interactionPointer.set(((event.clientX-rect.left)/rect.width)*2-1,-((event.clientY-rect.top)/rect.height)*2+1);
    interactionRaycaster.setFromCamera(interactionPointer,camera);
    const hit=interactionRaycaster.intersectObjects(interactionZones.map(item=>item.mesh),false)[0];
    return hit?.object?.userData?.interactionName||null;
  }
  const overlayTargets = {
    crt: { el: document.getElementById("crt"), rect: [-.83, 1.28, -.265, .59, 2.02, -.265] },
    wall: { el: document.getElementById("wall"), rect: [4.195, 2.25, -.85, 4.195, 3.75, .55] },
    shredder: { el: document.getElementById("shredderObject"), rect: [2.34, .94, .79, 3.22, 1.68, 1.51] },
    weather: { el: layer.querySelector(".weather-glass"), rect: [-3.35, 1.3, -2.73, 2.66, 4.12, -2.73] }
  };
  interactionProjectionReady = true;
  function placeRect(el, rect) {
    if (!el) return;
    const [x1,y1,z1,x2,y2,z2] = rect;
    const points = [[x1,y1,z1],[x2,y1,z1],[x1,y2,z1],[x2,y2,z1]].map(p => new THREE.Vector3(...p).project(camera));
    const xs = points.map(p => (p.x * .5 + .5) * 100), ys = points.map(p => (-p.y * .5 + .5) * 100);
    const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
    const visible = points.some(p => p.z > -1 && p.z < 1) && right > 0 && left < 100 && bottom > 0 && top < 100;
    el.style.left = `${left}%`; el.style.top = `${top}%`; el.style.transform = "none";
    el.style.width = `${Math.max(0, right-left)}%`; el.style.height = `${Math.max(0, bottom-top)}%`;
    el.style.visibility = visible ? "visible" : "hidden";
  }
  function projectAnchors() {
    for (const [name, point] of Object.entries(anchors)) {
      const el = name === "incense" ? document.getElementById("incense") : name === "shredder" ? document.getElementById("shredderObject") : layer.querySelector(`.hot[data-open="${name}"]`);
      if (!el) continue;
      const v = new THREE.Vector3(...point).project(camera);
      const visible = v.z > -1 && v.z < 1;
      el.style.left = `${(v.x * .5 + .5) * 100}%`;
      el.style.top = `${(-v.y * .5 + .5) * 100}%`;
      el.style.transform = "translate(-50%,-50%)";
      el.style.visibility = visible ? "visible" : "hidden";
    }
    for (const target of Object.values(overlayTargets)) placeRect(target.el, target.rect);
    if (pcMode && pcScreenEl) placeRect(pcScreenEl, [-.83, 1.28, -.265, .59, 2.02, -.265]);
    else if (pcScreenEl && pcScreenEl.style.visibility !== "hidden") { pcScreenEl.style.visibility = "hidden"; pcScreenEl.classList.remove("on"); }
    // Open the wall on the camera side like an architectural cutaway; the far
    // wall stays solid so the room still reads as a complete space.
    const angle = Math.atan2(camera.position.x, camera.position.z);
    rightWall.visible = angle < .35;
    leftWall.visible = angle > -.35;
  }
  function size() {
    const r = room.getBoundingClientRect(); if (!r.width || !r.height) return;
    camera.aspect = r.width / r.height; camera.updateProjectionMatrix(); renderer.setSize(r.width, r.height, false); render();
  }
  let scheduled = false;
  function render() {
    renderer.render(scene, camera);
    if (interactionProjectionReady && !galleryMode) projectAnchors();
  }
  function scheduleRender() { if (scheduled) return; scheduled = true; requestAnimationFrame(() => { scheduled = false; controls.update(); render(); }); }
  controls.addEventListener("change", render);
  new ResizeObserver(size).observe(room);
  window.addEventListener("resize", size);
  controls.addEventListener("start", () => { cameraDragging=true; room.classList.add("is-camera-dragging"); });
  controls.addEventListener("end", () => { cameraDragging=false; room.classList.remove("is-camera-dragging"); });
  renderer.domElement.addEventListener("pointerdown", event => { pointerDown={x:event.clientX,y:event.clientY}; });
  renderer.domElement.addEventListener("pointermove", event => { if(galleryMode||pcMode||vinylMode||windowMode)return; if(!cameraDragging&&!event.buttons)setHoveredObject(pickObject(event)); });
  renderer.domElement.addEventListener("pointerleave", () => setHoveredObject(null));
  renderer.domElement.addEventListener("pointerup", event => {
    const down=pointerDown; pointerDown=null;
    if(pcMode||vinylMode||windowMode){
      if(down&&Math.hypot(event.clientX-down.x,event.clientY-down.y)<=6){ if(pcMode)window.exitRoomComputer?.(); else if(vinylMode)window.exitRoomTurntable?.(); else window.exitRoomWindow?.(); }
      return;
    }
    if(galleryMode)return; // the gallery has its own painting clicks; the computer screen has its own buttons
    // Pointer-up happens before OrbitControls' mouse-up "end" event. Do not
    // use cameraDragging here or ordinary clicks on room props get discarded.
    if(!down||Math.hypot(event.clientX-down.x,event.clientY-down.y)>6)return;
    const name=pickObject(event); if(!name)return;
    if(name==="stranger-lights")return;
    if(name==="light"){setHoveredObject(null);window.toggleDeskLamp();return;}
    if(name==="floor-lamp"){setHoveredObject(null);window.toggleFloorLamp();return;}
    if(name==="vinyl-box"){setHoveredObject(null);window.swapRoomVinyl?.();return;}
    if(name==="music"){setHoveredObject(null);window.enterRoomTurntable?.();return;}
    if(name==="weather"){setHoveredObject(null);window.enterRoomWindow?.();return;}
    if(name==="shredder"){setHoveredObject(null);window.openRoomShredder?.();return;}
    if(name==="gallery") { setHoveredObject(null); window.openMoodGalleryDoor?.(); return; }
    if(name==="power") { window.toggleRoomPcPower?.(); return; }
    if(name==="computer") { window.__pcPowerOn?.(); window.enterRoomComputer?.(); return; }
    layer.querySelector(`.hot[data-open="${name}"]`)?.click();
  });
  // ---------- "Use the computer": zoom to the monitor and play the day's video ----------
  // Like the reference room: press C or click the monitor, the camera glides to
  // the screen, and the screen becomes a small desktop that plays the video
  // uploaded for this day. Shortcut hints sit at the bottom of the room.
  const PC_RECT = [-.83, 1.28, -.265, .59, 2.02, -.265];
  const PC_TEXT = {
    ko: { title: "나의 하루 PC", empty: "이날의 영상이 아직 없어요", emptySub: "영상을 올리면 이 화면에서 재생돼요", upload: "영상 올리기", play: "재생", pause: "일시정지", memo: "생각 메모", exit: "나가기", saved: "영상이 저장되었어요", saving: "저장 중…", failed: "저장하지 못했어요",
      hintRoom: [["N", "일기 쓰기"], ["C", "컴퓨터 사용"], ["클릭", "물건 보기"], ["드래그", "둘러보기"]], hintPc: [["U", "영상 올리기"], ["Space", "재생 / 일시정지"], ["Esc", "돌아가기"]] },
    zh: { title: "我的一天 PC", empty: "这一天还没有影像", emptySub: "上传视频后会在这块屏幕上播放", upload: "上传视频", play: "播放", pause: "暂停", memo: "想法便签", exit: "退出", saved: "视频已保存", saving: "保存中…", failed: "保存失败",
      hintRoom: [["N", "写日记"], ["C", "使用电脑"], ["点击", "查看物品"], ["拖动", "环顾房间"]], hintPc: [["U", "上传视频"], ["空格", "播放 / 暂停"], ["Esc", "返回"]] },
    en: { title: "My Day PC", empty: "No video for this day yet", emptySub: "Upload one and it plays on this screen", upload: "Upload video", play: "Play", pause: "Pause", memo: "Thoughts", exit: "Exit", saved: "Video saved", saving: "Saving…", failed: "Could not save",
      hintRoom: [["N", "write diary"], ["C", "use computer"], ["Click", "look at things"], ["Drag", "look around"]], hintPc: [["U", "upload video"], ["Space", "play / pause"], ["Esc", "back"]] }
  };
  const pcLang = () => { const l = window.roomVideoBridge?.lang?.() || document.getElementById("lang")?.value || "ko"; return PC_TEXT[l] ? l : "ko"; };
  const pcT = () => PC_TEXT[pcLang()];
  const pcStyle = document.createElement("style");
  pcStyle.textContent = `
  #pcScreen{position:absolute;z-index:4;visibility:hidden;overflow:hidden;background:#07090a;color:#d9f2dc;font:500 clamp(9px,1.05vw,15px)/1.4 "SFMono-Regular",Menlo,Consolas,"D2Coding","Nanum Gothic Coding",monospace;border-radius:3px;opacity:0;transition:opacity .35s ease;display:flex;flex-direction:column}
  #pcScreen.on{opacity:1}
  #pcScreen:after{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(rgba(255,255,255,.035) 0 1px,transparent 1px 3px),radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.55));mix-blend-mode:screen}
  #pcScreen .pc-bar{display:flex;justify-content:space-between;gap:8px;padding:.45em .9em;background:linear-gradient(#1d2a24,#121a16);border-bottom:1px solid #2f4a3a;color:#9fe0b0;letter-spacing:.06em;font-size:.86em}
  #pcScreen .pc-main{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;background:#000}
  #pcScreen video{width:100%;height:100%;object-fit:contain;background:#000}
  #pcScreen .pc-empty{text-align:center;color:#a9d8b4;padding:1em}
  #pcScreen .pc-empty b{display:block;font-size:1.3em;color:#e2f7e6;margin-bottom:.3em}
  #pcScreen .pc-dock{display:flex;gap:.5em;justify-content:center;padding:.5em;background:#101613;border-top:1px solid #2f4a3a}
  #pcScreen button{font:inherit;font-size:.9em;color:#e8fbe9;background:#1f3328;border:1px solid #3f6b52;border-radius:4px;padding:.3em .9em;cursor:pointer}
  #pcScreen button:hover{background:#2c4a39}
  #pcScreen button kbd{margin-left:.45em;padding:0 .35em;border:1px solid #5f8f73;border-radius:3px;font-size:.8em;color:#9fe0b0}
  #pcScreen .pc-toast{position:absolute;left:50%;top:.8em;transform:translateX(-50%);padding:.3em .9em;background:#0c120fdd;border:1px solid #3f6b52;border-radius:4px;color:#bff3cb;opacity:0;transition:opacity .3s}
  #pcScreen .pc-toast.show{opacity:1}
  #roomHints{position:absolute;z-index:6;left:50%;bottom:18px;transform:translateX(-50%);display:flex;gap:14px;align-items:center;padding:7px 14px;border-radius:20px;background:#120d0acc;border:1px solid #d7b37444;color:#ecdcc0;font:500 12.5px/1 "SFMono-Regular",Menlo,Consolas,monospace;letter-spacing:.04em;pointer-events:none;white-space:nowrap;transition:opacity .3s}
  #roomHints kbd{display:inline-block;margin-right:6px;padding:3px 6px;border:1px solid #d7b37488;border-bottom-width:2px;border-radius:4px;color:#f6d38e;font:inherit}
  #roomHints span+span:before{content:"·";margin-right:14px;color:#d7b37488}
  @media (max-width:720px){#roomHints{display:none}}`;
  document.head.appendChild(pcStyle);
  const pcScreen = document.createElement("div"); pcScreen.id = "pcScreen"; layer.appendChild(pcScreen);
  const pcInput = document.createElement("input"); pcInput.type = "file"; pcInput.accept = "video/*"; pcInput.hidden = true; document.body.appendChild(pcInput);
  const hints = document.createElement("div"); hints.id = "roomHints"; room.appendChild(hints);
  let pcSaved = null, pcUrl = "", pcTween = 0; pcScreenEl = pcScreen;
  function renderHints() {
    const list = windowMode ? (WT[pcLang()] || WT.ko).hint : vinylMode ? VT[pcLang()].hint : pcMode ? pcT().hintPc : pcT().hintRoom;
    hints.innerHTML = list.map(([k, v]) => `<span><kbd>${k}</kbd>${v}</span>`).join("");
    hints.style.opacity = galleryMode ? "0" : "1";
  }
  function pcClock() { const d = new Date(); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
  // Videos are copied into memory first: Chrome will not stream a file-backed
  // blob that has been stored in IndexedDB on a page opened from file://.
  let pcRenderId = 0;
  async function renderPc() {
    const t = pcT(), b = window.roomVideoBridge, day = b?.day?.() || "", id = ++pcRenderId;
    const url = (await b?.url?.()) || "", name = b?.name?.() || "";
    if (id !== pcRenderId) { if (url.startsWith("blob:")) URL.revokeObjectURL(url); return; }
    if (pcUrl && pcUrl !== url && pcUrl.startsWith("blob:")) URL.revokeObjectURL(pcUrl);
    pcUrl = url;
    pcScreen.innerHTML = `<div class="pc-bar"><span>▣ ${t.title}</span><span>${name ? "▶ " + name.replace(/[<>&]/g, "") + " · " : ""}${day.replace(/-/g, ".")} · ${pcClock()}</span></div>
      <div class="pc-main">${url ? `<video playsinline preload="metadata"></video>` : `<div class="pc-empty"><b>${t.empty}</b>${t.emptySub}</div>`}<div class="pc-toast"></div></div>
      <div class="pc-dock"><button data-pc="upload">⤒ ${t.upload}<kbd>U</kbd></button>${url ? `<button data-pc="play">▶ ${t.play}<kbd>Space</kbd></button>` : ""}<button data-pc="memo">✎ ${t.memo}</button><button data-pc="exit">⏏ ${t.exit}<kbd>Esc</kbd></button></div>`;
    const v = pcScreen.querySelector("video");
    if (v) { v.src = url; v.onerror = () => pcToast(pcT().failed); v.onplay = v.onpause = () => { const pb = pcScreen.querySelector('[data-pc="play"]'); if (pb) pb.innerHTML = (v.paused ? "▶ " + t.play : "❚❚ " + t.pause) + "<kbd>Space</kbd>"; }; v.onclick = pcToggle; }
  }
  function pcToast(text) { const el = pcScreen.querySelector(".pc-toast"); if (!el) return; el.textContent = text; el.classList.add("show"); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("show"), 2200); }
  function pcToggle() { const v = pcScreen.querySelector("video"); if (!v) return; if (v.paused) v.play().catch(() => {}); else v.pause(); }
  pcScreen.addEventListener("click", e => {
    const act = e.target.closest("[data-pc]")?.dataset.pc; if (!act) return;
    e.stopPropagation();
    if (act === "upload") pcInput.click();
    else if (act === "play") pcToggle();
    else if (act === "exit") exitComputer();
    else if (act === "memo") { exitComputer(); setTimeout(() => layer.querySelector('.hot[data-open="computer"]')?.click(), 650); }
  });
  ["pointerdown", "pointerup", "pointermove", "wheel"].forEach(type => pcScreen.addEventListener(type, e => e.stopPropagation()));
  pcInput.onchange = async () => {
    const file = pcInput.files[0]; pcInput.value = ""; if (!file) return;
    const b = window.roomVideoBridge; if (!b) return;
    pcToast(pcT().saving);
    const ok = await b.set(file);
    await renderPc(); pcToast(ok ? pcT().saved : pcT().failed);
    const v = pcScreen.querySelector("video"); if (v) v.play().catch(() => {});
  };
  function tweenCamera(toPos, toTarget, ms, done) {
    cancelAnimationFrame(pcTween);
    const p0 = camera.position.clone(), t0 = controls.target.clone(), start = performance.now();
    const step = now => {
      const k = Math.min(1, (now - start) / ms), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      camera.position.lerpVectors(p0, toPos, e); controls.target.lerpVectors(t0, toTarget, e); camera.lookAt(controls.target); render();
      if (k < 1) pcTween = requestAnimationFrame(step); else done && done();
    };
    pcTween = requestAnimationFrame(step);
  }
  function enterComputer() {
    if (pcMode || galleryMode || vinylMode || windowMode) return;
    pcMode = true; setHoveredObject(null);
    pcSaved = { pos: camera.position.clone(), target: controls.target.clone(), min: controls.minDistance, max: controls.maxDistance, polar: [controls.minPolarAngle, controls.maxPolarAngle], az: [controls.minAzimuthAngle, controls.maxAzimuthAngle] };
    controls.enabled = false;
    controls.minDistance = .5; controls.maxDistance = 10; controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI; controls.minAzimuthAngle = -Infinity; controls.maxAzimuthAngle = Infinity;
    const cx = (PC_RECT[0] + PC_RECT[3]) / 2, cy = (PC_RECT[1] + PC_RECT[4]) / 2, w = PC_RECT[3] - PC_RECT[0], h = PC_RECT[4] - PC_RECT[1];
    // distance that makes the screen fill about 72% of the view
    const vf = THREE.MathUtils.degToRad(camera.fov) / 2, hf = Math.atan(Math.tan(vf) * camera.aspect);
    const dist = Math.max(w / (2 * Math.tan(hf) * .72), h / (2 * Math.tan(vf) * .72));
    const crt = document.getElementById("crt"); if (crt) crt.style.opacity = "0";
    renderPc(); renderHints();
    tweenCamera(new THREE.Vector3(cx, cy, PC_RECT[2] + dist), new THREE.Vector3(cx, cy, PC_RECT[2]), 900, () => pcScreen.classList.add("on"));
  }
  function exitComputer() {
    if (!pcMode) return;
    pcScreen.classList.remove("on");
    const s = pcSaved; pcSaved = null;
    tweenCamera(s.pos, s.target, 800, () => {
      controls.minDistance = s.min; controls.maxDistance = s.max; [controls.minPolarAngle, controls.maxPolarAngle] = s.polar; [controls.minAzimuthAngle, controls.maxAzimuthAngle] = s.az;
      controls.enabled = true; pcMode = false; pcScreen.style.visibility = "hidden";
      const crt = document.getElementById("crt"); if (crt) crt.style.opacity = ""; renderHints(); render();
    });
  }
  window.enterRoomComputer = enterComputer; window.exitRoomComputer = exitComputer;

  // ---------- v54: the monitor in the room ----------
  // The day's video keeps playing on the real monitor after you step back from
  // the computer. A glass layer gives the panel a soft reflection so it reads as
  // a real screen, and the small power button at the bottom-right turns it off
  // (the picture collapses to a line) and on again.
  const SW = PC_RECT[3] - PC_RECT[0], SH = PC_RECT[4] - PC_RECT[1], SCX = (PC_RECT[0] + PC_RECT[3]) / 2, SCY = (PC_RECT[1] + PC_RECT[4]) / 2, SZ = PC_RECT[2];
  const screenRig = new THREE.Group(); screenRig.name = "monitor screen rig"; scene.add(screenRig);
  const panelMat = new THREE.MeshBasicMaterial({ color: 0x0b0d0f, toneMapped: false, depthTest: false });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), panelMat); panel.position.set(SCX, SCY, SZ + .022); screenRig.add(panel);
  const vidMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, opacity: 0, depthTest: false });
  const vidPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), vidMat); vidPlane.position.set(SCX, SCY, SZ + .024); vidPlane.visible = false; screenRig.add(vidPlane);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x9fb8c8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false });
  const glowLine = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), glowMat); glowLine.position.set(SCX, SCY, SZ + .025); screenRig.add(glowLine);
  // glass: faint diagonal sheen of the desk lamp + darker corners
  const gc = document.createElement("canvas"); gc.width = 512; gc.height = 280; const g2 = gc.getContext("2d");
  let gr = g2.createLinearGradient(0, 0, 512, 280); gr.addColorStop(0, "rgba(255,236,210,.10)"); gr.addColorStop(.28, "rgba(255,236,210,.035)"); gr.addColorStop(.42, "rgba(255,236,210,0)"); gr.addColorStop(.62, "rgba(255,236,210,0)"); gr.addColorStop(.7, "rgba(255,236,210,.05)"); gr.addColorStop(.76, "rgba(255,236,210,0)"); g2.fillStyle = gr; g2.fillRect(0, 0, 512, 280);
  gr = g2.createLinearGradient(0, 0, 0, 280); gr.addColorStop(0, "rgba(255,255,255,.06)"); gr.addColorStop(.06, "rgba(255,255,255,0)"); g2.fillStyle = gr; g2.fillRect(0, 0, 512, 280);
  const sheen = g2.createRadialGradient(120, 70, 4, 120, 70, 150); sheen.addColorStop(0, "rgba(255,214,170,.09)"); sheen.addColorStop(1, "rgba(255,214,170,0)"); g2.fillStyle = sheen; g2.fillRect(0, 0, 512, 280);
  const glassTex = new THREE.CanvasTexture(gc); glassTex.encoding = THREE.sRGBEncoding;
  const screenGlass = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: glassTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false }));
  screenGlass.position.set(SCX, SCY, SZ + .027); screenRig.add(screenGlass);
  panel.renderOrder = 20; vidPlane.renderOrder = 21; glowLine.renderOrder = 22; screenGlass.renderOrder = 23;
  // power button + LED, bottom-right of the bezel
  const pwr = new THREE.Group(); pwr.position.set(PC_RECT[3] - .045, PC_RECT[1] - .022, SZ + .03); screenRig.add(pwr);
  const pwrBtn = new THREE.Mesh(new THREE.CylinderGeometry(.011, .011, .006, 20), new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: .45, metalness: .5 }));
  pwrBtn.rotation.x = Math.PI / 2; pwr.add(pwrBtn);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x8fd6ff, toneMapped: false });
  const led = new THREE.Mesh(new THREE.CircleGeometry(.0042, 16), ledMat); led.position.set(-.026, 0, .002); pwr.add(led);
  let pcPower = true, vidTex = null, vidEl = null, vidShow = 0, lastPcDay = "", powerAnim = null;
  function currentVideo() { return pcScreen.querySelector("video"); }
  function fitVideo(v) {
    const ar = v && v.videoWidth ? v.videoWidth / v.videoHeight : 16 / 9, sr = SW / SH;
    if (ar > sr) vidPlane.scale.set(SW, SW / ar, 1); else vidPlane.scale.set(SH * ar, SH, 1);
  }
  function setCrt(op) { const crt = document.getElementById("crt"); if (crt && crt.style.opacity !== op) crt.style.opacity = op; }
  window.__pcVideoPause = () => { const v = currentVideo(); if (v) v.pause(); };
  window.__pcPowerOn = () => { if (!pcPower) togglePower(); };
  function togglePower() {
    const v = currentVideo();
    pcPower = !pcPower;
    powerAnim = { on: pcPower, t0: performance.now() };
    if (!pcPower) { if (v) v.pause(); }
    else if (v && v.currentTime > 0 && !v.ended) v.play().catch(() => {});
    window.roomPcClick?.();
  }
  window.toggleRoomPcPower = togglePower;
  window.isRoomPcOn = () => pcPower;
  window.__pcScreenTick = now => {
    const v = currentVideo();
    // a new day: stop the old day's video on the room monitor
    const d = window.roomVideoBridge?.day?.() || "";
    if (lastPcDay && d !== lastPcDay && !pcMode && v) { v.pause(); v.removeAttribute("src"); v.load(); }
    lastPcDay = d;
    if (v !== vidEl) { vidTex?.dispose(); vidTex = null; vidEl = v; if (v) { vidTex = new THREE.VideoTexture(v); vidTex.encoding = THREE.sRGBEncoding; vidMat.map = vidTex; vidMat.needsUpdate = true; } }
    const has = !!(v && v.getAttribute("src") && v.readyState >= 2 && v.currentTime > 0);
    const want = has && pcPower && !pcMode ? 1 : 0;
    vidShow += (want - vidShow) * .18; if (Math.abs(want - vidShow) < .01) vidShow = want;
    if (has) fitVideo(v);
    let squash = 1, line = 0;
    if (powerAnim) {
      const k = Math.min(1, (now - powerAnim.t0) / 420);
      if (!powerAnim.on) { squash = Math.max(.008, 1 - k * 1.25); line = k < .8 ? .9 * Math.min(1, k * 3) : .9 * (1 - (k - .8) / .2); glowLine.scale.set(Math.max(.02, 1 - Math.max(0, k - .55) * 2.2), .012, 1); }
      else { line = .5 * (1 - k); glowLine.scale.set(1, 1, 1); }
      if (k >= 1) { powerAnim = null; glowLine.scale.set(1, 1, 1); }
    }
    glowMat.opacity = line;
    vidMat.opacity = vidShow; vidPlane.visible = vidShow > .01 && (pcPower || !!powerAnim);
    if (vidPlane.visible && powerAnim && !powerAnim.on) vidPlane.scale.y *= squash;
    panelMat.color.setHex(pcPower ? (has && !pcMode ? 0x000000 : 0x0d1013) : 0x050506);
    ledMat.color.setHex(pcPower ? (v && !v.paused ? 0x7dffa8 : 0x8fd6ff) : 0x5a2a0c);
    if (!pcMode && !vinylMode && !windowMode && !galleryMode) setCrt(pcPower && !(vidShow > .01) ? "" : "0");
  };
  // ---------- v51: turntable — lift the record off and put a new one on ----------
  // Clicking the turntable glides the camera over the deck and shows a record
  // sleeve (not the notepad). "New record" asks for a music file, then the record
  // that is on the platter is lifted off and carried away, the new one (its label
  // printed with the song title) is lowered onto the spindle, spins and plays.
  const VT = {
    ko: { kicker: "턴테이블 · 오늘의 레코드", title: "곡 제목을 적어 주세요", none: "아직 올린 레코드가 없어요", newRec: "새 레코드 올리기", play: "재생", pause: "멈춤", mv: "MV 영상 넣기", mvSet: "MV · ", mvHint: "MV는 컴퓨터(C)에서 재생돼요", side: "SIDE A · 33⅓", lifting: "레코드를 들어 올리는 중…", placing: "새 레코드를 올리는 중…", hint: [["U", "새 레코드"], ["Space", "재생 / 멈춤"], ["Esc", "돌아가기"]] },
    zh: { kicker: "唱机 · 今天的唱片", title: "在这里写歌名", none: "还没有放唱片", newRec: "换一张新唱片", play: "播放", pause: "暂停", mv: "放入 MV 视频", mvSet: "MV · ", mvHint: "MV 在电脑里播放（按 C）", side: "SIDE A · 33⅓", lifting: "正在拿起旧唱片…", placing: "正在放上新唱片…", hint: [["U", "换新唱片"], ["空格", "播放 / 暂停"], ["Esc", "返回"]] },
    en: { kicker: "Turntable · today's record", title: "Write the song title", none: "No record on yet", newRec: "Put on a new record", play: "Play", pause: "Pause", mv: "Add MV video", mvSet: "MV · ", mvHint: "The MV plays on the computer (C)", side: "SIDE A · 33⅓", lifting: "Lifting the record…", placing: "Putting the new record on…", hint: [["U", "new record"], ["Space", "play / pause"], ["Esc", "back"]] }
  };
  const vtLang = () => { const l = window.roomMusicBridge?.lang?.() || document.getElementById("lang")?.value || "ko"; return VT[l] ? l : "ko"; };
  const vt = () => VT[vtLang()];
  const LABEL_TONES = ["#c8553d", "#d9a441", "#55777f", "#8b5d6d", "#6f8a4e", "#3e5a7a"];
  let vinylSaved = null, vinylSpin = false, discOnPlatter = platterDisc, labelTone = 0;
  const PLATTER = new THREE.Vector3(3.16, 1.297, -.87);
  window.__vinylSpinTick = dt => { if (vinylSpin && discOnPlatter) discOnPlatter.rotation.y -= dt * .0024; };
  window.__vinylStopSpin = () => { vinylSpin = false; };
  function paintLabel(canvas, title, tone) {
    const c = canvas.getContext("2d"); c.clearRect(0, 0, 512, 512);
    c.fillStyle = tone; c.beginPath(); c.arc(256, 256, 254, 0, 7); c.fill();
    c.strokeStyle = "rgba(255,240,210,.5)"; c.lineWidth = 4; c.beginPath(); c.arc(256, 256, 226, 0, 7); c.stroke();
    c.fillStyle = "#fff1d6"; c.textAlign = "center"; c.font = "600 30px monospace"; c.fillText(vt().side, 256, 140);
    c.font = "64px 'Diary Hand', 'Nanum Pen Script', cursive";
    const words = String(title || "").trim() || "♪", lines = [];
    let cur = ""; for (const ch of words) { if (c.measureText(cur + ch).width > 380) { lines.push(cur); cur = ch; } else cur += ch; } lines.push(cur);
    lines.slice(0, 2).forEach((l, i) => c.fillText(l, 256, (lines.length > 1 ? 330 : 360) + i * 64));
    c.fillStyle = "#16110d"; c.beginPath(); c.arc(256, 256, 16, 0, 7); c.fill();
  }
  function makeRecord(title) {
    const g = new THREE.Group(); g.name = "new LP"; scene.add(g);
    cylinder(.335, .335, .014, vinylBlack, 0, 0, 0, g, 72);
    for (let r = .14; r < .325; r += .022) { const groove = torus(r, .0013, mat(0x3c3f43, .34, .18), [0, .0075, 0], g, 4, 64); groove.rotation.x = Math.PI / 2; }
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 512;
    const tone = LABEL_TONES[labelTone++ % LABEL_TONES.length]; paintLabel(canvas, title, tone);
    const tex = new THREE.CanvasTexture(canvas); if ("encoding" in tex) tex.encoding = THREE.sRGBEncoding;
    const label = new THREE.Mesh(new THREE.CircleGeometry(.11, 48), new THREE.MeshStandardMaterial({ map: tex, roughness: .62 }));
    label.rotation.x = -Math.PI / 2; label.position.y = .0078; g.add(label);
    g.userData.tone = tone; return g;
  }
  function tweenObj(ms, step) {
    return new Promise(res => { const t0 = performance.now(); const f = now => { const k = Math.min(1, (now - t0) / ms); step(k); render(); if (k < 1) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  }
  const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  // Lift the current record straight up, tip it toward you and carry it away.
  async function liftOff() {
    let old = discOnPlatter;
    if (activeVinyl >= 0) old = vinylRecords[activeVinyl];
    if (!old || !old.visible) return;
    vinylSpin = false;
    const p0 = old.position.clone(), r0 = old.rotation.y;
    await tweenObj(520, k => { const e = ease(k); old.position.set(p0.x, p0.y + .30 * e, p0.z); old.rotation.x = -.5 * e; old.rotation.y = r0 + .4 * e; });
    if (old === vinylRecords[activeVinyl]) {
      const i = activeVinyl, home = new THREE.Vector3(3.2 + (i - 1) * .035, 1.075 + i * .016, -.10 + (i % 2) * .025), p1 = old.position.clone();
      await tweenObj(560, k => { const e = ease(k); old.position.lerpVectors(p1, home, e); old.position.y += Math.sin(e * Math.PI) * .12; old.rotation.x = -.5 * (1 - e); });
      old.rotation.set(0, 0, 0); activeVinyl = -1;
    } else {
      const p1 = old.position.clone(), away = new THREE.Vector3(p1.x - 1.0, p1.y + .35, p1.z + .9);
      await tweenObj(620, k => { const e = ease(k); old.position.lerpVectors(p1, away, e); old.rotation.x = -.5 - 1.0 * e; old.scale.setScalar(1 - .5 * e); });
      old.visible = false;
      if (old !== platterDisc) { scene.remove(old); old.traverse(n => { n.geometry?.dispose?.(); if (n.material?.map) n.material.map.dispose(); }); }
      else { old.position.copy(p0); old.rotation.set(0, 0, 0); old.scale.setScalar(1); }
    }
    discOnPlatter = null;
  }
  // Bring a new record in from the front-left, hover it over the spindle and lower it.
  async function placeNew(title) {
    const rec = makeRecord(title), start = new THREE.Vector3(PLATTER.x - 1.0, PLATTER.y + .45, PLATTER.z + .9), hover = PLATTER.clone().add(new THREE.Vector3(0, .26, 0));
    rec.position.copy(start); rec.rotation.x = -1.2; rec.scale.setScalar(.6);
    await tweenObj(700, k => { const e = ease(k); rec.position.lerpVectors(start, hover, e); rec.rotation.x = -1.2 * (1 - e); rec.scale.setScalar(.6 + .4 * e); });
    await tweenObj(420, k => { const e = ease(k); rec.position.lerpVectors(hover, PLATTER, e); });
    discOnPlatter = rec; vinylSpin = true; return rec;
  }
  // ---- sleeve UI ----
  const deck = document.createElement("div"); deck.id = "vinylDeck"; deck.hidden = true; document.body.appendChild(deck);
  const audioIn = document.createElement("input"); audioIn.type = "file"; audioIn.accept = "audio/*"; audioIn.hidden = true; document.body.appendChild(audioIn);
  const mvIn = document.createElement("input"); mvIn.type = "file"; mvIn.accept = "video/*"; mvIn.hidden = true; document.body.appendChild(mvIn);
  const vstyle = document.createElement("style"); vstyle.textContent = `
#vinylDeck{position:fixed;z-index:12;left:max(20px,5vw);top:50%;width:min(330px,38vw);transform:translate(-130%,-50%) rotate(-4deg);opacity:0;transition:transform .7s cubic-bezier(.2,.8,.2,1),opacity .45s;font-family:'Diary Hand','Nanum Pen Script','Kaiti SC','STKaiti',cursive}
#vinylDeck.on{transform:translate(0,-50%) rotate(-3deg);opacity:1}
#vinylDeck .vs-wrap{position:relative;aspect-ratio:1}
#vinylDeck .vs-disc{position:absolute;top:5%;left:24%;width:90%;aspect-ratio:1;border-radius:50%;z-index:0;transition:left .8s cubic-bezier(.3,.7,.2,1),opacity .5s,transform .8s;
  background:radial-gradient(circle,#15110e 0 2.2%,var(--tone,#c8553d) 2.5% 17%,#0e0e0e 17.5% 19%,transparent 19%),repeating-radial-gradient(circle,#151515 0 2px,#232323 2px 3px);box-shadow:0 10px 30px rgba(0,0,0,.6),inset 0 0 0 2px #0a0a0a}
#vinylDeck .vs-disc:after{content:"";position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 30deg,transparent 0 10%,rgba(255,255,255,.10) 14%,transparent 20% 60%,rgba(255,255,255,.07) 64%,transparent 70%)}
#vinylDeck.out .vs-disc{left:120%;opacity:0;transform:rotate(160deg)}
#vinylDeck.in .vs-disc{left:-60%;opacity:0;transition:none}
#vinylDeck .vs-sleeve{position:absolute;inset:0;z-index:1;border-radius:3px;overflow:hidden;color:#2a1d12;
  background:radial-gradient(circle at 50% 52%,transparent 37%,rgba(70,40,18,.20) 38.5%,transparent 41%),radial-gradient(ellipse at 20% 15%,rgba(255,240,210,.35),transparent 55%),radial-gradient(ellipse at 85% 95%,rgba(70,40,15,.35),transparent 50%),repeating-linear-gradient(83deg,rgba(90,55,25,.05) 0 2px,transparent 2px 5px),#b98e5c;
  box-shadow:0 26px 50px rgba(0,0,0,.6),inset 0 0 0 1px rgba(60,35,15,.4),inset 0 0 40px rgba(70,40,15,.35)}
#vinylDeck .vs-band{position:absolute;left:0;right:0;top:0;height:22%;background:#8a2f22;color:#f4dfc0;font:700 12px/1 "SFMono-Regular",Menlo,Consolas,monospace;letter-spacing:.16em;display:flex;align-items:flex-end;padding:0 16px 10px;text-transform:uppercase;box-shadow:inset 0 -2px 0 rgba(0,0,0,.2)}
#vinylDeck .vs-big{position:absolute;right:14px;top:12px;font:800 36px/1 Georgia,serif;color:#f4dfc0;opacity:.9}
#vinylDeck .vs-sticker{position:absolute;left:11%;right:11%;top:36%;padding:10px 14px 8px;background:#f3e8cf;transform:rotate(-1.5deg);box-shadow:0 3px 8px rgba(60,35,10,.35)}
#vinylDeck .vs-sticker input{width:100%;border:none;border-bottom:1px dashed rgba(42,29,18,.35);background:transparent;font:inherit;font-size:30px;line-height:36px;color:#1d2846;outline:none;padding:0}
#vinylDeck .vs-file{margin-top:6px;font:600 11px/1.4 "SFMono-Regular",Menlo,Consolas,monospace;letter-spacing:.05em;color:#6a4b2c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#vinylDeck .vs-date{position:absolute;left:16px;bottom:12px;font:600 11px/1 "SFMono-Regular",Menlo,Consolas,monospace;letter-spacing:.14em;color:#5a3d22}
#vinylDeck .vs-mv{position:absolute;right:16px;bottom:12px;font:600 11px/1 "SFMono-Regular",Menlo,Consolas,monospace;color:#5a3d22;max-width:55%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#vinylDeck .vs-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px;transform:rotate(3deg)}
#vinylDeck button{padding:10px 14px;border:1px solid #d7b37466;border-radius:20px;background:#120d0add;color:#f2e4cd;font:600 12px/1 "SFMono-Regular",Menlo,Consolas,monospace;letter-spacing:.08em;cursor:pointer}
#vinylDeck button.main{background:#e9be7a;color:#1b130c;border-color:#e9be7a}
#vinylDeck button:disabled{opacity:.45;cursor:default}
#vinylDeck .vs-status{margin-top:10px;min-height:16px;color:#f2e4cd;font:600 11px/1.3 "SFMono-Regular",Menlo,Consolas,monospace;letter-spacing:.06em;transform:rotate(3deg);text-shadow:0 1px 3px #000}
#vinylDeck .vs-inner{position:absolute;top:3%;left:16%;width:94%;aspect-ratio:1;border-radius:2px;z-index:0;background:radial-gradient(circle,transparent 0 9%,#efe8da 9.5%),linear-gradient(135deg,#f4eee2,#ddd3c0);box-shadow:0 10px 26px rgba(0,0,0,.5);transition:left .8s cubic-bezier(.3,.7,.2,1),opacity .5s}
#vinylDeck .vs-inner .vs-disc{top:3%;left:22%;width:94%}
#vinylDeck.out .vs-inner{left:110%;opacity:0}#vinylDeck.in .vs-inner{left:-40%;opacity:0;transition:none}
#vinylDeck.out .vs-disc,#vinylDeck.in .vs-disc{left:22%;opacity:1;transform:none}
#vinylDeck .vs-sleeve{background:#d8c7a3;color:#2a1d12;box-shadow:0 26px 50px rgba(0,0,0,.6),inset 0 0 0 1px rgba(60,35,15,.35),inset 0 0 26px rgba(70,40,15,.38)}
#vinylDeck .vs-art{position:absolute;inset:0;background:
  radial-gradient(circle at 50% 50%,transparent 41%,rgba(255,250,235,.22) 42.5%,transparent 45%),
  radial-gradient(circle,rgba(30,20,10,.16) 1px,transparent 1.6px) 0 0/5px 5px,
  radial-gradient(circle at 63% 39%,#c2562f 0 27%,transparent 27.3%),
  radial-gradient(circle at 60% 41%,#e0a53a 0 27%,transparent 27.3%),
  linear-gradient(transparent 0 68%,#2d3f52 68% 71%,transparent 71% 74%,#2d3f52 74% 77%,transparent 77% 80%,#2d3f52 80% 83%,transparent 83%),
  linear-gradient(160deg,#e3d4b2,#cdb98f)}
#vinylDeck .vs-art:after{content:"";position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,248,230,.55),transparent 7%),linear-gradient(315deg,rgba(255,248,230,.45),transparent 6%),linear-gradient(45deg,rgba(255,248,230,.35),transparent 5%),linear-gradient(90deg,transparent 49.6%,rgba(255,255,255,.12) 50%,transparent 50.4%);mix-blend-mode:screen}
#vinylDeck .vs-spine{position:absolute;left:0;top:0;bottom:0;width:9px;background:linear-gradient(90deg,rgba(0,0,0,.28),rgba(255,255,255,.08) 60%,transparent)}
#vinylDeck .vs-brand{position:absolute;left:18px;top:16px;font:700 10px/1 Georgia,serif;letter-spacing:.32em;color:#2a1d12}
#vinylDeck .vs-stereo{position:absolute;right:14px;top:12px;padding:3px 6px;border:1.5px solid #2a1d12;font:800 9px/1 Arial,sans-serif;letter-spacing:.2em}
#vinylDeck .vs-cat{position:absolute;right:16px;top:34px;font:600 9px/1 "SFMono-Regular",Menlo,monospace;color:#4a3420}
#vinylDeck .vs-tape{position:absolute;left:7%;right:9%;top:52%;padding:9px 14px 7px;background:linear-gradient(rgba(240,228,196,.94),rgba(232,218,182,.94));transform:rotate(-2.5deg);box-shadow:0 2px 5px rgba(40,25,10,.3);clip-path:polygon(0 6%,2% 0,98% 3%,100% 12%,99% 50%,100% 92%,97% 100%,3% 96%,0 100%,1% 50%)}
#vinylDeck .vs-tape input{width:100%;border:none;background:transparent;font:inherit;font-size:30px;line-height:34px;color:#1d2846;outline:none;padding:0}
#vinylDeck .vs-tape .vs-file{margin-top:2px;font:600 10px/1.3 "SFMono-Regular",Menlo,monospace;color:#5a4128;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#vinylDeck .vs-date,#vinylDeck .vs-mv{color:#f1e6cf;text-shadow:0 1px 2px rgba(0,0,0,.5);bottom:10px}
#vinylDeck .vs-band,#vinylDeck .vs-big,#vinylDeck .vs-sticker{display:none}
@media (max-width:820px){#vinylDeck{left:50%;top:auto;bottom:70px;width:min(260px,62vw);transform:translate(-50%,140%) rotate(-3deg)}#vinylDeck.on{transform:translate(-50%,0) rotate(-3deg)}}`;
  document.head.appendChild(vstyle);
  let deckBusy = false, titleEdited = false;
  function renderDeck() {
    const t = vt(), b = window.roomMusicBridge, song = b?.song?.() || "", file = b?.audioName?.() || "", mv = b?.videoName?.() || "", day = b?.day?.() || "";
    const tone = discOnPlatter?.userData?.tone || "#c8553d", playing = !!b?.playing?.();
    deck.style.setProperty("--tone", tone);
    deck.innerHTML = `<div class="vs-wrap"><div class="vs-inner"><div class="vs-disc"></div></div><div class="vs-sleeve"><div class="vs-art"></div><div class="vs-spine"></div>
      <div class="vs-brand">ROOM RECORDS</div><div class="vs-stereo">STEREO</div><div class="vs-cat">RR-${escHtml(day.replace(/-/g, "").slice(2))}</div>
      <div class="vs-tape"><input id="vsTitle" maxlength="60" placeholder="${t.title}"><div class="vs-file">${file ? "♫ " + escHtml(file) : t.none}</div></div>
      <div class="vs-date">${escHtml(day)}</div><div class="vs-mv">${mv ? t.mvSet + escHtml(mv) : ""}</div></div></div>
      <div class="vs-actions"><button class="main" id="vsNew">● ${t.newRec}</button><button id="vsPlay" ${b?.hasAudio?.() ? "" : "disabled"}>${playing ? "❚❚ " + t.pause : "▶ " + t.play}</button><button id="vsMv">${t.mv}</button></div>
      <div class="vs-status" id="vsStatus">${mv ? t.mvHint : ""}</div>`;
    const ti = deck.querySelector("#vsTitle"); ti.value = song;
    ti.oninput = () => { titleEdited = true; b?.setSong?.(ti.value); };
    ti.onchange = () => b?.save?.();
    ti.onkeydown = e => { if (e.key === "Escape") { ti.blur(); exitTurntable(); } e.stopPropagation(); };
    deck.querySelector("#vsNew").onclick = () => { if (!deckBusy) audioIn.click(); };
    deck.querySelector("#vsPlay").onclick = togglePlay;
    deck.querySelector("#vsMv").onclick = () => mvIn.click();
  }
  function escHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  const setStatus = txt => { const el = deck.querySelector("#vsStatus"); if (el) el.textContent = txt; };
  async function togglePlay() {
    const b = window.roomMusicBridge; if (!b?.hasAudio?.()) return;
    if (b.playing()) { b.pause(); vinylSpin = false; }
    else {
      if (!discOnPlatter || discOnPlatter === platterDisc) { await liftOff(); await placeNew(b.song() || b.audioName()); }
      const ok = b.hasPlayer() ? await b.resume() : await b.play(); vinylSpin = true;
      if (!ok) setStatus("▶ ?");
    }
    renderDeck();
  }
  audioIn.onchange = async () => {
    const f = audioIn.files[0]; audioIn.value = ""; if (!f || deckBusy) return;
    const b = window.roomMusicBridge; deckBusy = true;
    const typed = deck.querySelector("#vsTitle")?.value.trim();
    const title = titleEdited && typed ? typed : f.name.replace(/\.[^.]+$/, ""); titleEdited = false;
    b?.pause?.();
    deck.classList.add("out"); setStatus(vt().lifting);
    await liftOff();
    setStatus(vt().placing);
    await b?.setAudio?.(f, title);
    await placeNew(title);
    renderDeck();
    deck.classList.add("in"); deck.classList.remove("out"); void deck.offsetWidth; deck.classList.remove("in");
    await b?.play?.(); vinylSpin = true; deckBusy = false; renderDeck();
  };
  mvIn.onchange = async () => { const f = mvIn.files[0]; mvIn.value = ""; if (!f) return; await window.roomMusicBridge?.setVideo?.(f); renderDeck(); };
  function enterTurntable() {
    if (vinylMode || windowMode || pcMode || galleryMode) return;
    vinylMode = true; setHoveredObject(null);
    vinylSaved = { pos: camera.position.clone(), target: controls.target.clone(), min: controls.minDistance, max: controls.maxDistance, polar: [controls.minPolarAngle, controls.maxPolarAngle], az: [controls.minAzimuthAngle, controls.maxAzimuthAngle] };
    controls.enabled = false;
    controls.minDistance = .3; controls.maxDistance = 12; controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI; controls.minAzimuthAngle = -Infinity; controls.maxAzimuthAngle = Infinity;
    const crt = document.getElementById("crt"); if (crt) crt.style.opacity = "0";
    const narrow = innerWidth < 820;
    tweenCamera(narrow ? new THREE.Vector3(3.05, 2.75, .55) : new THREE.Vector3(2.55, 2.45, .75), narrow ? new THREE.Vector3(3.15, 1.05, -.85) : new THREE.Vector3(2.62, 1.25, -.82), 900, () => { renderDeck(); deck.hidden = false; void deck.offsetWidth; deck.classList.add("on"); });
    renderHints();
  }
  function exitTurntable() {
    if (!vinylMode || deckBusy) return;
    deck.classList.remove("on"); setTimeout(() => { if (!vinylMode) deck.hidden = true; }, 500);
    const s = vinylSaved; vinylSaved = null;
    tweenCamera(s.pos, s.target, 800, () => {
      controls.minDistance = s.min; controls.maxDistance = s.max; [controls.minPolarAngle, controls.maxPolarAngle] = s.polar; [controls.minAzimuthAngle, controls.maxAzimuthAngle] = s.az;
      controls.enabled = true; vinylMode = false; const crt = document.getElementById("crt"); if (crt) crt.style.opacity = ""; renderHints(); render();
    });
  }
  window.enterRoomTurntable = enterTurntable; window.exitRoomTurntable = exitTurntable;
  window.isRoomTurntable = () => vinylMode;
  document.addEventListener("keydown", e => {
    if (!vinylMode) return;
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "escape") { e.preventDefault(); e.stopImmediatePropagation(); exitTurntable(); }
    else if (k === "u") { e.preventDefault(); if (!deckBusy) audioIn.click(); }
    else if (k === " ") { e.preventDefault(); togglePlay(); }
  }, true);
  document.getElementById("lang")?.addEventListener("change", () => setTimeout(() => { if (vinylMode) renderDeck(); }, 0));
  // ---------- v52: the window — look outside and choose the weather ----------
  const WT = {
    ko: { title: "창밖", sunny: "맑음", rain: "비", snow: "눈", mood: "✎ 오늘의 생각", back: "돌아가기", hint: [["1", "맑음"], ["2", "비"], ["3", "눈"], ["Esc", "돌아가기"]] },
    zh: { title: "窗外", sunny: "晴天", rain: "下雨", snow: "下雪", mood: "✎ 今天的想法", back: "返回", hint: [["1", "晴天"], ["2", "下雨"], ["3", "下雪"], ["Esc", "返回"]] },
    en: { title: "Outside", sunny: "Clear", rain: "Rain", snow: "Snow", mood: "✎ Today's thoughts", back: "Back", hint: [["1", "clear"], ["2", "rain"], ["3", "snow"], ["Esc", "back"]] }
  };
  const wt = () => WT[pcLang()] || WT.ko;
  let windowSaved = null;
  const wdeck = document.createElement("div"); wdeck.id = "windowDeck"; wdeck.hidden = true; document.body.appendChild(wdeck);
  const wstyle = document.createElement("style"); wstyle.textContent = `
#windowDeck{position:fixed;z-index:12;left:50%;bottom:64px;transform:translate(-50%,20px);opacity:0;transition:opacity .45s,transform .45s;display:flex;flex-direction:column;align-items:center;gap:10px;font:600 11px/1 "SFMono-Regular",Menlo,Consolas,monospace;letter-spacing:.12em;text-transform:uppercase}
#windowDeck.on{opacity:1;transform:translate(-50%,0)}
#windowDeck .wd-title{color:#f2e4cd;text-shadow:0 1px 4px #000;opacity:.8}
#windowDeck .wd-row{display:flex;gap:6px;padding:5px;border-radius:24px;background:#120d0acc;border:1px solid #d7b37444;backdrop-filter:blur(6px)}
#windowDeck button{padding:9px 16px;border:none;border-radius:18px;background:transparent;color:#f2e4cd;font:inherit;letter-spacing:inherit;text-transform:inherit;cursor:pointer}
#windowDeck button.on{background:#f2e4cd;color:#1b130c}
#windowDeck button.ghost{border:1px solid #d7b37466}`;
  document.head.appendChild(wstyle);
  const curWeather = () => { const w = window.roomWeatherBridge?.get?.() || "sunny"; return w === "rain" || w === "snow" ? w : "sunny"; };
  function renderWindowDeck() {
    const t = wt(), w = curWeather();
    wdeck.innerHTML = `<div class="wd-title">${t.title} · ${window.roomWeatherBridge?.day?.() || ""}</div>
      <div class="wd-row">${["sunny", "rain", "snow"].map(k => `<button data-w="${k}" class="${k === w ? "on" : ""}">${k === "sunny" ? "☀" : k === "rain" ? "☂" : "❄"} ${t[k]}</button>`).join("")}</div>
      <div class="wd-row"><button class="ghost" data-a="mood">${t.mood}</button><button class="ghost" data-a="back">${t.back} · Esc</button></div>`;
    wdeck.querySelectorAll("[data-w]").forEach(b => b.onclick = () => setOutside(b.dataset.w));
    wdeck.querySelector("[data-a=mood]").onclick = () => { exitWindow(() => window.roomWeatherBridge?.openPanel?.()); };
    wdeck.querySelector("[data-a=back]").onclick = () => exitWindow();
  }
  function setOutside(w) { window.roomWeatherBridge?.set?.(w); renderWindowDeck(); }
  function enterWindow() {
    if (windowMode || vinylMode || pcMode || galleryMode) return;
    windowMode = true; setHoveredObject(null);
    windowSaved = { pos: camera.position.clone(), target: controls.target.clone(), min: controls.minDistance, max: controls.maxDistance, polar: [controls.minPolarAngle, controls.maxPolarAngle], az: [controls.minAzimuthAngle, controls.maxAzimuthAngle] };
    controls.enabled = false;
    controls.minDistance = .3; controls.maxDistance = 12; controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI; controls.minAzimuthAngle = -Infinity; controls.maxAzimuthAngle = Infinity;
    const crt = document.getElementById("crt"); if (crt) crt.style.opacity = "0";
    tweenCamera(new THREE.Vector3(-.35, 2.98, 1.25), new THREE.Vector3(-.35, 2.62, -2.9), 1000, () => { renderWindowDeck(); wdeck.hidden = false; void wdeck.offsetWidth; wdeck.classList.add("on"); });
    renderHints();
  }
  function exitWindow(after) {
    if (!windowMode) return;
    wdeck.classList.remove("on"); setTimeout(() => { if (!windowMode) wdeck.hidden = true; }, 450);
    const s = windowSaved; windowSaved = null;
    tweenCamera(s.pos, s.target, 850, () => {
      controls.minDistance = s.min; controls.maxDistance = s.max; [controls.minPolarAngle, controls.maxPolarAngle] = s.polar; [controls.minAzimuthAngle, controls.maxAzimuthAngle] = s.az;
      controls.enabled = true; windowMode = false; const crt = document.getElementById("crt"); if (crt) crt.style.opacity = ""; renderHints(); render(); after?.();
    });
  }
  window.__roomCam = { camera, controls, render: () => render() };
  window.__leaveRoomModesNow = () => {
    const restore = sv => { if (!sv) return; controls.minDistance = sv.min; controls.maxDistance = sv.max; [controls.minPolarAngle, controls.maxPolarAngle] = sv.polar; [controls.minAzimuthAngle, controls.maxAzimuthAngle] = sv.az; controls.enabled = true; };
    cancelAnimationFrame(pcTween);
    if (pcMode) { pcScreen.classList.remove("on"); pcScreen.style.visibility = "hidden"; const v = pcScreen.querySelector("video"); if (v) v.pause(); restore(pcSaved); pcSaved = null; pcMode = false; }
    if (vinylMode && !deckBusy) { deck.classList.remove("on"); deck.hidden = true; restore(vinylSaved); vinylSaved = null; vinylMode = false; }
    if (windowMode) { wdeck.classList.remove("on"); wdeck.hidden = true; restore(windowSaved); windowSaved = null; windowMode = false; }
    const crt = document.getElementById("crt"); if (crt) crt.style.opacity = ""; renderHints();
  };
  window.enterRoomWindow = enterWindow; window.exitRoomWindow = exitWindow;
  document.addEventListener("keydown", e => {
    if (!windowMode) return;
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    e.stopImmediatePropagation();
    if (k === "escape") { e.preventDefault(); exitWindow(); }
    else if (k === "1") setOutside("sunny"); else if (k === "2") setOutside("rain"); else if (k === "3") setOutside("snow");
  }, true);
  document.getElementById("lang")?.addEventListener("change", () => setTimeout(() => { if (windowMode) renderWindowDeck(); }, 0));
  // ---------- v50: reference-style object interaction ----------
  // Hover tag next to the cursor ("DIARY · WRITE"), the legal-pad panel with a
  // "put down · Esc" pill, and N to open the diary notebook.
  window.roomAssetURL?.("assets/fonts/NanumPenScript-Regular.woff2").then(u => new FontFace("Diary Hand", `url("${u}")`).load()).then(f => document.fonts.add(f)).catch(() => {});
  const TAGS = {
    ko: { diary: "일기장 · 쓰기", computer: "컴퓨터 · 사용", weather: "창문 · 창밖 보기", photo: "필름 카메라 · 현상하기", music: "턴테이블 · 레코드 바꾸기", "vinyl-box": "레코드 · 바꾸기", light: "스탠드 · 켜기/끄기", "floor-lamp": "플로어 램프 · 켜기/끄기", shredder: "파쇄기 · 버리기", gallery: "문 · 감정 갤러리", memory: "추억 · 보기", power: "전원 · 켜기/끄기", putDown: "내려놓기" },
    zh: { diary: "日记本 · 写日记", computer: "电脑 · 使用", weather: "窗户 · 看窗外", photo: "胶片相机 · 冲洗照片", music: "唱机 · 换唱片", "vinyl-box": "唱片 · 换一张", light: "台灯 · 开/关", "floor-lamp": "落地灯 · 开/关", shredder: "碎纸机 · 丢掉", gallery: "门 · 情绪画廊", memory: "回忆 · 查看", power: "电源 · 开机/关机", putDown: "放下" },
    en: { diary: "Diary · Write", computer: "Computer · Use", weather: "Window · Look outside", photo: "Film camera · Develop", music: "Turntable · Change record", "vinyl-box": "Records · Swap", light: "Lamp · On/Off", "floor-lamp": "Floor lamp · On/Off", shredder: "Shredder · Toss", gallery: "Door · Gallery", memory: "Memories · View", power: "Power · On/Off", putDown: "Put down" }
  };
  const tagText = name => (TAGS[pcLang()] || TAGS.ko)[name] || "";
  const hoverTag = document.createElement("div"); hoverTag.id = "hoverTag"; document.body.appendChild(hoverTag);
  renderer.domElement.addEventListener("pointermove", e => {
    hoverTag.style.left = e.clientX + "px"; hoverTag.style.top = e.clientY + "px";
    const name = !galleryMode && !pcMode && !e.buttons ? hoveredObject : null;
    const text = name && name !== "stranger-lights" ? tagText(name) : "";
    hoverTag.textContent = text; hoverTag.classList.toggle("on", !!text);
  });
  renderer.domElement.addEventListener("pointerleave", () => hoverTag.classList.remove("on"));
  const shadeEl = document.getElementById("shade");
  const putDown = document.createElement("button"); putDown.id = "putDown"; putDown.type = "button"; putDown.hidden = true; document.body.appendChild(putDown);
  putDown.onclick = () => { if (shadeEl) shadeEl.hidden = true; };
  if (shadeEl) new MutationObserver(() => {
    putDown.hidden = shadeEl.hidden; hoverTag.classList.remove("on"); hints.style.opacity = shadeEl.hidden && !galleryMode ? "1" : "0";
    putDown.innerHTML = `${tagText("putDown")}<kbd>Esc</kbd>`;
    // a fresh slide-in each time the pad is picked up
    const modal = shadeEl.querySelector(".modal"); if (modal && !shadeEl.hidden) { modal.style.animation = "none"; void modal.offsetWidth; modal.style.animation = ""; }
  }).observe(shadeEl, { attributes: true, attributeFilter: ["hidden"] });
  document.addEventListener("keydown", e => {
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return;
    if (galleryMode || pcMode || vinylMode || windowMode || document.getElementById("mpShade") || (shadeEl && !shadeEl.hidden)) return;
    if (e.key.toLowerCase() === "n") { e.preventDefault(); layer.querySelector('.hot[data-open="diary"]')?.click(); }
  });
  document.addEventListener("keydown", e => {
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return;
    if (galleryMode || vinylMode || windowMode || document.getElementById("mpShade")) return;
    const shade = document.getElementById("shade"); if (shade && !shade.hidden) return;
    const k = e.key.toLowerCase();
    if (!pcMode && k === "c") { e.preventDefault(); enterComputer(); }
    else if (pcMode && (k === "escape" || k === "c")) { e.preventDefault(); exitComputer(); }
    else if (pcMode && k === "u") { e.preventDefault(); pcInput.click(); }
    else if (pcMode && k === " ") { e.preventDefault(); pcToggle(); }
  });
  document.getElementById("lang")?.addEventListener("change", () => setTimeout(() => { renderHints(); if (pcMode) renderPc(); }, 0));
  renderHints();
  window.focusThreeRoom = (name) => {
    window.__leaveRoomModesNow?.();
    if (name === "wide") {
      const from = camera.position.clone(), targetFrom = controls.target.clone();
      const to = new THREE.Vector3(...ROOM_VIEW.pos), targetTo = new THREE.Vector3(...ROOM_VIEW.target);
      const started = performance.now(), duration = 520;
      const moveWide = now => { const t=Math.min(1,(now-started)/duration), e=1-Math.pow(1-t,3); camera.position.copy(from).lerp(to,e); controls.target.copy(targetFrom).lerp(targetTo,e); controls.update(); render(); if(t<1)requestAnimationFrame(moveWide); };
      requestAnimationFrame(moveWide); return;
    }
    const point = anchors[name] || [0, 1.4, 0];
    const from = controls.target.clone(), to = new THREE.Vector3(point[0], Math.max(.8, point[1]), point[2]);
    const startPosition = camera.position.clone(), endPosition = startPosition.clone().add(to.clone().sub(from));
    const started = performance.now(), duration = 520;
    function move(now) {
      const t = Math.min(1, (now - started) / duration), eased = 1 - Math.pow(1 - t, 3);
      controls.target.copy(from).lerp(to, eased); camera.position.copy(startPosition).lerp(endPosition, eased); controls.update(); render();
      if (t < 1) requestAnimationFrame(move);
    }
    requestAnimationFrame(move);
  };
  window.setThreeRoomScene = (which) => {
    window.__leaveRoomModesNow?.();
    if (which === "corner") {
      // A right-side desk view stays centered on the work surface and reveals
      // the framed picture on the right wall.
      // Keep the preset inside the same restrained range as manual dragging.
      camera.position.set(2.0, 2.2, 5.1); controls.target.set(...ROOM_VIEW.target);
    } else {
      camera.position.set(...ROOM_VIEW.pos); controls.target.set(...ROOM_VIEW.target);
    }
    controls.update(); render();
  };
  // Only a real change of scene moves the camera (saving a day re-writes the same value).
  new MutationObserver(records => { if (pcMode || galleryMode || !records.some(r => r.oldValue !== layer.dataset.scene)) return; window.setThreeRoomScene(layer.dataset.scene); }).observe(layer, { attributes: true, attributeFilter: ["data-scene"], attributeOldValue: true });
  room.classList.add("has-three-room");
  layer.dataset.view = "wide";
  layer.style.transform = "none";
  layer.style.transformOrigin = "center center";
  layer.querySelectorAll(".hot").forEach(el => { el.style.pointerEvents = "none"; });
  layer.querySelector("#crt")?.removeAttribute("hidden");
  layer.querySelector("#wall")?.removeAttribute("hidden");
  document.getElementById("shredderObject")?.removeAttribute("hidden");
  renderer.domElement.addEventListener("pointerdown", () => renderer.domElement.style.cursor = "grabbing");
  renderer.domElement.addEventListener("pointerup", () => { if(!galleryMode) renderer.domElement.style.cursor = "grab"; });
  renderer.domElement.style.cursor = "grab";
  const contentShade=document.getElementById("shade");
  if(contentShade)new MutationObserver(()=>{
    if(contentShade.hidden&&galleryDoorAngle) swingGalleryDoor(0);
    if(contentShade.hidden&&layer.dataset.view!=="wide"){
      layer.dataset.view="wide"; setHoveredObject(null); window.focusThreeRoom("wide");
    }
  }).observe(contentShade,{attributes:true,attributeFilter:["hidden"]});
  size(); render();
  let lastRiverFrame = 0;
  function animateRiver(now) {
    requestAnimationFrame(animateRiver);
    if (document.hidden || now-lastRiverFrame < 40) return;
    const frameDelta=lastRiverFrame?now-lastRiverFrame:40;
    // Inside the drawing room only that scene is drawn; the night-room effects pause.
    if (galleryMode) { lastRiverFrame=now; gallerySunTick?.(now); controls.update(); renderer.render(scene,camera); return; }
     lastRiverFrame=now; cityMaterial.uniforms.uTime.value=now*.001; updateStoryLights(now); animateExterior(now,frameDelta);
     animateWeather(now,frameDelta); animateBeacons(now); window.__deskFlicker?.(now); window.__pcScreenTick?.(now);
    const lampBlend=1-Math.exp(-frameDelta/260);
    deskLampLevel+=( (deskLampOn?1:0)-deskLampLevel )*lampBlend;
     bulb.intensity=3.6*deskLampLevel; lampSpot.intensity=13*deskLampLevel; deskWarm.intensity=.12+1.5*deskLampLevel;
     lampGlowMaterial.uniforms.uOn.value=deskLampLevel;
     bulbGlass.emissiveIntensity=2.2*deskLampLevel; lampInside.emissiveIntensity=.55*deskLampLevel;
     if(deskLampLevel>.006){bulb.visible=true;lampSpot.visible=true;}else if(!deskLampOn){deskLampLevel=0;bulb.visible=false;lampSpot.visible=false;}
    floorLampLevel+=((floorLampOn?1:0)-floorLampLevel)*lampBlend;
    warm.intensity=2.4*floorLampLevel; floorBulbMaterial.emissiveIntensity=1.1*floorLampLevel;
    if(activeVinyl>=0)vinylRecords[activeVinyl].rotation.y+=frameDelta*.00042;
    if(window.__vinylSpinTick)window.__vinylSpinTick(frameDelta);
    if(!floorLampOn&&floorLampLevel<.006){floorLampLevel=0;warm.visible=false;}
    controls.update(); renderer.render(scene,camera); if(!galleryMode)projectAnchors();
  }
  requestAnimationFrame(animateRiver);
})();
