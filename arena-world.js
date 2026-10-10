/* One demand-rendered Three.js world shared by every portfolio chapter. */
(() => {
  'use strict';

  const world = document.getElementById('arena-world');
  const canvas = document.getElementById('arena-canvas');
  const heroVisual = document.querySelector('.hero-visual');
  if (!world || !canvas || !heroVisual) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 1024px)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const chapterIds = ['hero', 'about', 'projects', 'experience', 'awards', 'education', 'side-quest', 'contact'];
  const chapters = chapterIds.map(id => document.getElementById(id)).filter(Boolean);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const mix = (a, b, amount) => a + (b - a) * amount;

  let THREE, renderer, scene, camera, relic, environment, shadow;
  let keyLight, violetLight, coralLight, lightColors, experienceRibbon;
  let sectionLayers = {}, projectMarkers = [], awardEmblems = [];
  let running = false, animationHandle = 0, scrollFrame = 0, pointerFrame = 0, lastTime = 0;
  let introStarted = 0, introUntil = 0, entryComplete = false, inViewport = true;
  let sectionName = 'hero', sectionProgress = 0, pointerX = 0, pointerY = 0;
  let focusKind = '', focusIndex = -1;

  const baseX = () => mobile.matches ? 0 : 2.72;
  let goal = { x: baseX(), y: 0, z: 0, scale: .88, rx: -.18, ry: -.22, rz: -.11, cameraX: 0, cameraY: 0, cameraZ: 8.1, fov: 40 };
  let current = { x: baseX(), y: 1.2, z: -.9, scale: .42, rx: -.5, ry: -.82, rz: -.34, cameraX: -.12, cameraY: .15, cameraZ: 9.35, fov: 43 };
  const layerState = Object.fromEntries(chapterIds.map(id => [id, { current: id === 'hero' ? 1 : 0, goal: id === 'hero' ? 1 : 0 }]));

  const poses = {
    hero:         { x: 2.68, y:  .02, z:  .00, scale: .89, rx: -.22, ry: -.34, rz: -.10, cameraX: -.08, cameraY: .02, cameraZ: 8.05, fov: 39 },
    about:        { x: 3.18, y:  .08, z: -.75, scale: .43, rx: -.10, ry:  .16, rz: -.14, cameraX:  .08, cameraY: .03, cameraZ: 8.75, fov: 41 },
    projects:     { x: 3.12, y: -.12, z: -.58, scale: .48, rx: -.12, ry:  .26, rz: -.07, cameraX: -.05, cameraY: .02, cameraZ: 8.72, fov: 40 },
    experience:   { x: 3.36, y: -.26, z: -1.05, scale: .34, rx:  .02, ry:  .38, rz: -.08, cameraX:  .14, cameraY: .06, cameraZ: 9.12, fov: 41 },
    awards:       { x: 3.12, y:  .34, z: -.82, scale: .39, rx: -.06, ry: -.22, rz:  .08, cameraX: -.10, cameraY: .04, cameraZ: 8.88, fov: 40 },
    education:    { x: 3.28, y: -.28, z: -1.02, scale: .34, rx:  .04, ry:  .34, rz: -.05, cameraX:  .12, cameraY: .08, cameraZ: 9.18, fov: 41 },
    'side-quest': { x: 3.00, y:  .30, z: -.58, scale: .48, rx: -.08, ry: -.32, rz:  .06, cameraX: -.05, cameraY: .02, cameraZ: 8.68, fov: 40 },
    contact:      { x: 3.06, y: -.06, z: -.52, scale: .48, rx:  0,    ry:  0,    rz:  0,    cameraX:  0,    cameraY: 0,   cameraZ: 8.96, fov: 39 }
  };

  function polygon(points) {
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
    shape.closePath();
    return shape;
  }

  function rememberOpacity(material, opacity) {
    material.userData.baseOpacity = opacity;
    return material;
  }

  function glassMaterial(color, opacity = .14) {
    return rememberOpacity(new THREE.MeshPhysicalMaterial({
      color, metalness: .08, roughness: .2, clearcoat: .72, clearcoatRoughness: .2,
      transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, flatShading: true
    }), opacity);
  }

  function polishedMaterial(color, opacity = .78, emissive = 0x000000) {
    return rememberOpacity(new THREE.MeshStandardMaterial({
      color, emissive, emissiveIntensity: emissive ? .16 : 0, metalness: .46, roughness: .3,
      transparent: opacity < 1, opacity, flatShading: true
    }), opacity);
  }

  function setLayerOpacity(root, opacity) {
    if (!root) return;
    root.visible = opacity > .008;
    root.traverse(object => {
      const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      materials.forEach(material => {
        if (material.userData.baseOpacity !== undefined) material.opacity = material.userData.baseOpacity * opacity;
      });
    });
  }

  function makeExtrusion(points, color, edge, depth, bevel, frontMetalness = .38) {
    const geometry = new THREE.ExtrudeGeometry(polygon(points), {
      depth, steps: 1, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
      bevelSegments: mobile.matches ? 1 : 2, curveSegments: 1
    });
    geometry.computeVertexNormals();
    const front = new THREE.MeshPhysicalMaterial({
      color, metalness: frontMetalness, roughness: .31, clearcoat: .5,
      clearcoatRoughness: .2, flatShading: true
    });
    const sides = new THREE.MeshStandardMaterial({ color: edge, metalness: .42, roughness: .34, flatShading: true });
    const mesh = new THREE.Mesh(geometry, [front, sides]);
    if (!mobile.matches) {
      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry, 42),
        new THREE.LineBasicMaterial({ color: 0xf5f0e6, transparent: true, opacity: .62 })
      );
      outline.material.userData.baseOpacity = .62;
      mesh.add(outline);
    }
    return mesh;
  }

  function disposeContents(root) {
    if (!root) return;
    const geometries = new Set(), materials = new Set();
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

  function registerRelicPart(part, index) {
    part.userData.homePosition = part.position.clone();
    part.userData.homeScale = part.scale.clone();
    part.userData.assemblyIndex = index;
    relic.userData.parts.push(part);
  }

  function buildRelic() {
    disposeContents(relic);
    relic = new THREE.Group();
    relic.userData.parts = [];
    scene.add(relic);
    const v = [[-1.98,1.36],[-1.25,1.36],[-.56,-.67],[.12,1.36],[.84,1.36],[-.25,-1.53],[-.97,-1.53]];
    const l = [[.53,.63],[1.24,.63],[1.24,-.93],[2.07,-.93],[1.83,-1.53],[.53,-1.53]];
    const vMesh = makeExtrusion(v, 0x163ba9, 0x29246f, .63, .085, .25);
    const lMesh = makeExtrusion(l, 0xb87808, 0xad443a, .63, .085, .2);
    vMesh.position.set(-.035,.04,.16);
    lMesh.position.set(.01,-.05,.33);
    relic.add(vMesh, lMesh);
    registerRelicPart(vMesh, 0);
    registerRelicPart(lMesh, 1);
    if (!mobile.matches) {
      [
        { points: [[-2.21,.7],[-1.96,1.07],[-1.56,-1.4],[-2.19,-1.68]], color: 0x6e58bc, x: -.08, z: -.35 },
        { points: [[-.43,.38],[.08,.92],[.56,-1.24],[-.18,-1.67]], color: 0x6b78d5, x: 0, z: -.49 },
        { points: [[1.63,.22],[2.19,.45],[2.28,-1.32],[1.82,-1.55]], color: 0xe86e59, x: .09, z: -.28 }
      ].forEach((fin, index) => {
        const facet = makeExtrusion(fin.points, fin.color, 0x554677, .12, .035, .18);
        facet.position.set(fin.x, 0, fin.z);
        relic.add(facet);
        registerRelicPart(facet, index + 2);
      });
    }
    const vGleam = new THREE.Mesh(
      new THREE.ExtrudeGeometry(polygon([[-1.76,1.14],[-1.46,1.14],[-.55,-1.08],[-.73,-1.22]]), { depth: .008, bevelEnabled: false }),
      new THREE.MeshBasicMaterial({ color: 0xb7d6ff, transparent: true, opacity: .37, depthWrite: false })
    );
    vGleam.material.userData.baseOpacity = .37;
    vGleam.position.z = .89;
    const lGleam = new THREE.Mesh(
      new THREE.ExtrudeGeometry(polygon([[.7,.45],[.88,.45],[.88,-1.28],[.7,-1.28]]), { depth: .008, bevelEnabled: false }),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .4, depthWrite: false })
    );
    lGleam.material.userData.baseOpacity = .4;
    lGleam.position.z = 1.04;
    relic.add(vGleam, lGleam);
    registerRelicPart(vGleam, 5);
    registerRelicPart(lGleam, 6);
  }

  function addGlassPanel(root, width, height, color, position, rotation, opacity) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, .06), glassMaterial(color, opacity));
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    root.add(mesh);
    return mesh;
  }

  function makeProfileLayer() {
    const group = new THREE.Group();
    [
      [new THREE.OctahedronGeometry(.72, 0), 0x638aff, [-.65,.76,0], [.22,.38,.12]],
      [new THREE.BoxGeometry(1.08,.94,.5), 0x8a6bd4, [.42,.14,-.4], [-.18,.35,.18]],
      [new THREE.TetrahedronGeometry(.66, 0), 0xf0b833, [-.1,-.92,.18], [.22,-.36,-.2]]
    ].forEach(([geometry, color, position, rotation], index) => {
      const mesh = new THREE.Mesh(geometry, glassMaterial(color, index === 1 ? .12 : .18));
      mesh.position.set(...position);
      mesh.rotation.set(...rotation);
      group.add(mesh);
    });
    group.position.set(2.72, -.02, -1.55);
    return group;
  }

  function makeProjectLayer() {
    const group = new THREE.Group();
    projectMarkers = [];
    const colors = [0x3155d9,0x7048c8,0xe86e59,0xf4bf3a,0x3155d9,0x7048c8,0xe86e59];
    for (let index = 0; index < 7; index++) {
      const marker = new THREE.Group();
      const plate = new THREE.Mesh(new THREE.BoxGeometry(.48,.48,.09), glassMaterial(colors[index], .16));
      plate.rotation.z = Math.PI / 4;
      const gem = new THREE.Mesh(new THREE.DodecahedronGeometry(.21, 0), polishedMaterial(colors[index], .76, colors[index]));
      gem.position.z = .18;
      marker.add(plate, gem);
      marker.position.set((index % 2) * .62 - .3, 1.72 - index * .58, (index % 3) * -.12);
      marker.userData.gem = gem;
      projectMarkers.push(marker);
      group.add(marker);
    }
    group.position.set(3.05, -.02, -1.42);
    return group;
  }

  function makeExperienceLayer() {
    const group = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-.54,2.25,.1), new THREE.Vector3(.3,1.55,-.2),
      new THREE.Vector3(-.22,.72,.1), new THREE.Vector3(.46,-.05,-.2),
      new THREE.Vector3(-.38,-.88,.06), new THREE.Vector3(.3,-1.58,-.16),
      new THREE.Vector3(-.08,-2.24,.02)
    ]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 52, .055, 6, false), polishedMaterial(0x3155d9, .44, 0x3155d9));
    const points = curve.getPoints(64);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      rememberOpacity(new THREE.LineBasicMaterial({ color: 0xf4bf3a, transparent: true, opacity: .65 }), .65)
    );
    line.position.z = .08;
    group.add(tube, line);
    group.position.set(3.24, 0, -1.48);
    group.userData.line = line;
    group.userData.maxLinePoints = points.length;
    experienceRibbon = group;
    return group;
  }

  function makeAwardsLayer() {
    const group = new THREE.Group();
    awardEmblems = [];
    [0xf4bf3a,0x3155d9,0x7048c8,0xe86e59,0x3155d9].forEach((color, index) => {
      const emblem = new THREE.Group();
      const back = new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.1,6), glassMaterial(color,.18));
      back.rotation.x = Math.PI / 2;
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(.21,0), polishedMaterial(color,.8,color));
      core.position.z = .16;
      emblem.add(back, core);
      emblem.position.set((index % 2) * .84 - .42, 1.45 - index * .72, (index % 2) * -.18);
      emblem.userData.core = core;
      awardEmblems.push(emblem);
      group.add(emblem);
    });
    group.position.set(3.05, .02, -1.46);
    return group;
  }

  function makeEducationLayer() {
    const group = new THREE.Group();
    [0x3155d9,0x7048c8,0xf4bf3a].forEach((color,index) => {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(1.75,.18,1.05), glassMaterial(color,.13 + index * .025));
      slab.position.set((index - 1) * .18, (index - 1) * .42, -index * .13);
      slab.rotation.set(.08 + index * .03,-.24 + index * .18,-.09 + index * .08);
      group.add(slab);
    });
    const axis = new THREE.Mesh(new THREE.OctahedronGeometry(.36,0), polishedMaterial(0xe86e59,.56,0xe86e59));
    axis.position.set(.16,.08,.48);
    group.add(axis);
    group.position.set(3.04, -.05, -1.62);
    return group;
  }

  function makeSideQuestLayer() {
    const group = new THREE.Group();
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(1.35,1.55,.22,6), glassMaterial(0x7048c8,.2));
    platform.rotation.y = Math.PI / 6;
    platform.position.y = -1.25;
    const inset = new THREE.Mesh(new THREE.CylinderGeometry(.88,1.02,.12,6), polishedMaterial(0xf4bf3a,.38,0xf4bf3a));
    inset.position.y = -1.08;
    inset.rotation.y = Math.PI / 6;
    const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(.22,.82,.22), polishedMaterial(0x3155d9,.42,0x3155d9));
    const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(.22,.82,.22), polishedMaterial(0xe86e59,.42,0xe86e59));
    leftPillar.position.set(-1.02,-.78,-.28);
    rightPillar.position.set(1.02,-.78,-.28);
    group.add(platform,inset,leftPillar,rightPillar);
    group.position.set(3.02,.12,-1.34);
    return group;
  }

  function makeContactLayer() {
    const group = new THREE.Group();
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.5,.18,1.42), glassMaterial(0x3155d9,.16));
    plinth.position.y = -1.4;
    plinth.rotation.y = -.12;
    const resolveBeam = new THREE.Mesh(new THREE.BoxGeometry(.08,2.65,.08), polishedMaterial(0xf4bf3a,.3,0xf4bf3a));
    resolveBeam.position.set(-1.42,-.12,-.2);
    const quietPanel = new THREE.Mesh(new THREE.BoxGeometry(1.35,2.2,.06), glassMaterial(0x7048c8,.1));
    quietPanel.position.set(.86,.1,-.92);
    quietPanel.rotation.y = -.28;
    group.add(plinth,resolveBeam,quietPanel);
    group.position.set(3.02,0,-1.55);
    return group;
  }

  function buildEnvironment() {
    disposeContents(environment);
    environment = new THREE.Group();
    scene.add(environment);
    sectionLayers = {};
    projectMarkers = [];
    awardEmblems = [];
    experienceRibbon = null;
    const architecture = new THREE.Group();
    addGlassPanel(architecture, 3.6, 5.8, 0x3155d9, [3.76,.1,-4.3], [.05,-.28,-.08], .055);
    addGlassPanel(architecture, 2.25, 5.1, 0x7048c8, [4.72,-.55,-5.25], [-.08,.3,.13], .035);
    addGlassPanel(architecture, 2.8, 1.4, 0xf4bf3a, [2.1,-2.7,-3.7], [.1,.12,-.2], .045);
    addGlassPanel(architecture, 1.7, 1.7, 0xe86e59, [5.05,2.65,-5], [.18,-.22,.3], .05);
    environment.add(architecture);
    environment.userData.architecture = architecture;
    if (!mobile.matches) {
      sectionLayers.about = makeProfileLayer();
      sectionLayers.projects = makeProjectLayer();
      sectionLayers.experience = makeExperienceLayer();
      sectionLayers.awards = makeAwardsLayer();
      sectionLayers.education = makeEducationLayer();
      sectionLayers['side-quest'] = makeSideQuestLayer();
      sectionLayers.contact = makeContactLayer();
      Object.values(sectionLayers).forEach(group => environment.add(group));
      Object.entries(sectionLayers).forEach(([id,group]) => setLayerOpacity(group, layerState[id]?.current || 0));
    }
  }

  function moveWorldForViewport() {
    if (mobile.matches) heroVisual.insertBefore(world, heroVisual.firstChild);
    else document.body.insertBefore(world, document.querySelector('.site-header'));
  }

  function resize() {
    if (!renderer) return;
    moveWorldForViewport();
    const width = Math.max(1, Math.round(world.clientWidth));
    const height = Math.max(1, Math.round(world.clientHeight));
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile.matches ? 1.15 : 1.55));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    requestRender();
  }

  function chapterAtFocus() {
    const focus = innerHeight * (mobile.matches ? .34 : .48);
    let active = chapters[0];
    for (const chapter of chapters) {
      if (chapter.getBoundingClientRect().top <= focus) active = chapter;
      else break;
    }
    const rect = active.getBoundingClientRect();
    return { id: active.id, progress: clamp((focus - rect.top) / Math.max(1, rect.height), 0, 1) };
  }

  function updateSceneGoal() {
    scrollFrame = 0;
    const chapter = chapterAtFocus();
    sectionName = chapter.id;
    sectionProgress = chapter.progress;
    const pose = poses[chapter.id] || poses.hero;
    const progress = chapter.progress;
    goal = {
      x: (mobile.matches ? 0 : pose.x) + (mobile.matches ? 0 : (progress - .5) * .18),
      y: pose.y + (.5 - progress) * (mobile.matches ? .06 : .26),
      z: pose.z,
      scale: mobile.matches && chapter.id === 'hero' ? 1.08 : pose.scale,
      rx: pose.rx + (mobile.matches ? 0 : pointerY * .065),
      ry: pose.ry + (progress - .5) * (mobile.matches ? .08 : .24) + (mobile.matches ? 0 : pointerX * .11),
      rz: pose.rz,
      cameraX: pose.cameraX + (mobile.matches ? 0 : pointerX * .055),
      cameraY: pose.cameraY - (mobile.matches ? 0 : pointerY * .04),
      cameraZ: pose.cameraZ + progress * (mobile.matches ? 0 : .18) - (mobile.matches && chapter.id === 'hero' ? .45 : 0),
      fov: pose.fov
    };
    Object.keys(layerState).forEach(id => { layerState[id].goal = id === chapter.id ? 1 : 0; });
    document.body.dataset.arenaChapter = chapter.id;
    document.body.style.setProperty('--section-progress', progress.toFixed(4));
    requestRender();
  }

  function scheduleSceneGoal() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateSceneGoal);
  }

  function canRender() {
    return !!renderer && !reduced.matches && !document.hidden && (!mobile.matches || inViewport);
  }

  function pauseRendering() {
    if (animationHandle) cancelAnimationFrame(animationHandle);
    animationHandle = 0;
    running = false;
    lastTime = 0;
  }

  function requestRender() {
    if (!canRender() || running) return;
    running = true;
    animationHandle = requestAnimationFrame(frame);
  }

  function applyAssembly(time) {
    if (entryComplete || !relic?.userData.parts) return 0;
    const raw = clamp((time - introStarted) / 1050, 0, 1);
    const eased = 1 - Math.pow(1 - raw, 4);
    relic.userData.parts.forEach(part => {
      const home = part.userData.homePosition, homeScale = part.userData.homeScale;
      const index = part.userData.assemblyIndex;
      const local = clamp((eased * 1.2) - index * .035, 0, 1);
      part.position.set(
        home.x + (index % 2 ? 1 : -1) * (1 - local) * .72,
        home.y + (index < 2 ? .48 : -.35) * (1 - local),
        home.z - (1 - local) * 1.15
      );
      part.scale.copy(homeScale).multiplyScalar(.58 + local * .42);
    });
    if (raw >= 1) entryComplete = true;
    return 1 - raw;
  }

  function updateInteractiveObjects(weight) {
    projectMarkers.forEach((marker,index) => {
      const active = focusKind === 'project' && index === focusIndex;
      marker.scale.setScalar(mix(marker.scale.x,active ? 1.42 : 1,weight));
      marker.userData.gem.material.emissiveIntensity = mix(marker.userData.gem.material.emissiveIntensity,active ? .48 : .16,weight);
    });
    awardEmblems.forEach((emblem,index) => {
      const active = focusKind === 'award' && index === focusIndex;
      emblem.scale.setScalar(mix(emblem.scale.x,active ? 1.3 : 1,weight));
      emblem.userData.core.material.emissiveIntensity = mix(emblem.userData.core.material.emissiveIntensity,active ? .5 : .16,weight);
    });
  }

  function frame(time) {
    animationHandle = 0;
    if (!canRender()) { pauseRendering(); return; }
    const dt = lastTime ? Math.min(.05, (time - lastTime) / 1000) : 1 / 60;
    lastTime = time;
    const weight = 1 - Math.exp(-7 * dt);
    let distance = applyAssembly(time);
    Object.keys(goal).forEach(key => {
      distance += Math.abs(goal[key] - current[key]);
      current[key] = mix(current[key], goal[key], weight);
    });
    Object.entries(layerState).forEach(([id,state]) => {
      distance += Math.abs(state.goal - state.current);
      state.current = mix(state.current,state.goal,weight);
      setLayerOpacity(sectionLayers[id],state.current);
    });
    relic.position.set(current.x,current.y,current.z);
    relic.scale.setScalar(current.scale);
    relic.rotation.set(current.rx,current.ry,current.rz);
    camera.position.set(current.cameraX,current.cameraY,current.cameraZ);
    camera.fov = current.fov;
    camera.updateProjectionMatrix();
    camera.lookAt(0,0,0);
    if (environment) {
      environment.position.y = mix(environment.position.y,(.5 - sectionProgress) * .12,weight);
      environment.rotation.z = mix(environment.rotation.z,(sectionProgress - .5) * .018,weight);
      const architecture = environment.userData.architecture;
      if (architecture) architecture.rotation.y = mix(architecture.rotation.y,(sectionProgress - .5) * .045 + pointerX * .012,weight);
    }
    if (experienceRibbon) {
      const ribbonProgress = sectionName === 'experience' ? clamp(.18 + sectionProgress * .95, .18, 1) : .18;
      experienceRibbon.scale.y = mix(experienceRibbon.scale.y,ribbonProgress,weight);
      experienceRibbon.position.y = 2.05 * (1 - experienceRibbon.scale.y);
      experienceRibbon.userData.line.geometry.setDrawRange(0,Math.max(2,Math.round(experienceRibbon.userData.maxLinePoints * ribbonProgress)));
      distance += Math.abs(experienceRibbon.scale.y-ribbonProgress);
    }
    updateInteractiveObjects(weight);
    const warm = sectionName === 'side-quest' || sectionName === 'awards';
    keyLight.color.copy(warm ? lightColors.warm : lightColors.blue);
    keyLight.position.x = 2.2 + pointerX * .55;
    violetLight.intensity = sectionName === 'contact' ? .38 : .66;
    coralLight.intensity = sectionName === 'side-quest' ? .74 : .48;
    shadow.position.x = current.x;
    shadow.position.y = current.y - 1.82 * current.scale;
    shadow.scale.setScalar(.65 + current.scale * .55);
    renderer.render(scene,camera);
    if (distance < .0035 && time > introUntil) pauseRendering();
    else animationHandle = requestAnimationFrame(frame);
  }

  function makeScene() {
    THREE = window.THREE;
    const contextOptions = { alpha: true, antialias: true, powerPreference: 'high-performance' };
    const context = canvas.getContext('webgl2',contextOptions) || canvas.getContext('webgl',contextOptions);
    if (!context) return;
    try { renderer = new THREE.WebGLRenderer({ canvas, context, ...contextOptions }); }
    catch (_) { renderer = null; return; }
    renderer.setClearColor(0x000000,0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = .92;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(40,1,.1,100);
    camera.position.set(0,0,9);
    scene.add(new THREE.AmbientLight(0xffffff,.3));
    scene.add(new THREE.HemisphereLight(0xecf2ff,0x70677d,.46));
    keyLight = new THREE.DirectionalLight(0xc7ddff,1.45);
    keyLight.position.set(2,4,5);
    scene.add(keyLight);
    violetLight = new THREE.DirectionalLight(0xa68aff,.66);
    violetLight.position.set(-3,1,-2);
    scene.add(violetLight);
    coralLight = new THREE.DirectionalLight(0xffa16b,.48);
    coralLight.position.set(1,-3,3);
    scene.add(coralLight);
    lightColors = { blue: new THREE.Color(0xc7ddff), warm: new THREE.Color(0xffe5a6) };
    shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(4.8,1.1),
      new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, uniforms: { ink: { value: new THREE.Color(0x32306d) } },
        vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader: 'uniform vec3 ink; varying vec2 vUv; void main(){vec2 q=(vUv-.5)*vec2(2.0,4.0); float a=exp(-dot(q,q)*2.3)*.16; gl_FragColor=vec4(ink,a);}'
      })
    );
    shadow.position.set(baseX(),-1.9,-.7);
    scene.add(shadow);
    buildRelic();
    buildEnvironment();
    resize();
    introStarted = performance.now();
    introUntil = introStarted + 1450;
    document.body.classList.add('world-live','arena-entering');
    requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add('arena-ready')));
    setTimeout(() => document.body.classList.remove('arena-entering'),1550);
    updateSceneGoal();
    requestRender();
    window.__arenaWorld = {
      get state() { return { section: sectionName, progress: sectionProgress, running, mobile: mobile.matches, focus: [focusKind,focusIndex] }; },
      get rendererInfo() { return renderer?.info; }
    };
  }

  function updatePreference() {
    document.body.classList.toggle('world-live',!!renderer && !reduced.matches);
    document.body.classList.toggle('arena-ready',!!renderer && !reduced.matches);
    if (reduced.matches) { pauseRendering(); return; }
    if (!renderer && window.THREE) makeScene();
    else { resize(); updateSceneGoal(); }
  }

  function rebuildForBreakpoint() {
    moveWorldForViewport();
    if (!renderer) return;
    current.x = goal.x = baseX();
    entryComplete = true;
    buildRelic();
    buildEnvironment();
    resize();
    scheduleSceneGoal();
  }

  function teardown() {
    pauseRendering();
    disposeContents(relic);
    disposeContents(environment);
    if (shadow) { shadow.geometry.dispose(); shadow.material.dispose(); }
    renderer?.dispose();
  }

  moveWorldForViewport();
  if (window.THREE && !reduced.matches) makeScene();
  const viewportObserver = new IntersectionObserver(entries => {
    inViewport = entries[0].isIntersecting;
    if (canRender()) requestRender(); else pauseRendering();
  }, { threshold: .01 });
  viewportObserver.observe(world);
  addEventListener('pointermove',event => {
    if (!finePointer.matches || mobile.matches || reduced.matches || document.hidden) return;
    pointerX = clamp((event.clientX / innerWidth - .5) * 2,-1,1);
    pointerY = clamp((event.clientY / innerHeight - .5) * 2,-1,1);
    if (!pointerFrame) pointerFrame = requestAnimationFrame(() => { pointerFrame = 0; scheduleSceneGoal(); });
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave',() => { pointerX = pointerY = 0; scheduleSceneGoal(); });
  addEventListener('arena:focus',event => {
    focusKind = event.detail?.kind || '';
    focusIndex = Number.isInteger(event.detail?.index) ? event.detail.index : -1;
    requestRender();
  });
  addEventListener('scroll',scheduleSceneGoal,{ passive: true });
  addEventListener('resize',() => { resize(); scheduleSceneGoal(); },{ passive: true });
  document.addEventListener('visibilitychange',() => { if (document.hidden) pauseRendering(); else scheduleSceneGoal(); });
  reduced.addEventListener('change',updatePreference);
  mobile.addEventListener('change',rebuildForBreakpoint);
  canvas.addEventListener('webglcontextlost',event => {
    event.preventDefault();
    pauseRendering();
    document.body.classList.remove('world-live','arena-ready');
  });
  addEventListener('pagehide',pauseRendering);
  addEventListener('pageshow',scheduleSceneGoal);
  addEventListener('beforeunload',teardown,{ once: true });
})();
