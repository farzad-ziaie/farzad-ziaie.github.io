/* Ambient spiking-neuron background.
   Nodes drift; occasional spikes flash a node and send a pulse
   along an edge to a neighbour, which may fire in turn.
   Pointer gently attracts nearby nodes and can trigger spikes. */
(function () {
  "use strict";
  var canvas = document.getElementById("bg");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var W = 0, H = 0, DPR = 1;
  var nodes = [], pulses = [];
  var mouse = { x: -9999, y: -9999 };

  var COLORS = [
    "56,225,255",   // cyan
    "167,139,250",  // violet
    "52,211,153",   // green
    "251,191,36"    // amber (rare)
  ];

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    seed();
  }

  function seed() {
    var count = Math.max(40, Math.min(110, Math.floor((W * H) / 16000)));
    nodes = [];
    for (var i = 0; i < count; i++) {
      nodes.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: 1.2 + Math.random() * 1.8,
        c: COLORS[Math.random() < 0.12 ? 3 : (Math.random() < 0.5 ? 0 : 1)],
        flash: 0
      });
    }
  }

  function neighbors(n, maxD) {
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i] === n) continue;
      var dx = nodes[i].x - n.x, dy = nodes[i].y - n.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < maxD) out.push({ node: nodes[i], d: d });
    }
    return out;
  }

  function spawnPulse(from) {
    var ns = neighbors(from, 150);
    if (!ns.length) return;
    var to = ns[Math.floor(Math.random() * ns.length)].node;
    pulses.push({ a: from, b: to, t: 0, dur: 34 + Math.random() * 22 });
    from.flash = 1;
  }

  function fireRandom() {
    var n = nodes[Math.floor(Math.random() * nodes.length)];
    spawnPulse(n);
  }

  var lastPulse = 0;

  function frame(ts, schedule) {
    ctx.clearRect(0, 0, W, H);

    // update nodes
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      n.x += n.vx;
      n.y += n.vy;

      // gentle attraction to pointer + soft bounds
      var dx = mouse.x - n.x, dy = mouse.y - n.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < 160 && d > 1) {
        n.x += (dx / d) * 0.35;
        n.y += (dy / d) * 0.35;
        if (Math.random() < 0.004 && d < 90) n.flash = 1;
      }
      if (n.x < -20) n.x = W + 20; if (n.x > W + 20) n.x = -20;
      if (n.y < -20) n.y = H + 20; if (n.y > H + 20) n.y = -20;
      if (n.flash > 0) n.flash = Math.max(0, n.flash - 0.03);
    }

    // occasional spontaneous spike
    if (ts - lastPulse > 320 + Math.random() * 500) {
      fireRandom();
      lastPulse = ts;
    }

    // edges
    ctx.lineWidth = 1;
    for (i = 0; i < nodes.length; i++) {
      var a = nodes[i];
      for (var j = i + 1; j < nodes.length; j++) {
        var b = nodes[j];
        var ddx = b.x - a.x, ddy = b.y - a.y;
        var dd = Math.sqrt(ddx * ddx + ddy * ddy);
        if (dd < 140) {
          ctx.strokeStyle = "rgba(110,150,255," + ((1 - dd / 140) * 0.16).toFixed(3) + ")";
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // pulses travelling along edges
    for (i = pulses.length - 1; i >= 0; i--) {
      var p = pulses[i];
      p.t++;
      var k = p.t / p.dur;
      if (k >= 1) {
        p.b.flash = 1;
        if (Math.random() < 0.55) spawnPulse(p.b); // chain
        pulses.splice(i, 1);
        continue;
      }
      var px = p.a.x + (p.b.x - p.a.x) * k;
      var py = p.a.y + (p.b.y - p.a.y) * k;
      ctx.fillStyle = "rgba(251,191,36," + (0.9 * (1 - k * 0.4)).toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(px, py, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(251,191,36," + (0.35 * (1 - k)).toFixed(3) + ")";
      ctx.beginPath();
      ctx.moveTo(p.a.x, p.a.y);
      ctx.lineTo(px, py);
      ctx.stroke();
    }

    // nodes
    for (i = 0; i < nodes.length; i++) {
      var nd = nodes[i];
      var r = nd.r + nd.flash * 2.4;
      ctx.fillStyle = "rgba(" + nd.c + "," + (0.55 + nd.flash * 0.45).toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(nd.x, nd.y, r, 0, Math.PI * 2);
      ctx.fill();
      if (nd.flash > 0.05) {
        ctx.strokeStyle = "rgba(" + nd.c + "," + (nd.flash * 0.5).toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(nd.x, nd.y, r + 5 + (1 - nd.flash) * 8, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (schedule !== false) requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", function (e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  window.addEventListener("pointerleave", function () {
    mouse.x = -9999; mouse.y = -9999;
  });

  resize();
  if (reduced) {
    frame(0, false); // one static frame, no loop
  } else {
    requestAnimationFrame(frame);
  }

  // exposed for debugging / tests
  window.__bg = {
    nodes: function () { return nodes.length; },
    pulses: function () { return pulses.length; },
    drawOnce: function () { frame(performance.now(), false); }
  };
})();
