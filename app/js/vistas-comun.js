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
      out.push({ l: c.lc || c.l, v: function (r) { return valorCampo(c, r); }, tipo: tipoCol(c), dec: c.k === 'galones' ? 2 : 0, ancho: c.ancho });
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
    var modal;
    if (!nuevo && esq.idCampo && V.esAdmin()) {
      var etq = esq.idCampo === 'placa' ? 'placa' : 'cédula';
      cuerpo = h('div', { class: 'pila' }, h('p', { class: 'aviso' }, 'La ' + etq + ' identifica el registro. Si quedó mal escrita: ',
        h('button', { class: 'enlace', type: 'button', onclick: function () { modal.cerrar(); V.corregirId(col, rec); } }, 'Corregir ' + etq), ' (se trasladan también todos sus registros, archivos y usuarios).'), cuerpo);
    }
    modal = UI.modal({
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
          if (r.correo && !FL.Notif.correoValido(r.correo)) { f.error('correo', 'Correo no válido.'); return false; }
          if (r.correo) r.correo = r.correo.trim().toLowerCase();
          if (r.telefono) { var tel = r.telefono.replace(/\D/g, ''); if (!FL.Notif.celular(tel)) { f.error('telefono', 'Escriba el celular de 10 dígitos (empieza por 3).'); return false; } r.telefono = tel.slice(-10); }
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

  // ---------- Acciones sobre registros (Administrador: editar, anular, reactivar, eliminar) ----------
  V.accionesRegistro = function (col, r, extra) {
    var b = [];
    if (extra) b = b.concat(extra);
    if (!V.esAdmin()) return b.length ? h('div', { class: 'fila gap' }, b) : null;
    b.push(h('button', { class: 'btn xs', type: 'button', onclick: function () { V.editarRegistro(col, r); } }, 'Editar'));
    if (!r.anulado) {
      b.push(h('button', { class: 'btn xs peligro-t', type: 'button', onclick: async function () {
        var m = await UI.pedirTexto('Anular ' + FL.ESQ[col].uno, 'Motivo de la anulación', 'El registro no se borra: queda marcado como anulado, con su motivo, autor y fecha, y deja de sumar en los cálculos. Puede reactivarlo cuando quiera.');
        if (!m) return;
        try { await FL.Datos.anular(col, r.id, m, FL.ESQ[col].uno + ' ' + (r.placa || r.cedula || '')); UI.toast('Registro anulado.', 'ok'); FL.App.refrescar(); } catch (e) { UI.toast(e.message, 'error'); }
      } }, 'Anular'));
    } else {
      b.push(h('button', { class: 'btn xs', type: 'button', onclick: async function () {
        if (!(await UI.confirmar('Reactivar registro', 'El registro volverá a sumar en los cálculos. Motivo de la anulación: ' + (r.motivoAnulacion || '—'), 'Reactivar'))) return;
        try { await FL.Datos.restablecer(col, r.id, FL.ESQ[col].uno); UI.toast('Registro reactivado.', 'ok'); FL.App.refrescar(); } catch (e) { UI.toast(e.message, 'error'); }
      } }, 'Reactivar'));
    }
    b.push(V.botonEliminar(col, r));
    return h('div', { class: 'fila gap' }, b);
  };
  // Editar y eliminar para tablas de maestros
  V.accionesMaestro = function (col, r, extra) {
    var b = (extra || []).slice();
    if (V.esAdmin()) {
      b.push(h('button', { class: 'btn xs', type: 'button', onclick: function () { V.editarMaestro(col, r); } }, 'Editar'));
      b.push(V.botonEliminar(col, r));
    }
    return b.length ? h('div', { class: 'fila gap' }, b) : null;
  };
  V.botonEliminar = function (col, r, alTerminar) {
    return h('button', { class: 'btn xs peligro-t', type: 'button', onclick: function () { V.eliminar(col, r, alTerminar); } }, 'Eliminar');
  };

  // Registros que impiden eliminar un maestro (quedarían sin persona, vehículo o centro de costo)
  V.referencias = function (col, r) {
    var d = FL.App.datos(), out = [];
    function n(c, f, etq) { var k = (d[c] || []).filter(f).length; if (k) out.push(k + ' ' + etq); }
    if (col === 'razones') {
      n('centros', function (x) { return x.razonId === r.id; }, 'centro(s) de costo');
      n('personas', function (x) { return x.razonId === r.id; }, 'persona(s)');
      n('vehiculos', function (x) { return x.razonId === r.id; }, 'vehículo(s)');
    } else if (col === 'centros') {
      n('personas', function (x) { return x.centroId === r.id; }, 'persona(s) con este centro habitual');
      n('vehiculos', function (x) { return x.centroId === r.id; }, 'vehículo(s)');
      n('tanqueos', function (x) { return x.centroId === r.id; }, 'tanqueo(s)');
      n('recorridos', function (x) { return x.centroId === r.id; }, 'uso(s) diario(s)');
      n('mantenimientos', function (x) { return x.centroId === r.id; }, 'mantenimiento(s)');
    } else if (col === 'personas') {
      n('tanqueos', function (x) { return x.cedula === r.cedula; }, 'tanqueo(s)');
      n('recorridos', function (x) { return x.cedula === r.cedula; }, 'uso(s) diario(s)');
      n('mantenimientos', function (x) { return x.cedula === r.cedula; }, 'mantenimiento(s)');
      n('vehiculos', function (x) { return x.responsableCedula === r.cedula; }, 'vehículo(s) a su cargo');
      n('asignaciones', function (x) { return x.cedula === r.cedula; }, 'asignación(es) de vehículos');
    } else if (col === 'vehiculos') {
      n('tanqueos', function (x) { return x.placa === r.placa; }, 'tanqueo(s)');
      n('recorridos', function (x) { return x.placa === r.placa; }, 'uso(s) diario(s)');
      n('mantenimientos', function (x) { return x.placa === r.placa; }, 'mantenimiento(s)');
      n('documentos', function (x) { return x.placa === r.placa; }, 'documento(s)');
      n('asignaciones', function (x) { return x.placa === r.placa; }, 'asignación(es)');
    }
    return out;
  };
  V.nombreRegistro = function (col, r) {
    var e = FL.ESQ[col];
    return (e ? e.uno : 'registro') + ' ' + (r.placa && col !== 'personas' ? r.placa + ' ' : '') + (r.nombres || r.nombre || r.ciudad || r.equipo || r.tipo || r.cedula || '') + (r.fecha ? ' ' + U.fFecha(r.fecha) : r.fechaRecibe ? ' ' + U.fFecha(r.fechaRecibe) : '');
  };
  // Eliminación definitiva: copia completa en la bitácora; los archivos del registro también se eliminan
  V.eliminar = async function (col, r, alTerminar) {
    var refs = V.referencias(col, r);
    if (col === 'personas') {
      try { var us = (await FL.Datos.usuarios()).filter(function (u) { return u.cedula === r.cedula && u.activo; }); if (us.length) refs.push('el usuario activo «' + us[0].usuario + '» (dele de baja primero)'); } catch (e) { /* sin conexión */ }
    }
    var nombre = V.nombreRegistro(col, r);
    if (refs.length) {
      UI.modal({ titulo: 'No se puede eliminar', cuerpo: h('div', { class: 'pila' },
        h('p', null, 'No se puede eliminar ' + ({ personas: 'a ' + (r.nombres || ''), vehiculos: 'el vehículo ' + (r.placa || ''), centros: 'el centro de costo ' + (r.nombre || ''), razones: 'la razón social ' + (r.nombre || '') }[col] || 'este registro') + ' porque tiene ' + refs.join(', ') + '.'),
        h('p', { class: 'muted small' }, 'Elimine o reasigne primero esos registros' + (col === 'personas' ? ', o desmarque «Activa en la operación».' : col === 'vehiculos' ? ', o cambie su estado a «Dado de baja».' : col === 'razones' || col === 'centros' ? ', o desmárquelo como activo.' : '.') + ' Así ningún registro queda sin su persona, vehículo o centro de costo.')),
        acciones: [{ l: 'Entendido', tipo: 'primario' }] });
      return;
    }
    var adj = 0;
    try { adj = (await FL.Datos.fotos(col + '/' + r.id, true)).length; } catch (e) { /* se informa al eliminar */ }
    var m = await UI.pedirTexto('Eliminar ' + nombre.trim(), 'Motivo de la eliminación',
      'Se borra definitivamente' + (adj ? ' junto con su(s) ' + adj + ' archivo(s)' : '') + ' y deja de verse en todos los equipos. La bitácora conserva una copia completa del registro, el motivo, quién lo eliminó y cuándo. Si solo quiere que deje de sumar, use «Anular».', 'Eliminar definitivamente', true);
    if (!m) return;
    var listo = UI.cargando('Eliminando…');
    try { await FL.Datos.eliminar(col, r.id, m, nombre); UI.toast('Registro eliminado.', 'ok'); if (alTerminar) alTerminar(); else FL.App.refrescar(); }
    catch (e) { UI.toast(e.message, 'error'); }
    finally { listo(); }
  };

  // Corrección de la cédula o la placa (identificador del registro)
  V.corregirId = async function (col, r) {
    var placa = col === 'vehiculos', etq = placa ? 'placa' : 'cédula';
    var inp = h('input', { class: 'campo-input', inputmode: placa ? 'text' : 'numeric', autocomplete: 'off', value: placa ? r.placa : r.cedula });
    var err = h('p', { class: 'txt-error small' });
    var rel = V.referencias(col, r);
    UI.modal({ titulo: 'Corregir ' + etq,
      cuerpo: h('div', { class: 'pila' }, h('label', { class: 'campo' }, h('span', { class: 'campo-l' }, 'Nueva ' + etq), inp),
        h('p', { class: 'muted small' }, 'Se traslada a la nueva ' + etq + (rel.length ? ' todo lo relacionado (' + rel.join(', ') + '), sus archivos' : ' el registro con sus archivos') + (placa ? '' : ' y su usuario, si lo tiene') + '. Cada cambio queda en la bitácora.'), err),
      acciones: [{ l: 'Cancelar' }, { l: 'Corregir', tipo: 'primario', fn: async function () {
        var nv = placa ? U.normPlaca(inp.value) : U.normCedula(inp.value);
        if (!nv) { err.textContent = 'Escriba la ' + etq + '.'; return false; }
        var listo = UI.cargando('Trasladando registros…');
        try { await FL.Datos.cambiarId(col, placa ? r.placa : r.cedula, nv); }
        catch (e) { err.textContent = e.message; return false; }
        finally { listo(); }
        UI.toast(etq.charAt(0).toUpperCase() + etq.slice(1) + ' corregida.', 'ok');
        if (placa) FL.App.ir('/vehiculo/' + encodeURIComponent(nv)); else FL.App.refrescar();
      } }] });
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

  // ---------- Archivos: fotografías y documentos ----------
  V.ACEPTA = 'image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx';
  function extension(f) {
    var m = /\.([a-z0-9]{2,5})$/i.exec(f.nombre || '');
    return m ? m[1].toUpperCase() : (/pdf/.test(f.mime || '') ? 'PDF' : 'DOC');
  }
  function tamano(n) { return !n ? '' : n >= 1048576 ? U.n(n / 1048576, 1) + ' MB' : U.n(Math.max(1, n / 1024), 0) + ' KB'; }
  // opts: { tipos, principal(f), soloEscritor, alCambiar() }
  V.galeria = function (ref, opts) {
    opts = opts || {};
    var cont = h('div', { class: 'galeria' }, h('p', { class: 'muted small' }, 'Cargando archivos…'));
    var puedeSubir = opts.soloEscritor ? (V.esAdmin() || FL.Datos.yo().rol === 'Analista') : V.puedeIngresar();
    async function cargar(forzar) {
      try {
        var fotos = await FL.Datos.fotos(ref, forzar);
        U.clear(cont);
        if (!fotos.length && !puedeSubir) cont.appendChild(h('p', { class: 'muted small' }, 'Sin archivos.'));
        fotos.forEach(function (f) { cont.appendChild(tarjeta(f)); });
        if (puedeSubir) cont.appendChild(botonSubir());
        if (opts.alCambiar) opts.alCambiar(fotos);
      } catch (e) { U.clear(cont).appendChild(h('p', { class: 'txt-error small' }, e.message)); }
    }
    function tarjeta(f) {
      var img = FL.Datos.esImagen(f), incompleto = !img && f.completo === false;
      var vista = img ? h('img', { src: f.data, alt: f.tipo + ' ' + (f.descripcion || ''), loading: 'lazy', onclick: function () { ver(f); } })
        : h('button', { type: 'button', class: 'doc-vista', onclick: function () { ver(f); } }, h('span', { class: 'doc-ext' }, extension(f)), h('span', { class: 'doc-nombre' }, f.nombre || 'Documento'));
      var acc = [];
      if (!img && !incompleto) acc.push(h('button', { class: 'btn xs', type: 'button', onclick: function () { descargar(f); } }, 'Descargar'));
      if (V.esAdmin()) {
        acc.push(h('button', { class: 'btn xs', type: 'button', onclick: function () { editar(f); } }, 'Editar'));
        acc.push(h('button', { class: 'btn xs peligro-t', type: 'button', onclick: function () { eliminar(f); } }, 'Eliminar'));
      }
      return h('figure', { class: 'foto' + (incompleto ? ' incompleto' : '') }, vista,
        h('figcaption', null, h('strong', null, f.tipo), f.descripcion ? ' — ' + f.descripcion : '',
          h('span', { class: 'muted small block' }, U.fFechaHora(f._creado) + ' · ' + (f._creadoPorUsuario || '') + (f.bytes && !img ? ' · ' + tamano(f.bytes) : '')),
          incompleto ? h('span', { class: 'txt-error small block' }, 'Carga incompleta: elimínelo y cárguelo de nuevo.') : null,
          acc.length ? h('div', { class: 'fila gap wrap' }, acc) : null));
    }
    async function descargar(f) {
      var listo = UI.cargando('Preparando el archivo…');
      try { var blob = await FL.Datos.contenidoArchivo(f); U.download(blob, f.nombre || (U.nombreArchivo(f.tipo) + (FL.Datos.esImagen(f) ? '.jpg' : ''))); }
      catch (e) { UI.toast(e.message, 'error'); } finally { listo(); }
    }
    async function ver(f) {
      if (!FL.Datos.esImagen(f)) {
        if (f.completo === false) return UI.toast('La carga de este archivo no terminó.', 'error');
        var listo = UI.cargando('Abriendo el archivo…');
        try {
          var blob = await FL.Datos.contenidoArchivo(f), url = URL.createObjectURL(blob);
          var w = window.open(url, '_blank');
          if (!w) U.download(blob, f.nombre || 'documento');
          setTimeout(function () { URL.revokeObjectURL(url); }, 120000);
        } catch (e) { UI.toast(e.message, 'error'); } finally { listo(); }
        return;
      }
      var acc = [{ l: 'Descargar', fn: async function () { await descargar(f); return false; } }, { l: 'Cerrar' }];
      if (V.esAdmin() && opts.principal) acc.unshift({ l: 'Usar como foto principal', fn: async function () { await opts.principal(f); } });
      UI.modal({ titulo: f.tipo, ancho: true, cuerpo: h('div', { class: 'pila' }, h('img', { src: f.data, alt: '', class: 'foto-grande' }), h('p', { class: 'muted small' }, (f.descripcion || '') + ' · ' + U.fFechaHora(f._creado) + ' · ' + (f._creadoPorUsuario || '')), h('code', { class: 'huella' }, 'SHA-256 ' + (f.sha256 || ''))), acciones: acc });
    }
    function editar(f) {
      var tipo = h('select', { class: 'campo-input' });
      var lista = (opts.tipos || []).slice(); if (lista.indexOf(f.tipo) < 0) lista.unshift(f.tipo);
      lista.forEach(function (t) { tipo.appendChild(h('option', null, t)); }); tipo.value = f.tipo;
      var desc = h('input', { class: 'campo-input', value: f.descripcion || '' });
      UI.modal({ titulo: 'Editar archivo', cuerpo: h('div', { class: 'pila' }, h('label', { class: 'campo' }, h('span', { class: 'campo-l' }, 'Tipo'), tipo), h('label', { class: 'campo' }, h('span', { class: 'campo-l' }, 'Descripción'), desc),
        h('p', { class: 'muted small' }, 'Para cambiar el contenido, cargue el archivo nuevo y elimine el anterior.')),
        acciones: [{ l: 'Cancelar' }, { l: 'Guardar', tipo: 'primario', fn: async function () { await FL.Datos.editarArchivo(f, { tipo: tipo.value, descripcion: desc.value.trim() }); UI.toast('Archivo actualizado.', 'ok'); cargar(true); } }] });
    }
    async function eliminar(f) {
      var m = await UI.pedirTexto('Eliminar archivo', 'Motivo', 'Se borra definitivamente. La bitácora conserva el registro de quién lo eliminó, cuándo, el motivo y la huella digital del archivo.', 'Eliminar definitivamente', true);
      if (!m) return;
      var listo = UI.cargando('Eliminando…');
      try { await FL.Datos.eliminarArchivo(f, m); UI.toast('Archivo eliminado.', 'ok'); cargar(true); } catch (e) { UI.toast(e.message, 'error'); } finally { listo(); }
    }
    function botonSubir() {
      var tipo = h('select', { class: 'campo-input' }); (opts.tipos || ['Fotografía', 'Documento']).forEach(function (t) { tipo.appendChild(h('option', null, t)); });
      var desc = h('input', { class: 'campo-input', placeholder: 'Descripción (opcional)' });
      var file = h('input', { type: 'file', accept: V.ACEPTA, multiple: true, class: 'hidden', onchange: async function () {
        var lista = Array.from(file.files || []);
        if (!lista.length) return;
        var listo = UI.cargando('Cargando ' + lista.length + ' archivo(s)…'), ok = 0;
        try {
          for (var i = 0; i < lista.length; i++) {
            var fl = lista[i];
            if (/^image\//.test(fl.type)) {
              var data = await U.reducirImagen(fl, 1600, 0.75);
              if (data.length > 880000) data = await U.reducirImagen(fl, 1200, 0.62);
              await FL.Datos.subirFoto(ref, data, tipo.value, desc.value.trim());
            } else await FL.Datos.subirArchivo(ref, fl, tipo.value, desc.value.trim());
            ok++;
          }
          UI.toast(ok + ' archivo(s) guardado(s).', 'ok');
        } catch (e) { UI.toast((ok ? ok + ' archivo(s) guardado(s). ' : '') + e.message, 'error'); }
        finally { listo(); file.value = ''; cargar(true); }
      } });
      return h('div', { class: 'foto-nueva' }, tipo, desc, file,
        h('button', { class: 'btn sm', type: 'button', onclick: function () { file.click(); } }, '📎 Cargar foto o documento'),
        h('span', { class: 'muted small' }, 'Imágenes, PDF, Word o Excel (máx. 8 MB). Puede elegir varios.'));
    }
    cargar(false);
    return cont;
  };

  // Ventana para adjuntar soportes justo después de guardar un registro
  V.ofrecerSoporte = function (ref, titulo, tipos) {
    UI.modal({ titulo: titulo, ancho: true, cuerpo: h('div', { class: 'pila' }, h('p', null, 'Puede adjuntar la factura o tirilla, fotos del odómetro u otro soporte (imagen o PDF). Es opcional.'), V.galeria(ref, { tipos: tipos })), acciones: [{ l: 'Terminar', tipo: 'primario' }] });
  };
})();
