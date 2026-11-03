# farzad-ziaie.github.io — personal portfolio

Static one-pager ("neural observatory" theme) served by GitHub Pages at
**https://farzad-ziaie.github.io/** with custom domain **https://ziaie.de/** (see `CNAME`).

No build step. Vanilla HTML/CSS/JS + canvas; three.js (CDN) for the 3D camera rig;
all playground demos run 100% client-side.

## Structure

```
index.html            single-page site (about / research / projects / services & consulting / playground /
                      publications & cv / background / contact) — positioned as ML engineer, solution architect
                      and fractional CTO / consultant, on top of the neuroscience PhD work
css/style.css         theme
js/neural-bg.js       ambient spiking-neuron background canvas
js/main.js            nav, scroll reveals, project filters
js/pose3d.js          three.js 8× Basler camera rig around a monkey (research section)
js/playground.js      5 live demos: MNIST k-NN digit pad, fuzzyart (FuzzyARTMAP port),
                      mopso (MOPSO port), tiny-net trainer, spike raster
cv.pdf                downloadable CV (publications & cv section)
images/profile-photo.png  portfolio photo
CNAME                 custom domain (ziaie.de)
.nojekyll             disable Jekyll processing on GitHub Pages
icon.ico              favicon (kept from the previous site)
```

## Deploy

Copy the contents of this folder into the root of the
[`farzad-ziaie/farzad-ziaie.github.io`](https://github.com/farzad-ziaie/farzad-ziaie.github.io)
repository (keep `CNAME` and `icon.ico`), then:

```bash
git add -A
git commit -m "new portfolio: neural observatory + live ports of fuzzyart & mopso"
git push
```

GitHub Pages serves the `main` branch root automatically (user site).
Settings → Pages should show `ziaie.de` as the custom domain.

## Playground notes

- The digit demo fetches a small MNIST subset on demand from the jsDelivr CDN
  (`npm/mnist` package, first 30 images per digit, quantized to 14×14, k-NN k=7).
  It needs internet on first open of that tab.
- The **fuzzyart** demo is a faithful in-browser port of
  [`fuzzyart`](https://github.com/farzad-ziaie/fuzzyart) (`fam.py`): complement coding
  `A=(u,1-u,v,1-v)`, choice `T_j=|A∧W_j|+(1-α)(M-|W_j|)`, vigilance/match-tracking with
  `ε=-0.001`, learning `W←β(A∧W)+(1-β)W`.
- The **mopso** demo is a faithful in-browser port of
  [`mopso`](https://github.com/farzad-ziaie/mopso) (Coello Coello & Lechuga 2002):
  velocity update, Pareto domination, hyper-grid archive, roulette leader selection
  `exp(-β·n)`, pruning `exp(-γ·n)`, inertia damping. Test functions: Schaffer N.1,
  ZDT1 and mopso's default 3-objective cost.
- The tiny-net and spike-raster demos are fully self-contained vanilla JS.
