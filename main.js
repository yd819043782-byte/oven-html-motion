/* 嵌入式烤箱选购 · 1920×1080 · 60fps
   Timeline locks to voiceover.mp3 (script segment only).
   Lead 3.6s, slack 2.5s after 正片开始 (source 70.78s), tail 1.8s.
   window.renderAt(seconds) is the only painter. Same t => same frame.
*/
(function () {
  "use strict";

  const LEAD = 3.6;
  const SLACK = 2.5;
  const TAIL = 1.8;
  const ZHENG_END_SRC = 70.78;
  const LINES = [
    { id: "hello", a: 0.0, b: 2.38 },
    { id: "halfyear", a: 2.38, b: 7.74 },
    { id: "price", a: 7.74, b: 12.96 },
    { id: "features", a: 12.96, b: 18.3 },
    { id: "jd", a: 18.3, b: 24.58 },
    { id: "mature", a: 24.58, b: 28.14 },
    { id: "stack", a: 28.14, b: 35.46 },
    { id: "worry", a: 35.46, b: 41.56 },
    { id: "gap", a: 41.56, b: 46.64 },
    { id: "ai", a: 46.64, b: 63.22 },
    { id: "pin", a: 63.22, b: 68.86 },
    { id: "zheng", a: 68.86, b: 70.78 },
    { id: "mainstream", a: 70.78, b: 76.46 },
    { id: "uniform", a: 76.46, b: 83.58 },
    { id: "old", a: 83.58, b: 89.18 },
    { id: "habit", a: 89.18, b: 97.54 },
    { id: "path5k", a: 97.54, b: 112.08 },
    { id: "path6k", a: 112.08, b: 126.0 },
    { id: "next", a: 126.0, b: 128.02 },
  ];

  function mapPoint(src, role) {
    if (src < ZHENG_END_SRC - 1e-4) return LEAD + src;
    if (src > ZHENG_END_SRC + 1e-4) {
      return LEAD + ZHENG_END_SRC + SLACK + (src - ZHENG_END_SRC);
    }
    return role === "in" ? LEAD + ZHENG_END_SRC + SLACK : LEAD + ZHENG_END_SRC;
  }

  const CUE = {};
  LINES.forEach(function (line) {
    CUE[line.id] = {
      id: line.id,
      t0: mapPoint(line.a, "in"),
      t1: mapPoint(line.b, "out"),
      a: line.a,
      b: line.b,
    };
  });

  const DURATION = mapPoint(128.02, "out") + TAIL;
  const SLACK_T0 = CUE.zheng.t1;
  const SLACK_T1 = CUE.mainstream.t0;

  const params = new URLSearchParams(location.search);
  const EXPORT =
    params.get("export") === "1" ||
    location.hash === "#export" ||
    window.__EXPORT_MODE__ === true;
  if (EXPORT) document.body.classList.add("export");

  const stage = document.getElementById("stage");
  const canvas = document.getElementById("gl");
  const labelsEl = document.getElementById("labels");
  const dimEl = document.getElementById("dim");
  const jdRig = document.getElementById("jd-rig");
  const jdWindow = document.getElementById("jd-window");
  const jdImg = document.getElementById("jd-img");
  const jdRing = document.getElementById("jd-ring");
  const jdCap = document.getElementById("jd-cap");
  const pinEl = document.getElementById("pin");
  const scrub = document.getElementById("scrub");
  const timeEl = document.getElementById("time");
  const iconPlay = document.getElementById("icon-play");
  const iconPause = document.getElementById("icon-pause");
  const btnPlay = document.getElementById("btn-play");

  const audio = new Audio("assets/voiceover.mp3");
  audio.preload = "auto";

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function lerp(a, b, u) {
    return a + (b - a) * u;
  }
  function smooth(a, b, t) {
    if (t <= a) return 0;
    if (t >= b) return 1;
    const u = (t - a) / (b - a);
    return u * u * (3 - 2 * u);
  }
  function easeOut(u) {
    return 1 - Math.pow(1 - clamp(u, 0, 1), 3);
  }
  function easeOutBack(u) {
    const x = clamp(u, 0, 1);
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }
  function cueU(id, t) {
    const c = CUE[id];
    if (t <= c.t0) return 0;
    if (t >= c.t1) return 1;
    return (t - c.t0) / (c.t1 - c.t0);
  }
  function cueW(id, t, fin, fout) {
    const c = CUE[id];
    const inn = fin == null ? 0.4 : fin;
    const out = fout == null ? 0.45 : fout;
    const a = smooth(c.t0, Math.min(c.t1, c.t0 + inn), t);
    const b = 1 - smooth(Math.max(c.t0, c.t1 - out), c.t1, t);
    return clamp(a * b, 0, 1);
  }
  function sampleLinear(keys, t) {
    if (t <= keys[0].t) return keys[0].v;
    for (let i = 0; i < keys.length - 1; i++) {
      if (t <= keys[i + 1].t) {
        const span = keys[i + 1].t - keys[i].t;
        const u = span <= 1e-5 ? 0 : (t - keys[i].t) / span;
        return keys[i].v + (keys[i + 1].v - keys[i].v) * u;
      }
    }
    return keys[keys.length - 1].v;
  }
  function cr1(p0, p1, p2, p3, u) {
    const u2 = u * u;
    const u3 = u2 * u;
    return (
      0.5 *
      (2 * p1 +
        (-p0 + p2) * u +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 +
        (-p0 + 3 * p1 - 3 * p2 + p3) * u3)
    );
  }
  function sampleCR(keys, t) {
    const n = keys.length;
    if (t <= keys[0].t) return keys[0].v.slice();
    if (t >= keys[n - 1].t) return keys[n - 1].v.slice();
    let i = 0;
    for (let k = 0; k < n - 1; k++) if (t >= keys[k].t) i = k;
    const a = keys[Math.max(0, i - 1)].v;
    const b = keys[i].v;
    const c = keys[i + 1].v;
    const d = keys[Math.min(n - 1, i + 2)].v;
    const span = keys[i + 1].t - keys[i].t;
    const u = span <= 1e-5 ? 0 : (t - keys[i].t) / span;
    return [cr1(a[0], b[0], c[0], d[0], u), cr1(a[1], b[1], c[1], d[1], u), cr1(a[2], b[2], c[2], d[2], u)];
  }

  function fail(err) {
    const el = document.getElementById("boot-error");
    el.style.display = "grid";
    el.textContent = "画面没有启动：" + (err && err.message ? err.message : err);
    console.error(err);
  }

  if (!window.THREE) {
    fail(new Error("Three.js 没有加载"));
    return;
  }

  const THREE = window.THREE;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
  } catch (err) {
    fail(err);
    return;
  }
  renderer.setPixelRatio(1);
  renderer.setSize(1920, 1080, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.setClearColor(0x100e0c, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x16120f, 0.032);
  const camera = new THREE.PerspectiveCamera(30, 1920 / 1080, 0.05, 40);

  scene.add(new THREE.AmbientLight(0xfff1e2, 0.62));
  const key = new THREE.DirectionalLight(0xffe4c8, 2.35);
  key.position.set(2.6, 3.4, 4.4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xc9d7ea, 0.85);
  fill.position.set(-3.4, 1.6, 2.2);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xff9a5c, 0.42);
  rim.position.set(-1.2, 2.2, -3.2);
  scene.add(rim);

  function steel(color) {
    return new THREE.MeshStandardMaterial({
      color: color == null ? 0xe7e1d8 : color,
      metalness: 0.74,
      roughness: 0.34,
    });
  }
  function darkMat() {
    return new THREE.MeshStandardMaterial({
      color: 0x161412,
      metalness: 0.35,
      roughness: 0.62,
    });
  }

  function addBox(parent, w, h, d, x, y, z, mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  function trackMats(group, mat, base) {
    mat.transparent = true;
    mat.opacity = base == null ? 1 : base;
    mat.depthWrite = (base == null ? 1 : base) > 0.9;
    group.userData.mats.push({ mat: mat, base: base == null ? 1 : base });
    return mat;
  }

  function applyOpacity(group, o) {
    const mats = group.userData.mats;
    if (!mats) return;
    for (let i = 0; i < mats.length; i++) {
      const rec = mats[i];
      rec.mat.opacity = rec.base * o;
      rec.mat.depthWrite = rec.base > 0.9 && o > 0.82;
    }
    group.visible = o > 0.02;
  }

  function buildAppliance(opt) {
    const g = new THREE.Group();
    g.userData.mats = [];
    const W = opt.w;
    const H = opt.h;
    const D = opt.d;
    const body = trackMats(g, steel(opt.color));
    const cavityMat = trackMats(
      g,
      new THREE.MeshStandardMaterial({
        color: 0x2a1410,
        emissive: 0xff6a2a,
        emissiveIntensity: 0.42,
        roughness: 0.82,
      })
    );
    const doorMat = trackMats(g, steel(opt.door || opt.color));
    const glassMat = trackMats(
      g,
      new THREE.MeshStandardMaterial({
        color: 0xc5ddf0,
        transparent: true,
        opacity: 0.2,
        metalness: 0.05,
        roughness: 0.06,
        depthWrite: false,
      }),
      0.2
    );
    const fz = D / 2 - 0.03;
    addBox(g, W, H, 0.05, 0, 0, -D / 2, body);
    addBox(g, 0.07, H, D, -W / 2 + 0.03, 0, 0, body);
    addBox(g, 0.07, H, D, W / 2 - 0.03, 0, 0, body);
    addBox(g, W, 0.07, D, 0, H / 2 - 0.02, 0, body);
    addBox(g, W, 0.07, D, 0, -H / 2 + 0.02, 0, body);
    const inner = addBox(g, W - 0.24, H - 0.24, 0.04, 0, 0, -D / 2 + 0.09, cavityMat);
    const ft = 0.075;
    addBox(g, W, ft, 0.055, 0, H / 2 - ft / 2, fz, body);
    addBox(g, W, ft, 0.055, 0, -H / 2 + ft / 2, fz, body);
    addBox(g, ft, H - ft * 2, 0.055, -W / 2 + ft / 2, 0, fz, body);
    addBox(g, ft, H - ft * 2, 0.055, W / 2 - ft / 2, 0, fz, body);

    const pivot = new THREE.Group();
    pivot.position.set(-W / 2 + 0.05, 0, fz + 0.04);
    g.add(pivot);
    const dw = W - 0.12;
    const dh = H - 0.12;
    function dbox(w, h, d, x, y, z, mat) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      pivot.add(m);
      return m;
    }
    dbox(dw, 0.045, 0.035, dw / 2, dh / 2 - 0.02, 0, doorMat);
    dbox(dw, 0.045, 0.035, dw / 2, -dh / 2 + 0.02, 0, doorMat);
    dbox(0.045, dh, 0.035, 0.03, 0, 0, doorMat);
    dbox(0.045, dh, 0.035, dw - 0.02, 0, 0, doorMat);
    dbox(dw - 0.14, dh - 0.14, 0.012, dw / 2, 0, 0.012, glassMat);
    dbox(0.34, 0.032, 0.04, dw - 0.3, -0.02, 0.05, doorMat);
    if (opt.knob) {
      const knobMat = trackMats(g, steel(0x6d6458));
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 18), knobMat);
      knob.rotation.x = Math.PI / 2;
      knob.position.set(dw * 0.7, dh * 0.28, 0.05);
      pivot.add(knob);
    }
    if (opt.stripe) {
      const stripeMat = trackMats(
        g,
        new THREE.MeshStandardMaterial({
          color: 0x8fd4ff,
          emissive: 0x49b7ff,
          emissiveIntensity: 0.8,
          roughness: 0.35,
        })
      );
      addBox(g, W * 0.55, 0.025, 0.02, 0.05, H / 2 - 0.12, fz + 0.02, stripeMat);
    }
    const anchor = new THREE.Object3D();
    anchor.position.set(0, H / 2 + 0.08, 0.1);
    g.add(anchor);
    g.userData.pivot = pivot;
    g.userData.innerMat = cavityMat;
    g.userData.anchor = anchor;
    g.userData.W = W;
    g.userData.H = H;
    g.userData.D = D;
    return g;
  }

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a241e, roughness: 0.92, metalness: 0.04 });
  const cabMat = new THREE.MeshStandardMaterial({ color: 0x3c342c, roughness: 0.78, metalness: 0.08 });
  const counterMat = new THREE.MeshStandardMaterial({ color: 0x6e655b, roughness: 0.55, metalness: 0.12 });
  addBox(scene, 10, 4.2, 0.08, 0, 0.7, -1.55, wallMat);
  addBox(scene, 8.5, 0.12, 1.8, 0, -0.78, 0.15, counterMat);
  addBox(scene, 0.42, 1.7, 0.7, -1.15, 0.05, -0.15, cabMat);
  addBox(scene, 0.42, 1.7, 0.7, 1.15, 0.05, -0.15, cabMat);
  addBox(scene, 1.9, 0.28, 0.7, 0, 0.95, -0.15, cabMat);

  const floorMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uHot: { value: 0.5 }, uGlow: { value: 0.35 } },
    vertexShader:
      "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader:
      "varying vec2 vUv; uniform float uHot; uniform float uGlow;" +
      "void main(){" +
      " float d=abs(vUv.x-uHot);" +
      " float band=exp(-d*d*26.0)*uGlow;" +
      " float fade=smoothstep(0.0,0.12,vUv.y)*smoothstep(1.0,0.72,vUv.y);" +
      " vec3 col=mix(vec3(0.09,0.07,0.06), vec3(0.85,0.42,0.22), band);" +
      " gl_FragColor=vec4(col, (0.45+band)*fade);" +
      "}",
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8.2, 2.4), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.84, 0.35);
  scene.add(floor);

  const hero = buildAppliance({ w: 1.46, h: 1.12, d: 0.92, color: 0xe6e0d6 });
  hero.position.set(0, 0.02, 0);
  scene.add(hero);
  const heroMatsBackup = hero.userData.mats;
  hero.userData.mats = null;

  const cavityLight = new THREE.PointLight(0xff7a3a, 6.5, 3.4, 2);
  cavityLight.position.set(0, 0.02, 0.05);
  hero.add(cavityLight);

  const tubeMat = new THREE.MeshStandardMaterial({
    color: 0xffd0b0,
    emissive: 0xff5a1e,
    emissiveIntensity: 0.9,
    roughness: 0.4,
  });
  const tubeGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.92, 12);
  const tubeA = new THREE.Mesh(tubeGeo, tubeMat);
  const tubeB = new THREE.Mesh(tubeGeo, tubeMat);
  tubeA.rotation.z = Math.PI / 2;
  tubeB.rotation.z = Math.PI / 2;
  tubeA.position.set(0, 0.38, -0.05);
  tubeB.position.set(0, 0.3, -0.02);
  hero.add(tubeA);
  hero.add(tubeB);

  const fan = new THREE.Group();
  fan.position.set(0, 0.08, -0.4);
  fan.scale.setScalar(0.62);
  hero.add(fan);
  const bladeMat = steel(0xc8c2ba);
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Group();
    p.rotation.z = (i * Math.PI) / 3;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.012), bladeMat);
    blade.position.x = 0.12;
    p.add(blade);
    fan.add(p);
  }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 16), bladeMat);
  cap.rotation.x = Math.PI / 2;
  fan.add(cap);

  const foodMat = new THREE.MeshStandardMaterial({
    color: 0xc4783a,
    roughness: 0.72,
    metalness: 0.02,
    emissive: 0x5a2610,
    emissiveIntensity: 0.18,
  });
  addBox(hero, 0.7, 0.025, 0.42, 0, -0.34, 0.02, darkMat());
  const roast = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 14), foodMat);
  roast.scale.set(1.15, 0.72, 0.85);
  roast.position.set(-0.02, -0.24, 0.02);
  hero.add(roast);
  const bunMat = foodMat.clone();
  bunMat.color = new THREE.Color(0xd7a15a);
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), bunMat);
  bun.position.set(0.22, -0.28, 0.08);
  hero.add(bun);
  const rackMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.8, roughness: 0.3 });
  addBox(hero, 0.9, 0.012, 0.46, 0, -0.16, 0.02, rackMat);
  addBox(hero, 0.9, 0.012, 0.46, 0, 0.08, 0.0, rackMat);

  const heatMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uSteam: { value: 0.2 },
      uTime: { value: 0 },
      uAlpha: { value: 0.25 },
    },
    vertexShader:
      "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader:
      "varying vec2 vUv; uniform float uSteam; uniform float uTime; uniform float uAlpha;" +
      "void main(){" +
      " vec2 p=vUv-0.5;" +
      " float blobs=sin(vUv.x*9.0+1.3)*cos(vUv.y*7.0)+sin(vUv.x*16.0-vUv.y*12.0);" +
      " blobs=blobs*0.5+0.5;" +
      " float even=0.74+0.06*sin(vUv.x*3.0+uTime*0.35);" +
      " float field=mix(blobs, even, clamp(uSteam,0.0,1.0));" +
      " vec3 col=mix(vec3(0.16,0.2,0.36), vec3(1.0,0.4,0.1), field);" +
      " float vig=smoothstep(0.78,0.18,length(p));" +
      " gl_FragColor=vec4(col, uAlpha*vig);" +
      "}",
  });
  const heat = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.78), heatMat);
  heat.position.set(0, 0.02, -0.34);
  hero.add(heat);
  const heatCardMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uSteam: { value: 0 }, uTime: { value: 0 }, uAlpha: { value: 1 } },
    vertexShader: heatMat.vertexShader,
    fragmentShader:
      "varying vec2 vUv; uniform float uSteam; uniform float uTime; uniform float uAlpha;" +
      "void main(){" +
      " float edge=smoothstep(0.0,0.015,vUv.x)*smoothstep(1.0,0.985,vUv.x)*smoothstep(0.0,0.015,vUv.y)*smoothstep(1.0,0.985,vUv.y);" +
      " float blobs=sin(vUv.x*8.0)*cos(vUv.y*6.0)+0.65*sin(vUv.x*14.0-vUv.y*11.0);" +
      " blobs=clamp(blobs*0.55+0.5,0.0,1.0);" +
      " float even=0.8;" +
      " float field=mix(blobs, even, clamp(uSteam,0.0,1.0));" +
      " vec3 col=mix(vec3(0.12,0.28,0.62), vec3(1.0,0.32,0.08), field);" +
      " vec3 frame=mix(vec3(0.95,0.93,0.9), col, edge);" +
      " gl_FragColor=vec4(frame, uAlpha);" +
      "}",
  });
  const heatCard = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.42), heatCardMat);
  heatCard.position.set(1.22, 0.18, 0.48);
  scene.add(heatCard);

  function radialTex(inner, outer) {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(64, 64, 8, 64, 64, 64);
    grd.addColorStop(0, inner);
    grd.addColorStop(1, outer);
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  const steamTex = radialTex("rgba(244,250,255,0.9)", "rgba(244,250,255,0)");
  const puffTex = radialTex("rgba(255,244,230,0.75)", "rgba(255,244,230,0)");
  const dustTex = radialTex("rgba(210,190,150,0.7)", "rgba(210,190,150,0)");

  function makeSteam(parent, n) {
    const sprites = [];
    for (let i = 0; i < n; i++) {
      const mat = new THREE.SpriteMaterial({
        map: steamTex,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      });
      const s = new THREE.Sprite(mat);
      parent.add(s);
      sprites.push(s);
    }
    return sprites;
  }
  const steamL = makeSteam(hero, 16);
  const steamR = makeSteam(hero, 12);

  function layoutSteam(sprites, t, intensity, ox, oy, oz) {
    for (let i = 0; i < sprites.length; i++) {
      const loop = 1.9 + (i % 5) * 0.21;
      const phase = (((t * 0.9) / loop + i * 0.173) % 1 + 1) % 1;
      const s = sprites[i];
      s.position.set(
        ox + Math.sin(i * 1.7) * 0.08 + Math.sin(t * 0.7 + i) * 0.02,
        oy + phase * 0.7,
        oz + Math.cos(i * 1.25) * 0.06
      );
      const sc = 0.09 + phase * 0.22;
      s.scale.set(sc, sc, sc);
      s.material.opacity = Math.sin(phase * Math.PI) * 0.72 * intensity;
    }
  }

  const second = buildAppliance({
    w: 1.32,
    h: 1.02,
    d: 0.84,
    color: 0xd5dde3,
    stripe: true,
  });
  second.position.set(0.9, 0.0, 0);
  scene.add(second);
  const secondRack = steel(0xd5dde6);
  trackMats(second, secondRack);
  addBox(second, 0.9, 0.015, 0.4, 0, 0.02, 0, secondRack);
  addBox(second, 0.9, 0.015, 0.4, 0, -0.22, 0.02, secondRack);

  const singleSteam = buildAppliance({ w: 0.78, h: 1.05, d: 0.7, color: 0xc8d0d4 });
  singleSteam.position.set(-1.85, -0.02, -0.35);
  singleSteam.scale.setScalar(0.92);
  scene.add(singleSteam);
  const singleBake = buildAppliance({ w: 0.92, h: 0.78, d: 0.7, color: 0xb7b0a6, knob: true });
  singleBake.position.set(1.95, -0.08, -0.35);
  scene.add(singleBake);

  const oldOven = buildAppliance({
    w: 1.2,
    h: 0.98,
    d: 0.8,
    color: 0xb6a78f,
    door: 0x8d7d66,
    knob: true,
  });
  oldOven.position.set(-1.7, -0.04, 0.05);
  scene.add(oldOven);
  const dust = [];
  for (let i = 0; i < 14; i++) {
    const mat = new THREE.SpriteMaterial({
      map: dustTex,
      transparent: true,
      depthWrite: false,
      opacity: 0,
    });
    const s = new THREE.Sprite(mat);
    oldOven.add(s);
    dust.push(s);
  }

  const brands = new THREE.Group();
  scene.add(brands);
  const brandMeshes = [];
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2a2724,
      emissive: 0xffb15a,
      emissiveIntensity: 0.25 + i * 0.45,
      roughness: 0.6,
      transparent: true,
    });
    const h = 0.35 + i * 0.22;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.28, h, 0.12), mat);
    m.position.set(-0.72 + i * 0.72, -0.58 + h / 2, 1.02);
    m.userData.baseY = m.position.y;
    brands.add(m);
    brandMeshes.push(m);
  }

  const puffs = [];
  for (let i = 0; i < 6; i++) {
    const mat = new THREE.SpriteMaterial({
      map: puffTex,
      transparent: true,
      depthWrite: false,
      opacity: 0,
    });
    const s = new THREE.Sprite(mat);
    scene.add(s);
    puffs.push(s);
  }

  const tags = [];
  const tagTexts = ["¥7999", "¥7499", "¥6899"];
  function textTexture(text, w, h, color, px, plate) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    g.clearRect(0, 0, w, h);
    if (plate) {
      g.fillStyle = "rgba(18,14,12,0.82)";
      g.beginPath();
      g.roundRect(12, 16, w - 24, h - 32, 28);
      g.fill();
    } else {
      g.fillStyle = "rgba(28,18,16,0.92)";
      g.fillRect(16, 28, w - 32, h - 56);
      g.strokeStyle = color;
      g.lineWidth = 6;
      g.strokeRect(16, 28, w - 32, h - 56);
    }
    let size = px;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = color;
    do {
      g.font = "600 " + size + "px OvenUI, sans-serif";
      if (g.measureText(text).width <= w - 64) break;
      size -= 4;
    } while (size > 28);
    g.fillText(text, w / 2, h / 2 + 2);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }
  function makePlate() {
    const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0 });
    return new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.16), mat);
  }

  const plinthMat = new THREE.MeshStandardMaterial({ color: 0x2c2824, roughness: 0.7, metalness: 0.2 });
  const plinthHi = addBox(scene, 0.86, 0.06, 0.28, 1.82, 0.72, 0.35, plinthMat);
  const plinthLo = addBox(scene, 0.86, 0.06, 0.28, 1.82, -0.28, 0.5, plinthMat);
  const plinthLabelHi = new THREE.Mesh(
    new THREE.PlaneGeometry(0.34, 0.12),
    new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })
  );
  plinthLabelHi.position.set(1.82, 0.86, 0.35);
  scene.add(plinthLabelHi);
  const plinthLabelLo = new THREE.Mesh(
    new THREE.PlaneGeometry(0.34, 0.12),
    new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })
  );
  plinthLabelLo.position.set(1.82, -0.12, 0.5);
  scene.add(plinthLabelLo);

  const moduleGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  const moduleColors = [0xff7a3c, 0xd7dde6, 0x9fd7ff, 0xf0c27a];
  const modules = [];
  for (let i = 0; i < 4; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: moduleColors[i],
      emissive: moduleColors[i],
      emissiveIntensity: 0.25,
      roughness: 0.4,
      metalness: 0.15,
    });
    const m = new THREE.Mesh(moduleGeo, mat);
    scene.add(m);
    modules.push(m);
  }
  const modAnchor = new THREE.Object3D();
  modAnchor.position.set(1.82, 0.2, 0.5);
  scene.add(modAnchor);
  const plateHero = makePlate();
  plateHero.position.set(0, 0.74, 0.15);
  hero.add(plateHero);
  const plateSecond = makePlate();
  plateSecond.position.set(0, 0.58, 0.72);
  second.add(plateSecond);
  const plateSteam = makePlate();
  plateSteam.position.set(0, 0.66, 0.1);
  singleSteam.add(plateSteam);
  const plateBake = makePlate();
  plateBake.position.set(0, 0.52, 0.1);
  singleBake.add(plateBake);
  const plateOld = makePlate();
  plateOld.position.set(0, 0.64, 0.12);
  oldOven.add(plateOld);
  const plateSix = makePlate();
  plateSix.position.set(0, 0.66, 0.16);

  const recipe = new THREE.Group();
  hero.add(recipe);
  recipe.position.set(0, 0.05, 0.52);
  const recipeMat = new THREE.MeshBasicMaterial({
    color: 0xf4efe6,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.12), recipeMat);
      m.position.set(-0.22 + c * 0.22, 0.16 - r * 0.18, 0);
      recipe.add(m);
    }
  }
  const scan = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.008, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0x7ee0ff, transparent: true, opacity: 0.9 })
  );
  scan.position.set(0, 0, 0.2);
  hero.add(scan);
  const voice = new THREE.Group();
  voice.position.set(0.78, 0.05, 0.35);
  hero.add(voice);
  const voiceBars = [];
  const voiceMat = new THREE.MeshBasicMaterial({ color: 0xff8a6a, transparent: true, opacity: 0.95 });
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.2, 0.02), voiceMat);
    m.position.x = (i - 3) * 0.055;
    voice.add(m);
    voiceBars.push(m);
  }

  const aiAnchor = new THREE.Object3D();
  aiAnchor.position.set(0.15, 0.42, 0.4);
  hero.add(aiAnchor);

  const lanterns = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xe1251b,
      emissive: 0xff2a22,
      emissiveIntensity: 0.7,
      roughness: 0.45,
    });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), mat);
    body.scale.y = 1.25;
    g.add(body);
    const capM = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.03, 10), steel(0xf2d48a));
    capM.position.y = 0.09;
    g.add(capM);
    g.position.set(-0.55 + i * 0.55, 1.25, 0.1);
    g.userData.baseX = g.position.x;
    scene.add(g);
    lanterns.push(g);
  }

  const pathMatL = new THREE.MeshBasicMaterial({
    color: 0xffb078,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const pathMatR = pathMatL.clone();
  const pathL = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.28), pathMatL);
  const pathR = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.28), pathMatR);
  pathL.rotation.x = -Math.PI / 2;
  pathR.rotation.x = -Math.PI / 2;
  pathL.position.set(-1.15, -0.82, 0.7);
  pathR.position.set(1.2, -0.82, 0.7);
  scene.add(pathL);
  scene.add(pathR);

  const specs = new THREE.Group();
  specs.position.set(0.62, -0.15, 0.55);
  scene.add(specs);
  const specCols = [];
  const specNames = ["烤管", "热风", "蒸汽"];
  const specColors = [0xff6a2a, 0xd5dbe2, 0x8fd0ff];
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: specColors[i],
      emissive: specColors[i],
      emissiveIntensity: 0.35,
      roughness: 0.35,
    });
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.46, 0.16), mat);
    m.position.set((i - 1) * 0.28, 0.23, 0);
    specs.add(m);
    const anchor = new THREE.Object3D();
    anchor.position.set((i - 1) * 0.28, 0.55, 0);
    specs.add(anchor);
    specCols.push({ mesh: m, anchor: anchor, name: specNames[i] });
  }
  const coins = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.02, 14),
      new THREE.MeshStandardMaterial({ color: 0xf0c14a, metalness: 0.7, roughness: 0.3, emissive: 0x8a5a10, emissiveIntensity: 0.2 })
    );
    m.rotation.x = Math.PI / 2;
    scene.add(m);
    coins.push(m);
  }

  const trio = [
    buildAppliance({ w: 0.78, h: 0.4, d: 0.55, color: 0xcfd6dc }),
    buildAppliance({ w: 0.42, h: 0.72, d: 0.5, color: 0xd5e2ea }),
    buildAppliance({ w: 0.55, h: 0.55, d: 0.5, color: 0xe4ddd2 }),
  ];
  const trioStart = [
    new THREE.Vector3(1.55, 0.15, 0.35),
    new THREE.Vector3(1.95, -0.05, 0.15),
    new THREE.Vector3(1.25, -0.1, 0.45),
  ];
  const mergeEnd = new THREE.Vector3(1.15, 0.28, 0.85);
  trio.forEach(function (g) {
    scene.add(g);
  });
  const combo = buildAppliance({ w: 1.2, h: 1.0, d: 0.8, color: 0xd7dee6, stripe: true });
  combo.position.set(1.15, 0.0, 0.2);
  scene.add(combo);
  combo.add(plateSix);
  const perfGeo = new THREE.BoxGeometry(0.07, 0.46, 0.04);
  const perfMatL = new THREE.MeshStandardMaterial({
    color: 0xffb080,
    emissive: 0xff6a2a,
    emissiveIntensity: 0.55,
    transparent: true,
  });
  const perfMatR = perfMatL.clone();
  const perfL = new THREE.Mesh(perfGeo, perfMatL);
  perfL.position.set(-0.86, 0.02, 0.2);
  hero.add(perfL);
  const perfR = new THREE.Mesh(perfGeo, perfMatR);
  perfR.position.set(0.8, 0.02, 0.2);
  second.add(perfR);
  const priceStack = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.05, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xf2c14e, metalness: 0.55, roughness: 0.35 })
    );
    m.position.set(1.15, -0.35 + i * 0.07, 0.55);
    scene.add(m);
    priceStack.push(m);
  }

  const camP = [];
  const camL = [];
  function camKey(t, p, l) {
    camP.push({ t: t, v: p });
    camL.push({ t: t, v: l });
  }
  camKey(0, [0.62, 0.62, 6.15], [0.04, 0.2, 0]);
  camKey(CUE.hello.t0, [0.2, 0.36, 4.9], [0, 0.1, 0]);
  camKey(CUE.halfyear.t0, [0.02, 0.22, 4.15], [0, 0.05, 0.05]);
  camKey(CUE.price.t0, [-0.35, 0.5, 3.75], [0.05, 0.22, 0.1]);
  camKey(CUE.features.t0, [0.9, 0.24, 4.15], [0.85, 0.12, 0.1]);
  camKey(CUE.jd.t0, [-0.45, 0.22, 4.7], [-0.2, 0.06, 0]);
  camKey(CUE.mature.t0, [0, 0.26, 5.2], [0, 0.05, 0]);
  camKey(CUE.stack.t0, [0, 0.16, 4.5], [0, 0.02, 0]);
  camKey(CUE.worry.t0, [0.08, 0.2, 4.35], [0, 0.06, 0]);
  camKey(CUE.gap.t0, [0, 0.34, 5.45], [0, 0.15, -0.6]);
  camKey(CUE.ai.t0, [0.04, 0.14, 3.35], [0, 0.02, 0.12]);
  camKey(CUE.pin.t0, [0.12, 0.32, 4.4], [0, 0.1, 0]);
  camKey(CUE.zheng.t0, [0, 0.12, 3.5], [0, 0.04, 0.15]);
  camKey(SLACK_T0 + 0.2, [0, 0.1, 3.15], [0, 0.04, 0]);
  camKey(SLACK_T0 + 1.45, [0, 0.08, 2.35], [0, 0.03, 0]);
  camKey(CUE.mainstream.t0, [0.02, 0.3, 5.45], [0, 0.02, 0]);
  camKey(CUE.uniform.t0, [0.12, 0.16, 3.45], [0.08, 0.06, 0.02]);
  camKey(CUE.uniform.t1 - 0.35, [0.28, 0.14, 3.2], [0.42, 0.08, 0.12]);
  camKey(CUE.old.t0, [-0.35, 0.24, 4.45], [-1.25, 0.02, 0]);
  camKey(CUE.habit.t0, [0.02, 0.24, 4.75], [0, 0.04, 0]);
  camKey(CUE.path5k.t0, [-0.15, 0.16, 3.85], [0.15, 0.0, 0.15]);
  camKey(CUE.path6k.t0, [0.55, 0.18, 4.05], [0.7, 0.02, 0.1]);
  camKey(CUE.next.t0, [-0.08, 0.16, 3.6], [0, 0.04, 0.1]);
  camKey(DURATION, [0.02, 0.18, 3.35], [0.02, 0.05, 0.14]);

  const ovenXKeys = [
    { t: 0, v: 0 },
    { t: CUE.mature.t0, v: 0 },
    { t: CUE.mature.t0 + 0.7, v: -0.78 },
    { t: CUE.gap.t1, v: -0.45 },
    { t: CUE.ai.t0 + 0.8, v: 0 },
    { t: CUE.mainstream.t0, v: 0 },
    { t: CUE.mainstream.t0 + 0.85, v: -0.7 },
    { t: CUE.uniform.t0, v: 0.02 },
    { t: CUE.uniform.t1 - 0.2, v: 0.06 },
    { t: CUE.old.t0, v: 0.95 },
    { t: CUE.habit.t0, v: 0.05 },
    { t: CUE.path5k.t0, v: -0.28 },
    { t: CUE.path6k.t0, v: -0.9 },
    { t: CUE.next.t0, v: -0.05 },
    { t: DURATION, v: 0.02 },
  ];
  const doorKeys = [
    { t: 0, v: 0.18 },
    { t: CUE.hello.t0, v: 0.28 },
    { t: CUE.halfyear.t0, v: 0.42 },
    { t: CUE.price.t0, v: 0.62 },
    { t: CUE.features.t0, v: 0.4 },
    { t: CUE.jd.t0, v: 0.85 },
    { t: CUE.mature.t0, v: 0.48 },
    { t: CUE.ai.t0, v: 0.72 },
    { t: CUE.pin.t0, v: 0.4 },
    { t: CUE.zheng.t0, v: 0.55 },
    { t: CUE.zheng.t1, v: 0.04 },
    { t: SLACK_T0 + 0.4, v: 0.7 },
    { t: SLACK_T1, v: 0.5 },
    { t: CUE.uniform.t0, v: 0.95 },
    { t: CUE.old.t0, v: 0.4 },
    { t: CUE.habit.t0, v: 0.48 },
    { t: CUE.path5k.t0, v: 0.62 },
    { t: CUE.path6k.t0, v: 0.4 },
    { t: CUE.next.t0, v: 0.7 },
    { t: DURATION, v: 0.66 },
  ];

  const tmp = new THREE.Vector3();
  const chips = {};
  function project(obj, ox, oy) {
    obj.getWorldPosition(tmp);
    tmp.project(camera);
    return {
      x: (tmp.x * 0.5 + 0.5) * 1920 + (ox || 0),
      y: (-tmp.y * 0.5 + 0.5) * 1080 + (oy || 0),
      z: tmp.z,
    };
  }
  function chip(id, text, x, y, opt) {
    opt = opt || {};
    let el = chips[id];
    if (!el) {
      el = document.createElement("div");
      el.className = "chip";
      labelsEl.appendChild(el);
      chips[id] = el;
    }
    const cls = "chip" + (opt.cls ? " " + opt.cls : "");
    if (el.className !== cls) el.className = cls;
    if (el.textContent !== text) el.textContent = text;
    let op = opt.op == null ? 0 : opt.op;
    const size = opt.size || 16;
    let yy = y;
    if (yy > 1000 || yy < 8 || x < -20 || x > 1860 || (opt.z != null && opt.z > 1)) op = 0;
    yy = clamp(yy, 10, 1000);
    el.style.opacity = op < 0.02 ? "0" : String(op);
    el.style.fontSize = size + "px";
    const rot = opt.rot || 0;
    const sc = opt.scale || 1;
    el.style.transform = "translate(" + x + "px," + yy + "px) rotate(" + rot + "deg) scale(" + sc + ")";
  }

  let booted = false;
  let clockT = 0;
  let playing = false;
  let lastNow = 0;

  function draw(t) {
    const ovenX = sampleLinear(ovenXKeys, t);
    hero.position.x = ovenX;
    hero.position.y = 0.02 + Math.sin(t * 0.8) * 0.004;

    const door = clamp(sampleLinear(doorKeys, t), 0, 1.15);
    hero.userData.pivot.rotation.y = -door;
    second.userData.pivot.rotation.y = -door * 0.85;
    oldOven.userData.pivot.rotation.y = -0.35;

    const cp = sampleCR(camP, t);
    const cl = sampleCR(camL, t);
    const tunnel =
      smooth(CUE.zheng.t0 + 0.45, SLACK_T0 + 0.9, t) *
      (1 - smooth(SLACK_T1 - 0.45, CUE.mainstream.t0 + 0.7, t));
    cp[0] += Math.sin(t * 21) * 0.01 * tunnel;
    cp[1] += Math.sin(t * 0.7) * 0.01 + Math.sin(t * 17) * 0.008 * tunnel;
    if (cp[2] < 2.15) cp[2] = 2.15;
    camera.position.set(cp[0], cp[1], cp[2]);
    camera.lookAt(cl[0], cl[1], cl[2]);

    const power = smooth(0.2, 1.45, t);
    const heatAmt = clamp(
      0.18 +
        0.82 * cueW("uniform", t, 0.35, 0.45) * easeOut(clamp(cueU("uniform", t) / 0.7, 0, 1)) +
        0.25 * tunnel,
      0,
      1
    );
    heatMat.uniforms.uSteam.value = heatAmt;
    heatMat.uniforms.uTime.value = t;
    heatMat.uniforms.uAlpha.value = (0.18 + 0.62 * heatAmt) * power;
    tubeMat.emissiveIntensity = (0.35 + 1.3 * heatAmt) * power;
    foodMat.emissiveIntensity = 0.12 + 0.45 * heatAmt;
    cavityLight.intensity = (2.2 + 7.5 * heatAmt) * power * (0.82 + 0.18 * Math.sin(t * 1.6));
    hero.userData.innerMat.emissiveIntensity = (0.25 + 0.7 * heatAmt) * power;
    fan.rotation.z = t * (1.4 + 8.5 * heatAmt);

    const steamI = (0.28 + 0.72 * heatAmt) * power * (0.55 + 0.45 * (1 - tunnel * 0.3));
    layoutSteam(steamL, t, steamI, -0.42, -0.05, 0.05);
    layoutSteam(steamR, t, steamI * 0.85, 0.4, -0.02, 0.02);

    scene.fog.density = lerp(0.03, 0.11, tunnel);
    scene.fog.color.setRGB(lerp(0.09, 0.35, tunnel), lerp(0.07, 0.24, tunnel), lerp(0.06, 0.18, tunnel));

    const hotU = clamp(0.5 + ovenX / 4.2, 0.12, 0.88);
    floorMat.uniforms.uHot.value = hotU;
    floorMat.uniforms.uGlow.value = 0.25 + 0.55 * Math.max(cueW("path5k", t), cueW("path6k", t), cueW("uniform", t));

    const tagShow = Math.max(cueW("halfyear", t, 0.6, 0.2) * 0.2, cueW("price", t, 0.25, 0.35));
    const fall = cueU("price", t);
    const tagX = [-0.26, 0.04, 0.3];
    const tagY = [0.34, 0.1, -0.12];
    for (let i = 0; i < tags.length; i++) {
      const local = clamp((fall - i * 0.12) / 0.7, 0, 1);
      const y = lerp(tagY[i], -0.5, local * local);
      const bounce = local > 0.72 ? Math.sin((local - 0.72) * 10) * (1 - local) * 0.08 : 0;
      const tag = tags[i];
      tag.position.set(ovenX + tagX[i], y + bounce, 0.58);
      tag.rotation.z = 0;
      tag.material.opacity = tagShow * (local > 0.86 ? 1 - (local - 0.86) / 0.14 : 1);
      tag.visible = tag.material.opacity > 0.02;
    }

    const modShow = cueW("features", t, 0.35, 0.4) * (1 - 0.85 * cueW("jd", t));
    for (let i = 0; i < modules.length; i++) {
      const local = clamp((cueU("features", t) - i * 0.08) / 0.62, 0, 1);
      const e = easeOutBack(local);
      const x = 1.82;
      const y = lerp(0.9, -0.05, e);
      const z = lerp(0.28, 0.55, e);
      modules[i].position.set(x + (i - 1.5) * 0.2, y, z);
      modules[i].scale.setScalar(modShow < 0.02 ? 0.001 : 0.9 + 0.1 * modShow);
      modules[i].visible = modShow > 0.02;
      modules[i].material.opacity = 1;
    }
    plinthHi.visible = modShow > 0.05;
    plinthLo.visible = modShow > 0.05;
    plinthLabelHi.visible = modShow > 0.08;
    plinthLabelLo.visible = modShow > 0.08;
    plinthHi.material.opacity = modShow;
    plinthLo.material.opacity = modShow;
    plinthLabelHi.material.opacity = modShow;
    plinthLabelLo.material.opacity = modShow;
    plinthLabelHi.quaternion.copy(camera.quaternion);
    plinthLabelLo.quaternion.copy(camera.quaternion);
    plinthLabelLo.position.y = -0.02;
    plinthHi.material.transparent = true;
    plinthLo.material.transparent = true;

    const secondW = Math.max(
      cueW("mature", t, 0.45, 0.25),
      cueW("stack", t, 0.2, 0.25),
      cueW("worry", t, 0.15, 0.3),
      cueW("gap", t, 0.15, 0.4) * 0.85,
      cueW("mainstream", t, 0.4, 0.35),
      cueW("habit", t, 0.25, 0.35) * 0.7
    );
    second.position.x = 0.88;
    second.position.y = 0.0;
    applyOpacity(second, secondW);

    const singleW = cueW("mainstream", t, 0.4, 0.45) * (1 - 0.8 * cueW("uniform", t));
    applyOpacity(singleSteam, singleW);
    applyOpacity(singleBake, singleW);
    singleSteam.position.y = -0.02 + Math.sin(t * 0.9) * 0.01 * singleW;
    singleBake.position.y = -0.08 + Math.sin(t * 0.8 + 1) * 0.01 * singleW;

    const oldW = cueW("old", t, 0.4, 0.4);
    applyOpacity(oldOven, oldW);
    for (let i = 0; i < dust.length; i++) {
      const phase = (((t * 0.25) / (2.4 + (i % 4) * 0.3) + i * 0.17) % 1 + 1) % 1;
      dust[i].position.set(Math.sin(i * 2.1) * 0.55, -0.2 + phase * 1.1, Math.cos(i) * 0.3);
      dust[i].scale.setScalar(0.06 + phase * 0.08);
      dust[i].material.opacity = Math.sin(phase * Math.PI) * 0.35 * oldW;
    }

    const brandW = cueW("gap", t, 0.35, 0.4);
    brands.visible = brandW > 0.02;
    for (let i = 0; i < brandMeshes.length; i++) {
      brandMeshes[i].material.opacity = brandW;
      brandMeshes[i].position.y = brandMeshes[i].userData.baseY + Math.sin(t * 0.8 + i) * 0.012;
    }

    const puffW = cueW("worry", t, 0.2, 0.3);
    const puffU = cueU("worry", t);
    for (let i = 0; i < puffs.length; i++) {
      const life = Math.sin(clamp(puffU * 1.1 - i * 0.04, 0, 1) * Math.PI);
      puffs[i].position.set(-0.55 + (i % 3) * 0.55, 0.35 + Math.floor(i / 3) * 0.32, 1.15);
      const sc = 0.08 + life * 0.62;
      puffs[i].scale.set(sc, sc, sc);
      puffs[i].material.opacity = life * 0.55 * puffW;
    }

    const aiW = cueW("ai", t, 0.4, 0.4);
    const aiU = cueU("ai", t);
    const recipeOp = aiW * (1 - smooth(0.12, 0.48, aiU));
    recipe.visible = recipeOp > 0.02;
    recipeMat.opacity = 0.9 * recipeOp;
    const aiIn = aiW * smooth(0.18, 0.5, aiU);
    scan.visible = aiIn > 0.02;
    scan.material.opacity = 0.95 * aiIn;
    const sweep = ((aiU * 1.35) % 1 + 1) % 1;
    scan.rotation.x = Math.PI / 2;
    scan.position.y = lerp(-0.34, -0.12, sweep);
    scan.position.z = 0.16;
    scan.rotation.z = t * 0.8;
    voice.visible = aiIn > 0.02;
    for (let i = 0; i < voiceBars.length; i++) {
      const h = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 7.5 + i * 0.85));
      voiceBars[i].scale.y = h;
      voiceBars[i].position.y = (h - 1) * 0.1;
      voiceBars[i].material.opacity = aiIn;
    }

    const jdW = cueW("jd", t, 0.4, 0.45);
    const jdU = cueU("jd", t);
    const swing = (1 - easeOut(clamp(jdU / 0.34, 0, 1))) * 64;
    const zoom = lerp(1.15, 1.78, smooth(0.22, 0.68, jdU));
    const focus = lerp(190, 340, smooth(0.18, 0.72, jdU));
    const disp = (860 / 1128) * zoom;
    const pan = -focus * disp + 70;
    jdRig.style.opacity = String(jdW);
    jdRig.style.visibility = jdW < 0.02 ? "hidden" : "visible";
    jdWindow.style.transform = "rotateY(" + swing + "deg) scale(" + lerp(0.9, 1, easeOut(clamp(jdU / 0.3, 0, 1))) + ")";
    jdImg.style.transform = "translate3d(0," + pan + "px,0) scale(" + zoom + ")";
    const ringOp = smooth(0.22, 0.4, jdU) * (1 - smooth(0.9, 1, jdU)) * jdW;
    jdRing.style.opacity = String(ringOp);
    jdRing.style.left = "250px";
    jdRing.style.top = "78px";
    jdRing.style.width = "250px";
    jdRing.style.height = "230px";
    jdCap.style.opacity = String(jdW);
    dimEl.style.opacity = String(0.58 * jdW);

    for (let i = 0; i < lanterns.length; i++) {
      const g = lanterns[i];
      const sway = Math.sin(t * 1.15 + i * 0.8) * 0.05;
      g.position.x = g.userData.baseX + sway;
      g.rotation.z = sway * 1.4;
      g.visible = jdW > 0.05;
      g.children[0].material.opacity = jdW;
      g.children[0].material.transparent = true;
    }

    const pinW = Math.max(cueW("pin", t, 0.35, 0.25), cueW("zheng", t, 0.1, 0.45) * 0.85);
    const pinY = lerp(160, 36, easeOut(clamp(cueU("pin", t) / 0.5, 0, 1)));
    pinEl.style.opacity = String(pinW);
    pinEl.style.visibility = pinW < 0.02 ? "hidden" : "visible";
    pinEl.style.transform = "translateY(" + pinY + "px)";

    const leftAmt =
      Math.max(cueW("habit", t) * 0.75, cueW("path5k", t)) * (1 - 0.72 * cueW("path6k", t));
    const rightAmt =
      Math.max(cueW("habit", t) * 0.75, cueW("path6k", t)) * (1 - 0.72 * cueW("path5k", t));
    pathMatL.opacity = 0.42 * leftAmt;
    pathMatR.opacity = 0.42 * rightAmt;

    const specW = cueW("path5k", t, 0.35, 0.4);
    specs.visible = specW > 0.02;
    const specU = cueU("path5k", t);
    for (let i = 0; i < specCols.length; i++) {
      const uu = easeOut(clamp((specU - 0.08 - i * 0.12) / 0.5, 0, 1));
      specCols[i].mesh.scale.y = 0.08 + 0.92 * uu;
      specCols[i].mesh.position.y = -0.05 + specCols[i].mesh.scale.y * 0.23;
      specCols[i].mesh.material.opacity = specW;
      specCols[i].mesh.material.transparent = true;
    }
    for (let i = 0; i < coins.length; i++) {
      const uu = easeOut(clamp((specU - i * 0.06) / 0.45, 0, 1));
      const slot = i % 3;
      coins[i].position.set(
        lerp(0.15 + i * 0.12, 0.62 + (slot - 1) * 0.28, uu),
        lerp(0.85, 0.05 + Math.floor(i / 3) * 0.08, uu),
        lerp(0.9, 0.62, uu)
      );
      coins[i].visible = specW > 0.05 && uu < 0.98;
      coins[i].material.opacity = specW * (1 - smooth(0.75, 0.98, uu));
      coins[i].material.transparent = true;
    }

    const mergeW = cueW("path6k", t, 0.35, 0.4);
    const mergeU = easeOut(cueU("path6k", t));
    const trioFade = 1 - smooth(0.18, 0.5, mergeU);
    const comboIn = smooth(0.34, 0.72, mergeU);
    for (let i = 0; i < trio.length; i++) {
      trio[i].position.lerpVectors(trioStart[i], mergeEnd, Math.min(1, mergeU * 1.15));
      trio[i].scale.setScalar(lerp(1, 0.55, mergeU));
      applyOpacity(trio[i], mergeW * trioFade);
    }
    applyOpacity(combo, mergeW * comboIn);
    const pop = 0.78 + 0.22 * easeOutBack(clamp(comboIn, 0, 1));
    combo.scale.setScalar(pop);
    for (let i = 0; i < priceStack.length; i++) {
      const uu = smooth(0.35 + i * 0.08, 0.7 + i * 0.05, cueU("path6k", t));
      priceStack[i].visible = mergeW > 0.05 && uu > 0.02;
      priceStack[i].scale.y = uu;
      priceStack[i].material.opacity = mergeW;
      priceStack[i].material.transparent = true;
    }

    const bugOp = smooth(0.35, 1.15, t) * (1 - smooth(CUE.hello.t1, CUE.hello.t1 + 0.8, t));
    chip("bug", "识食务者", 48, 36, { op: bugOp * (1 - tunnel), size: 14, cls: "ghost" });

    function facePlate(plate, op) {
      plate.quaternion.copy(camera.quaternion);
      plate.material.opacity = op;
      plate.visible = op > 0.03;
    }
    const plateOp = (1 - jdW) * (1 - tunnel) * smooth(0.8, 2.0, t);
    facePlate(plateHero, plateOp * (0.35 + 0.65 * Math.max(cueW("hello", t), cueW("halfyear", t), cueW("mature", t), cueW("mainstream", t), cueW("next", t), cueW("path5k", t), cueW("uniform", t) * 0.5)));
    facePlate(plateSecond, secondW);
    facePlate(plateSteam, singleW);
    facePlate(plateBake, singleW);
    facePlate(plateOld, oldW);
    facePlate(plateSix, mergeW * comboIn);

    const uniW = cueW("uniform", t, 0.3, 0.35);
    heatCard.visible = uniW > 0.04;
    heatCard.quaternion.copy(camera.quaternion);
    heatCardMat.uniforms.uSteam.value = clamp(cueU("uniform", t) / 0.72, 0, 1);
    heatCardMat.uniforms.uTime.value = t;
    heatCardMat.uniforms.uAlpha.value = uniW;

    const perfShow = Math.max(cueW("stack", t, 0.3, 0.35), cueW("worry", t, 0.15, 0.35));
    const dip = 0.16 * Math.sin(clamp(cueU("worry", t), 0, 1) * Math.PI);
    const perf = clamp(0.92 * easeOut(clamp((cueU("stack", t) + cueU("worry", t)) / 0.35, 0, 1)) - dip, 0.2, 1);
    perfL.visible = perfShow > 0.04;
    perfR.visible = perfShow > 0.04 && secondW > 0.2;
    perfL.scale.y = perf;
    perfR.scale.y = perf;
    perfL.position.y = -0.22 + perf * 0.23;
    perfR.position.y = -0.18 + perf * 0.2;
    perfMatL.opacity = perfShow;
    perfMatR.opacity = perfShow * secondW;

    for (let i = 0; i < specCols.length; i++) {
      const p = project(specCols[i].anchor, -18, -28);
      chip("spec" + i, specCols[i].name, p.x, p.y, { op: specW, size: 15, cls: "pill", z: p.z });
    }
    const modP = project(modAnchor, -48, -36);
    chip("down", "8K → 5K", modP.x, modP.y, { op: modShow, size: 15, cls: "pill", z: modP.z });

    const heatP = project(heatCard, -18, -36);
    chip("even", "均匀", heatP.x, heatP.y, { op: uniW, size: 15, cls: "pill", z: heatP.z });
    chip("doneness", "AI 熟度", 1188, 250, { op: aiIn * (1 - jdW), size: 16, cls: "pill" });
    chip("voice", "AI 语音", 1188, 292, { op: aiIn * (1 - jdW), size: 16, cls: "pill" });
    chip("recipes", "菜谱", 1188, 334, { op: recipeOp, size: 15, cls: "pill ghost" });

    const stampU = cueU("zheng", t);
    const stampOp = Math.sin(clamp(stampU, 0, 1) * Math.PI) * (1 - tunnel);
    chip("stamp", "正片开始", 836, 188, {
      op: stampOp,
      size: 20,
      cls: "stamp",
      rot: -8,
      scale: lerp(0.86, 1, easeOut(clamp(stampU / 0.35, 0, 1))),
    });

    renderer.render(scene, camera);
  }

  function fmt(t) {
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    const whole = Math.floor(s);
    const frac = Math.floor((s - whole) * 100 + 1e-4);
    return m + ":" + String(whole).padStart(2, "0") + "." + String(frac).padStart(2, "0");
  }

  function renderAt(seconds) {
    const t = clamp(Number(seconds) || 0, 0, DURATION);
    clockT = t;
    draw(t);
    if (document.activeElement !== scrub) scrub.value = String(t);
    timeEl.textContent = fmt(t) + " / " + fmt(DURATION);
    return t;
  }

  function updateIcon() {
    const on = playing;
    iconPlay.hidden = on;
    iconPause.hidden = !on;
    btnPlay.setAttribute("aria-label", on ? "暂停" : "播放");
  }
  function pause() {
    playing = false;
    audio.pause();
    updateIcon();
  }
  function play() {
    if (clockT >= DURATION - 0.04) {
      clockT = 0;
      renderAt(0);
    }
    playing = true;
    try {
      audio.currentTime = Math.min(clockT, (audio.duration || DURATION) - 0.05);
    } catch (e) {}
    audio.play().catch(function () {});
    updateIcon();
  }
  function userSeek(t) {
    const clamped = clamp(t, 0, DURATION);
    try {
      if (audio.readyState >= 1) audio.currentTime = Math.min(clamped, audio.duration || clamped);
    } catch (e) {}
    renderAt(clamped);
  }
  function toggle() {
    if (playing) pause();
    else play();
  }
  function replay() {
    pause();
    userSeek(0);
    play();
  }

  function tick(now) {
    if (playing) {
      const dt = Math.min(0.05, (now - lastNow) / 1000);
      clockT = Math.min(DURATION, clockT + dt);
      if (!audio.paused && !audio.ended && Math.abs(audio.currentTime - clockT) > 0.09) {
        try {
          audio.currentTime = clockT;
        } catch (e) {}
      }
      if (clockT >= DURATION - 0.0001) {
        clockT = DURATION;
        renderAt(clockT);
        pause();
      } else {
        renderAt(clockT);
      }
    }
    lastNow = now;
    requestAnimationFrame(tick);
  }

  function fit() {
    if (document.body.classList.contains("export")) {
      stage.style.transform = "none";
      return;
    }
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.transform = "scale(" + s + ")";
  }

  window.setExportMode = function (on) {
    document.body.classList.toggle("export", !!on);
    if (on) pause();
    fit();
  };

  window.renderAt = function (seconds) {
    if (!booted) {
      clockT = clamp(Number(seconds) || 0, 0, DURATION);
      return clockT;
    }
    return renderAt(seconds);
  };

  btnPlay.addEventListener("click", toggle);
  document.getElementById("btn-replay").addEventListener("click", replay);
  scrub.addEventListener("input", function () {
    if (playing) pause();
    userSeek(parseFloat(scrub.value));
  });
  window.addEventListener("keydown", function (e) {
    if (document.body.classList.contains("export")) return;
    if (e.code === "Space") {
      e.preventDefault();
      toggle();
    }
  });
  window.addEventListener("resize", fit);
  fit();
  scrub.max = String(DURATION);
  scrub.step = "0.0166667";

  function bootLabels() {
    for (let i = 0; i < tagTexts.length; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: textTexture(tagTexts[i], 512, 192, "#ffe7e3", 92),
        transparent: true,
        depthWrite: false,
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.128), mat);
      scene.add(m);
      tags.push(m);
    }
    plinthLabelHi.material.map = textTexture("8K", 256, 128, "#f6f1e8", 78);
    plinthLabelHi.material.needsUpdate = true;
    plinthLabelLo.material.map = textTexture("5K", 256, 128, "#ffd0c8", 78);
    plinthLabelLo.material.needsUpdate = true;
    function plateMap(mesh, text) {
      mesh.material.map = textTexture(text, 512, 160, "#f6f1e8", 68, true);
      mesh.material.needsUpdate = true;
    }
    plateMap(plateHero, "蒸烤箱");
    plateMap(plateSecond, "微蒸烤");
    plateMap(plateSteam, "单蒸");
    plateMap(plateBake, "单烤");
    plateMap(plateOld, "2016");
    plateMap(plateSix, "6K+");
  }

  async function boot() {
    try {
      await document.fonts.load("16px OvenUI");
      await document.fonts.load("22px OvenUI");
      await document.fonts.ready;
      if (jdImg.decode) {
        try {
          await jdImg.decode();
        } catch (e) {}
      }
      await new Promise(function (resolve) {
        if (audio.readyState >= 2) return resolve();
        audio.addEventListener("canplay", resolve, { once: true });
        audio.addEventListener("error", resolve, { once: true });
        setTimeout(resolve, 8000);
      });
      bootLabels();
      if (renderer.compile) renderer.compile(scene, camera);
      booted = true;
      const startT = params.get("t");
      const initial = startT == null ? 0 : clamp(parseFloat(startT) || 0, 0, DURATION);
      renderAt(initial);
      window.__RESOURCES_READY__ = true;
      window.__VIDEO__ = {
        width: 1920,
        height: 1080,
        fps: 60,
        duration: DURATION,
        lead: LEAD,
        slack: SLACK,
        slackAt: SLACK_T0,
        tail: TAIL,
        speechEnd: DURATION - TAIL,
      };
      document.documentElement.setAttribute("data-resources-ready", "true");
      window.dispatchEvent(new Event("resourcesready"));
      lastNow = performance.now();
      requestAnimationFrame(tick);
    } catch (err) {
      fail(err);
    }
  }

  boot();
})();
