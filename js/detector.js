(function (root) {
  'use strict';

  var DEFAULTS = {
    maxDim: 1500,
    sampleRatio: 0.62,
    densityThreshold: 0.45,
    anchorFillMin: 0.78,
    anchorAspect: 0.7,
    frameTrim: 0.005,
    frameAspectTolerance: 0.3
  };

  function mergeOpts(o) {
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) { out[k] = DEFAULTS[k]; });
    if (o) Object.keys(o).forEach(function (k) { out[k] = o[k]; });
    return out;
  }

  function grayscale(data, w, h) {
    var gray = new Uint8Array(w * h);
    for (var i = 0, p = 0; i < gray.length; i++, p += 4) {
      gray[i] = (data[p] * 299 + data[p + 1] * 587 + data[p + 2] * 114) / 1000 | 0;
    }
    return gray;
  }

  function otsu(gray) {
    var hist = new Int32Array(256);
    for (var i = 0; i < gray.length; i++) hist[gray[i]]++;
    var total = gray.length;
    var sum = 0;
    for (var t = 0; t < 256; t++) sum += t * hist[t];
    var sumB = 0, wB = 0, max = 0, thr = 127;
    for (var k = 0; k < 256; k++) {
      wB += hist[k];
      if (wB === 0) continue;
      var wF = total - wB;
      if (wF === 0) break;
      sumB += k * hist[k];
      var mB = sumB / wB;
      var mF = (sum - sumB) / wF;
      var between = wB * wF * (mB - mF) * (mB - mF);
      if (between > max) { max = between; thr = k; }
    }
    return thr;
  }

  function labelComponents(dark, w, h) {
    var labels = new Int32Array(w * h);
    var parent = [0];
    var next = 1;

    function find(x) {
      while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
      return x;
    }
    function union(a, b) {
      a = find(a); b = find(b);
      if (a !== b) parent[b] = a;
    }

    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var i = y * w + x;
        if (!dark[i]) continue;
        var l = x > 0 ? labels[i - 1] : 0;
        var u = y > 0 ? labels[i - w] : 0;
        var ul = (x > 0 && y > 0) ? labels[i - w - 1] : 0;
        var ur = (x < w - 1 && y > 0) ? labels[i - w + 1] : 0;
        var lab = l || u || ul || ur;
        if (lab) {
          labels[i] = lab;
          if (l && l !== lab) union(lab, l);
          if (u && u !== lab) union(lab, u);
          if (ul && ul !== lab) union(lab, ul);
          if (ur && ur !== lab) union(lab, ur);
        } else {
          labels[i] = next;
          parent[next] = next;
          next++;
        }
      }
    }

    var stats = [];
    for (var s = 0; s < next; s++) stats.push(null);
    for (var yy = 0; yy < h; yy++) {
      for (var xx = 0; xx < w; xx++) {
        var idx = yy * w + xx;
        if (!labels[idx]) continue;
        var r = find(labels[idx]);
        var st = stats[r];
        if (!st) { st = stats[r] = { n: 0, minx: xx, maxx: xx, miny: yy, maxy: yy }; }
        st.n++;
        if (xx < st.minx) st.minx = xx;
        if (xx > st.maxx) st.maxx = xx;
        if (yy < st.miny) st.miny = yy;
        if (yy > st.maxy) st.maxy = yy;
      }
    }
    return stats;
  }

  function findAnchors(dark, w, h, opts) {
    var stats = labelComponents(dark, w, h);
    var imgArea = w * h;
    var minArea = imgArea * 0.0006;
    var maxArea = imgArea * 0.03;
    var cands = [];

    for (var i = 1; i < stats.length; i++) {
      var st = stats[i];
      if (!st) continue;
      var bw = st.maxx - st.minx + 1;
      var bh = st.maxy - st.miny + 1;
      var area = st.n;
      if (area < minArea || area > maxArea) continue;
      var aspect = bw / bh;
      if (aspect < opts.anchorAspect || aspect > 1 / opts.anchorAspect) continue;
      var fill = area / (bw * bh);
      if (fill < opts.anchorFillMin) continue;
      cands.push({ x: (st.minx + st.maxx) / 2, y: (st.miny + st.maxy) / 2, side: (bw + bh) / 2, area: area, fill: fill });
    }

    if (cands.length < 4) return { ok: false, reason: 'ancoras_insuficientes', candidates: cands };
    var corners = [
      { id: 'TL', cx: 0, cy: 0 },
      { id: 'TR', cx: w, cy: 0 },
      { id: 'BL', cx: 0, cy: h },
      { id: 'BR', cx: w, cy: h }
    ];
    var used = {};
    var picked = [];
    corners.forEach(function (c) {
      var best = null, bestD = Infinity;
      cands.forEach(function (cd, idx) {
        if (used[idx]) return;
        var inQuad = (c.cx === 0 ? cd.x <= w / 2 : cd.x > w / 2) && (c.cy === 0 ? cd.y <= h / 2 : cd.y > h / 2);
        if (!inQuad) return;
        var d = (cd.x - c.cx) * (cd.x - c.cx) + (cd.y - c.cy) * (cd.y - c.cy);
        if (d < bestD) { bestD = d; best = { cand: cd, idx: idx }; }
      });
      if (best) { used[best.idx] = true; picked.push({ id: c.id, x: best.cand.x, y: best.cand.y, side: best.cand.side }); }
    });

    if (picked.length < 4) return { ok: false, reason: 'ancoras_quadrante', anchors: picked, candidates: cands };
    return { ok: true, anchors: picked, candidates: cands };
  }

  function darkBounds(dark, w, h, trim) {
    var colS = new Int32Array(w);
    var rowS = new Int32Array(h);
    var total = 0;
    for (var y = 0; y < h; y++) {
      var base = y * w;
      for (var x = 0; x < w; x++) {
        if (!dark[base + x]) continue;
        colS[x]++; rowS[y]++; total++;
      }
    }
    if (!total) return null;
    var cut = Math.max(1, Math.floor(total * trim));
    var i, acc;
    var left = 0, right = w - 1, top = 0, bottom = h - 1;
    for (acc = 0, i = 0; i < w; i++) { acc += colS[i]; if (acc >= cut) { left = i; break; } }
    for (acc = 0, i = w - 1; i >= 0; i--) { acc += colS[i]; if (acc >= cut) { right = i; break; } }
    for (acc = 0, i = 0; i < h; i++) { acc += rowS[i]; if (acc >= cut) { top = i; break; } }
    for (acc = 0, i = h - 1; i >= 0; i--) { acc += rowS[i]; if (acc >= cut) { bottom = i; break; } }
    return { left: left, top: top, right: right, bottom: bottom, total: total };
  }

  function findFrameAnchors(dark, w, h, matrix, opts) {
    var b = darkBounds(dark, w, h, opts.frameTrim);
    if (!b) return { ok: false, reason: 'moldura_nao_encontrada' };
    var bw = b.right - b.left;
    var bh = b.bottom - b.top;
    if (bw < w * 0.3 || bh < h * 0.3) return { ok: false, reason: 'moldura_nao_encontrada', bounds: b };
    var frame = matrix.frame || { width: 189.99, height: 252.98 };
    var expect = frame.width / frame.height;
    var got = bw / bh;
    if (Math.abs(got - expect) / expect > opts.frameAspectTolerance) {
      return { ok: false, reason: 'moldura_proporcao', bounds: b, aspect: got, expected: expect };
    }
    return {
      ok: true,
      mode: 'frame',
      bounds: b,
      pixelsPerMm: (bw / frame.width + bh / frame.height) / 2,
      anchors: [
        { id: 'TL', x: b.left, y: b.top, side: 0 },
        { id: 'TR', x: b.right, y: b.top, side: 0 },
        { id: 'BL', x: b.left, y: b.bottom, side: 0 },
        { id: 'BR', x: b.right, y: b.bottom, side: 0 }
      ]
    };
  }

  function solve(A, b) {
    var n = b.length;
    var M = A.map(function (row, i) { return row.concat([b[i]]); });
    for (var col = 0; col < n; col++) {
      var piv = col;
      for (var r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
      var tmp = M[col]; M[col] = M[piv]; M[piv] = tmp;
      var pv = M[col][col];
      if (Math.abs(pv) < 1e-12) return null;
      for (var c2 = col; c2 <= n; c2++) M[col][c2] /= pv;
      for (var r2 = 0; r2 < n; r2++) {
        if (r2 === col) continue;
        var f = M[r2][col];
        if (!f) continue;
        for (var c3 = col; c3 <= n; c3++) M[r2][c3] -= f * M[col][c3];
      }
    }
    return M.map(function (row) { return row[n]; });
  }

  function computeHomography(src, dst) {
    var A = [], b = [];
    for (var i = 0; i < 4; i++) {
      var X = src[i].x, Y = src[i].y, u = dst[i].x, v = dst[i].y;
      A.push([X, Y, 1, 0, 0, 0, -u * X, -u * Y]); b.push(u);
      A.push([0, 0, 0, X, Y, 1, -v * X, -v * Y]); b.push(v);
    }
    var h = solve(A, b);
    if (!h) return null;
    return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
  }

  function applyH(H, X, Y) {
    var d = H[6] * X + H[7] * Y + H[8];
    return [(H[0] * X + H[1] * Y + H[2]) / d, (H[3] * X + H[4] * Y + H[5]) / d];
  }

  function sampleDensity(dark, w, h, cx, cy, r) {
    var x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(w - 1, Math.ceil(cx + r));
    var y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(h - 1, Math.ceil(cy + r));
    var total = 0, black = 0;
    var r2 = r * r;
    for (var y = y0; y <= y1; y++) {
      var dy = y - cy;
      for (var x = x0; x <= x1; x++) {
        var dx = x - cx;
        if (dx * dx + dy * dy > r2) continue;
        total++;
        if (dark[y * w + x]) black++;
      }
    }
    return total ? black / total : 0;
  }

  function detect(sourceCanvas, matrix, userOpts) {
    var opts = mergeOpts(userOpts);
    var sw = sourceCanvas.width, sh = sourceCanvas.height;
    var scale = Math.min(1, opts.maxDim / Math.max(sw, sh));
    var w = Math.max(1, Math.round(sw * scale));
    var h = Math.max(1, Math.round(sh * scale));

    var work = document.createElement('canvas');
    work.width = w; work.height = h;
    var wctx = work.getContext('2d');
    wctx.drawImage(sourceCanvas, 0, 0, w, h);
    var img = wctx.getImageData(0, 0, w, h);
    var gray = grayscale(img.data, w, h);
    var thr = otsu(gray);
    var dark = new Uint8Array(w * h);
    for (var i = 0; i < gray.length; i++) dark[i] = gray[i] < thr ? 1 : 0;

    var mode = matrix.alignment === 'frame' ? 'frame' : 'anchors';
    var found = mode === 'frame'
      ? findFrameAnchors(dark, w, h, matrix, opts)
      : findAnchors(dark, w, h, opts);
    if (!found.ok) return { ok: false, reason: found.reason, grayThreshold: thr, candidates: found.candidates, anchors: found.anchors, bounds: found.bounds, aspect: found.aspect, expected: found.expected };

    var byId = {};
    found.anchors.forEach(function (a) { byId[a.id] = a; });
    var order = ['TL', 'TR', 'BL', 'BR'];
    var srcPts = order.map(function (id) { return { x: byId[id].x, y: byId[id].y }; });
    var dstPts = order.map(function (id) {
      var a = matrix.anchors.filter(function (m) { return m.id === id; })[0];
      return { x: a.x, y: a.y };
    });

    var H = computeHomography(dstPts, srcPts);
    if (!H) return { ok: false, reason: 'homografia' };

    var invScale = 1 / scale;
    var outBubbles = [];

    function readBubble(b) {
      var p = applyH(H, b.x, b.y);
      var pdx = applyH(H, b.x + 1, b.y);
      var pdy = applyH(H, b.x, b.y + 1);
      var sLocal = (Math.hypot(pdx[0] - p[0], pdx[1] - p[1]) + Math.hypot(pdy[0] - p[0], pdy[1] - p[1])) / 2;
      var r = (matrix.bubbleDiameter / 2) * opts.sampleRatio * sLocal;
      var density = sampleDensity(dark, w, h, p[0], p[1], r);
      return { density: density, marked: density >= opts.densityThreshold, x: p[0] * invScale, y: p[1] * invScale, r: r * invScale };
    }

    var answers = [];
    matrix.bubbles.forEach(function (b) {
      var res = readBubble(b);
      outBubbles.push({ q: b.q, option: b.option, density: res.density, marked: res.marked, x: res.x, y: res.y, r: res.r });
    });

    var byQ = {};
    outBubbles.forEach(function (b) {
      (byQ[b.q] = byQ[b.q] || []).push(b);
    });
    Object.keys(byQ).forEach(function (q) {
      var marks = byQ[q].filter(function (b) { return b.marked; });
      var value = '';
      if (marks.length === 1) value = marks[0].option;
      else if (marks.length > 1) value = 'X';
      answers.push({
        q: parseInt(q, 10),
        value: value,
        marks: marks.map(function (m) { return m.option; }),
        densities: byQ[q].map(function (b) { return { option: b.option, density: Math.round(b.density * 1000) / 1000 }; })
      });
    });
    answers.sort(function (a, b) { return a.q - b.q; });

    var prova = null;
    if (matrix.prova && (matrix.prova.enabled || matrix.prova.groups)) {
      prova = { tens: null, units: null, number: null, groups: {} };
      matrix.prova.groups.forEach(function (grp) {
        var best = null;
        grp.bubbles.forEach(function (gb) {
          var res = readBubble({ x: gb.x, y: gb.y, option: gb.value });
          outBubbles.push({ group: grp.key, value: gb.value, density: res.density, marked: res.marked, x: res.x, y: res.y, r: res.r });
          if (res.marked && (!best || res.density > best.density)) best = { value: gb.value, density: res.density };
        });
        prova.groups[grp.key] = best ? best.value : null;
        if (grp.key === 'tens') prova.tens = best ? best.value : null;
        if (grp.key === 'units') prova.units = best ? best.value : null;
      });
      if (prova.tens !== null && prova.units !== null) prova.number = prova.tens * 10 + prova.units;
    }

    var ppm = found.mode === 'frame'
      ? found.pixelsPerMm * invScale
      : found.anchors.reduce(function (s, a) { return s + a.side; }, 0) / 4 / 10 * invScale;

    return {
      ok: true,
      mode: mode,
      grayThreshold: thr,
      scale: invScale,
      anchors: found.anchors.map(function (a) { return { id: a.id, x: a.x * invScale, y: a.y * invScale, side: a.side * invScale }; }),
      ppm: ppm,
      bubbles: outBubbles,
      answers: answers,
      prova: prova
    };
  }

  root.OMR = root.OMR || {};
  root.OMR.detect = detect;
})(typeof window !== 'undefined' ? window : this);
