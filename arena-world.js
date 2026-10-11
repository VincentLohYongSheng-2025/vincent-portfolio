/* A single, hero-contained Three.js VL sculpture. */
(() => {
  'use strict';

  const world = document.getElementById('arena-world');
  const canvas = document.getElementById('arena-canvas');
  const hero = document.getElementById('hero');
  const heroVisual = document.querySelector('.hero-visual');
  if (!world || !canvas || !hero || !heroVisual) return;

  // The visual never escapes its own hero wrapper, including during fallback.
  heroVisual.prepend(world);
  world.hidden = true;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 768px)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const damp = (value, target, lambda, dt) => value + (target - value) * (1 - Math.exp(-lambda * dt));

  let THREE, renderer, scene, camera, relic;
  let keyLight, violetLight, coralLight;
  let rendering = false;
  let animationHandle = 0;
  let lastTime = 0;
  let elapsed = 0;
  let pointerX = 0;
  let pointerY = 0;
  let currentX = 0;
  let currentY = 0;
  let heroVisible = true;
  let entryEndsAt = 0;

  function setFallback(reason) {
    pauseRendering();
    world.classList.remove('is-measuring', 'is-ready');
    world.hidden = true;
    document.body.classList.remove('world-live', 'arena-ready', 'arena-entering');
    document.body.classList.add('webgl-fallback');
    document.body.dataset.arenaMode = 'fallback';
    document.body.dataset.arenaFallback = reason;
  }

  function revealWorld() {
    world.hidden = false;
    world.classList.remove('is-measuring');
    world.classList.add('is-ready');
    document.body.classList.remove('webgl-fallback');
    document.body.classList.add('world-live');
    document.body.dataset.arenaMode = 'webgl';
    delete document.body.dataset.arenaFallback;
  }

  function polygon(points) {
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
    shape.closePath();
    return shape;
  }

  function makeExtrusion(points, color, edge, depth, bevel, metalness = .35) {
    const geometry = new THREE.ExtrudeGeometry(polygon(points), {
      depth,
      steps: 1,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: mobile.matches ? 1 : 2,
      curveSegments: 1
    });
    geometry.computeVertexNormals();
    const front = new THREE.MeshPhysicalMaterial({
      color,
      metalness,
      roughness: .31,
      clearcoat: .5,
      clearcoatRoughness: .2,
      flatShading: true
    });
    const sides = new THREE.MeshStandardMaterial({
      color: edge,
      metalness: .42,
      roughness: .34,
      flatShading: true
    });
    const mesh = new THREE.Mesh(geometry, [front, sides]);
    if (!mobile.matches) {
      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry, 42),
        new THREE.LineBasicMaterial({ color: 0xf5f0e6, transparent: true, opacity: .56 })
      );
      mesh.add(outline);
    }
    return mesh;
  }

  function disposeObject(root) {
    if (!root) return;
    const geometries = new Set();
    const materials = new Set();
    root.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      const list = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      list.forEach(material => materials.add(material));
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    root.parent?.remove(root);
    root.clear();
  }

  function buildRelic() {
    disposeObject(relic);
    relic = new THREE.Group();
    scene.add(relic);

    const vPoints = [[-1.98, 1.36], [-1.25, 1.36], [-.56, -.67], [.12, 1.36], [.84, 1.36], [-.25, -1.53], [-.97, -1.53]];
    const lPoints = [[.53, .63], [1.24, .63], [1.24, -.93], [2.07, -.93], [1.83, -1.53], [.53, -1.53]];
    const v = makeExtrusion(vPoints, 0x163ba9, 0x29246f, .63, .085, .25);
    const l = makeExtrusion(lPoints, 0xb87808, 0xad443a, .63, .085, .2);
    v.position.set(-.035, .04, .16);
    l.position.set(.01, -.05, .33);
    relic.add(v, l);

    if (!mobile.matches) {
      const facets = [
        { points: [[-2.21, .7], [-1.96, 1.07], [-1.56, -1.4], [-2.19, -1.68]], color: 0x6e58bc, x: -.08, z: -.35 },
        { points: [[-.43, .38], [.08, .92], [.56, -1.24], [-.18, -1.67]], color: 0x6b78d5, x: 0, z: -.49 },
        { points: [[1.63, .22], [2.19, .45], [2.28, -1.32], [1.82, -1.55]], color: 0xe86e59, x: .09, z: -.28 }
      ];
      facets.forEach(facet => {
        const mesh = makeExtrusion(facet.points, facet.color, 0x554677, .12, .035, .18);
        mesh.position.set(facet.x, 0, facet.z);
        relic.add(mesh);
      });
    }

    const vGleam = new THREE.Mesh(
      new THREE.ExtrudeGeometry(polygon([[-1.76, 1.14], [-1.46, 1.14], [-.55, -1.08], [-.73, -1.22]]), { depth: .008, bevelEnabled: false }),
      new THREE.MeshBasicMaterial({ color: 0xb7d6ff, transparent: true, opacity: .37, depthWrite: false })
    );
    const lGleam = new THREE.Mesh(
      new THREE.ExtrudeGeometry(polygon([[.7, .45], [.88, .45], [.88, -1.28], [.7, -1.28]]), { depth: .008, bevelEnabled: false }),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .4, depthWrite: false })
    );
    vGleam.position.z = .89;
    lGleam.position.z = 1.04;
    relic.add(vGleam, lGleam);
  }

  function resize() {
    if (!renderer) return;
    const width = Math.max(1, Math.round(heroVisual.clientWidth));
    const height = Math.max(1, Math.round(heroVisual.clientHeight));
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile.matches ? 1.15 : 1.55));
    renderer.setSize(width, height, false);
    canvas.dataset.renderSize = `${canvas.width}x${canvas.height}`;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function canRender() {
    return !!renderer && world.classList.contains('is-ready') && !reduced.matches && !document.hidden && heroVisible;
  }

  function pauseRendering() {
    if (animationHandle) cancelAnimationFrame(animationHandle);
    animationHandle = 0;
    rendering = false;
    lastTime = 0;
  }

  function requestRender() {
    if (!canRender() || rendering) return;
    rendering = true;
    animationHandle = requestAnimationFrame(frame);
  }

  function frame(time) {
    animationHandle = 0;
    if (!canRender()) {
      pauseRendering();
      return;
    }
    const dt = lastTime ? Math.min(.05, (time - lastTime) / 1000) : 1 / 60;
    lastTime = time;
    elapsed += dt;

    currentX = damp(currentX, mobile.matches ? 0 : pointerX, 5.5, dt);
    currentY = damp(currentY, mobile.matches ? 0 : pointerY, 5.5, dt);
    const entering = Math.max(0, (entryEndsAt - time) / 900);
    const settle = 1 - entering;
    const idleY = mobile.matches ? 0 : Math.sin(elapsed * .7) * .065;

    relic.position.set(0, idleY + entering * .2, entering * -.8);
    relic.scale.setScalar((mobile.matches ? .78 : .94) * (.78 + settle * .22));
    relic.rotation.set(-.18 + currentY * .07, -.3 + currentX * .12, -.1);
    keyLight.position.x = 2.2 + currentX * .5;
    keyLight.position.y = 4 - currentY * .25;
    renderer.render(scene, camera);
    animationHandle = requestAnimationFrame(frame);
  }

  function makeScene() {
    THREE = window.THREE;
    if (!THREE) {
      setFallback('library-unavailable');
      return;
    }
    world.hidden = false;
    world.classList.add('is-measuring');
    const contextOptions = { alpha: true, antialias: true, powerPreference: 'high-performance' };
    const context = canvas.getContext('webgl2', contextOptions) || canvas.getContext('webgl', contextOptions);
    if (!context) {
      setFallback('context-unavailable');
      return;
    }
    try {
      renderer = new THREE.WebGLRenderer({ canvas, context, ...contextOptions });
      renderer.setClearColor(0x000000, 0);
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = .92;
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(40, 1, .1, 100);
      camera.position.set(0, 0, 8.35);
      camera.lookAt(0, 0, 0);
      scene.add(new THREE.AmbientLight(0xffffff, .3));
      scene.add(new THREE.HemisphereLight(0xecf2ff, 0x70677d, .46));
      keyLight = new THREE.DirectionalLight(0xc7ddff, 1.45);
      keyLight.position.set(2, 4, 5);
      violetLight = new THREE.DirectionalLight(0xa68aff, .66);
      violetLight.position.set(-3, 1, -2);
      coralLight = new THREE.DirectionalLight(0xffa16b, .48);
      coralLight.position.set(1, -3, 3);
      scene.add(keyLight, violetLight, coralLight);
      buildRelic();
      resize();
      if (canvas.width < 2 || canvas.height < 2) throw new Error('Canvas failed to measure');
      renderer.render(scene, camera);
    } catch (_) {
      disposeObject(relic);
      renderer?.dispose();
      renderer = null;
      setFallback('renderer-unavailable');
      return;
    }
    entryEndsAt = performance.now() + 900;
    revealWorld();
    document.body.classList.add('arena-entering');
    requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add('arena-ready')));
    setTimeout(() => document.body.classList.remove('arena-entering'), 1000);
    requestRender();
  }

  function updatePreference() {
    if (reduced.matches) {
      setFallback('reduced-motion');
      return;
    }
    if (!renderer && window.THREE) makeScene();
    else if (renderer) {
      revealWorld();
      resize();
      requestRender();
    } else setFallback('library-unavailable');
  }

  function rebuildForViewport() {
    if (!renderer) return;
    world.classList.add('is-measuring');
    buildRelic();
    resize();
    revealWorld();
    requestRender();
  }

  function teardown() {
    pauseRendering();
    disposeObject(relic);
    renderer?.dispose();
    renderer?.forceContextLoss?.();
  }

  if (reduced.matches) setFallback('reduced-motion');
  else makeScene();

  if ('IntersectionObserver' in window) {
    const heroObserver = new IntersectionObserver(entries => {
      heroVisible = entries[0].isIntersecting;
      if (heroVisible) requestRender();
      else pauseRendering();
    }, { threshold: .01 });
    heroObserver.observe(hero);
  }

  addEventListener('pointermove', event => {
    if (!finePointer.matches || mobile.matches || reduced.matches || !heroVisible) return;
    const bounds = heroVisual.getBoundingClientRect();
    pointerX = clamp(((event.clientX - bounds.left) / Math.max(1, bounds.width) - .5) * 2, -1, 1);
    pointerY = clamp(((event.clientY - bounds.top) / Math.max(1, bounds.height) - .5) * 2, -1, 1);
  }, { passive: true });
  heroVisual.addEventListener('pointerleave', () => { pointerX = 0; pointerY = 0; });
  addEventListener('resize', () => { resize(); requestRender(); }, { passive: true });
  reduced.addEventListener('change', updatePreference);
  mobile.addEventListener('change', rebuildForViewport);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseRendering(); else requestRender(); });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    renderer = null;
    setFallback('context-lost');
  });
  addEventListener('pagehide', pauseRendering);
  addEventListener('beforeunload', teardown, { once: true });
})();
