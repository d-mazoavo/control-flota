/* Componentes de interfaz: avisos, ventanas, formularios generados desde el esquema y tablas con filtro. */
(function () {
  'use strict';
  var FL = (window.FL = window.FL || {});
  var U = FL.U, h = U.h;
  var UI = (FL.UI = {});

  // ---------- Avisos ----------
  UI.toast = function (msg, tipo) {
    var box = document.getElementById('toasts') || document.body.appendChild(h('div', { id: 'toasts', class: 'toasts', role: 'status' }));
    var t = h('div', { class: 'toast ' + (tipo || '') }, msg);
    box.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 400); }, tipo === 'error' ? 7000 : 3500);
  };

  // ---------- Ventanas ----------
  UI.modal = function (o) {
    var fondo = h('div', { class: 'modal-fondo' });
    var cerrar = function (v) { fondo.remove(); document.removeEventListener('keydown', esc); if (o.alCerrar) o.alCerrar(v); };
    var esc = function (e) { if (e.key === 'Escape' && !o.fijo) cerrar(); };
    var acciones = h('div', { class: 'modal-acciones' });
    (o.acciones || [{ l: 'Cerrar' }]).forEach(function (a) {
      acciones.appendChild(h('button', {
        class: 'btn ' + (a.tipo || ''), type: 'button', onclick: async function (e) {
          if (a.fn) {
            var b = e.currentTarget; b.disabled = true;
            try { var r = await a.fn(); if (r === false) { b.disabled = false; return; } } catch (x) { b.disabled = false; UI.toast(x.message || String(x), 'error'); return; }
          }
          cerrar(a.valor);
        }
      }, a.l));
    });
    var caja = h('div', { class: 'modal ' + (o.ancho ? 'ancho' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': o.titulo || '' },
      h('div', { class: 'modal-cab' }, h('h2', null, o.titulo || ''), o.fijo ? null : h('button', { class: 'btn-icono', type: 'button', 'aria-label': 'Cerrar', onclick: function () { cerrar(); } }, '×')),
      h('div', { class: 'modal-cuerpo' }, o.cuerpo),
      acciones);
    fondo.appendChild(caja);
    fondo.addEventListener('mousedown', function (e) { if (e.target === fondo && !o.fijo) cerrar(); });
    document.addEventListener('keydown', esc);
    document.body.appendChild(fondo);
    var foco = caja.querySelector('input:not([disabled]),select:not([disabled]),textarea'); if (foco) foco.focus({ preventScroll: true });
    return { cerrar: cerrar, caja: caja };
  };
  UI.confirmar = function (titulo, texto, etiqueta, peligro) {
    return new Promise(function (res) {
      UI.modal({ titulo: titulo, cuerpo: h('p', null, texto), alCerrar: function (v) { res(v === true); },
        acciones: [{ l: 'Cancelar', valor: false }, { l: etiqueta || 'Confirmar', tipo: peligro ? 'peligro' : 'primario', valor: true }] });
    });
  };
  UI.pedirTexto = function (titulo, etiqueta, ayuda, boton, peligro) {
    return new Promise(function (res) {
      var ta = h('textarea', { rows: 3, class: 'campo-input' });
      var err = h('p', { class: 'txt-error small' });
      UI.modal({
        titulo: titulo,
        cuerpo: h('div', { class: 'pila' }, h('label', { class: 'campo' }, h('span', { class: 'campo-l' }, etiqueta), ta), ayuda ? h('p', { class: 'muted small' }, ayuda) : null, err),
        alCerrar: function (v) { res(v === true ? ta.value.trim() : null); },
        acciones: [{ l: 'Cancelar', valor: false }, { l: boton || 'Aceptar', tipo: peligro ? 'peligro' : 'primario', valor: true, fn: function () { if (ta.value.trim().length < 5) { err.textContent = 'Escriba el motivo (mínimo 5 caracteres).'; return false; } } }]
      });
    });
  };
  UI.cargando = function (texto) {
    var f = h('div', { class: 'modal-fondo' }, h('div', { class: 'cargando' }, h('div', { class: 'giro' }), h('p', null, texto || 'Procesando…')));
    document.body.appendChild(f);
    return function () { f.remove(); };
  };

  // ---------- Etiquetas de estado ----------
  UI.chip = function (texto, tipo) { return h('span', { class: 'chip ' + (tipo || '') }, texto); };
  UI.chipEstado = function (estado) {
    var m = { 'Vencido': 'mal', 'Por vencer': 'alerta', 'Vigente': 'bien', 'Sin registro': 'alerta', 'Bajo': 'mal', 'Alto': 'alerta', 'Normal': 'bien', 'Sin referencia': '',
      'Próximo': 'alerta', 'Al día': 'bien', 'Alguna vencida': 'alerta', 'Abierto': 'info', 'Cerrado': '', 'Anulado': 'mal', 'Activo': 'bien', 'En mantenimiento': 'alerta', 'Fuera de servicio': 'mal', 'Dado de baja': '' };
    var iconos = { mal: '✕ ', alerta: '! ', bien: '✓ ' };
    var t = m[estado] || '';
    return UI.chip((iconos[t] || '') + estado, t);
  };

  // ---------- Etiquetas de referencias ----------
  UI.nombreRazon = function (id) { var r = FL.Datos.uno('razones', id); return r ? r.nombre : (id ? '(' + id + ')' : ''); };
  UI.nombreCentro = function (id) { var r = FL.Datos.uno('centros', id); return r ? (r.codigo ? r.codigo + ' · ' : '') + r.nombre : (id ? '(' + id + ')' : ''); };
  UI.nombrePersona = function (ced) { var r = FL.Datos.uno('personas', ced); return r ? r.nombres : ''; };
  UI.descVehiculo = function (p) { var v = FL.Datos.uno('vehiculos', p); return v ? v.placa + ' · ' + [v.tipo, v.marca, v.linea].filter(Boolean).join(' ') : (p || ''); };

  // ---------- Formulario generado desde el esquema ----------
  // opts: { campos: lista opcional de claves, excluir: [], alCambiar(rec, k), soloLectura: [] }
  UI.formulario = function (col, rec, opts) {
    opts = opts || {};
    var esq = FL.ESQ[col];
    var campos = esq.campos.filter(function (c) {
      if (c.calc && col !== 'tanqueos' && col !== 'recorridos') return false;
      if (c.oculto) return false;
      if (opts.campos && opts.campos.indexOf(c.k) < 0) return false;
      if (opts.excluir && opts.excluir.indexOf(c.k) >= 0) return false;
      return true;
    });
    var valores = Object.assign({}, rec || {});
    var nuevo = !rec || !rec.id;
    campos.forEach(function (c) {
      if (valores[c.k] === undefined && nuevo && c.def !== undefined) {
        valores[c.k] = c.def === 'ahora' ? U.ymdhm(new Date()) : c.def === 'hoy' ? U.ymd(new Date()) : (Array.isArray(c.def) ? c.def.slice() : c.def);
      }
    });
    var cont = h('div', { class: 'form' });
    var nodos = {};
    var grupoAct = null, rejilla = null, tituloAct = null;

    function nuevoGrupo(titulo) {
      tituloAct = titulo || null;
      grupoAct = h('fieldset', { class: 'grupo' }, titulo ? h('legend', null, titulo) : null);
      rejilla = h('div', { class: 'rejilla' });
      grupoAct.appendChild(rejilla);
      cont.appendChild(grupoAct);
    }
    nuevoGrupo(campos[0] && campos[0].grupo);

    campos.forEach(function (c) {
      if (c.grupo && c.grupo !== tituloAct) nuevoGrupo(c.grupo);
      var n = construir(c);
      nodos[c.k] = n;
      rejilla.appendChild(n.envoltura);
    });

    function requerido(c) { return typeof c.req === 'function' ? c.req(valores) : !!c.req; }
    function visible(c) { return !c.solo || c.solo(valores); }

    function construir(c) {
      var id = 'f-' + col + '-' + c.k;
      // Si la pantalla ya tiene un formulario igual (por ejemplo, al editar desde «Mis últimos registros»), se usa otro identificador
      if (document.getElementById(id)) { var sfx = 2; while (document.getElementById(id + '-' + sfx)) sfx++; id = id + '-' + sfx; }
      var v = valores[c.k];
      var input, extra = null;
      var bloqueado = (!nuevo && c.fijo) || (opts.soloLectura && opts.soloLectura.indexOf(c.k) >= 0) || c.calc;
      switch (c.t) {
        case 'textarea': input = h('textarea', { id: id, rows: 2, class: 'campo-input' }); input.value = v || ''; break;
        case 'number': case 'money':
          input = h('input', { id: id, type: 'number', class: 'campo-input', inputmode: 'decimal', step: c.t === 'money' ? 'any' : (c.step || 'any'), min: c.min != null ? c.min : null, max: c.max != null ? c.max : null });
          input.value = v == null ? '' : v; break;
        case 'date': input = h('input', { id: id, type: 'date', class: 'campo-input' }); input.value = v || ''; break;
        case 'datetime': input = h('input', { id: id, type: 'datetime-local', class: 'campo-input' }); input.value = v || ''; break;
        case 'bool': input = h('input', { id: id, type: 'checkbox', class: 'campo-check' }); input.checked = !!v; break;
        case 'select': input = selectOpts(id, c.opts, v); break;
        case 'razon': input = selectOpts(id, FL.Datos.lista('razones').filter(function (r) { return r.activo !== false || r.id === v; }).sort(porNombre).map(function (r) { return [r.id, r.nombre]; }), v); break;
        case 'centro': input = selectOpts(id, FL.Datos.lista('centros').filter(function (r) { return r.activo !== false || r.id === v; }).sort(porNombre).map(function (r) { return [r.id, UI.nombreCentro(r.id) + ' — ' + UI.nombreRazon(r.razonId)]; }), v); break;
        case 'vehiculo':
          input = selectOpts(id, FL.Datos.lista('vehiculos').filter(function (r) { return (r.estado !== 'Dado de baja' && !r.anulado) || r.id === v; }).sort(function (a, b) { return a.placa < b.placa ? -1 : 1; }).map(function (r) { return [r.placa, UI.descVehiculo(r.placa)]; }), v);
          extra = h('div', { class: 'ficha-ref' });
          break;
        case 'persona':
          input = h('input', { id: id, type: 'text', class: 'campo-input', inputmode: 'numeric', autocomplete: 'off', list: id + '-dl', placeholder: 'Número de cédula' });
          input.value = v || '';
          var dl = h('datalist', { id: id + '-dl' });
          FL.Datos.lista('personas').filter(function (p) { return p.activo !== false; }).forEach(function (p) { dl.appendChild(h('option', { value: p.cedula }, p.nombres + (p.cargo ? ' — ' + p.cargo : ''))); });
          extra = h('div', { class: 'ficha-ref' }, dl);
          break;
        case 'licencias':
          input = campoLicencias(id, FL.Calc.licencias(Object.assign({}, rec || {}, { licencias: v })));
          break;
        case 'multi':
          input = h('div', { class: 'multi', id: id });
          (c.opts || []).forEach(function (o) {
            var cb = h('input', { type: 'checkbox', value: o });
            cb.checked = (v || []).indexOf(o) >= 0;
            input.appendChild(h('label', { class: 'multi-op' }, cb, ' ', o));
          });
          break;
        default:
          input = h('input', { id: id, type: 'text', class: 'campo-input', inputmode: c.inputmode || null, autocomplete: 'off' });
          input.value = v == null ? '' : v;
      }
      if (bloqueado && input.tagName !== 'DIV') { input.disabled = true; }
      var lab = h('span', { class: 'campo-l' }, c.l);
      var err = h('span', { class: 'campo-err' });
      var env = c.t === 'bool'
        ? h('label', { class: 'campo campo-bool ' + (c.t === 'textarea' ? 'ancho' : ''), for: id }, input, h('span', null, c.l, c.ayuda ? h('span', { class: 'campo-ayuda' }, c.ayuda) : null), err)
        : h('div', { class: 'campo ' + (c.t === 'textarea' || c.t === 'multi' || c.t === 'licencias' ? 'ancho' : '') }, h('label', { for: id }, lab), input, extra, c.ayuda ? h('span', { class: 'campo-ayuda' }, c.ayuda) : null, err);
      var evento = function () { valores[c.k] = leerCampo(c, input); refrescar(c.k); };
      input.addEventListener('input', evento);
      input.addEventListener('change', evento);
      return { envoltura: env, input: input, extra: extra, lab: lab, err: err, c: c };
    }
    // Lista editable de licencias: una línea por categoría con su vencimiento
    function campoLicencias(id, lista) {
      var cont = h('div', { class: 'licencias', id: id });
      var filas = h('div', { class: 'lic-filas' });
      function fila(l) {
        var cat = h('select', { class: 'campo-input lic-cat', 'aria-label': 'Categoría' }, h('option', { value: '' }, 'Categoría'));
        FL.OPC.categoriasLicencia.forEach(function (o) { cat.appendChild(h('option', { value: o }, o)); });
        cat.value = (l && l.categoria) || '';
        var ven = h('input', { type: 'date', class: 'campo-input lic-ven', 'aria-label': 'Vencimiento' }); ven.value = (l && l.vence) || '';
        var f = h('div', { class: 'lic-fila' }, cat, ven, h('button', { type: 'button', class: 'btn xs peligro-t', 'aria-label': 'Quitar licencia', onclick: function () { f.remove(); cont.dispatchEvent(new Event('change')); } }, 'Quitar'));
        filas.appendChild(f);
      }
      (lista.length ? lista : [null]).forEach(fila);
      cont.appendChild(filas);
      cont.appendChild(h('button', { type: 'button', class: 'btn xs', onclick: function () { fila(null); cont.dispatchEvent(new Event('change')); } }, '+ Agregar otra categoría'));
      return cont;
    }
    function porNombre(a, b) { return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'); }
    function selectOpts(id, lista, v) {
      var s = h('select', { id: id, class: 'campo-input' }, h('option', { value: '' }, '— Seleccione —'));
      (lista || []).forEach(function (o) {
        var val = Array.isArray(o) ? o[0] : o, txt = Array.isArray(o) ? o[1] : o;
        s.appendChild(h('option', { value: val }, txt));
      });
      if (v != null && v !== '' && !Array.from(s.options).some(function (op) { return op.value === String(v); })) s.appendChild(h('option', { value: v }, String(v)));
      s.value = v == null ? '' : v;
      return s;
    }
    function leerCampo(c, input) {
      switch (c.t) {
        case 'number': case 'money': return input.value === '' ? null : Number(input.value);
        case 'bool': return input.checked;
        case 'multi': return Array.from(input.querySelectorAll('input:checked')).map(function (x) { return x.value; });
        case 'licencias': return Array.from(input.querySelectorAll('.lic-fila')).map(function (f) { return { categoria: f.querySelector('.lic-cat').value, vence: f.querySelector('.lic-ven').value || null }; }).filter(function (l) { return l.categoria || l.vence; });
        case 'persona': return U.normCedula(input.value);
        case 'text': return c.k === 'placa' ? U.normPlaca(input.value) : input.value.trim();
        default: return typeof input.value === 'string' ? input.value.trim() : input.value;
      }
    }
    function refrescar(k) {
      if (opts.alCambiar && k) opts.alCambiar(valores, k, api);
      campos.forEach(function (c) {
        var n = nodos[c.k];
        n.envoltura.classList.toggle('hidden', !visible(c));
        n.lab.classList.toggle('req', requerido(c));
        if (c.t === 'persona') fichaPersona(n);
        if (c.t === 'vehiculo') fichaVehiculo(n);
      });
    }
    function fichaPersona(n) {
      var ced = valores[n.c.k], dl = n.extra.querySelector('datalist');
      U.clear(n.extra); n.extra.appendChild(dl);
      if (!ced) return;
      var p = FL.Datos.uno('personas', ced);
      if (!p) { n.extra.appendChild(h('span', { class: 'txt-error small' }, 'Cédula no registrada. El Administrador debe crearla en Personas.')); return; }
      var lic = FL.Calc.licencias(p).map(function (l) {
        var dd = l.vence ? U.diasHasta(l.vence) : null;
        return h('span', { class: 'chip ' + (dd == null || dd < 0 ? 'mal' : dd <= (FL.App.param().diasAlerta || 30) ? 'alerta' : 'bien') }, l.categoria + (dd == null ? ' sin vencimiento' : dd < 0 ? ' VENCIDA ' + U.fFecha(l.vence) : ' vence ' + U.fFecha(l.vence)));
      });
      n.extra.appendChild(h('div', { class: 'ficha ' + (p.activo === false ? 'inactiva' : '') },
        h('strong', null, p.nombres), h('span', null, [p.cargo, UI.nombreRazon(p.razonId), p.centroId ? 'C. C. ' + UI.nombreCentro(p.centroId) : ''].filter(Boolean).join(' · ')),
        p.conductor ? (lic.length ? h('span', { class: 'fila gap wrap' }, 'Licencias:', lic) : h('span', { class: 'txt-alerta' }, 'Autorizado para conducir, sin licencias registradas.')) : null,
        p.activo === false ? h('span', { class: 'txt-error' }, 'Persona inactiva en la operación.') : null));
    }
    function fichaVehiculo(n) {
      U.clear(n.extra);
      var v = FL.Datos.uno('vehiculos', valores[n.c.k]);
      if (!v) return;
      var d = FL.App.datos();
      var ult = FL.Calc.ultimaLectura(v, d);
      var r = FL.Calc.rendimiento(v, d.tanqueos);
      var pyp = FL.Calc.picoYPlaca(v, new Date(), d.picoyplaca);
      n.extra.appendChild(h('div', { class: 'ficha' },
        h('span', null, 'Último kilometraje: ', h('strong', null, ult ? U.n(ult.km) + ' km' : 'sin registro'), ult ? ' (' + ult.fuente.toLowerCase() + ', ' + U.fFecha(ult.fecha) + ')' : ''),
        h('span', null, [v.combustible, v.capacidadTanque ? 'tanque ' + U.n(v.capacidadTanque, 1) + ' gal' : '', r.promedio ? 'promedio ' + U.n(r.promedio, 1) + ' km/gal' : '', v.responsableCedula ? 'asignado a ' + UI.nombrePersona(v.responsableCedula) : ''].filter(Boolean).join(' · ')),
        pyp.length ? h('span', { class: 'txt-alerta' }, 'Hoy tiene pico y placa en ' + pyp.map(function (x) { return x.ciudad + (x.horario ? ' (' + x.horario + ')' : ''); }).join(', ')) : null,
        v.estado && v.estado !== 'Activo' ? h('span', { class: 'txt-error' }, 'Estado: ' + v.estado) : null));
    }

    var api = {
      el: cont,
      valores: function () { return valores; },
      poner: function (k, v) {
        valores[k] = v;
        var n = nodos[k]; if (!n) return;
        if (n.c.t === 'bool') n.input.checked = !!v; else n.input.value = v == null ? '' : v;
        refrescar(null);
      },
      // Devuelve el registro limpio o null si hay errores (los muestra en cada campo)
      leer: function () {
        var ok = true, out = {};
        campos.forEach(function (c) {
          var n = nodos[c.k]; n.err.textContent = '';
          if (!visible(c)) { if (!c.calc) out[c.k] = c.t === 'bool' ? false : c.t === 'multi' ? [] : null; return; }
          var v = leerCampo(c, n.input);
          var vacio = v === null || v === '' || (Array.isArray(v) && !v.length);
          if (requerido(c) && vacio && !c.calc) { n.err.textContent = 'Obligatorio.'; ok = false; }
          if ((c.t === 'number' || c.t === 'money') && v != null && isNaN(v)) { n.err.textContent = 'Número no válido.'; ok = false; }
          if ((c.t === 'number' || c.t === 'money') && v != null && c.min != null && v < c.min) { n.err.textContent = 'Mínimo ' + c.min + '.'; ok = false; }
          if (c.t === 'money' && v != null && v < 0) { n.err.textContent = 'No puede ser negativo.'; ok = false; }
          if (c.t === 'persona' && v && !FL.Datos.uno('personas', v)) { n.err.textContent = 'Cédula no registrada.'; ok = false; }
          if (c.t === 'licencias') {
            var cats = {};
            v.forEach(function (l) {
              if (!l.categoria || !l.vence) { n.err.textContent = 'Cada licencia necesita la categoría y la fecha de vencimiento.'; ok = false; }
              else if (cats[l.categoria]) { n.err.textContent = 'La categoría ' + l.categoria + ' está repetida.'; ok = false; }
              cats[l.categoria] = 1;
            });
          }
          out[c.k] = vacio ? (c.t === 'multi' ? [] : null) : v;
        });
        if (!ok) { var e = cont.querySelector('.campo-err:not(:empty)'); if (e) e.closest('.campo').scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        return ok ? out : null;
      },
      error: function (k, msg) { if (nodos[k]) { nodos[k].err.textContent = msg; nodos[k].envoltura.scrollIntoView({ block: 'center' }); } },
      refrescar: refrescar
    };
    refrescar(null);
    return api;
  };

  // ---------- Tabla con búsqueda, filtros, orden y exportación ----------
  // o: { columnas: [{ l, v(r), f(r)?, tipo?: 'num'|'cop'|'fecha'|'fechahora', ancho? }], filas, nombre, filtros?: [{ l, opts:[[valor, texto]], fn(r, valor) }],
  //      alAbrir?(r), acciones?(r) -> nodos, vacio?, porPagina? }
  UI.tabla = function (o) {
    var orden = { i: o.ordenInicial != null ? o.ordenInicial : -1, desc: o.ordenDesc !== false };
    var texto = '', valoresFiltro = {}, limite = o.porPagina || 150;
    var cuerpo = h('tbody'), contador = h('span', { class: 'muted small' });
    var buscar = h('input', { type: 'search', class: 'campo-input buscar', placeholder: 'Buscar…', 'aria-label': 'Buscar en la tabla', oninput: U.debounce(function () { texto = U.sinTildes(buscar.value); limite = o.porPagina || 150; pintar(); }, 200) });
    var barra = h('div', { class: 'tabla-barra' }, buscar);
    (o.filtros || []).forEach(function (f, i) {
      var s = h('select', { class: 'campo-input filtro', 'aria-label': f.l, onchange: function () { valoresFiltro[i] = s.value; pintar(); } }, h('option', { value: '' }, f.l + ': todos'));
      f.opts.forEach(function (op) { s.appendChild(h('option', { value: op[0] }, op[1])); });
      if (f.def) { s.value = f.def; valoresFiltro[i] = f.def; }
      barra.appendChild(s);
    });
    barra.appendChild(h('span', { class: 'flex1' }));
    barra.appendChild(contador);
    if (o.nombre && !FL.Datos.esConductor()) barra.appendChild(h('button', { class: 'btn sm', type: 'button', onclick: function () { FL.Exportar.excel(o.nombre, [{ nombre: o.nombre, columnas: o.columnas, filas: filtradas() }], descripcionFiltros()); } }, '⬇ Excel'));
    var cab = h('tr');
    o.columnas.forEach(function (c, i) {
      var th = h('th', { class: (c.tipo === 'num' || c.tipo === 'cop' ? 'num' : ''), scope: 'col' }, h('button', { type: 'button', class: 'th-btn', onclick: function () { if (orden.i === i) orden.desc = !orden.desc; else { orden.i = i; orden.desc = c.tipo === 'num' || c.tipo === 'cop' || c.tipo === 'fecha' || c.tipo === 'fechahora'; } pintar(); } }, c.l, h('span', { class: 'orden' })));
      cab.appendChild(th);
    });
    if (o.acciones) cab.appendChild(h('th', null, ''));
    var tabla = h('table', { class: 'tabla' }, h('thead', null, cab), cuerpo);
    var mas = h('button', { class: 'btn sm hidden', type: 'button', onclick: function () { limite += 300; pintar(); } }, 'Mostrar más');
    var cont = h('div', { class: 'tabla-cont' }, barra, h('div', { class: 'tabla-scroll' }, tabla), h('div', { class: 'centrado' }, mas));

    function descripcionFiltros() {
      var d = [];
      if (buscar.value) d.push(['Búsqueda', buscar.value]);
      (o.filtros || []).forEach(function (f, i) { if (valoresFiltro[i]) { var op = f.opts.filter(function (x) { return String(x[0]) === String(valoresFiltro[i]); })[0]; d.push([f.l, op ? op[1] : valoresFiltro[i]]); } });
      return d;
    }
    function filtradas() {
      var filas = (typeof o.filas === 'function' ? o.filas() : o.filas).filter(function (r) {
        for (var i = 0; i < (o.filtros || []).length; i++) if (valoresFiltro[i] && !o.filtros[i].fn(r, valoresFiltro[i])) return false;
        if (!texto) return true;
        return U.sinTildes(o.columnas.map(function (c) { var v = c.v(r); return c.tipo === 'fecha' ? U.fFecha(v) : c.tipo === 'fechahora' ? U.fFechaHora(v) : v; }).join(' ')).indexOf(texto) >= 0;
      });
      if (orden.i >= 0) {
        var c = o.columnas[orden.i], k = orden.desc ? -1 : 1;
        filas.sort(function (a, b) {
          var x = c.v(a), y = c.v(b);
          if (c.tipo === 'fecha' || c.tipo === 'fechahora') { x = U.toDate(x) ? U.toDate(x).getTime() : -Infinity; y = U.toDate(y) ? U.toDate(y).getTime() : -Infinity; }
          if (x == null || x === '') return 1; if (y == null || y === '') return -1;
          return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es', { numeric: true })) * k;
        });
      }
      return filas;
    }
    function celda(c, r) {
      if (c.f) return c.f(r);
      var v = c.v(r);
      if (c.tipo === 'cop') return U.cop(v);
      if (c.tipo === 'num') return v == null || v === '' ? '—' : U.n(v, c.dec || 0);
      if (c.tipo === 'fecha') return U.fFecha(v);
      if (c.tipo === 'fechahora') return U.fFechaHora(v);
      if (typeof v === 'boolean') return v ? 'Sí' : 'No';
      return v == null || v === '' ? '—' : String(v);
    }
    function pintar() {
      var filas = filtradas();
      U.clear(cuerpo);
      Array.from(cab.querySelectorAll('.orden')).forEach(function (s, i) { s.textContent = i === orden.i ? (orden.desc ? ' ▼' : ' ▲') : ''; });
      filas.slice(0, limite).forEach(function (r) {
        var tr = h('tr', { class: (o.alAbrir ? 'clic ' : '') + (r.anulado ? 'anulada' : '') + (o.claseFila ? ' ' + (o.claseFila(r) || '') : '') });
        o.columnas.forEach(function (c) { tr.appendChild(h('td', { class: c.tipo === 'num' || c.tipo === 'cop' ? 'num' : '', 'data-l': c.l }, celda(c, r))); });
        if (o.acciones) tr.appendChild(h('td', { class: 'acc' }, o.acciones(r)));
        if (o.alAbrir) tr.addEventListener('click', function (e) { if (e.target.closest('button,a')) return; o.alAbrir(r); });
        cuerpo.appendChild(tr);
      });
      if (!filas.length) cuerpo.appendChild(h('tr', null, h('td', { colspan: o.columnas.length + (o.acciones ? 1 : 0), class: 'vacio' }, o.vacio || 'No hay registros.')));
      contador.textContent = filas.length + ' registro' + (filas.length === 1 ? '' : 's');
      mas.classList.toggle('hidden', filas.length <= limite);
    }
    pintar();
    cont.refrescar = pintar;
    cont.filtradas = filtradas;
    return cont;
  };

  // ---------- Tarjetas de indicadores ----------
  UI.kpi = function (titulo, valor, detalle, tipo) {
    return h('div', { class: 'kpi ' + (tipo || '') }, h('span', { class: 'kpi-t' }, titulo), h('strong', { class: 'kpi-v' }, valor), detalle ? h('span', { class: 'kpi-d' }, detalle) : null);
  };
  UI.seccion = function (titulo, contenido, acciones) {
    return h('section', { class: 'tarjeta' }, h('div', { class: 'tarjeta-cab' }, h('h2', null, titulo), acciones ? h('div', { class: 'fila gap' }, acciones) : null), contenido);
  };
  UI.datosClave = function (pares) {
    return h('dl', { class: 'datos' }, pares.filter(function (p) { return p && p[1] !== undefined && p[1] !== null && p[1] !== ''; }).map(function (p) { return h('div', null, h('dt', null, p[0]), h('dd', null, p[1])); }));
  };
})();
