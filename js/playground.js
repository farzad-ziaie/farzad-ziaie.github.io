/* Playground: 5 client-side demos.
   1. digit  — draw a digit, k-NN (k=7) against an MNIST subset fetched from CDN
   2. fam    — FAITHFUL port of github.com/farzad-ziaie/fuzzyart (FuzzyARTMAP, fam.py):
               complement coding, choice T_j, vigilance/match tracking, beta learning
   3. mopso  — FAITHFUL port of github.com/farzad-ziaie/mopso (mopso.py, Coello Coello 2002):
               velocity update, Pareto domination, hyper-grid archive, roulette leader,
               pruning, inertia damping
   4. net    — train a 2-16-16-1 MLP live on 2D datasets
   5. spikes — simulated Poisson spike trains + live PSTH
   Everything vanilla JS, no backend. */
(function () {
  "use strict";

  /* ---------------- tabs ---------------- */
  var tabs = document.querySelectorAll("#pgTabs .tab");
  var panels = {
    digit: document.getElementById("pg-digit"),
    fam: document.getElementById("pg-fam"),
    mopso: document.getElementById("pg-mopso"),
    net: document.getElementById("pg-net"),
    spikes: document.getElementById("pg-spikes")
  };
  var inited = { digit: false, fam: false, mopso: false, net: false, spikes: false };

  function activate(name) {
    tabs.forEach(function (t) { t.classList.toggle("active", t.getAttribute("data-tab") === name); });
    Object.keys(panels).forEach(function (k) { panels[k].classList.toggle("active", k === name); });
    if (name === "digit" && !inited.digit) { inited.digit = true; DigitDemo.init(); }
    if (name === "fam" && !inited.fam) { inited.fam = true; FamDemo.init(); }
    if (name === "mopso" && !inited.mopso) { inited.mopso = true; MopsoDemo.init(); }
    if (name === "net" && !inited.net) { inited.net = true; NetDemo.init(); }
    if (name === "spikes" && !inited.spikes) { inited.spikes = true; SpikeDemo.init(); }
  }
  tabs.forEach(function (t) { t.addEventListener("click", function () { activate(t.getAttribute("data-tab")); }); });

  // the "live port ↓" links on the project cards jump to the matching demo
  document.querySelectorAll(".demo-link").forEach(function (a) {
    a.addEventListener("click", function () { activate(a.getAttribute("data-demo") || "fam"); });
  });

  /* ================================================================
     1. DIGIT — k-NN on MNIST
     ================================================================ */
  var DigitDemo = {
    DIM: 14, PER: 30, K: 7,
    X: null, Y: "", n: 0,
    canvas: null, ctx: null, drawing: false, last: null,
    status: null, bars: null,

    init: function () {
      var self = this;
      this.canvas = document.getElementById("drawCanvas");
      this.ctx = this.canvas.getContext("2d");
      this.status = document.getElementById("drawStatus");
      this.bars = document.getElementById("predBars");
      this.clear();
      this.buildBars();
      this.load().then(function () {
        self.status.textContent = "ready — draw a digit (0–9). k-NN, k=" + self.K + ", " + self.n + " samples";
        self.sample();
      }).catch(function (err) {
        self.status.textContent = "could not load MNIST subset (" + err + ") — check your connection";
      });

      var pos = function (e) {
        var r = self.canvas.getBoundingClientRect();
        return {
          x: (e.clientX - r.left) * (self.canvas.width / r.width),
          y: (e.clientY - r.top) * (self.canvas.height / r.height)
        };
      };
      this.canvas.addEventListener("pointerdown", function (e) {
        self.drawing = true;
        self.last = pos(e);
        self.canvas.setPointerCapture(e.pointerId);
        self.plot(self.last);
      });
      this.canvas.addEventListener("pointermove", function (e) {
        if (!self.drawing) return;
        var p = pos(e);
        self.ctx.strokeStyle = "#fff";
        self.ctx.lineWidth = 22;
        self.ctx.lineCap = "round";
        self.ctx.lineJoin = "round";
        self.ctx.shadowColor = "rgba(56,225,255,0.8)";
        self.ctx.shadowBlur = 12;
        self.ctx.beginPath();
        self.ctx.moveTo(self.last.x, self.last.y);
        self.ctx.lineTo(p.x, p.y);
        self.ctx.stroke();
        self.ctx.shadowBlur = 0;
        self.last = p;
      });
      var done = function () {
        if (!self.drawing) return;
        self.drawing = false;
        self.classifyCanvas();
      };
      this.canvas.addEventListener("pointerup", done);
      this.canvas.addEventListener("pointercancel", done);

      document.getElementById("btnClear").addEventListener("click", function () { self.clear(); self.buildBars(); });
      document.getElementById("btnSample").addEventListener("click", function () { self.sample(); });
    },

    clear: function () {
      this.ctx.fillStyle = "#05080f";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    },

    buildBars: function () {
      this.bars.innerHTML = "";
      for (var d = 0; d < 10; d++) {
        var row = document.createElement("div");
        row.className = "pred-row";
        row.innerHTML = "<span>" + d + "</span><div class='bar'><i></i></div><span class='pct'>–</span>";
        this.bars.appendChild(row);
      }
    },

    // fetch one digit file (Range fast-path, full-file fallback), take PER images, quantize to 14x14
    loadDigit: async function (d) {
      var url = "https://cdn.jsdelivr.net/npm/mnist@1.1.0/src/digits/" + d + ".json";
      var data = null;
      try {
        var r = await fetch(url, { headers: { Range: "bytes=0-240000" } });
        if (r.ok) {
          var t = await r.text();
          t = t.replace(/,\s*$/, "") + "]}";
          var j = JSON.parse(t);
          if (j && j.data && j.data.length >= this.PER * 784) data = j.data;
        }
      } catch (e) { /* fall through to full fetch */ }
      if (!data) {
        var r2 = await fetch(url);
        if (!r2.ok) throw new Error("HTTP " + r2.status);
        data = (await r2.json()).data;
      }
      var out = new Uint8Array(this.PER * 196);
      for (var img = 0; img < this.PER; img++) {
        var base = img * 784;
        for (var y = 0; y < 14; y++) for (var x = 0; x < 14; x++) {
          var s = Math.round(data[base + (y * 2) * 28 + x * 2] * 255)
                + Math.round(data[base + (y * 2) * 28 + x * 2 + 1] * 255)
                + Math.round(data[base + (y * 2 + 1) * 28 + x * 2] * 255)
                + Math.round(data[base + (y * 2 + 1) * 28 + x * 2 + 1] * 255);
          out[img * 196 + y * 14 + x] = s >> 2;
        }
      }
      return out;
    },

    load: async function () {
      var self = this;
      var parts = [];
      for (var d = 0; d < 10; d++) {
        this.status.textContent = "loading mnist subset… " + (d + 1) + "/10";
        parts.push(await this.loadDigit(d));
        for (var i = 0; i < this.PER; i++) this.Y += d;
      }
      var total = 10 * this.PER * 196;
      this.X = new Uint8Array(total);
      var off = 0;
      parts.forEach(function (p) { self.X.set(p, off); off += p.length; });
      this.n = 10 * this.PER;
    },

    // canvas 280x280 -> 28x28 -> centroid shift -> 14x14 vec
    vecFromCanvas: function () {
      var img = this.ctx.getImageData(0, 0, 280, 280).data;
      var g = new Float32Array(784);
      for (var y = 0; y < 28; y++) for (var x = 0; x < 28; x++) {
        var s = 0;
        for (var dy = 0; dy < 10; dy++) for (var dx = 0; dx < 10; dx++) {
          s += img[((y * 10 + dy) * 280 + (x * 10 + dx)) * 4]; // red channel
        }
        g[y * 28 + x] = s / 100;
      }
      // centroid of mass
      var sx = 0, sy = 0, sw = 0;
      for (y = 0; y < 28; y++) for (x = 0; x < 28; x++) {
        var w = g[y * 28 + x] / 255;
        sx += x * w; sy += y * w; sw += w;
      }
      if (sw > 0.001) {
        var shX = Math.round(14 - sx / sw), shY = Math.round(14 - sy / sw);
        var g2 = new Float32Array(784);
        for (y = 0; y < 28; y++) for (x = 0; x < 28; x++) {
          var nx = x + shX, ny = y + shY;
          if (nx >= 0 && nx < 28 && ny >= 0 && ny < 28) g2[ny * 28 + nx] = g[y * 28 + x];
        }
        g = g2;
      }
      // downsample to 14x14
      var v = new Uint8Array(196);
      for (y = 0; y < 14; y++) for (x = 0; x < 14; x++) {
        var s2 = g[(y * 2) * 28 + x * 2] + g[(y * 2) * 28 + x * 2 + 1] + g[(y * 2 + 1) * 28 + x * 2] + g[(y * 2 + 1) * 28 + x * 2 + 1];
        v[y * 14 + x] = s2 / 4;
      }
      return v;
    },

    knn: function (v) {
      var dists = new Float64Array(this.n);
      for (var i = 0; i < this.n; i++) {
        var off = i * 196, s = 0;
        for (var p = 0; p < 196; p++) {
          var d = this.X[off + p] - v[p];
          s += d * d;
        }
        dists[i] = s;
      }
      var idx = [];
      for (i = 0; i < this.n; i++) idx.push(i);
      idx.sort(function (a, b) { return dists[a] - dists[b]; });
      var votes = new Array(10).fill(0);
      for (i = 0; i < this.K; i++) {
        var lab = +this.Y[idx[i]];
        votes[lab] += 1 / (dists[idx[i]] + 1e-9);
      }
      var tot = votes.reduce(function (a, b) { return a + b; }, 0) || 1;
      return votes.map(function (vv) { return vv / tot; });
    },

    show: function (conf) {
      var rows = this.bars.children;
      var best = 0;
      for (var d = 0; d < 10; d++) if (conf[d] > conf[best]) best = d;
      for (d = 0; d < 10; d++) {
        rows[d].querySelector(".bar i").style.width = (conf[d] * 100).toFixed(1) + "%";
        rows[d].querySelector(".pct").textContent = (conf[d] * 100).toFixed(0) + "%";
        rows[d].classList.toggle("top", d === best && conf[best] > 0.02);
      }
    },

    classifyCanvas: function () {
      if (!this.X) return;
      this.show(this.knn(this.vecFromCanvas()));
    },

    sample: function () {
      if (!this.X) return;
      var i = Math.floor(Math.random() * this.n);
      var v = this.X.subarray(i * 196, (i + 1) * 196);
      // render 14x14 -> 280x280 blocky
      var tmp = document.createElement("canvas");
      tmp.width = 14; tmp.height = 14;
      var tc = tmp.getContext("2d");
      var im = tc.createImageData(14, 14);
      for (var p = 0; p < 196; p++) {
        var val = v[p];
        im.data[p * 4] = val; im.data[p * 4 + 1] = val; im.data[p * 4 + 2] = val; im.data[p * 4 + 3] = 255;
      }
      tc.putImageData(im, 0, 0);
      this.clear();
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.drawImage(tmp, 0, 0, 280, 280);
      this.show(this.knn(v));
      this.status.textContent = "sample #" + i + " (label " + this.Y[i] + ") — now draw your own";
    }
  };

  /* ================================================================
     2. FAM — faithful JS port of fuzzyart's FuzzyARTMAP (fam.py)
     ----------------------------------------------------------------
     complement_code: A = [u, v, 1-u, 1-v]          (M = 2*n_features = 4)
     choice:   T_j = |A∧W_j|_1 + (1-alpha)*(M - |W_j|_1),  alpha = 0.01
     candidates: T_j > alpha*M, visited in descending T order
     match:    |A∧W_j|_1 / M  >= rho
     match tracking (label mismatch): rho = match + |epsilon|, eps = -0.001
     learning: W_j = beta*(A∧W_j) + (1-beta)*W_j,  beta = 0.2
     new node: W = A.copy()
     ================================================================ */
  var FamDemo = {
    ALPHA: 0.01, BETA: 0.2, EPS: -0.001, M: 4, // 2 features -> M = 2*2
    W: [],        // weight vectors (complement-coded, length 4)
    Wab: [],      // class label per F2 node
    pts: [],      // input points {u,v,cls}
    rhoBase: 0.40,
    cls: "A",
    canvas: null, ctx: null,

    CLASS_COLORS: { A: "#38e1ff", B: "#f472b6", C: "#fbbf24" },

    init: function () {
      var self = this;
      this.canvas = document.getElementById("famCanvas");
      this.ctx = this.canvas.getContext("2d");
      this.canvas.addEventListener("pointerdown", function (e) {
        var r = self.canvas.getBoundingClientRect();
        var u = (e.clientX - r.left) / r.width;
        var v = 1 - (e.clientY - r.top) / r.height;
        self.addPoint(u, v);
      });
      var slider = document.getElementById("famRho");
      slider.addEventListener("input", function () {
        self.rhoBase = +slider.value;
        document.getElementById("famRhoOut").textContent = self.rhoBase.toFixed(2);
      });
      document.querySelectorAll("#famClasses .chip").forEach(function (chip) {
        chip.addEventListener("click", function () {
          document.querySelectorAll("#famClasses .chip").forEach(function (c) { c.classList.remove("active"); });
          chip.classList.add("active");
          self.cls = chip.getAttribute("data-cls");
        });
      });
      document.getElementById("btnFamReset").addEventListener("click", function () { self.reset(); });
      document.getElementById("btnFamScatter").addEventListener("click", function () { self.scatter(20); });
      this.draw();
      this.stats();
    },

    /* ----- fuzzyart.utils.math ----- */
    complement: function (a) { return a.concat(a.map(function (x) { return 1 - x; })); }, // complement_code
    fuzzyAnd: function (a, w) { // element-wise min
      var out = new Array(a.length);
      for (var i = 0; i < a.length; i++) out[i] = Math.min(a[i], w[i]);
      return out;
    },
    l1: function (a) { var s = 0; for (var i = 0; i < a.length; i++) s += Math.abs(a[i]); return s; },

    /* ----- fam.py internals ----- */
    signals: function (A) { // T_j for every node
      var T = new Array(this.W.length);
      for (var j = 0; j < this.W.length; j++) {
        T[j] = this.l1(this.fuzzyAnd(A, this.W[j])) + (1 - this.ALPHA) * (this.M - this.l1(this.W[j]));
      }
      return T;
    },
    matchScore: function (A, j) { return this.l1(this.fuzzyAnd(A, this.W[j])) / this.M; },
    addNode: function (A, k) { this.W.push(A.slice()); this.Wab.push(k); },

    // _train_one: returns log string
    trainOne: function (u, v, k) {
      var A = this.complement([u, v]);
      var rho = this.rhoBase;
      var log;
      if (this.W.length === 0) {
        this.addNode(A, k);
        return "new F2 node 0 (class " + k + ") — W = A";
      }
      var T = this.signals(A);
      var order = T.map(function (t, j) { return j; }).sort(function (a, b) { return T[b] - T[a]; }); // flip(argsort(T))
      var candidates = order.filter(function (j) { return T[j] > this.ALPHA * this.M; }, this);
      if (candidates.length === 0) {
        this.addNode(A, k);
        return "no candidate with T > α·M → new F2 node " + (this.W.length - 1) + " (class " + k + ")";
      }
      var committed = false, mt = "";
      for (var ci = 0; ci < candidates.length; ci++) {
        var j = candidates[ci];
        var m = this.matchScore(A, j);
        if (m >= rho) {
          if (this.Wab[j] === k || this.Wab[j] == null) {
            this.Wab[j] = k;
            var fa = this.fuzzyAnd(A, this.W[j]);
            for (var i = 0; i < fa.length; i++) this.W[j][i] = this.BETA * fa[i] + (1 - this.BETA) * this.W[j][i];
            committed = true;
            log = (mt ? mt + " → " : "") + "resonance F2." + j + " (match " + m.toFixed(3) + " ≥ ρ " + rho.toFixed(3) +
                  ", class " + k + ") → W ← β(A∧W)+(1−β)W";
            break;
          } else {
            rho = m + Math.abs(this.EPS); // match tracking
            mt = "label conflict at F2." + j + " → ρ = match+|ε| = " + rho.toFixed(4);
          }
        }
      }
      if (!committed) {
        this.addNode(A, k);
        log = (mt ? mt + " → " : "") + "no resonance → new F2 node " + (this.W.length - 1) + " (class " + k + ")";
      }
      return log;
    },

    // _predict_one
    predictOne: function (A) {
      if (this.W.length === 0) return "–";
      var T = this.signals(A);
      var order = T.map(function (t, j) { return j; }).sort(function (a, b) { return T[b] - T[a]; });
      var candidates = order.filter(function (j) { return T[j] > this.ALPHA * this.M; }, this);
      if (candidates.length === 0) {
        var best = 0;
        for (var j = 1; j < T.length; j++) if (T[j] > T[best]) best = j;
        return this.Wab[best];
      }
      return this.Wab[candidates[0]];
    },

    /* ----- UI ----- */
    addPoint: function (u, v) {
      u = Math.min(0.99, Math.max(0.01, u));
      v = Math.min(0.99, Math.max(0.01, v));
      var log = this.trainOne(u, v, this.cls);
      var pred = this.predictOne(this.complement([u, v]));
      this.pts.push({ u: u, v: v, cls: this.cls });
      document.getElementById("famLog").textContent = log + " · predict: " + pred;
      this.draw();
      this.stats();
    },

    scatter: function (n) {
      var self = this, i = 0;
      // cluster around a random center so category boxes visibly grow
      var cu = 0.15 + Math.random() * 0.7, cv = 0.15 + Math.random() * 0.7;
      function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; }
      var iv = setInterval(function () {
        self.addPoint(cu + gauss() * 0.14, cv + gauss() * 0.14);
        if (++i >= n) clearInterval(iv);
      }, 24);
    },

    reset: function () {
      this.W = []; this.Wab = []; this.pts = [];
      document.getElementById("famLog").textContent = "—";
      this.draw();
      this.stats();
    },

    stats: function () {
      document.getElementById("famNodes").textContent = this.W.length;
      document.getElementById("famCount").textContent = this.pts.length;
    },

    color: function (cls) { return this.CLASS_COLORS[cls] || "#e6ecf8"; },

    draw: function () {
      var c = this.ctx, W = this.canvas.width, H = this.canvas.height;
      var pad = 30;
      var mx = function (u) { return pad + u * (W - 2 * pad); };
      var my = function (v) { return H - pad - v * (H - 2 * pad); };
      c.fillStyle = "#05080f";
      c.fillRect(0, 0, W, H);
      // grid + axes
      c.strokeStyle = "rgba(120,160,255,0.07)";
      c.lineWidth = 1;
      c.font = "10px 'JetBrains Mono', monospace";
      c.fillStyle = "#8b96b3";
      for (var gx = 0; gx <= 10; gx++) {
        c.beginPath(); c.moveTo(mx(gx / 10), pad); c.lineTo(mx(gx / 10), H - pad); c.stroke();
        c.beginPath(); c.moveTo(pad, my(gx / 10)); c.lineTo(W - pad, my(gx / 10)); c.stroke();
        c.fillText((gx / 10).toFixed(1), mx(gx / 10) - 8, H - pad + 14);
        c.fillText((gx / 10).toFixed(1), 8, my(gx / 10) + 3);
      }
      c.fillText("u", W - pad - 6, H - pad + 14);
      c.fillText("v", 8, pad - 8);

      // F2 category boxes: u in [1-w2, w0], v in [1-w3, w1]
      for (var j = 0; j < this.W.length; j++) {
        var w = this.W[j], col = this.color(this.Wab[j]);
        var x0 = mx(1 - w[2]), x1 = mx(w[0]);
        var y0 = my(w[1]), y1 = my(1 - w[3]);
        c.fillStyle = col + "22";
        c.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
        c.strokeStyle = col + "aa";
        c.lineWidth = 1.4;
        c.strokeRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
        c.fillStyle = col;
        c.font = "11px 'JetBrains Mono', monospace";
        c.fillText("F2." + j + "·" + this.Wab[j], Math.min(x0 + 4, W - 74), Math.max(y0 + 13, 12));
      }
      // input points
      for (var i = 0; i < this.pts.length; i++) {
        var p = this.pts[i];
        c.fillStyle = this.color(p.cls);
        c.beginPath();
        c.arc(mx(p.u), my(p.v), 3.4, 0, Math.PI * 2);
        c.fill();
      }
    }
  };

  /* ================================================================
     3. MOPSO — faithful JS port of mopso.py (Coello Coello & Lechuga 2002)
     ----------------------------------------------------------------
     v = w*v + c1*r1*(pbest-x) + c2*r2*(leader.best-x);  x += v
     dominates(x,y): all(x<=y) && any(x<y)            (on cost vectors)
     grid: per-objective linspace(min-alpha*dc, max+alpha*dc, nGrid+1)
     leader: cell roulette p=exp(-beta*dups), random member of that cell
     archive: add non-dominated, re-dominate, prune to nrepo via exp(-gamma*dups)
     w *= wdamp every iteration
     ================================================================ */
  var MopsoDemo = {
    npop: 100, wdamp: 0.99, beta: 0.5, gamma: 0.5, alpha: 0.1,
    prob: "schaffer",
    pop: [], repo: [], grid: [], iter: 0, running: false,
    w: 0.2, c1: 0.1, c2: 0.1, nrepo: 50, ngrid: 10,
    canvas: null, ctx: null,

    problems: {
      schaffer: {
        label: "schaffer N.1 — f1=x², f2=(x−2)²",
        nvar: 1,
        cost: function (x) { return [x[0] * x[0], (x[0] - 2) * (x[0] - 2)]; }
      },
      zdt1: {
        label: "ZDT1 — f1=x₁, f2=g·(1−√(f1/g))",
        nvar: 3,
        cost: function (x) {
          var f1 = x[0], s = 0;
          for (var i = 1; i < x.length; i++) s += x[i];
          var g = 1 + 9 * s / (x.length - 1);
          var r = Math.min(1, Math.max(0, f1 / g)); // guard sqrt domain
          return [f1, g * (1 - Math.sqrt(r))];
        }
      },
      default3: {
        label: "mopso default cost — z1=Σx², z2=Σx⁴, z3=Σx⁶ (plot f1–f2, colour=f3)",
        nvar: 3,
        cost: function (x) {
          var z1 = 0, z2 = 0, z3 = 0;
          for (var i = 0; i < x.length; i++) {
            var x2 = x[i] * x[i];
            z1 += x2; z2 += x2 * x2; z3 += x2 * x2 * x2;
          }
          return [z1, z2, z3];
        }
      }
    },

    init: function () {
      var self = this;
      this.canvas = document.getElementById("mopsoCanvas");
      this.ctx = this.canvas.getContext("2d");

      document.querySelectorAll("#mopsoProblems .chip").forEach(function (chip) {
        chip.addEventListener("click", function () {
          document.querySelectorAll("#mopsoProblems .chip").forEach(function (c) { c.classList.remove("active"); });
          chip.classList.add("active");
          self.prob = chip.getAttribute("data-prob");
          self.reset();
        });
      });
      function bind(id, outId, fmt, cb) {
        var s = document.getElementById(id), out = document.getElementById(outId);
        s.addEventListener("input", function () {
          var v = +s.value;
          out.textContent = fmt(v);
          cb(v);
        });
      }
      bind("mW", "mWOut", function (v) { return v.toFixed(2); }, function (v) { self.w = v; self.statW(); });
      bind("mC1", "mC1Out", function (v) { return v.toFixed(2); }, function (v) { self.c1 = v; });
      bind("mC2", "mC2Out", function (v) { return v.toFixed(2); }, function (v) { self.c2 = v; });
      bind("mRepo", "mRepoOut", function (v) { return v; }, function (v) { self.nrepo = v; });
      bind("mGrid", "mGridOut", function (v) { return v; }, function (v) { self.ngrid = v; });

      var btnRun = document.getElementById("btnMopsoRun");
      btnRun.addEventListener("click", function () {
        self.running = !self.running;
        btnRun.textContent = self.running ? "pause" : "run";
      });
      document.getElementById("btnMopsoStep").addEventListener("click", function () { self.iterate(); self.draw(); self.stats(); });
      document.getElementById("btnMopsoReset").addEventListener("click", function () { self.reset(); });

      this.reset();
      this.loop();
    },

    /* ----- mopso.py helpers ----- */
    rand: function () { return Math.random(); },

    // random_generator(): rows of U(-1,1)^w, row order shuffled (varmin/varmax stored but unused, as in mopso.py)
    randomGenerator: function (h, w) {
      var rows = [];
      for (var i = 0; i < h; i++) {
        var row = [];
        for (var j = 0; j < w; j++) row.push(2 * (Math.random() - 0.5));
        rows.push(row);
      }
      for (var k = rows.length - 1; k > 0; k--) { // shuffle
        var m = Math.floor(Math.random() * (k + 1));
        var tmp = rows[k]; rows[k] = rows[m]; rows[m] = tmp;
      }
      return rows;
    },

    cost: function (x) { return this.problems[this.prob].cost(x); },

    // _dominates: all(x<=y) && any(x<y)
    dominates: function (x, y) {
      var all = true, any = false;
      for (var i = 0; i < x.length; i++) {
        if (x[i] > y[i]) all = false;
        if (x[i] < y[i]) any = true;
      }
      return all && any;
    },

    determineDomination: function (pops) {
      var n = pops.length;
      for (var i = 0; i < n; i++) pops[i].isdominated = false;
      for (i = 0; i < n - 1; i++) {
        for (var j = i + 1; j < n; j++) {
          if (this.dominates(pops[i].cost, pops[j].cost)) pops[j].isdominated = true;
          if (this.dominates(pops[j].cost, pops[i].cost)) pops[i].isdominated = true;
        }
      }
      return pops;
    },

    linspace: function (a, b, n) {
      var out = [];
      for (var i = 0; i < n; i++) out.push(a + (b - a) * i / (n - 1));
      return out;
    },

    // _CreateGrid
    createGrid: function (repo) {
      var nObj = this.repo.length ? repo[0].cost.length : 2;
      var min = [], max = [];
      for (var j = 0; j < nObj; j++) { min.push(Infinity); max.push(-Infinity); }
      repo.forEach(function (p) {
        for (var j = 0; j < nObj; j++) {
          if (p.cost[j] < min[j]) min[j] = p.cost[j];
          if (p.cost[j] > max[j]) max[j] = p.cost[j];
        }
      });
      var grid = [];
      for (j = 0; j < nObj; j++) {
        var dc = max[j] - min[j];
        var cuts = this.linspace(min[j] - this.alpha * dc, max[j] + this.alpha * dc, this.ngrid + 1);
        grid.push({ upper: cuts.concat([Infinity]) }); // lower bands not needed for Ccompare
      }
      return grid;
    },

    // Ccompare: first index in upper[] whose value is > a
    ccompare: function (a, upper) {
      for (var j = 0; j < upper.length; j++) if (a < upper[j]) return j;
      return upper.length;
    },

    // _find_grid_index: mixed-radix encoding of the per-objective sub-indices
    findGridIndex: function (p, grid) {
      var sub = new Array(grid.length);
      for (var j = 0; j < grid.length; j++) sub[j] = this.ccompare(p.cost[j], grid[j].upper);
      var gi = sub[0];
      for (j = 1; j < grid.length; j++) gi = (gi - 1) * (this.ngrid + 2) + sub[j];
      p.gridsubindex = sub;
      p.gridindex = gi;
      return p;
    },

    // _roulette_wheel_selection
    roulette: function (p) {
      var r = Math.random();
      var keys = Object.keys(p);
      var vals = keys.map(function (k) { return p[k]; });
      var sum = vals.reduce(function (a, b) { return a + b; }, 0) || 1;
      var ci = 0;
      for (var i = 0; i < keys.length; i++) {
        ci += vals[i] / sum;
        if (r <= ci) return keys[i];
      }
      return keys[0];
    },

    // _leader_selection: cell probabilities exp(-beta*dups), then a member of that cell
    leaderSelection: function (repo) {
      var counts = {};
      repo.forEach(function (p) { counts[p.gridindex] = (counts[p.gridindex] || 0) + 1; });
      var p = {};
      Object.keys(counts).forEach(function (k) { p[k] = Math.exp(-this.beta * counts[k]); }, this);
      var sci = this.roulette(p);
      var n = 0;
      repo.forEach(function (p) { if (String(p.gridindex) === String(sci)) n++; });
      // as in mopso.py: repo[randint(n)]
      return repo[Math.floor(Math.random() * Math.max(1, n))];
    },

    // _detelte_rep_mem: prune one member from a crowded cell chosen by exp(-gamma*dups)
    deleteRepMem: function (repo) {
      var counts = {};
      repo.forEach(function (p) { counts[p.gridindex] = (counts[p.gridindex] || 0) + 1; });
      var p = {};
      Object.keys(counts).forEach(function (k) { p[k] = Math.exp(-this.gamma * counts[k]); }, this);
      var sci = this.roulette(p);
      var n = 0;
      repo.forEach(function (p) { if (String(p.gridindex) === String(sci)) n++; });
      repo.splice(Math.floor(Math.random() * Math.max(1, n)), 1);
      return repo;
    },

    /* ----- lifecycle ----- */
    reset: function () {
      var self = this;
      var prob = this.problems[this.prob];
      var pos = this.randomGenerator(this.npop, prob.nvar);
      this.pop = [];
      for (var i = 0; i < this.npop; i++) {
        var c = this.cost(pos[i]);
        this.pop.push({
          position: pos[i],
          velocity: pos[i].map(function () { return 0; }),
          cost: c,
          best_position: pos[i].slice(),
          best_cost: c.slice(),
          isdominated: false,
          gridindex: 0, gridsubindex: []
        });
      }
      this.pop = this.determineDomination(this.pop);
      this.repo = this.pop.filter(function (p) { return !p.isdominated; });
      this.grid = this.createGrid(this.repo);
      this.repo.forEach(function (p) { self.findGridIndex(p, self.grid); });
      this.iter = 0;
      this.w = +document.getElementById("mW").value;
      this.c1 = +document.getElementById("mC1").value;
      this.c2 = +document.getElementById("mC2").value;
      this.nrepo = +document.getElementById("mRepo").value;
      this.ngrid = +document.getElementById("mGrid").value;
      this.draw();
      this.stats();
    },

    // one fit() iteration from mopso.py
    iterate: function () {
      var self = this;
      var prob = this.problems[this.prob];
      var nvar = prob.nvar;
      for (var i = 0; i < this.npop; i++) {
        var leader = this.leaderSelection(this.repo);
        var p = this.pop[i];
        // _update_velocity_pos
        for (var d = 0; d < nvar; d++) {
          p.velocity[d] = this.w * p.velocity[d]
            + this.c1 * Math.random() * (p.best_position[d] - p.position[d])
            + this.c2 * Math.random() * (leader.best_position[d] - p.position[d]);
          p.position[d] = p.position[d] + p.velocity[d];
        }
        p.cost = this.cost(p.position);
        this.pop = this.determineDomination(this.pop);
        // pbest update (as in mopso.py: _dominates is called on the positions)
        if (this.dominates(p.position, p.best_position)) {
          p.best_position = p.position.slice();
          p.best_cost = p.cost.slice();
        } else if (!this.dominates(p.best_position, p.position)) {
          if (Math.random() < 0.5) {
            p.best_position = p.position.slice();
            p.best_cost = p.cost.slice();
          }
        }
      }
      // add non-dominated population members to the repository
      this.pop.forEach(function (p) { if (!p.isdominated) self.repo.push(p); });
      this.grid = this.createGrid(this.repo);
      this.repo.forEach(function (p) { self.findGridIndex(p, self.grid); });
      // re-dominate the repository
      this.repo = this.determineDomination(this.repo);
      this.repo = this.repo.filter(function (p) { return !p.isdominated; });
      this.grid = this.createGrid(this.repo);
      this.repo.forEach(function (p) { self.findGridIndex(p, self.grid); });
      // prune (mopso.py deletes extera-1 members — kept verbatim)
      var extera = this.repo.length - this.nrepo;
      if (extera > 0) {
        for (var e = 0; e < extera - 1; e++) this.repo = this.deleteRepMem(this.repo);
      }
      this.w = this.w * this.wdamp;
      this.iter++;
    },

    loop: function () {
      var self = this;
      function tick() {
        requestAnimationFrame(tick);
        if (self.running) {
          self.iterate();
          self.iterate();
          self.stats();
        }
        self.draw();
      }
      tick();
    },

    stats: function () {
      document.getElementById("mIter").textContent = this.iter;
      document.getElementById("mArchive").textContent = this.repo.length;
      this.statW();
    },
    statW: function () {
      document.getElementById("mWCur").textContent = this.w.toFixed(3);
    },

    draw: function () {
      var c = this.ctx, W = this.canvas.width, H = this.canvas.height;
      var padL = 48, padR = 16, padT = 30, padB = 36;
      var x0 = padL, x1 = W - padR, y0 = padT, y1 = H - padB;

      // axis ranges over swarm + archive (objectives 0 and 1)
      var f1min = Infinity, f1max = -Infinity, f2min = Infinity, f2max = -Infinity, f3min = Infinity, f3max = -Infinity;
      var all = this.pop.concat(this.repo);
      for (var i = 0; i < all.length; i++) {
        var co = all[i].cost;
        if (co[0] < f1min) f1min = co[0]; if (co[0] > f1max) f1max = co[0];
        if (co[1] < f2min) f2min = co[1]; if (co[1] > f2max) f2max = co[1];
        if (co.length > 2) {
          if (co[2] < f3min) f3min = co[2]; if (co[2] > f3max) f3max = co[2];
        }
      }
      if (!isFinite(f1min)) { f1min = 0; f1max = 1; f2min = 0; f2max = 1; }
      var d1 = (f1max - f1min) || 1, d2 = (f2max - f2min) || 1;
      f1min -= d1 * 0.06; f1max += d1 * 0.06; f2min -= d2 * 0.06; f2max += d2 * 0.06;
      var mx = function (f1) { return x0 + (f1 - f1min) / (f1max - f1min) * (x1 - x0); };
      var my = function (f2) { return y1 - (f2 - f2min) / (f2max - f2min) * (y1 - y0); };

      c.fillStyle = "#05080f";
      c.fillRect(0, 0, W, H);
      c.strokeStyle = "rgba(120,160,255,0.08)";
      c.fillStyle = "#8b96b3";
      c.font = "10px 'JetBrains Mono', monospace";
      c.lineWidth = 1;
      for (var g = 0; g <= 5; g++) {
        var gx = x0 + (x1 - x0) * g / 5, gy = y0 + (y1 - y0) * g / 5;
        c.beginPath(); c.moveTo(gx, y0); c.lineTo(gx, y1); c.stroke();
        c.beginPath(); c.moveTo(x0, gy); c.lineTo(x1, gy); c.stroke();
        c.fillText((f1min + (f1max - f1min) * g / 5).toFixed(2), gx - 14, y1 + 14);
        c.fillText((f2min + (f2max - f2min) * g / 5).toFixed(2), 6, gy + 3);
      }
      c.fillStyle = "#38e1ff";
      c.fillText("f1 →", x1 - 24, y1 + 14);
      c.fillText("f2", 6, y0 - 8);
      c.fillStyle = "#e6ecf8";
      c.font = "11px 'JetBrains Mono', monospace";
      c.fillText(this.problems[this.prob].label + "  ·  iter " + this.iter, x0, 16);

      // swarm
      c.fillStyle = "rgba(139,150,179,0.45)";
      for (i = 0; i < this.pop.length; i++) {
        c.beginPath();
        c.arc(mx(this.pop[i].cost[0]), my(this.pop[i].cost[1]), 2, 0, Math.PI * 2);
        c.fill();
      }

      // archive front (sorted by f1) + members
      var front = this.repo.slice().sort(function (a, b) { return a.cost[0] - b.cost[0]; });
      if (front.length > 1) {
        c.strokeStyle = "rgba(251,191,36,0.85)";
        c.lineWidth = 1.6;
        c.beginPath();
        for (i = 0; i < front.length; i++) {
          var px = mx(front[i].cost[0]), py = my(front[i].cost[1]);
          if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
        }
        c.stroke();
      }
      var d3 = (f3max - f3min) || 1;
      for (i = 0; i < front.length; i++) {
        if (front[i].cost.length > 2) {
          var t = (front[i].cost[2] - f3min) / d3;
          c.fillStyle = "hsl(" + (280 - t * 220) + ",85%,62%)"; // colour = 3rd objective
        } else {
          c.fillStyle = "#fbbf24";
        }
        c.beginPath();
        c.arc(mx(front[i].cost[0]), my(front[i].cost[1]), 3.4, 0, Math.PI * 2);
        c.fill();
      }
    }
  };

  /* ================================================================
     4. TINY NET — train a 2-16-16-1 MLP live
     ================================================================ */
  var NetDemo = {
    canvas: null, ctx: null, lossCanvas: null, lctx: null,
    W: null, b: null, data: null, ds: "blobs",
    training: false, epoch: 0, lossHist: [],
    GRID: 56,

    init: function () {
      var self = this;
      this.canvas = document.getElementById("netCanvas");
      this.ctx = this.canvas.getContext("2d");
      this.lossCanvas = document.getElementById("lossCanvas");
      this.lctx = this.lossCanvas.getContext("2d");
      document.getElementById("btnTrain").addEventListener("click", function () {
        self.training = !self.training;
        this.textContent = self.training ? "pause" : "train";
      });
      document.getElementById("btnNetReset").addEventListener("click", function () { self.newNet(); });
      document.querySelectorAll("#dsPills .chip").forEach(function (chip) {
        chip.addEventListener("click", function () {
          document.querySelectorAll("#dsPills .chip").forEach(function (c) { c.classList.remove("active"); });
          chip.classList.add("active");
          self.ds = chip.getAttribute("data-ds");
          self.genData();
          self.newNet();
        });
      });
      var lr = document.getElementById("lrSlider");
      lr.addEventListener("input", function () {
        document.getElementById("lrOut").textContent = (+lr.value).toFixed(2);
      });
      this.genData();
      this.newNet();
      this.loop();
    },

    randn: function () {
      // Box-Muller
      var u = 0, v = 0;
      while (u === 0) u = Math.random();
      while (v === 0) v = Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },

    newNet: function () {
      var sizes = [2, 16, 16, 1];
      this.W = []; this.b = [];
      for (var l = 1; l < sizes.length; l++) {
        var fanin = sizes[l - 1], fanout = sizes[l];
        var w = [];
        for (var i = 0; i < fanout; i++) {
          var row = [];
          for (var j = 0; j < fanin; j++) row.push(this.randn() * Math.sqrt(2 / (fanin + fanout)));
          w.push(row);
        }
        this.W.push(w);
        this.b.push(new Array(fanout).fill(0));
      }
      this.epoch = 0;
      this.lossHist = [];
      this.stats();
      this.draw();
    },

    genData: function () {
      var pts = [], labels = [];
      function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; }
      var i, x, y, r, a;
      if (this.ds === "blobs") {
        for (i = 0; i < 70; i++) { pts.push([-0.55 + gauss() * 0.30, -0.55 + gauss() * 0.30]); labels.push(0); }
        for (i = 0; i < 70; i++) { pts.push([0.55 + gauss() * 0.30, 0.55 + gauss() * 0.30]); labels.push(1); }
      } else if (this.ds === "circles") {
        for (i = 0; i < 130; i++) {
          r = Math.sqrt(Math.random()) * 0.95; a = Math.random() * Math.PI * 2;
          x = r * Math.cos(a); y = r * Math.sin(a);
          pts.push([x + gauss() * 0.04, y + gauss() * 0.04]);
          labels.push(r < 0.42 ? 1 : 0);
        }
      } else if (this.ds === "xor") {
        var qs = [[-0.6, -0.6, 0], [0.6, -0.6, 1], [-0.6, 0.6, 1], [0.6, 0.6, 0]];
        for (i = 0; i < 50; i++) {
          var q = qs[i % 4];
          pts.push([q[0] + gauss() * 0.10, q[1] + gauss() * 0.10]);
          labels.push(q[2]);
        }
      } else { // spiral
        for (i = 0; i < 95; i++) {
          r = (i / 95) * 0.85; a = (i / 95) * Math.PI * 3.1;
          pts.push([r * Math.cos(a) + gauss() * 0.05, r * Math.sin(a) + gauss() * 0.05]); labels.push(0);
          pts.push([r * Math.cos(a + Math.PI) + gauss() * 0.05, r * Math.sin(a + Math.PI) + gauss() * 0.05]); labels.push(1);
        }
      }
      this.data = { x: pts, y: labels };
    },

    forward: function (x) {
      var a = x, acts = [a], zs = [];
      for (var l = 0; l < this.W.length; l++) {
        var z = [];
        for (var i = 0; i < this.W[l].length; i++) {
          var s = this.b[l][i];
          for (var j = 0; j < this.W[l][i].length; j++) s += this.W[l][i][j] * a[j];
          z.push(s);
        }
        zs.push(z);
        var na = [];
        for (i = 0; i < z.length; i++) {
          na.push(l === this.W.length - 1 ? 1 / (1 + Math.exp(-z[i])) : Math.tanh(z[i]));
        }
        acts.push(na);
        a = na;
      }
      return { out: a[0], acts: acts, zs: zs };
    },

    trainStep: function (lr) {
      var n = this.data.x.length;
      var gW = this.W.map(function (w) { return w.map(function (row) { return row.map(function () { return 0; }); }); });
      var gb = this.b.map(function (bb) { return bb.map(function () { return 0; }); });
      var loss = 0;
      for (var s = 0; s < n; s++) {
        var f = this.forward(this.data.x[s]);
        var y = this.data.y[s];
        var p = Math.min(1 - 1e-9, Math.max(1e-9, f.out));
        loss += -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
        // backprop
        var L = this.W.length;
        var delta = [f.out - y]; // dL/dz at output (BCE + sigmoid)
        for (var l = L - 1; l >= 0; l--) {
          var aPrev = f.acts[l];
          for (var i = 0; i < delta.length; i++) {
            gb[l][i] += delta[i];
            for (var j = 0; j < aPrev.length; j++) gW[l][i][j] += delta[i] * aPrev[j];
          }
          if (l > 0) {
            var nd = [];
            for (j = 0; j < aPrev.length; j++) {
              var sum = 0;
              for (i = 0; i < delta.length; i++) sum += this.W[l][i][j] * delta[i];
              nd.push(sum * (1 - aPrev[j] * aPrev[j])); // tanh'
            }
            delta = nd;
          }
        }
      }
      loss /= n;
      for (l = 0; l < this.W.length; l++) {
        for (i = 0; i < this.W[l].length; i++) {
          this.b[l][i] -= lr * gb[l][i] / n;
          for (j = 0; j < this.W[l][i].length; j++) this.W[l][i][j] -= lr * gW[l][i][j] / n;
        }
      }
      this.epoch++;
      this.lossHist.push(loss);
      if (this.lossHist.length > 400) this.lossHist.shift();
      return loss;
    },

    accuracy: function () {
      var ok = 0, n = this.data.x.length;
      for (var s = 0; s < n; s++) {
        var p = this.forward(this.data.x[s]).out;
        if ((p > 0.5 ? 1 : 0) === this.data.y[s]) ok++;
      }
      return ok / n;
    },

    loop: function () {
      var self = this;
      function tick() {
        requestAnimationFrame(tick);
        if (self.training) {
          var lr = +document.getElementById("lrSlider").value;
          for (var k = 0; k < 25; k++) self.trainStep(lr);
          self.stats();
        }
        self.draw();
      }
      tick();
    },

    stats: function () {
      var last = this.lossHist[this.lossHist.length - 1];
      document.getElementById("epOut").textContent = this.epoch;
      document.getElementById("lossOut").textContent = last !== undefined ? last.toFixed(4) : "–";
      document.getElementById("accOut").textContent = (this.accuracy() * 100).toFixed(1) + "%";
    },

    draw: function () {
      var c = this.ctx, S = this.canvas.width;
      var G = this.GRID;
      var off = document.createElement("canvas");
      off.width = G; off.height = G;
      var oc = off.getContext("2d");
      var im = oc.createImageData(G, G);
      var bg = [5, 8, 15], cy = [56, 225, 255], vi = [167, 139, 250];
      for (var gy = 0; gy < G; gy++) for (var gx = 0; gx < G; gx++) {
        var x = (gx / (G - 1)) * 2.3 - 1.15;
        var y = 1.15 - (gy / (G - 1)) * 2.3;
        var p = this.forward([x, y]).out;
        var a = Math.abs(p - 0.5) * 2 * 0.75;
        var fg = p > 0.5 ? cy : vi;
        var o = (gy * G + gx) * 4;
        im.data[o] = bg[0] + (fg[0] - bg[0]) * a;
        im.data[o + 1] = bg[1] + (fg[1] - bg[1]) * a;
        im.data[o + 2] = bg[2] + (fg[2] - bg[2]) * a;
        im.data[o + 3] = 255;
      }
      oc.putImageData(im, 0, 0);
      c.imageSmoothingEnabled = true;
      c.fillStyle = "#05080f";
      c.fillRect(0, 0, S, S);
      c.drawImage(off, 0, 0, S, S);
      // points
      for (var i = 0; i < this.data.x.length; i++) {
        var px = (this.data.x[i][0] + 1.15) / 2.3 * S;
        var py = (1.15 - this.data.x[i][1]) / 2.3 * S;
        c.fillStyle = this.data.y[i] === 1 ? "#e6ecf8" : "#a78bfa";
        c.strokeStyle = "#05080f";
        c.lineWidth = 1.5;
        c.beginPath();
        c.arc(px, py, 3.4, 0, Math.PI * 2);
        c.fill(); c.stroke();
      }
      // loss sparkline
      var lc = this.lctx, LW = this.lossCanvas.width, LH = this.lossCanvas.height;
      lc.fillStyle = "#05080f";
      lc.fillRect(0, 0, LW, LH);
      if (this.lossHist.length > 1) {
        var mn = Math.min.apply(null, this.lossHist), mx = Math.max.apply(null, this.lossHist);
        var rg = (mx - mn) || 1;
        lc.strokeStyle = "#38e1ff";
        lc.lineWidth = 1.6;
        lc.beginPath();
        for (i = 0; i < this.lossHist.length; i++) {
          var lx = i / 399 * LW;
          var ly = LH - 6 - ((this.lossHist[i] - mn) / rg) * (LH - 12);
          if (i === 0) lc.moveTo(lx, ly); else lc.lineTo(lx, ly);
        }
        lc.stroke();
      }
      lc.fillStyle = "#8b96b3";
      lc.font = "10px 'JetBrains Mono', monospace";
      lc.fillText("loss", 6, 12);
    }
  };

  /* ================================================================
     5. SPIKES — Poisson raster + PSTH
     ================================================================ */
  var SpikeDemo = {
    canvas: null, ctx: null,
    N: 120, r0: 5, stim: 25,
    spikes: [], running: true,
    lastT: 0, WIN: 1200,

    init: function () {
      var self = this;
      this.canvas = document.getElementById("spikeCanvas");
      this.ctx = this.canvas.getContext("2d");

      function bind(sliderId, outId, fmt, cb) {
        var s = document.getElementById(sliderId);
        var out = document.getElementById(outId);
        s.addEventListener("input", function () {
          var v = +s.value;
          out.textContent = fmt(v);
          cb(v);
        });
      }
      bind("nSlider", "nOut", function (v) { return v; }, function (v) { self.N = v; });
      bind("r0Slider", "r0Out", function (v) { return v + " Hz"; }, function (v) { self.r0 = v; });
      bind("stimSlider", "stimOut", function (v) { return v + " Hz"; }, function (v) { self.stim = v; });

      var btn = document.getElementById("btnSpikeToggle");
      btn.addEventListener("click", function () {
        self.running = !self.running;
        btn.textContent = self.running ? "pause" : "run";
        self.lastT = performance.now();
      });

      this.lastT = performance.now();
      this.loop();
    },

    rate: function (phaseMs) {
      // stimulus bump centered at 600 ms
      var d = (phaseMs - 600) / 130;
      return this.r0 + this.stim * Math.exp(-d * d);
    },

    loop: function () {
      var self = this;
      function tick(now) {
        requestAnimationFrame(tick);
        var dt = Math.min(80, now - self.lastT);
        self.lastT = now;
        if (self.running) {
          var phase = now % self.WIN;
          var lam = self.rate(phase) * dt / 1000;
          for (var n = 0; n < self.N; n++) {
            if (Math.random() < lam) self.spikes.push({ n: n, t: now });
          }
          var cutoff = now - self.WIN;
          while (self.spikes.length && self.spikes[0].t < cutoff) self.spikes.shift();
        }
        self.draw(now);
      }
      requestAnimationFrame(tick);
    },

    draw: function (now) {
      var c = this.ctx, W = this.canvas.width, H = this.canvas.height;
      var pad = 12, top = 26, rastH = H * 0.66, psthTop = top + rastH + 26, psthH = H - psthTop - 16;
      var x0 = pad, x1 = W - pad, win = this.WIN;

      c.fillStyle = "#05080f";
      c.fillRect(0, 0, W, H);

      // labels
      c.font = "11px 'JetBrains Mono', monospace";
      c.fillStyle = "#8b96b3";
      c.fillText("raster — " + this.N + " neurons", x0, 16);
      c.fillText("PSTH (Hz)", x0, psthTop - 8);

      // stimulus marker (t=600ms of current sweep)
      var stimX = x0 + (600 / win) * (x1 - x0);
      c.strokeStyle = "rgba(251,191,36,0.55)";
      c.setLineDash([4, 4]);
      c.beginPath(); c.moveTo(stimX, top - 4); c.lineTo(stimX, psthTop + psthH); c.stroke();
      c.setLineDash([]);
      c.fillStyle = "rgba(251,191,36,0.8)";
      c.fillText("stim", stimX - 12, top - 8);

      // raster
      var cutoff = now - win;
      c.fillStyle = "rgba(56,225,255,0.85)";
      for (var i = 0; i < this.spikes.length; i++) {
        var s = this.spikes[i];
        var x = x0 + ((s.t - cutoff) / win) * (x1 - x0);
        var y = top + (s.n / this.N) * rastH;
        c.fillRect(x, y, 2, 2);
      }

      // PSTH: 30 bins over the window
      var bins = 30, bw = (x1 - x0) / bins;
      var counts = new Array(bins).fill(0);
      for (i = 0; i < this.spikes.length; i++) {
        var b = Math.floor(((this.spikes[i].t - cutoff) / win) * bins);
        if (b >= 0 && b < bins) counts[b]++;
      }
      var binSec = win / 1000 / bins;
      var rates = counts.map(function (cnt) { return cnt / (this.N * binSec); }, this);
      var mx = Math.max.apply(null, rates.concat([1]));
      c.fillStyle = "rgba(167,139,250,0.75)";
      for (i = 0; i < bins; i++) {
        var bh = (rates[i] / mx) * psthH;
        c.fillRect(x0 + i * bw + 1, psthTop + psthH - bh, bw - 2, bh);
      }
      // axis
      c.strokeStyle = "rgba(120,160,255,0.25)";
      c.beginPath(); c.moveTo(x0, psthTop + psthH); c.lineTo(x1, psthTop + psthH); c.stroke();
      c.fillStyle = "#8b96b3";
      c.fillText("0", x0, psthTop + psthH + 12);
      c.fillText(win + " ms", x1 - 44, psthTop + psthH + 12);
      c.fillText(mx.toFixed(0) + " Hz", x1 - 52, psthTop + 10);
    }
  };

  // exposed for debugging / tests
  window.__pg = { activate: activate, digit: DigitDemo, fam: FamDemo, mopso: MopsoDemo, net: NetDemo, spikes: SpikeDemo };
})();
