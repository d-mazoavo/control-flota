/* Formularios de ingreso: tanqueo, uso diario (recibe / entrega), mantenimiento y documento. */
(function () {
  'use strict';
  var FL = (window.FL = window.FL || {});
  var U = FL.U, h = U.h, UI = FL.UI, V = FL.Vistas, App = FL.App;
  var A = 'Administrador', N = 'Analista';

  // Autocompletado común: la cédula y la placa llenan el resto de la información
  V.alCambiarRegistro = function (col) {
    var tocadoTotal = false;
    return function (r, k, f) {
      if (!f) return;
      if (k === 'cedula') {
        var p = FL.Datos.uno('personas', r.cedula);
        if (p && p.centroId && !r.centroId && !(col === 'tanqueos' && r.destino === 'Vehículo' && r.placa)) f.poner('centroId', p.centroId);
      }
      if (k === 'placa') {
        var v = FL.Datos.uno('vehiculos', r.placa);
        if (!v) return;
        if (v.centroId) f.poner('centroId', v.centroId);
        if (col === 'tanqueos' && v.combustible && FL.OPC.combustiblesTanqueo.indexOf(v.combustible) >= 0) f.poner('combustible', v.combustible);
        if (col === 'recorridos' && r.kmRecibe == null) { var u = FL.Calc.ultimaLectura(v, App.datos()); if (u) f.poner('kmRecibe', u.km); }
        if (col === 'tanqueos' && !r.cedula && v.responsableCedula) f.poner('cedula', v.responsableCedula);
      }
      if (col === 'tanqueos' && (k === 'galones' || k === 'precioGalon' || k === null)) {
        f.poner('valorTotal', r.galones && r.precioGalon ? Math.round(r.galones * r.precioGalon) : null);
      }
      if (col === 'mantenimientos') {
        if (k === 'valorTotal') tocadoTotal = true;
        if ((k === 'manoObra' || k === 'repuestos') && !tocadoTotal && (r.manoObra != null || r.repuestos != null)) f.poner('valorTotal', (r.manoObra || 0) + (r.repuestos || 0));
      }
      if (col === 'recorridos' && (k === 'kmEntrega' || k === 'kmRecibe')) {
        f.poner('kmRecorridos', typeof r.kmEntrega === 'number' && typeof r.kmRecibe === 'number' ? r.kmEntrega - r.kmRecibe : null);
      }
    };
  };

  // Verificaciones previas al guardado. Devuelve las advertencias que se anotan en el registro, o null si se cancela.
  async function verificar(col, r) {
    var notas = [], avisos = [];
    var d = App.datos();
    var v = r.placa ? FL.Datos.uno('vehiculos', r.placa) : null;
    var p = r.cedula ? FL.Datos.uno('personas', r.cedula) : null;
    var km = col === 'tanqueos' ? r.odometro : col === 'recorridos' ? r.kmRecibe : col === 'mantenimientos' ? r.odometro : null;
    if (v && typeof km === 'number') {
      var ult = FL.Calc.ultimaLectura(v, d);
      if (ult && km < ult.km) {
        avisos.push('El kilometraje registrado (' + U.n(km) + ') es MENOR que la última lectura del vehículo (' + U.n(ult.km) + ' km, ' + ult.fuente.toLowerCase() + ' del ' + U.fFecha(ult.fecha) + ').');
        notas.push('Kilometraje menor que la última lectura (' + U.n(ult.km) + ' km).');
      }
      if (col === 'recorridos' && ult && km - ult.km > (FL.App.param().kmBrecha || 5)) {
        avisos.push('Hay ' + U.n(km - ult.km) + ' km de diferencia con la última lectura registrada (' + U.n(ult.km) + ' km): recorrido sin registrar.');
        notas.push(U.n(km - ult.km) + ' km sin registrar desde la última lectura.');
      }
    }
    if (col === 'tanqueos' && v && v.capacidadTanque > 0 && r.galones > v.capacidadTanque * 1.05) {
      avisos.push('Se registran ' + U.n(r.galones, 2) + ' galones y la capacidad del tanque es ' + U.n(v.capacidadTanque, 1) + ' galones.');
      notas.push('Galones superiores a la capacidad del tanque.');
    }
    if (col === 'recorridos' && p) {
      if (!p.conductor) { avisos.push(p.nombres + ' NO está autorizado para conducir vehículos de la compañía.'); notas.push('Conductor sin autorización registrada.'); }
      else if (p.licenciaVence && U.diasHasta(p.licenciaVence) < 0) { avisos.push('La licencia de conducción de ' + p.nombres + ' está VENCIDA desde el ' + U.fFecha(p.licenciaVence) + '.'); notas.push('Licencia de conducción vencida.'); }
    }
    if (col === 'recorridos' && v) {
      var pyp = FL.Calc.picoYPlaca(v, r.fechaRecibe, d.picoyplaca);
      if (pyp.length) { avisos.push('El vehículo tiene pico y placa ese día en ' + pyp.map(function (x) { return x.ciudad + (x.horario ? ' (' + x.horario + ')' : ''); }).join(', ') + '.'); }
      var abierto = FL.Calc.vigentes(d.recorridos).filter(function (x) { return x.placa === v.placa && x.estado === 'Abierto'; })[0];
      if (abierto) { avisos.push('El vehículo ya tiene un uso diario abierto desde el ' + U.fFechaHora(abierto.fechaRecibe) + ' (' + (abierto.personaNombre || abierto.cedula) + ') sin entrega registrada.'); notas.push('Se abrió con otro uso diario sin cerrar.'); }
    }
    if (v && v.estado && v.estado !== 'Activo') avisos.push('El vehículo está en estado «' + v.estado + '».');
    if (avisos.length) {
      var ok = await new Promise(function (res) {
        UI.modal({ titulo: 'Revise antes de guardar', cuerpo: h('div', { class: 'pila' }, h('ul', { class: 'avisos' }, avisos.map(function (a) { return h('li', null, a); })), h('p', { class: 'muted small' }, 'Si confirma, el registro se guarda con una nota de advertencia visible en los reportes.')),
          alCerrar: function (x) { res(x === true); }, acciones: [{ l: 'Corregir', valor: false }, { l: 'Guardar de todas formas', tipo: 'peligro', valor: true }] });
      });
      if (!ok) return null;
    }
    return notas;
  }

  function pantallaRegistro(col, titulo, subtitulo, opts) {
    opts = opts || {};
    return function (cont) {
      var f = UI.formulario(col, opts.inicial ? opts.inicial() : null, { alCambiar: V.alCambiarRegistro(col), excluir: opts.excluir });
      var btn = h('button', { class: 'btn primario', type: 'button' }, 'Guardar');
      btn.addEventListener('click', async function () {
        var r = f.leer(); if (!r) return;
        if (opts.validar) { var m = opts.validar(r, f); if (m) return; }
        var notas = await verificar(col, r);
        if (notas === null) return;
        var o = V.completar(col, r);
        if (notas.length) o.advertencias = notas.join(' ');
        btn.disabled = true;
        try {
          var id = await FL.Datos.crear(col, o, null, FL.ESQ[col].uno + ' ' + (o.placa || o.equipo || '') + ' — ' + (o.personaNombre || ''));
          UI.toast(FL.ESQ[col].uno.charAt(0).toUpperCase() + FL.ESQ[col].uno.slice(1) + ' registrado.', 'ok');
          App.refrescar();
          if (opts.soporte) V.ofrecerSoporte(col + '/' + id, 'Soportes del ' + FL.ESQ[col].uno, opts.soporte);
        } catch (e) { UI.toast(e.message, 'error'); btn.disabled = false; }
      });
      cont.appendChild(V.titulo(titulo, subtitulo));
      cont.appendChild(h('section', { class: 'tarjeta' }, f.el, h('div', { class: 'form-acciones' }, h('button', { class: 'btn', type: 'button', onclick: function () { App.refrescar(); } }, 'Limpiar'), btn)));
      if (opts.despues) cont.appendChild(opts.despues());
    };
  }

  App.ruta('/registrar/tanqueo', pantallaRegistro('tanqueos', 'Registrar tanqueo', 'Digite la cédula de quien tanquea: el nombre, el cargo y el centro de costo se completan solos. Si el combustible no va a un vehículo, elija «Otro uso» y justifíquelo.', {
    soporte: ['Factura o tirilla', 'Odómetro', 'Otro soporte'],
    despues: function () { return ultimos('tanqueos', function (r) { return r.fecha; }, [{ l: 'Fecha', v: function (r) { return r.fecha; }, tipo: 'fechahora' }, { l: 'Destino', v: function (r) { return r.placa || r.equipo; } }, { l: 'Quien tanquea', v: function (r) { return r.personaNombre; } }, { l: 'Galones', v: function (r) { return r.galones; }, tipo: 'num', dec: 2 }, { l: 'Valor', v: function (r) { return r.valorTotal; }, tipo: 'cop' }]); }
  }), [A, N]);

  App.ruta('/registrar/mantenimiento', pantallaRegistro('mantenimientos', 'Registrar mantenimiento o arreglo', 'Quién lo hizo, dónde, cuánto costó y cuándo es el próximo.', {
    soporte: ['Factura', 'Antes del trabajo', 'Después del trabajo', 'Otro soporte'],
    despues: function () { return ultimos('mantenimientos', function (r) { return r.fecha; }, [{ l: 'Fecha', v: function (r) { return r.fecha; }, tipo: 'fecha' }, { l: 'Vehículo', v: function (r) { return r.placa; } }, { l: 'Tipo', v: function (r) { return r.tipo; } }, { l: 'Taller', v: function (r) { return r.taller; } }, { l: 'Valor', v: function (r) { return r.valorTotal; }, tipo: 'cop' }]); }
  }), [A, N]);

  App.ruta('/registrar/documento', pantallaRegistro('documentos', 'Registrar documento', 'SOAT, revisión técnico-mecánica, pólizas, impuesto y demás vigencias. Cada renovación es un registro nuevo; la aplicación toma el de vencimiento más reciente.', {
    soporte: ['Documento escaneado', 'Otro soporte'],
    validar: function (r, f) {
      if (r.fechaInicio && r.fechaVencimiento && r.fechaVencimiento < r.fechaInicio) { f.error('fechaVencimiento', 'El vencimiento no puede ser anterior al inicio de la vigencia.'); return true; }
    },
    despues: function () { return ultimos('documentos', function (r) { return r._creado; }, [{ l: 'Vehículo', v: function (r) { return r.placa; } }, { l: 'Documento', v: function (r) { return FL.Calc.claveDoc(r); } }, { l: 'Vence', v: function (r) { return r.fechaVencimiento; }, tipo: 'fecha' }, { l: 'Valor', v: function (r) { return r.valor; }, tipo: 'cop' }]); }
  }), [A, N]);

  // ---------- Uso diario: recibir y entregar ----------
  App.ruta('/registrar/uso', function (cont) {
    var completo = h('input', { type: 'checkbox', id: 'uso-completo' });
    var zona = h('div');
    function armar() {
      U.clear(zona);
      zona.appendChild(pantallaParcial(completo.checked));
    }
    function pantallaParcial(conEntrega) {
      var f = UI.formulario('recorridos', null, { alCambiar: V.alCambiarRegistro('recorridos'), excluir: conEntrega ? [] : ['fechaEntrega', 'kmEntrega', 'kmRecorridos', 'combustibleEntrega', 'entregadoA', 'novedadesEntrega'] });
      var btn = h('button', { class: 'btn primario', type: 'button' }, conEntrega ? 'Guardar uso completo' : 'Registrar recibo del vehículo');
      btn.addEventListener('click', async function () {
        var r = f.leer(); if (!r) return;
        if (conEntrega) {
          if (r.kmEntrega == null) { f.error('kmEntrega', 'Obligatorio en el uso completo.'); return; }
          if (!r.fechaEntrega) { f.error('fechaEntrega', 'Obligatorio en el uso completo.'); return; }
          if (r.kmEntrega < r.kmRecibe) { f.error('kmEntrega', 'No puede ser menor que el kilometraje al recibir.'); return; }
          if (r.fechaEntrega < r.fechaRecibe) { f.error('fechaEntrega', 'No puede ser anterior al recibo.'); return; }
        }
        var notas = await verificar('recorridos', r); if (notas === null) return;
        var o = V.completar('recorridos', r);
        if (notas.length) o.advertencias = notas.join(' ');
        btn.disabled = true;
        try {
          var id = await FL.Datos.crear('recorridos', o, null, 'Uso diario ' + o.placa + ' — ' + o.personaNombre);
          UI.toast(conEntrega ? 'Uso diario registrado.' : 'Recibo registrado. Cuando devuelvan el vehículo, registre la entrega abajo.', 'ok');
          App.refrescar();
          V.ofrecerSoporte('recorridos/' + id, 'Fotografías del estado del vehículo', ['Estado al recibir', 'Estado al entregar', 'Odómetro', 'Novedad']);
        } catch (e) { UI.toast(e.message, 'error'); btn.disabled = false; }
      });
      return h('section', { class: 'tarjeta' }, f.el, h('div', { class: 'form-acciones' }, btn));
    }
    completo.addEventListener('change', armar);
    cont.appendChild(V.titulo('Uso diario del vehículo', 'Quién lo condujo, con qué kilometraje lo recibió y con cuál lo entregó.'));
    cont.appendChild(h('label', { class: 'campo-bool tarjeta delgada', for: 'uso-completo' }, completo, h('span', null, 'Registrar el uso completo de una vez (recibo y entrega), por ejemplo cuando se diligencia al final del día')));
    cont.appendChild(zona);
    armar();
    var abiertos = function () { return FL.Calc.vigentes(FL.Datos.lista('recorridos')).filter(function (x) { return x.estado === 'Abierto'; }); };
    cont.appendChild(UI.seccion('Vehículos en uso pendientes de entrega', UI.tabla({
      columnas: [{ l: 'Vehículo', v: function (r) { return r.placa; } }, { l: 'Conductor', v: function (r) { return r.personaNombre; } }, { l: 'Recibió', v: function (r) { return r.fechaRecibe; }, tipo: 'fechahora' }, { l: 'Km al recibir', v: function (r) { return r.kmRecibe; }, tipo: 'num' }, { l: 'Motivo', v: function (r) { return r.motivo; } }],
      filas: abiertos, vacio: 'No hay vehículos pendientes de entrega.',
      acciones: function (r) { return h('button', { class: 'btn xs primario', type: 'button', onclick: function () { V.registrarEntrega(r); } }, 'Registrar entrega'); }
    })));
  }, [A, N]);

  V.registrarEntrega = function (r) {
    var f = UI.formulario('recorridos', Object.assign({}, r, { fechaEntrega: U.ymdhm(new Date()) }), { campos: ['fechaEntrega', 'kmEntrega', 'kmRecorridos', 'combustibleEntrega', 'entregadoA', 'novedadesEntrega'], alCambiar: V.alCambiarRegistro('recorridos') });
    UI.modal({
      titulo: 'Entrega del vehículo ' + r.placa, ancho: true,
      cuerpo: h('div', { class: 'pila' }, h('p', { class: 'muted' }, 'Recibido por ' + (r.personaNombre || r.cedula) + ' el ' + U.fFechaHora(r.fechaRecibe) + ' con ' + U.n(r.kmRecibe) + ' km.'), f.el),
      acciones: [{ l: 'Cancelar' }, { l: 'Registrar entrega', tipo: 'primario', fn: async function () {
        var x = f.leer(); if (!x) return false;
        if (x.kmEntrega == null) { f.error('kmEntrega', 'Obligatorio.'); return false; }
        if (!x.fechaEntrega) { f.error('fechaEntrega', 'Obligatorio.'); return false; }
        if (x.kmEntrega < r.kmRecibe) { f.error('kmEntrega', 'No puede ser menor que el kilometraje al recibir (' + U.n(r.kmRecibe) + ').'); return false; }
        if (x.fechaEntrega < r.fechaRecibe) { f.error('fechaEntrega', 'No puede ser anterior al recibo.'); return false; }
        var kmDia = x.kmEntrega - r.kmRecibe;
        if (kmDia > (FL.App.param().kmMaxDia || 800) && !(await UI.confirmar('Kilometraje inusual', 'Se registran ' + U.n(kmDia) + ' km en este uso. ¿Es correcto?', 'Sí, es correcto'))) return false;
        await FL.Datos.modificar('recorridos', r.id, {
          estado: 'Cerrado', kmEntrega: x.kmEntrega, kmRecorridos: kmDia, fechaEntrega: x.fechaEntrega,
          combustibleEntrega: x.combustibleEntrega || null, entregadoA: x.entregadoA || null, novedadesEntrega: x.novedadesEntrega || null
        }, 'Entrega ' + r.placa + ' — ' + U.n(kmDia) + ' km', 'Cierre');
        UI.toast('Entrega registrada.', 'ok'); App.refrescar();
      } }]
    });
  };

  function ultimos(col, fecha, columnas) {
    var filas = function () {
      var yo = FL.Datos.yo();
      return FL.Datos.lista(col).filter(function (r) { return r._creadoPorUsuario === yo.usuario; })
        .sort(function (a, b) { return (b._creado || 0) - (a._creado || 0); }).slice(0, 10);
    };
    return UI.seccion('Mis últimos registros', UI.tabla({ columnas: columnas, filas: filas, vacio: 'Aún no ha registrado información.' }));
  }
})();
