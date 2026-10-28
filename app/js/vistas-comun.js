/* Piezas comunes de las vistas: columnas, edición de maestros, acciones sobre registros y fotografías. */
(function () {
  'use strict';
  var FL = (window.FL = window.FL || {});
  var U = FL.U, h = U.h, UI = FL.UI;
  var V = (FL.Vistas = {});

  V.reglaClave = function (c, usuario) {
    c = String(c || '');
    if (c.length < 10) return 'La contraseña debe tener al menos 10 caracteres.';
    if (!/[a-zñáéíóú]/i.test(c) || !/\d/.test(c)) return 'La contraseña debe combinar letras y números.';
    if (usuario && c.toLowerCase().indexOf(U.normUsuario(usuario)) >= 0) return 'La contraseña no puede contener el usuario.';
    return null;
  };
  V.esAdmin = function () { return FL.Datos.esAdmin(); };
  V.puedeIngresar = function () { return FL.Datos.puedeIngresar(); };
  V.titulo = function (t, sub, acciones) {
    return h('div', { class: 'titulo' }, h('div', null, h('h1', null, t), sub ? h('p', { class: 'muted' }, sub) : null), acciones ? h('div', { class: 'fila gap wrap' }, acciones) : null);
  };
  V.selectorAnio = function (anio, alCambiar) {
    var anios = {}; var hoy = new Date().getFullYear();
    for (var a = hoy + 1; a >= hoy - 6; a--) anios[a] = 1;
    var s = h('select', { class: 'campo-input sel-anio', 'aria-label': 'Año', onchange: function () { alCambiar(Number(s.value)); } });
    Object.keys(anios).sort().reverse().forEach(function (a) { s.appendChild(h('option', { value: a }, 'Año ' + a)); });
    s.value = String(anio);
    return s;
  };
  V.anio = new Date().getFullYear();

  // ---------- Columnas para tablas y Excel ----------
  function valorCampo(c, r) {
    var v = r[c.k];
    switch (c.t) {
      case 'persona': return v ? (r[c.k === 'cedula' ? 'personaNombre' : c.k + 'Nombre'] || UI.nombrePersona(v) || '') : '';
      case 'centro': return v ? (r.centroNombre && c.k === 'centroId' ? r.centroNombre : UI.nombreCentro(v)) : '';
      case 'razon': return v ? UI.nombreRazon(v) : '';
      case 'multi': return Array.isArray(v) ? v.join(', ') : (v || '');
      case 'licencias': return FL.Calc.textoLicencias(r);
      case 'bool': return v === true ? 'Sí' : v === false ? 'No' : '';
      default: return v;
    }
  }
  function tipoCol(c) { return c.t === 'money' ? 'cop' : c.t === 'number' ? 'num' : c.t === 'date' ? 'fecha' : c.t === 'datetime' ? 'fechahora' : null; }
  V.columnas = function (col, extra) {
    var out = [];
    FL.ESQ[col].campos.filter(function (c) { return c.lista; }).forEach(function (c) {
      if (c.t === 'persona') {
        out.push({ l: c.l.replace(/ \(cédula\)| \/ recibe/g, '').replace('Cédula de quien tanquea', 'Quien tanquea').replace('Cédula del conductor', 'Conductor'), v: function (r) { return valorCampo(c, r); }, f: function (r) { var n = valorCampo(c, r); return r[c.k] ? h('span', null, n || '—', h('span', { class: 'muted small block' }, 'C. C. ' + r[c.k])) : '—'; }, ancho: 28 });
        return;
      }
      out.push({ l: c.l, v: function (r) { return valorCampo(c, r); }, tipo: tipoCol(c), dec: c.k === 'galones' ? 2 : 0, ancho: c.ancho });
    });
    return out.concat(extra || []);
  };
  V.columnasExport = function (col) {
    var out = [];
    if (col === 'asignaciones') {
      return [{ l: 'Placa', v: function (r) { return r.placa; } }, { l: 'Cédula', v: function (r) { return r.cedula; } }, { l: 'Responsable', v: function (r) { return r.nombre; } },
        { l: 'Desde', v: function (r) { return r.desde; }, tipo: 'fechahora' }, { l: 'Hasta', v: function (r) { return r.hasta; }, tipo: 'fechahora' }].concat(meta());
    }
    FL.ESQ[col].campos.forEach(function (c) {
      if (c.t === 'persona') { out.push({ l: c.l, v: function (r) { return r[c.k] || ''; } }); out.push({ l: 'Nombre (' + c.l.replace(/ \(cédula\)/, '').toLowerCase() + ')', v: function (r) { return valorCampo(c, r); }, ancho: 28 }); return; }
      out.push({ l: c.l, v: function (r) { return valorCampo(c, r); }, tipo: tipoCol(c), dec: c.k === 'galones' || c.k === 'capacidadTanque' || c.k === 'rendimientoRef' ? 2 : 0, ancho: c.ancho });
    });
    if (FL.ESQ[col].registro) out.push({ l: 'Razón social', v: function (r) { return r.razonNombre || UI.nombreRazon(r.razonId) || ''; }, ancho: 24 });
    return out.concat(meta());
    function meta() {
      return [
        { l: 'Anulado', v: function (r) { return r.anulado ? 'Sí' : 'No'; } },
        { l: 'Motivo de anulación', v: function (r) { return r.motivoAnulacion || ''; } },
        { l: 'Registrado por', v: function (r) { return r._creadoPorUsuario || ''; } },
        { l: 'Fecha de registro', v: function (r) { return r._creado; }, tipo: 'fechahora' },
        { l: 'Última modificación por', v: function (r) { return r._modPorUsuario || ''; } },
        { l: 'Fecha de modificación', v: function (r) { return r._mod; }, tipo: 'fechahora' },
        { l: 'Id interno', v: function (r) { return r.id; } }
      ];
    }
  };

  // ---------- Datos derivados que se guardan con cada registro ----------
  V.completar = function (col, r) {
    var o = Object.assign({}, r);
    if (o.cedula) o.personaNombre = UI.nombrePersona(o.cedula);
    if (o.centroId) {
      var c = FL.Datos.uno('centros', o.centroId);
      o.centroNombre = UI.nombreCentro(o.centroId);
      o.razonId = c ? c.razonId : null;
      o.razonNombre = c ? UI.nombreRazon(c.razonId) : '';
    }
    if (o.placa) o.vehiculoDesc = UI.descVehiculo(o.placa);
    if (col === 'tanqueos') {
      o.valorTotal = Math.round((o.galones || 0) * (o.precioGalon || 0));
      if (o.destino !== 'Vehículo') { o.placa = null; o.odometro = null; o.tanqueLleno = null; o.vehiculoDesc = ''; }
      else { o.equipo = null; o.justificacion = null; }
    }
    if (col === 'recorridos') {
      o.kmRecorridos = typeof o.kmEntrega === 'number' ? o.kmEntrega - o.kmRecibe : null;
      o.estado = typeof o.kmEntrega === 'number' ? 'Cerrado' : 'Abierto';
    }
    return o;
  };

  // ---------- Edición de maestros (solo Administrador) ----------
  V.editarMaestro = function (col, rec, alGuardar) {
    var esq = FL.ESQ[col], nuevo = !rec;
    var f = UI.formulario(col, rec || null, {});
    var angulos = col === 'vehiculos' ? V.cuatroAngulos(rec ? rec.placa : null, { editable: true }) : null;
    var cuerpo = angulos ? h('div', { class: 'pila' }, f.el, h('fieldset', { class: 'grupo' }, h('legend', null, 'Registro fotográfico (4 ángulos)'),
      h('p', { class: 'muted small' }, 'Frente, costado izquierdo, costado derecho y posterior. Quedan en la hoja de vida y en su PDF; la del frente es la foto principal. En el celular puede tomarlas directamente con la cámara.'), angulos.el)) : f.el;
    UI.modal({
      titulo: (nuevo ? 'Nuevo ' : 'Editar ') + esq.uno, ancho: true, cuerpo: cuerpo,
      acciones: [{ l: 'Cancelar' }, { l: 'Guardar', tipo: 'primario', fn: async function () {
        var r = f.leer(); if (!r) return false;
        var id = esq.idCampo ? (esq.idCampo === 'placa' ? U.normPlaca(r.placa) : U.normCedula(r.cedula)) : (rec ? rec.id : null);
        if (esq.idCampo) {
          r[esq.idCampo] = id;
          if (!id) { f.error(esq.idCampo, 'Obligatorio.'); return false; }
          if (nuevo && FL.Datos.uno(col, id)) { f.error(esq.idCampo, 'Ya existe un registro con ' + (esq.idCampo === 'placa' ? 'esta placa' : 'esta cédula') + '.'); return false; }
        }
        if (col === 'personas') {
          if (r.conductor && !(r.licencias && r.licencias.length)) { f.error('licencias', 'Registre al menos una licencia (categoría y vencimiento) de quien está autorizado para conducir.'); return false; }
          r.licencias = r.conductor ? r.licencias : [];
          r.licenciaCategoria = null; r.licenciaVence = null;   // formato anterior (una sola licencia)
        }
        var resumen = esq.uno + ' ' + (r.placa || r.cedula || r.nombre || r.ciudad || '');
        if (col === 'vehiculos') {
          await guardarVehiculo(rec, id, r, resumen);
          if (angulos.pendientes()) {
            try { var n = await angulos.subir(id); UI.toast(n + ' fotografía(s) guardada(s).', 'ok'); }
            catch (e) { UI.toast('El vehículo quedó guardado, pero no se pudieron subir las fotografías: ' + e.message + ' Súbalas desde la hoja de vida.', 'error'); }
          }
        }
        else if (nuevo) await FL.Datos.crear(col, r, id, resumen);
        else await FL.Datos.modificar(col, rec.id, r, resumen);
        UI.toast('Guardado.', 'ok');
        if (alGuardar) alGuardar(id); else FL.App.refrescar();
      } }]
    });
  };
  // El cambio de responsable cierra la asignación vigente y abre una nueva en la misma operación
  async function guardarVehiculo(rec, placa, r, resumen) {
    var ops = [];
    var antes = rec ? rec.responsableCedula || '' : '';
    var ahora = r.responsableCedula || '';
    if (rec) {
      var cambios = {};
      Object.keys(r).forEach(function (k) { if (JSON.stringify(rec[k] == null ? null : rec[k]) !== JSON.stringify(r[k] == null ? null : r[k])) cambios[k] = [rec[k] == null ? null : rec[k], r[k]]; });
      if (!Object.keys(cambios).length) return;
      ops.push({ tipo: 'modificar', col: 'vehiculos', id: placa, data: r, resumen: resumen, cambios: cambios });
    } else ops.push({ tipo: 'crear', col: 'vehiculos', id: placa, data: Object.assign({ anulado: false }, r), resumen: resumen });
    if (antes !== ahora) {
      var marca = U.ymdhm(new Date());
      FL.Datos.lista('asignaciones').filter(function (a) { return a.placa === placa && !a.hasta && !a.anulado; }).forEach(function (a) {
        ops.push({ tipo: 'modificar', col: 'asignaciones', id: a.id, data: { hasta: marca }, resumen: 'Fin de asignación ' + placa + ' a ' + (a.nombre || a.cedula) });
      });
      if (ahora) ops.push({ tipo: 'crear', col: 'asignaciones', data: { placa: placa, cedula: ahora, nombre: UI.nombrePersona(ahora), desde: marca, hasta: null, anulado: false }, resumen: 'Asignación ' + placa + ' a ' + UI.nombrePersona(ahora) });
    }
    await FL.Datos.confirmar(ops);
  }

  // ---------- Acciones sobre registros (Administrador: editar, anular, reactivar) ----------
  V.accionesRegistro = function (col, r, extra) {
    var b = [];
    if (extra) b = b.concat(extra);
    if (!V.esAdmin()) return b.length ? h('div', { class: 'fila gap' }, b) : null;
    if (!r.anulado) {
      b.push(h('button', { class: 'btn xs', type: 'button', onclick: function () { V.editarRegistro(col, r); } }, 'Editar'));
      b.push(h('button', { class: 'btn xs peligro-t', type: 'button', onclick: async function () {
        var m = await UI.pedirTexto('Anular ' + FL.ESQ[col].uno, 'Motivo de la anulación', 'El registro no se borra: queda marcado como anulado, con su motivo, autor y fecha, y deja de sumar en los cálculos.');
        if (!m) return;
        try { await FL.Datos.anular(col, r.id, m, FL.ESQ[col].uno + ' ' + (r.placa || r.cedula || '')); UI.toast('Registro anulado.', 'ok'); FL.App.refrescar(); } catch (e) { UI.toast(e.message, 'error'); }
      } }, 'Anular'));
    } else {
      b.push(h('button', { class: 'btn xs', type: 'button', onclick: async function () {
        if (!(await UI.confirmar('Reactivar registro', 'El registro volverá a sumar en los cálculos. Motivo de la anulación: ' + (r.motivoAnulacion || '—'), 'Reactivar'))) return;
        try { await FL.Datos.restablecer(col, r.id, FL.ESQ[col].uno); UI.toast('Registro reactivado.', 'ok'); FL.App.refrescar(); } catch (e) { UI.toast(e.message, 'error'); }
      } }, 'Reactivar'));
    }
    return h('div', { class: 'fila gap' }, b);
  };
  V.editarRegistro = function (col, r) {
    var f = UI.formulario(col, r, { alCambiar: FL.Vistas.alCambiarRegistro && FL.Vistas.alCambiarRegistro(col) });
    UI.modal({
      titulo: 'Editar ' + FL.ESQ[col].uno, ancho: true,
      cuerpo: h('div', { class: 'pila' }, h('p', { class: 'aviso' }, 'La modificación queda en la bitácora con el valor anterior y el nuevo.'), f.el),
      acciones: [{ l: 'Cancelar' }, { l: 'Guardar cambios', tipo: 'primario', fn: async function () {
        var x = f.leer(); if (!x) return false;
        var o = V.completar(col, Object.assign({}, x));
        await FL.Datos.modificar(col, r.id, o, FL.ESQ[col].uno + ' ' + (o.placa || o.cedula || ''));
        UI.toast('Cambios guardados.', 'ok'); FL.App.refrescar();
      } }]
    });
  };

  // ---------- Registro fotográfico del vehículo: 4 ángulos ----------
  // opts: { editable: bool, inmediato: bool (sube al elegir; si no, queda pendiente hasta subir()) , alCambiar() }
  V.cuatroAngulos = function (placa, opts) {
    opts = opts || {};
    var pend = {}, slots = {};
    var el = h('div', { class: 'angulos' });
    FL.OPC.angulos.forEach(function (a) {
      var marco = h('div', { class: 'angulo-img vacia' }, h('span', null, 'Sin fotografía'));
      var estado = h('span', { class: 'muted small block' });
      var file = h('input', { type: 'file', accept: 'image/*', class: 'hidden', 'data-angulo': a, onchange: async function () {
        if (!file.files[0]) return;
        var listo = UI.cargando('Reduciendo la fotografía…');
        try {
          var data = await U.reducirImagen(file.files[0], 1400, 0.72);
          if (data.length > 880000) data = await U.reducirImagen(file.files[0], 1000, 0.6);
          if (opts.inmediato) {
            listo(); listo = UI.cargando('Guardando la fotografía…');
            await FL.Datos.subirFoto('vehiculos/' + placa, data, a, 'Registro fotográfico');
            if (a === 'Frente' || !(FL.Datos.uno('vehiculos', placa) || {}).miniatura) await ponerMiniatura(placa, data);
            mostrar(a, data, 'Guardada ' + U.fFechaHora(new Date()));
            UI.toast('Fotografía «' + a + '» guardada.', 'ok');
            if (opts.alCambiar) opts.alCambiar();
          } else { pend[a] = data; mostrar(a, data, 'Pendiente: se guarda al hacer clic en «Guardar»'); }
        } catch (e) { UI.toast(e.message, 'error'); } finally { listo(); file.value = ''; }
      } });
      var btn = opts.editable ? h('button', { type: 'button', class: 'btn xs', onclick: function () { file.click(); } }, '📷 Tomar o elegir') : null;
      slots[a] = { marco: marco, estado: estado, btn: btn };
      el.appendChild(h('figure', { class: 'angulo' }, marco, h('figcaption', null, h('strong', null, a), estado, btn, file)));
    });
    function mostrar(a, data, texto) {
      var s = slots[a];
      U.clear(s.marco).classList.remove('vacia');
      s.marco.appendChild(h('img', { src: data, alt: 'Vehículo — ' + a, onclick: function () { UI.modal({ titulo: a, ancho: true, cuerpo: h('img', { src: data, alt: '', class: 'foto-grande' }) }); } }));
      s.estado.textContent = texto || '';
      if (s.btn) s.btn.textContent = '📷 Cambiar';
    }
    if (placa) FL.Datos.ultimasPorTipo('vehiculos/' + placa).then(function (o) {
      FL.OPC.angulos.forEach(function (a) { if (o[a] && !pend[a]) mostrar(a, o[a].data, U.fFechaHora(o[a]._creado) + ' · ' + (o[a]._creadoPorUsuario || '')); });
    }).catch(function () { /* sin conexión: se muestran vacíos */ });
    return {
      el: el,
      pendientes: function () { return Object.keys(pend).length; },
      // Sube las fotografías pendientes del vehículo ya guardado
      subir: async function (p) {
        var lista = FL.OPC.angulos.filter(function (a) { return pend[a]; });
        if (!lista.length) return 0;
        var listo = UI.cargando('Guardando ' + lista.length + ' fotografía(s)…'), n = 0;
        try {
          for (var i = 0; i < lista.length; i++) { await FL.Datos.subirFoto('vehiculos/' + p, pend[lista[i]], lista[i], 'Registro fotográfico'); n++; }
          var base = pend['Frente'] || (!(FL.Datos.uno('vehiculos', p) || {}).miniatura ? pend[lista[0]] : null);
          if (base) await ponerMiniatura(p, base);
          pend = {};
        } finally { listo(); }
        return n;
      }
    };
  };
  async function ponerMiniatura(placa, data) {
    var mini = await U.miniatura(data, 320);
    await FL.Datos.modificar('vehiculos', placa, { miniatura: mini }, 'Foto principal ' + placa);
  }
  V.ponerMiniatura = ponerMiniatura;

  // ---------- Fotografías ----------
  V.galeria = function (ref, opts) {
    opts = opts || {};
    var cont = h('div', { class: 'galeria' }, h('p', { class: 'muted small' }, 'Cargando fotografías…'));
    async function cargar() {
      try {
        var fotos = await FL.Datos.fotos(ref);
        U.clear(cont);
        if (!fotos.length) cont.appendChild(h('p', { class: 'muted small' }, 'Sin fotografías.'));
        fotos.forEach(function (f) {
          cont.appendChild(h('figure', { class: 'foto' },
            h('img', { src: f.data, alt: f.tipo + ' ' + (f.descripcion || ''), loading: 'lazy', onclick: function () { ver(f); } }),
            h('figcaption', null, h('strong', null, f.tipo), f.descripcion ? ' — ' + f.descripcion : '', h('span', { class: 'muted small block' }, U.fFechaHora(f._creado) + ' · ' + (f._creadoPorUsuario || '')))));
        });
        if (V.puedeIngresar()) cont.appendChild(botonFoto());
      } catch (e) { U.clear(cont).appendChild(h('p', { class: 'txt-error small' }, e.message)); }
    }
    function ver(f) {
      var acc = [{ l: 'Cerrar' }];
      if (V.esAdmin()) {
        acc.unshift({ l: 'Eliminar fotografía', tipo: 'peligro', fn: async function () {
          var m = await UI.pedirTexto('Eliminar fotografía', 'Motivo', 'La eliminación queda en la bitácora con la huella de la imagen.');
          if (!m) return false;
          await FL.Datos.borrarFoto(f, m); UI.toast('Fotografía eliminada.', 'ok'); cargar();
        } });
        if (opts.principal) acc.unshift({ l: 'Usar como foto principal', fn: async function () { await opts.principal(f); } });
      }
      UI.modal({ titulo: f.tipo, ancho: true, cuerpo: h('div', { class: 'pila' }, h('img', { src: f.data, alt: '', class: 'foto-grande' }), h('p', { class: 'muted small' }, (f.descripcion || '') + ' · ' + U.fFechaHora(f._creado) + ' · ' + (f._creadoPorUsuario || '')), h('code', { class: 'huella' }, 'SHA-256 ' + (f.sha256 || ''))), acciones: acc });
    }
    function botonFoto() {
      var tipo = h('select', { class: 'campo-input' }); (opts.tipos || ['Fotografía']).forEach(function (t) { tipo.appendChild(h('option', null, t)); });
      var desc = h('input', { class: 'campo-input', placeholder: 'Descripción (opcional)' });
      var file = h('input', { type: 'file', accept: 'image/*', class: 'hidden', onchange: async function () {
        if (!file.files[0]) return;
        var listo = UI.cargando('Reduciendo y enviando la fotografía…');
        try {
          var data = await U.reducirImagen(file.files[0], 1400, 0.72);
          if (data.length > 880000) data = await U.reducirImagen(file.files[0], 1000, 0.6);
          await FL.Datos.subirFoto(ref, data, tipo.value, desc.value.trim());
          UI.toast('Fotografía guardada.', 'ok'); cargar();
        } catch (e) { UI.toast(e.message, 'error'); } finally { listo(); file.value = ''; }
      } });
      return h('div', { class: 'foto-nueva' }, tipo, desc, file, h('button', { class: 'btn sm', type: 'button', onclick: function () { file.click(); } }, '📷 Agregar fotografía'));
    }
    cargar();
    return cont;
  };

  // Ventana para adjuntar soportes justo después de guardar un registro
  V.ofrecerSoporte = function (ref, titulo, tipos) {
    UI.modal({ titulo: titulo, ancho: true, cuerpo: h('div', { class: 'pila' }, h('p', null, 'Puede adjuntar la foto de la factura o tirilla, del odómetro u otro soporte. Es opcional.'), V.galeria(ref, { tipos: tipos })), acciones: [{ l: 'Terminar', tipo: 'primario' }] });
  };
})();
