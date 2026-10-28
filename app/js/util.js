/* Utilidades generales: construcción de elementos, formatos colombianos, fechas y archivos. */
(function () {
  'use strict';
  var FL = (window.FL = window.FL || {});
  var U = (FL.U = {});

  // ---------- Construcción de elementos ----------
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'value') el.value = v;
        else if (k === 'checked') el.checked = !!v;
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      });
    }
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
    if (c instanceof Node) { el.appendChild(c); return; }
    el.appendChild(document.createTextNode(String(c)));
  }
  U.h = h;
  U.clear = function (el) { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  U.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  // ---------- Normalización ----------
  U.normCedula = function (v) { return String(v == null ? '' : v).replace(/\D/g, ''); };
  U.normPlaca = function (v) { return String(v == null ? '' : v).toUpperCase().replace(/[^A-Z0-9]/g, ''); };
  U.normUsuario = function (v) { return String(v || '').trim().toLowerCase().replace(/\s+/g, ''); };
  U.sinTildes = function (s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
  U.num = function (v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var s = String(v).trim().replace(/\s/g, '').replace(/\$/g, '');
    // Admite 1.234,56 (Colombia) y 1234.56
    if (/,\d{1,3}$/.test(s) && s.indexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    else s = s.replace(/,/g, '');
    var n = Number(s);
    return isFinite(n) ? n : null;
  };

  // ---------- Formatos (Colombia) ----------
  var fmtCOP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  U.cop = function (n) { return n === null || n === undefined || !isFinite(n) ? '—' : fmtCOP.format(Math.round(n)); };
  U.n = function (n, dec) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    return new Intl.NumberFormat('es-CO', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }).format(n);
  };
  U.km = function (n) { return n === null || n === undefined ? '—' : U.n(n, 0) + ' km'; };

  // ---------- Fechas (hora local del equipo; Colombia UTC-5) ----------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  U.toDate = function (v) {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (typeof v === 'number') return new Date(v);
    if (v.toDate) return v.toDate();
    var s = String(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) { var a = s.split(/[-T:]/); return new Date(+a[0], +a[1] - 1, +a[2], +a[3], +a[4]); }
    var d = new Date(s);
    return isNaN(d) ? null : d;
  };
  U.ymd = function (v) { var d = U.toDate(v || new Date()); return d ? d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) : ''; };
  U.ymdhm = function (v) { var d = U.toDate(v || new Date()); return d ? U.ymd(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) : ''; };
  U.fFecha = function (v) { var d = U.toDate(v); return d ? pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() : '—'; };
  U.fFechaHora = function (v) { var d = U.toDate(v); return d ? U.fFecha(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) : '—'; };
  U.anio = function (v) { var d = U.toDate(v); return d ? d.getFullYear() : null; };
  U.mes = function (v) { var d = U.toDate(v); return d ? d.getMonth() : null; };
  U.hoy = function () { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  // Días calendario desde hoy hasta la fecha (negativo = ya pasó)
  U.diasHasta = function (v) {
    var d = U.toDate(v); if (!d) return null;
    var a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((a - U.hoy()) / 86400000);
  };
  U.MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  U.DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  // ---------- Archivos ----------
  U.download = function (blob, nombre) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };
  U.sha256 = async function (data) {
    var buf = data instanceof Blob ? await data.arrayBuffer() : new TextEncoder().encode(String(data));
    var dig = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(dig)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  };
  U.nombreArchivo = function (s) { return U.sinTildes(s).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); };
  U.sello = function () { var d = new Date(); return U.ymd(d).replace(/-/g, '') + '_' + pad(d.getHours()) + pad(d.getMinutes()); };

  // Reduce una imagen a JPEG con lado mayor "max" y devuelve un dataURL
  U.reducirImagen = function (file, max, calidad) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onerror = function () { rej(new Error('No se pudo leer la imagen.')); };
      fr.onload = function () {
        var img = new Image();
        img.onerror = function () { rej(new Error('El archivo no es una imagen válida.')); };
        img.onload = function () {
          var w = img.naturalWidth, hh = img.naturalHeight, k = Math.min(1, max / Math.max(w, hh));
          var c = document.createElement('canvas');
          c.width = Math.round(w * k); c.height = Math.round(hh * k);
          var ctx = c.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', calidad || 0.72));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  };

  // Miniatura JPEG (lado mayor "max") a partir de un dataURL
  U.miniatura = function (dataUrl, max) {
    return new Promise(function (res, rej) {
      var img = new Image();
      img.onerror = function () { rej(new Error('No se pudo leer la imagen.')); };
      img.onload = function () {
        var k = Math.min(1, (max || 320) / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.72));
      };
      img.src = dataUrl;
    });
  };
  U.debounce = function (fn, ms) { var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); }; };
  U.sum = function (arr, f) { return arr.reduce(function (s, x) { var v = f ? f(x) : x; return s + (typeof v === 'number' && isFinite(v) ? v : 0); }, 0); };
  U.agrupar = function (arr, f) { var o = {}; arr.forEach(function (x) { var k = f(x); (o[k] = o[k] || []).push(x); }); return o; };
  U.porId = function (arr) { var o = {}; (arr || []).forEach(function (x) { o[x.id] = x; }); return o; };
})();
