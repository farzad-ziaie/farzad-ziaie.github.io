/* Interactive 3D "multi-camera rig": an animated monkey in the middle,
   8 Basler-style camera frustums around it, drag to orbit.
   Uses three.js r149 (UMD) from CDN. Degrades gracefully without WebGL. */
(function () {
  "use strict";
  var wrap = document.getElementById("rigWrap");
  if (!wrap || !window.THREE) return;

  var fallback = document.getElementById("rigFallback");

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) {
    if (fallback) fallback.style.display = "flex";
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  wrap.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  var camDist = 6.4;
  camera.position.set(0, 2.4, camDist);

  // ---- floor grid ----
  var grid = new THREE.GridHelper(9, 18, 0x1d3a5f, 0x101c33);
  grid.position.y = 0;
  scene.add(grid);

  var rig = new THREE.Group();
  scene.add(rig);

  // ---- materials ----
  var boneMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
  var jointMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
  var headMat = new THREE.MeshBasicMaterial({ color: 0xa78bfa });
  var camMat = new THREE.MeshBasicMaterial({ color: 0xf472b6, wireframe: true });
  var lineMat = new THREE.LineBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.28 });

  // ---- skeleton ----
  var jointNames = ["pelvis", "chest", "neck", "head", "shL", "elL", "haL", "shR", "elR", "haR", "hipL", "knL", "foL", "hipR", "knR", "foR"];
  var joints = {};
  jointNames.forEach(function (n) { joints[n] = new THREE.Vector3(); });

  var bones = []; // {mesh, a, b}
  function bone(a, b) {
    var geo = new THREE.CylinderGeometry(0.028, 0.028, 1, 6);
    var m = new THREE.Mesh(geo, boneMat);
    rig.add(m);
    bones.push({ mesh: m, a: a, b: b });
  }
  bone("pelvis", "chest"); bone("chest", "neck"); bone("neck", "head");
  bone("neck", "shL"); bone("shL", "elL"); bone("elL", "haL");
  bone("neck", "shR"); bone("shR", "elR"); bone("elR", "haR");
  bone("pelvis", "hipL"); bone("hipL", "knL"); bone("knL", "foL");
  bone("pelvis", "hipR"); bone("hipR", "knR"); bone("knR", "foR");

  var head = new THREE.Mesh(new THREE.SphereGeometry(0.095, 16, 12), headMat);
  rig.add(head);
  var jointMeshes = {};
  jointNames.forEach(function (n) {
    if (n === "head") return;
    var s = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), jointMat);
    rig.add(s);
    jointMeshes[n] = s;
  });

  // tail: a little curling chain of spheres behind the pelvis
  var tailMat = new THREE.MeshBasicMaterial({ color: 0xa78bfa });
  var tailMeshes = [];
  for (var ti = 0; ti < 4; ti++) {
    var ts = new THREE.Mesh(new THREE.SphereGeometry(0.028 - ti * 0.004, 8, 6), tailMat);
    rig.add(ts);
    tailMeshes.push(ts);
  }

  function placeBone(b) {
    var A = joints[b.a], B = joints[b.b];
    var mid = A.clone().add(B).multiplyScalar(0.5);
    var dir = B.clone().sub(A);
    var len = dir.length();
    b.mesh.position.copy(mid);
    b.mesh.scale.set(1, len, 1);
    b.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  }

  // ---- cameras ----
  var camGroup = new THREE.Group();
  rig.add(camGroup);
  var target = new THREE.Vector3(0, 0.95, 0.1);

  function makeLabel(text) {
    var c = document.createElement("canvas");
    c.width = 128; c.height = 36;
    var g = c.getContext("2d");
    g.font = "600 20px 'JetBrains Mono', monospace";
    g.fillStyle = "#f472b6";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 64, 18);
    var tex = new THREE.CanvasTexture(c);
    var spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    spr.scale.set(0.85, 0.24, 1);
    return spr;
  }

  var cams = [];
  var camHeights = [1.0, 1.7, 2.3, 1.3, 1.9, 2.6, 1.5, 2.1];
  for (var i = 0; i < 8; i++) {
    var ang = (i / 8) * Math.PI * 2;
    var height = camHeights[i];
    var pos = new THREE.Vector3(Math.cos(ang) * 3.3, height, Math.sin(ang) * 3.3);
    var g = new THREE.Group();
    g.position.copy(pos);
    g.lookAt(target);

    var body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.3), camMat);
    var cone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.75, 4, 1, true), camMat);
    cone.rotation.x = -Math.PI / 2;
    cone.position.z = -0.55;
    g.add(body); g.add(cone);

    var label = makeLabel("cam" + i);
    label.position.set(0, 0.32, 0);
    g.add(label);

    // sight line to subject
    var lineGeo = new THREE.BufferGeometry().setFromPoints([pos.clone(), target.clone()]);
    var line = new THREE.Line(lineGeo, lineMat);
    scene.add(line);

    camGroup.add(g);
    cams.push(g);
  }

  // ---- orbit control (manual, no extra deps) ----
  var rotY = 0.6, rotX = 0.12, tRotY = 0.6, tRotX = 0.12;
  var dragging = false, px = 0, py = 0, interacted = false;

  renderer.domElement.addEventListener("pointerdown", function (e) {
    dragging = true; interacted = true;
    px = e.clientX; py = e.clientY;
    renderer.domElement.setPointerCapture(e.pointerId);
  });
  renderer.domElement.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    tRotY += (e.clientX - px) * 0.006;
    tRotX += (e.clientY - py) * 0.004;
    tRotX = Math.max(-0.15, Math.min(0.65, tRotX));
    px = e.clientX; py = e.clientY;
  });
  renderer.domElement.addEventListener("pointerup", function () { dragging = false; });
  renderer.domElement.addEventListener("wheel", function (e) {
    e.preventDefault();
    camDist = Math.max(4, Math.min(10, camDist + e.deltaY * 0.004));
  }, { passive: false });

  function resize() {
    var w = wrap.clientWidth, h = wrap.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap);
  window.addEventListener("resize", resize);
  resize();

  // ---- animation ----
  var clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    var t = clock.getElapsedTime();

    if (!interacted) tRotY += 0.0035; // gentle auto-rotate
    rotY += (tRotY - rotY) * 0.08;
    rotX += (tRotX - rotX) * 0.08;
    rig.rotation.y = rotY;
    rig.rotation.x = rotX * 0.4;

    // pose: crouched monkey — bob, arm sway, curling tail
    var bob = Math.sin(t * 2) * 0.03;
    joints.pelvis.set(0, 0.72 + bob, 0);
    joints.chest.set(0.02, 0.98 + bob, 0.05);
    joints.neck.set(0.05, 1.14 + bob, 0.10);
    joints.head.set(0.09, 1.28 + bob, 0.15);
    joints.shL.set(-0.22, 1.10 + bob, 0.07);
    joints.shR.set(0.26, 1.10 + bob, 0.07);
    var wave = Math.sin(t * 1.6);
    joints.elL.set(-0.28, 0.86 + bob, 0.26 + wave * 0.06);
    joints.haL.set(-0.30, 0.64 + bob, 0.42 + wave * 0.10);
    joints.elR.set(0.32, 0.86 + bob, 0.26 - wave * 0.06);
    joints.haR.set(0.34, 0.64 + bob, 0.42 - wave * 0.10);
    var step = Math.sin(t * 2);
    joints.hipL.set(-0.10, 0.68 + bob, 0.02);
    joints.hipR.set(0.12, 0.68 + bob, 0.02);
    joints.knL.set(-0.13, 0.38, 0.12 + 0.04 * Math.max(0, step));
    joints.foL.set(-0.16, 0.08, 0.30 + 0.05 * Math.max(0, step));
    joints.knR.set(0.15, 0.38, 0.12 + 0.04 * Math.max(0, -step));
    joints.foR.set(0.18, 0.08, 0.30 + 0.05 * Math.max(0, -step));

    for (var k = 0; k < tailMeshes.length; k++) {
      var tt = t * 2.4 + k * 0.9;
      tailMeshes[k].position.set(
        -0.02 - k * 0.02,
        0.72 + bob - k * 0.045 + Math.sin(tt) * 0.035,
        -0.10 - k * 0.09 + Math.cos(tt * 0.7) * 0.03
      );
    }

    bones.forEach(placeBone);
    head.position.copy(joints.head);
    jointNames.forEach(function (n) {
      if (jointMeshes[n]) jointMeshes[n].position.copy(joints[n]);
    });

    // cameras slowly breathe (radius)
    var breathe = 3.3 + Math.sin(t * 0.5) * 0.12;
    cams.forEach(function (g, i) {
      var ang = (i / 8) * Math.PI * 2 + rotY * 0.0; // cams stay world-fixed
      g.position.set(Math.cos(ang) * breathe, g.position.y, Math.sin(ang) * breathe);
      g.lookAt(target);
    });

    camera.position.set(Math.sin(rotY) * camDist, 2.2 + rotX * 2, Math.cos(rotY) * camDist);
    camera.lookAt(0, 0.95, 0.05);

    renderer.render(scene, camera);
  }
  animate();
})();
