/* Gráficas livianas en SVG: barras apiladas por mes y línea de rendimiento, con leyenda, detalle al pasar el cursor y vista de tabla. */
(function () {
  'use strict';
  var FL = (window.FL = window.FL || {});
  var U = FL.U, h = U.h;
  var NS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs) { var e = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); }); for (var i = 2; i < arguments.length; i++) if (arguments[i]) e.appendChild(arguments[i]); return e; }
  var Z = (FL.Viz = {});

  Z.copCorto = function (n) {
    if (!n) return '$0';
    if (Math.abs(n) >= 1e6) return '$' + U.n(n / 1e6, n >= 1e7 ? 0 : 1) + ' M';
    if (Math.abs(n) >= 1e3) return '$' + U.n(n / 1e3, 0) + ' mil';
    return '$' + U.n(n, 0);
  };
  function escala(max) {
    if (max <= 0) return { max: 1, pasos: [0, 1] };
    var e = Math.pow(10, Math.floor(Math.log10(max))), f = max / e;
    var paso = (f <= 1.5 ? 0.25 : f <= 3 ? 0.5 : f <= 6 ? 1 : 2) * e;
    var tope = Math.ceil(max / paso) * paso, pasos = [];
    for (var v = 0; v <= tope + 1e-9; v += paso) pasos.push(v);
    return { max: tope, pasos: pasos };
  }
  function leyenda(series) {
    return h('div', { class: 'viz-leyenda' }, series.map(function (x) { return h('span', null, h('i', { class: 'viz-cuadro', style: { background: x.color } }), x.nombre); }));
  }
  function contenedor(titulo, grafica, tabla, series) {
    var verTabla = false;
    var cuerpo = h('div', { class: 'viz-cuerpo' }, grafica);
    var btn = h('button', { class: 'btn xs', type: 'button', onclick: function () { verTabla = !verTabla; U.clear(cuerpo).appendChild(verTabla ? tabla() : grafica); btn.textContent = verTabla ? 'Ver gráfica' : 'Ver tabla'; } }, 'Ver tabla');
    return h('figure', { class: 'viz' }, h('div', { class: 'viz-cab' }, h('figcaption', null, titulo), btn), series ? leyenda(series) : null, cuerpo);
  }
  function tooltip(cont) {
    var t = h('div', { class: 'viz-tip', role: 'tooltip' });
    cont.appendChild(t);
    return {
      ver: function (html, x, y) { U.clear(t).appendChild(html); t.style.display = 'block'; var w = cont.clientWidth, tw = t.offsetWidth; t.style.left = Math.max(0, Math.min(w - tw, x - tw / 2)) + 'px'; t.style.top = Math.max(0, y - t.offsetHeight - 10) + 'px'; },
      ocultar: function () { t.style.display = 'none'; }
    };
  }
  function rectSup(x, y, w, hh, r) {
    r = Math.min(r, hh, w / 2);
    return 'M' + x + ',' + (y + hh) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + hh) + 'Z';
  }

  // o: { titulo, etiquetas: [12], series: [{ nombre, color, valores }], formato }
  Z.barras = function (o) {
    var W = 680, H = 240, ml = 76, mr = 8, mt = 12, mb = 28;
    var fmt = o.formato || Z.copCorto;
    var tot = o.etiquetas.map(function (_, i) { return U.sum(o.series, function (x) { return x.valores[i]; }); });
    var e = escala(Math.max.apply(null, tot.concat([0])));
    var y = function (v) { return mt + (H - mt - mb) * (1 - v / e.max); };
    var bw = (W - ml - mr) / o.etiquetas.length, ancho = Math.min(34, bw * 0.62);
    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'viz-svg', role: 'img', 'aria-label': o.titulo });
    e.pasos.forEach(function (v) {
      svg.appendChild(s('line', { x1: ml, x2: W - mr, y1: y(v), y2: y(v), class: v === 0 ? 'viz-base' : 'viz-rejilla' }));
      var t = s('text', { x: ml - 6, y: y(v) + 4, class: 'viz-eje', 'text-anchor': 'end' }); t.textContent = fmt(v); svg.appendChild(t);
    });
    var cont = h('div', { class: 'viz-area' }, svg);
    var tip = tooltip(cont);
    o.etiquetas.forEach(function (et, i) {
      var cx = ml + bw * i + bw / 2, acum = 0;
      var visibles = o.series.filter(function (x) { return x.valores[i] > 0; });
      visibles.forEach(function (x, j) {
        var v = x.valores[i], y0 = y(acum), y1 = y(acum + v), alto = Math.max(0, y0 - y1 - (j > 0 ? 2 : 0));
        var ultimo = j === visibles.length - 1;
        svg.appendChild(ultimo ? s('path', { d: rectSup(cx - ancho / 2, y1, ancho, alto, 4), fill: x.color }) : s('rect', { x: cx - ancho / 2, y: y1, width: ancho, height: alto, fill: x.color }));
        acum += v;
      });
      var tx = s('text', { x: cx, y: H - 8, class: 'viz-eje', 'text-anchor': 'middle' }); tx.textContent = et; svg.appendChild(tx);
      var hit = s('rect', { x: ml + bw * i, y: mt, width: bw, height: H - mt - mb, fill: 'transparent', class: 'viz-hit' });
      hit.addEventListener('mouseenter', function () {
        var r = svg.getBoundingClientRect(), k = r.width / W;
        tip.ver(h('div', null, h('strong', null, o.detalleEtiqueta ? o.detalleEtiqueta(i) : et),
          o.series.map(function (x) { return h('div', { class: 'viz-tip-f' }, h('i', { class: 'viz-cuadro', style: { background: x.color } }), x.nombre + ': ', h('b', null, U.cop(x.valores[i]))); }),
          h('div', { class: 'viz-tip-f tot' }, 'Total: ', h('b', null, U.cop(tot[i])))), cx * k, y(tot[i]) * k);
        hit.setAttribute('class', 'viz-hit activo');
      });
      hit.addEventListener('mouseleave', function () { tip.ocultar(); hit.setAttribute('class', 'viz-hit'); });
      svg.appendChild(hit);
    });
    function tabla() {
      return h('div', { class: 'tabla-scroll' }, h('table', { class: 'tabla' }, h('thead', null, h('tr', null, h('th', null, 'Mes'), o.series.map(function (x) { return h('th', { class: 'num' }, x.nombre); }), h('th', { class: 'num' }, 'Total'))),
        h('tbody', null, o.etiquetas.map(function (et, i) { return h('tr', null, h('td', null, et), o.series.map(function (x) { return h('td', { class: 'num' }, U.cop(x.valores[i])); }), h('td', { class: 'num' }, U.cop(tot[i]))); }))));
    }
    return contenedor(o.titulo, cont, tabla, o.series);
  };

  // o: { titulo, puntos: [{ etiqueta, y, detalle }], referencia, color, unidad }
  Z.linea = function (o) {
    var W = 680, H = 220, ml = 48, mr = 12, mt = 14, mb = 26;
    var p = o.puntos;
    var vals = p.map(function (x) { return x.y; }).concat(o.referencia ? [o.referencia] : []);
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var pad = (max - min) * 0.15 || max * 0.15 || 1;
    var e = escala(max + pad); var lo = Math.max(0, Math.floor((min - pad) / (e.pasos[1] || 1)) * (e.pasos[1] || 1));
    var pasos = e.pasos.filter(function (v) { return v >= lo; });
    var y = function (v) { return mt + (H - mt - mb) * (1 - (v - lo) / (e.max - lo || 1)); };
    var x = function (i) { return p.length === 1 ? (ml + W - mr) / 2 : ml + (W - ml - mr) * i / (p.length - 1); };
    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'viz-svg', role: 'img', 'aria-label': o.titulo });
    pasos.forEach(function (v) {
      svg.appendChild(s('line', { x1: ml, x2: W - mr, y1: y(v), y2: y(v), class: 'viz-rejilla' }));
      var t = s('text', { x: ml - 6, y: y(v) + 4, class: 'viz-eje', 'text-anchor': 'end' }); t.textContent = U.n(v, 0); svg.appendChild(t);
    });
    if (o.referencia) {
      svg.appendChild(s('line', { x1: ml, x2: W - mr, y1: y(o.referencia), y2: y(o.referencia), class: 'viz-ref' }));
      var tr = s('text', { x: W - mr, y: y(o.referencia) - 5, class: 'viz-eje', 'text-anchor': 'end' }); tr.textContent = 'Referencia ' + U.n(o.referencia, 1); svg.appendChild(tr);
    }
    svg.appendChild(s('polyline', { points: p.map(function (q, i) { return x(i) + ',' + y(q.y); }).join(' '), fill: 'none', stroke: o.color, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
    var cont = h('div', { class: 'viz-area' }, svg);
    var tip = tooltip(cont);
    var cada = Math.ceil(p.length / 8);
    p.forEach(function (q, i) {
      svg.appendChild(s('circle', { cx: x(i), cy: y(q.y), r: 4, fill: q.color || o.color, stroke: 'var(--card)', 'stroke-width': 2 }));
      if (i % cada === 0 || i === p.length - 1) { var t = s('text', { x: x(i), y: H - 8, class: 'viz-eje', 'text-anchor': 'middle' }); t.textContent = q.etiqueta; svg.appendChild(t); }
      var hit = s('circle', { cx: x(i), cy: y(q.y), r: 14, fill: 'transparent', class: 'viz-hit' });
      hit.addEventListener('mouseenter', function () { var r = svg.getBoundingClientRect(), k = r.width / W; tip.ver(h('div', null, h('strong', null, q.etiqueta), h('div', null, U.n(q.y, 1) + ' ' + (o.unidad || '')), q.detalle ? h('div', { class: 'muted' }, q.detalle) : null), x(i) * k, y(q.y) * k); });
      hit.addEventListener('mouseleave', tip.ocultar);
      svg.appendChild(hit);
    });
    function tabla() {
      return h('div', { class: 'tabla-scroll' }, h('table', { class: 'tabla' }, h('thead', null, h('tr', null, h('th', null, 'Tramo'), h('th', { class: 'num' }, o.unidad || 'Valor'), h('th', null, 'Detalle'))),
        h('tbody', null, p.map(function (q) { return h('tr', null, h('td', null, q.etiqueta), h('td', { class: 'num' }, U.n(q.y, 1)), h('td', null, q.detalle || '')); }))));
    }
    return contenedor(o.titulo, cont, tabla, null);
  };
})();
