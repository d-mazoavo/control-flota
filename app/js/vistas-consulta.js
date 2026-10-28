/* Consulta: tablero, vehículos y hoja de vida, combustible y rendimiento, uso diario, mantenimientos, documentos y reportes de costos. */
(function () {
  'use strict';
  var FL = (window.FL = window.FL || {});
  var U = FL.U, h = U.h, UI = FL.UI, V = FL.Vistas, App = FL.App, C = FL.Calc;
  var TODOS = ['Administrador', 'Analista', 'Gobierno Corporativo'];
  var CON_CONDUCTOR = TODOS.concat(['Conductor']);
  var SERIES = { comb: 'var(--s1)', mant: 'var(--s2)', docs: 'var(--s3)' };

  function vigentes(col) { return C.vigentes(FL.Datos.lista(col)); }
  function opcVehiculos() { return FL.Datos.lista('vehiculos').sort(function (a, b) { return a.placa < b.placa ? -1 : 1; }).map(function (v) { return [v.placa, v.placa]; }); }
  function opcCentros() { return FL.Datos.lista('centros').map(function (c) { return [c.id, UI.nombreCentro(c.id)]; }); }
  function opcRazones() { return FL.Datos.lista('razones').map(function (c) { return [c.id, c.nombre]; }); }
  function opcAnios(campo) {
    var s = {}; s[new Date().getFullYear()] = 1;
    return function (filas) { filas.forEach(function (r) { var a = U.anio(r[campo]); if (a) s[a] = 1; }); return Object.keys(s).sort().reverse().map(function (a) { return [a, a]; }); };
  }
  function filtroAnio(col, campo) {
    return { l: 'Año', opts: opcAnios(campo)(FL.Datos.lista(col)), def: String(new Date().getFullYear()), fn: function (r, v) { return String(U.anio(r[campo])) === v; } };
  }
  function filtroMes(campo) { return { l: 'Mes', opts: U.MESES.map(function (m, i) { return [String(i), m]; }), fn: function (r, v) { return String(U.mes(r[campo])) === v; } }; }
  var filtroAnulados = { l: 'Estado del registro', opts: [['v', 'Solo vigentes'], ['a', 'Solo anulados']], def: 'v', fn: function (r, v) { return v === 'v' ? !r.anulado : !!r.anulado; } };
  function botonNuevo(ruta, texto) { return V.puedeIngresar() ? h('a', { class: 'btn primario', href: '#' + ruta }, texto) : null; }
  function avisoAdvertencia(r) { return r.advertencias ? h('span', { class: 'chip alerta', title: r.advertencias }, '! Nota') : null; }

  // =================== TABLERO ===================
  // =================== INICIO DEL CONDUCTOR ===================
  function inicioConductor(cont) {
    var yo = FL.Datos.yo(), d = App.datos(), p = App.param();
    var per = FL.Datos.uno('personas', yo.cedula);
    cont.appendChild(V.titulo('Hola, ' + (per ? per.nombres : yo.nombre), 'Registre aquí sus tanqueos y el uso de los vehículos que conduce.',
      [h('a', { class: 'btn primario', href: '#/registrar/tanqueo' }, '⛽ Registrar tanqueo'), h('a', { class: 'btn primario', href: '#/registrar/uso' }, '⇄ Recibir o entregar vehículo')]));
    if (!per) { cont.appendChild(h('p', { class: 'aviso mal' }, 'Su usuario no está vinculado a una persona registrada. Informe al Director de Seguridad Integral.')); return; }
    var lic = C.licencias(per);
    cont.appendChild(UI.seccion('Mis licencias de conducción', lic.length ? h('div', { class: 'fila gap wrap' }, lic.map(function (l) {
      var dd = l.vence ? U.diasHasta(l.vence) : null;
      return UI.chip(l.categoria + (dd == null ? ' · sin vencimiento' : dd < 0 ? ' · VENCIDA el ' + U.fFecha(l.vence) : ' · vence el ' + U.fFecha(l.vence)), dd == null || dd < 0 ? 'mal' : dd <= (p.diasAlerta || 30) ? 'alerta' : 'bien');
    })) : h('p', { class: 'txt-alerta' }, 'No tiene licencias registradas. Informe al Director de Seguridad Integral.')));
    var abiertos = C.vigentes(d.recorridos).filter(function (x) { return x.estado === 'Abierto'; });
    if (abiertos.length) cont.appendChild(UI.seccion('Vehículos que tiene recibidos (pendientes de entrega)', UI.tabla({
      columnas: [{ l: 'Vehículo', v: function (r) { return r.placa; } }, { l: 'Recibió', v: function (r) { return r.fechaRecibe; }, tipo: 'fechahora' }, { l: 'Km al recibir', v: function (r) { return r.kmRecibe; }, tipo: 'num' }, { l: 'Motivo', v: function (r) { return r.motivo; } }],
      filas: abiertos, acciones: function (r) { return h('button', { class: 'btn xs primario', type: 'button', onclick: function () { V.registrarEntrega(r); } }, 'Registrar entrega'); }
    })));
    var mios = C.vigentes(d.vehiculos).filter(function (v) { return v.responsableCedula === yo.cedula && v.estado !== 'Dado de baja'; });
    if (mios.length) cont.appendChild(UI.seccion('Vehículos a mi cargo', h('div', { class: 'pila' }, mios.map(function (v) {
      var pyp = C.picoYPlaca(v, new Date(), d.picoyplaca), docs = C.documentosVehiculo(v, d.documentos, p), ult = C.ultimaLectura(v, d);
      return h('div', { class: 'tarjeta delgada pila sm' },
        h('div', { class: 'fila gap wrap' }, v.miniatura ? h('img', { src: v.miniatura, alt: '', class: 'mini' }) : null, h('strong', null, v.placa), h('span', { class: 'muted' }, [v.tipo, v.marca, v.linea].filter(Boolean).join(' ')),
          pyp.length ? UI.chip('! Pico y placa hoy: ' + pyp.map(function (x) { return x.ciudad + (x.horario ? ' (' + x.horario + ')' : ''); }).join(', '), 'alerta') : UI.chip('Sin pico y placa hoy')),
        h('span', { class: 'small' }, 'Último kilometraje registrado: ' + (ult ? U.n(ult.km) + ' km' : 'sin registro')),
        h('div', { class: 'fila gap wrap' }, docs.map(function (x) { return h('span', { class: 'small' }, x.tipo + ': ', UI.chipEstado(x.estado), x.doc ? ' ' + U.fFecha(x.doc.fechaVencimiento) : ''); })));
    }))));
    var ult = C.vigentes(d.tanqueos).sort(function (a, b) { return U.toDate(b.fecha) - U.toDate(a.fecha); }).slice(0, 5);
    cont.appendChild(UI.seccion('Mis últimos tanqueos', UI.tabla({
      columnas: [{ l: 'Fecha', v: function (r) { return r.fecha; }, tipo: 'fechahora' }, { l: 'Destino', v: function (r) { return r.placa || r.equipo; } }, { l: 'Galones', v: function (r) { return r.galones; }, tipo: 'num', dec: 2 }, { l: 'Valor', v: function (r) { return r.valorTotal; }, tipo: 'cop' }, { l: 'Registró', v: function (r) { return r._creadoPorUsuario; } }],
      filas: ult, vacio: 'Aún no tiene tanqueos registrados.', acciones: function (r) { return V.botonArchivos('tanqueos', r); }
    })));
  }

  App.ruta('/tablero', function (cont) {
    if (FL.Datos.esConductor()) return inicioConductor(cont);
    var anio = V.anio, d = App.datos(), p = App.param();
    var r = C.rangoAnio(anio);
    var veh = C.vigentes(d.vehiculos).filter(function (v) { return v.estado !== 'Dado de baja'; });
    var porVeh = veh.map(function (v) { return { v: v, k: C.costoVehiculo(v, d, r[0], r[1]), rend: C.rendimiento(v, d.tanqueos, p.toleranciaRendimiento), docs: C.documentosVehiculo(v, d.documentos, p), mant: C.proximoMantenimiento(v, d, p) }; });
    var otros = C.vigentes(d.tanqueos).filter(function (x) { return x.destino !== 'Vehículo' && U.anio(x.fecha) === anio; });
    var mes = C.porMes(d, anio);
    var tot = {
      comb: U.sum(mes, function (m) { return m.combustible; }), gal: U.sum(mes, function (m) { return m.galones; }),
      mant: U.sum(mes, function (m) { return m.mantenimiento; }), docs: U.sum(mes, function (m) { return m.documentos; }),
      km: U.sum(porVeh, function (x) { return x.k.km; }),
      otros: U.sum(otros, function (x) { return x.valorTotal; })
    };
    var trAnio = [];
    veh.forEach(function (v) { C.tramos(C.tanqueosDe(v.placa, d.tanqueos)).forEach(function (t) { if (U.anio(t.fecha) === anio) trAnio.push(t); }); });
    var kmGal = U.sum(trAnio, function (t) { return t.galones; }) > 0 ? U.sum(trAnio, function (t) { return t.km; }) / U.sum(trAnio, function (t) { return t.galones; }) : null;
    var alertas = C.alertas(d, p);

    cont.appendChild(V.titulo('Tablero', 'Flota de ' + veh.length + ' vehículo(s) · ' + (FL.CFG.empresa || 'Avo Pak S.A.S.'), [V.selectorAnio(anio, function (a) { V.anio = a; App.refrescar(); })]));
    cont.appendChild(h('div', { class: 'kpis' },
      UI.kpi('Combustible ' + anio, U.cop(tot.comb), U.n(tot.gal, 1) + ' galones' + (tot.otros ? ' · ' + U.cop(tot.otros) + ' en otros usos' : '')),
      UI.kpi('Mantenimientos y arreglos', U.cop(tot.mant), vigentes('mantenimientos').filter(function (x) { return U.anio(x.fecha) === anio; }).length + ' trabajos'),
      UI.kpi('Documentos (SOAT, RTM, pólizas…)', U.cop(tot.docs)),
      UI.kpi('Costo total de la flota', U.cop(tot.comb + tot.mant + tot.docs), tot.km ? U.cop((tot.comb - tot.otros + tot.mant + tot.docs) / tot.km) + ' por km' : null, 'fuerte'),
      UI.kpi('Kilómetros recorridos', U.n(tot.km), 'según lecturas de odómetro'),
      UI.kpi('Rendimiento promedio', kmGal ? U.n(kmGal, 1) + ' km/gal' : '—', 'tramos de tanque lleno del año'),
      UI.kpi('Alertas', String(alertas.filter(function (a) { return a.nivel >= 2; }).length), alertas.filter(function (a) { return a.nivel === 3; }).length + ' críticas', alertas.some(function (a) { return a.nivel === 3; }) ? 'mal' : alertas.some(function (a) { return a.nivel === 2; }) ? 'alerta' : 'bien')
    ));

    // Alertas
    var nivelTxt = ['Informativa', 'Media', 'Alta', 'Crítica'], nivelCls = ['info', 'leve', 'alerta', 'mal'];
    var filtroN = h('select', { class: 'campo-input filtro', 'aria-label': 'Nivel de alerta' }, h('option', { value: '0' }, 'Todas'), h('option', { value: '2' }, 'Altas y críticas'), h('option', { value: '3' }, 'Solo críticas'));
    var lista = h('ul', { class: 'alertas' });
    function pintarAlertas() {
      U.clear(lista);
      var a = alertas.filter(function (x) { return x.nivel >= Number(filtroN.value); });
      if (!a.length) lista.appendChild(h('li', { class: 'alerta-item bien' }, '✓ Sin alertas en este nivel.'));
      a.forEach(function (x) {
        lista.appendChild(h('li', { class: 'alerta-item ' + nivelCls[x.nivel] }, h('span', { class: 'alerta-n' }, nivelTxt[x.nivel]), h('span', { class: 'alerta-t' }, x.tipo), h('span', { class: 'alerta-x' }, x.texto),
          x.placa ? h('a', { class: 'btn xs', href: '#/vehiculo/' + encodeURIComponent(x.placa) }, 'Ver') : null));
      });
    }
    filtroN.addEventListener('change', pintarAlertas);
    pintarAlertas();
    cont.appendChild(UI.seccion('Alertas vigentes (' + alertas.length + ')', lista, [filtroN]));

    cont.appendChild(h('section', { class: 'tarjeta' }, FL.Viz.barras({
      titulo: 'Costo mensual de la flota, ' + anio, etiquetas: U.MESES, detalleEtiqueta: function (i) { return U.MESES[i] + ' ' + anio; },
      series: [{ nombre: 'Combustible', color: SERIES.comb, valores: mes.map(function (m) { return m.combustible; }) },
        { nombre: 'Mantenimiento', color: SERIES.mant, valores: mes.map(function (m) { return m.mantenimiento; }) },
        { nombre: 'Documentos', color: SERIES.docs, valores: mes.map(function (m) { return m.documentos; }) }]
    })));

    var peorDoc = function (x) { var o = ['Vencido', 'Sin registro', 'Por vencer', 'Vigente']; var e = x.docs.filter(function (q) { return q.exigido || q.doc; }).map(function (q) { return q.estado; }); for (var i = 0; i < o.length; i++) if (e.indexOf(o[i]) >= 0) return o[i]; return '—'; };
    cont.appendChild(UI.seccion('Resumen por vehículo, ' + anio, UI.tabla({
      nombre: 'Resumen por vehículo ' + anio,
      columnas: [
        { l: 'Placa', v: function (x) { return x.v.placa; }, f: function (x) { return h('a', { href: '#/vehiculo/' + encodeURIComponent(x.v.placa) }, x.v.placa); } },
        { l: 'Vehículo', v: function (x) { return [x.v.tipo, x.v.marca, x.v.linea].filter(Boolean).join(' '); } },
        { l: 'Responsable', v: function (x) { return UI.nombrePersona(x.v.responsableCedula); } },
        { l: 'Km actual', v: function (x) { return C.odometro(x.v, d); }, tipo: 'num' },
        { l: 'Km en el año', v: function (x) { return x.k.km; }, tipo: 'num' },
        { l: 'Km/gal promedio', v: function (x) { return x.rend.promedio; }, tipo: 'num', dec: 1 },
        { l: 'Último tramo', v: function (x) { var t = x.rend.tramos[x.rend.tramos.length - 1]; return t ? t.estado : 'Sin datos'; }, f: function (x) { var t = x.rend.tramos[x.rend.tramos.length - 1]; return t ? h('span', null, U.n(t.kmGal, 1) + ' ', UI.chipEstado(t.estado)) : '—'; } },
        { l: 'Costo del año', v: function (x) { return x.k.total; }, tipo: 'cop' },
        { l: 'Costo por km', v: function (x) { return x.k.costoKm; }, tipo: 'cop' },
        { l: 'Documentos', v: peorDoc, f: function (x) { var e = peorDoc(x); return e === '—' ? '—' : UI.chipEstado(e); } },
        { l: 'Mantenimiento', v: function (x) { return x.mant.estado; }, f: function (x) { return UI.chipEstado(x.mant.estado); } }
      ],
      filas: porVeh, alAbrir: function (x) { App.ir('/vehiculo/' + encodeURIComponent(x.v.placa)); }, vacio: 'Aún no hay vehículos registrados.'
    })));
  }, CON_CONDUCTOR);

  // =================== VEHÍCULOS ===================
  App.ruta('/vehiculos', function (cont) {
    var d = App.datos(), p = App.param();
    cont.appendChild(V.titulo('Vehículos', 'Haga clic en un vehículo para ver su hoja de vida.', V.esAdmin() ? [h('button', { class: 'btn primario', type: 'button', onclick: function () { V.editarMaestro('vehiculos', null, function (id) { App.ir('/vehiculo/' + encodeURIComponent(id)); }); } }, '+ Nuevo vehículo')] : null));
    cont.appendChild(h('section', { class: 'tarjeta' }, UI.tabla({
      nombre: 'Vehículos',
      columnas: [
        { l: 'Foto', v: function () { return ''; }, f: function (v) { return v.miniatura ? h('img', { src: v.miniatura, alt: '', class: 'mini' }) : h('span', { class: 'mini vacia' }, '🚙'); } },
        { l: 'Placa', v: function (v) { return v.placa; } },
        { l: 'Tipo', v: function (v) { return v.tipo; } },
        { l: 'Marca / línea', v: function (v) { return [v.marca, v.linea].filter(Boolean).join(' '); } },
        { l: 'Modelo', v: function (v) { return v.modelo; } },
        { l: 'Propietario', v: function (v) { return UI.nombreRazon(v.razonId); } },
        { l: 'Centro de costo', v: function (v) { return UI.nombreCentro(v.centroId); } },
        { l: 'Responsable', v: function (v) { return UI.nombrePersona(v.responsableCedula); } },
        { l: 'Km actual', v: function (v) { return C.odometro(v, d); }, tipo: 'num' },
        { l: 'Blindado', v: function (v) { return !!v.blindado; } },
        { l: 'Documentos', v: function (v) { var e = C.documentosVehiculo(v, d.documentos, p).filter(function (q) { return q.exigido || q.doc; }).map(function (q) { return q.estado; }); return e.indexOf('Vencido') >= 0 ? 'Vencido' : e.indexOf('Sin registro') >= 0 ? 'Sin registro' : e.indexOf('Por vencer') >= 0 ? 'Por vencer' : e.length ? 'Vigente' : '—'; }, f: function (v) { var x = this.v(v); return x === '—' ? '—' : UI.chipEstado(x); } },
        { l: 'Estado', v: function (v) { return v.estado; }, f: function (v) { return UI.chipEstado(v.estado || 'Activo'); } }
      ],
      filtros: [{ l: 'Estado', opts: FL.OPC.estadoVehiculo.map(function (e) { return [e, e]; }), fn: function (r, v) { return r.estado === v; } },
        { l: 'Propietario', opts: opcRazones(), fn: function (r, v) { return r.razonId === v; } },
        { l: 'Centro de costo', opts: opcCentros(), fn: function (r, v) { return r.centroId === v; } }],
      filas: d.vehiculos, ordenInicial: 1, ordenDesc: false,
      alAbrir: function (v) { App.ir('/vehiculo/' + encodeURIComponent(v.placa)); }, vacio: V.esAdmin() ? 'No hay vehículos. Use «Nuevo vehículo».' : 'No hay vehículos registrados.'
    })));
  }, TODOS);

  // =================== HOJA DE VIDA ===================
  var pestanaHV = 'resumen';
  App.ruta('/vehiculo', function (cont, arg) {
    var placa = arg[0], v = FL.Datos.uno('vehiculos', placa);
    if (!v) { cont.appendChild(UI.seccion('Vehículo no encontrado', h('p', null, 'No existe un vehículo con la placa ' + placa + '.'))); return; }
    var d = App.datos(), p = App.param(), anio = V.anio;
    var r = C.rangoAnio(anio), k = C.costoVehiculo(v, d, r[0], r[1]);
    var rend = C.rendimiento(v, d.tanqueos, p.toleranciaRendimiento);
    var docs = C.documentosVehiculo(v, d.documentos, p), mant = C.proximoMantenimiento(v, d, p);
    var pyp = C.picoYPlaca(v, new Date(), d.picoyplaca), odo = C.odometro(v, d);

    var acciones = [V.selectorAnio(anio, function (a) { V.anio = a; App.refrescar(); }),
      h('button', { class: 'btn', type: 'button', onclick: function () { FL.Exportar.hojaDeVida(v.placa, anio).catch(function (e) { UI.toast(e.message, 'error'); }); } }, '⬇ PDF hoja de vida'),
      h('button', { class: 'btn', type: 'button', onclick: function () { exportarVehiculo(v); } }, '⬇ Excel')];
    if (V.esAdmin()) {
      acciones.push(h('button', { class: 'btn primario', type: 'button', onclick: function () { V.editarMaestro('vehiculos', v); } }, 'Editar datos'));
      acciones.push(h('button', { class: 'btn peligro-t', type: 'button', onclick: function () { V.eliminar('vehiculos', v, function () { App.ir('/vehiculos'); }); } }, 'Eliminar vehículo'));
    }
    cont.appendChild(h('a', { class: 'enlace small', href: '#/vehiculos' }, '← Vehículos'));
    cont.appendChild(V.titulo('Hoja de vida · ' + v.placa, [v.tipo, v.marca, v.linea, v.modelo, v.color].filter(Boolean).join(' · '), acciones));

    cont.appendChild(h('section', { class: 'tarjeta hv-cab' },
      v.miniatura ? h('img', { src: v.miniatura, alt: 'Fotografía del vehículo', class: 'hv-foto' }) : h('div', { class: 'hv-foto vacia' }, '🚙'),
      h('div', { class: 'pila sm' },
        h('div', { class: 'fila gap wrap' }, UI.chipEstado(v.estado || 'Activo'), v.blindado ? UI.chip('Blindado' + (v.nivelBlindaje ? ' ' + v.nivelBlindaje : ''), 'info') : null, v.gps ? UI.chip('GPS', 'info') : null, v.alarma ? UI.chip('Alarma', 'info') : null,
          v.aplicaPicoPlaca === false ? UI.chip('Exento de pico y placa') : pyp.length ? UI.chip('! Pico y placa hoy: ' + pyp.map(function (x) { return x.ciudad; }).join(', '), 'alerta') : UI.chip('Sin pico y placa hoy')),
        UI.datosClave([
          ['Propietario', UI.nombreRazon(v.razonId)], ['Centro de costo', UI.nombreCentro(v.centroId)],
          ['Responsable asignado', v.responsableCedula ? UI.nombrePersona(v.responsableCedula) + ' · C. C. ' + v.responsableCedula : 'Sin asignar'],
          ['Kilometraje actual', odo != null ? U.n(odo) + ' km' : 'Sin registro'], ['Combustible', v.combustible + (v.capacidadTanque ? ' · tanque ' + U.n(v.capacidadTanque, 1) + ' gal' : '')],
          ['Rendimiento', rend.promedio ? U.n(rend.promedio, 1) + ' km/gal promedio' + (v.rendimientoRef ? ' (referencia ' + U.n(v.rendimientoRef, 1) + ')' : '') : 'Sin tramos completos']
        ]))));

    var tabs = [['resumen', 'Resumen ' + anio], ['datos', 'Datos'], ['combustible', 'Combustible'], ['uso', 'Uso diario'], ['mant', 'Mantenimientos'], ['docs', 'Documentos'], ['asig', 'Asignaciones'], ['fotos', 'Fotos y documentos']];
    var barra = h('div', { class: 'pestanas', role: 'tablist' }), panel = h('div', { class: 'pila' });
    tabs.forEach(function (t) {
      barra.appendChild(h('button', { class: 'pestana' + (pestanaHV === t[0] ? ' activa' : ''), role: 'tab', type: 'button', onclick: function () { pestanaHV = t[0]; Array.from(barra.children).forEach(function (b, i) { b.classList.toggle('activa', tabs[i][0] === pestanaHV); }); pintar(); } }, t[1]));
    });
    cont.appendChild(barra); cont.appendChild(panel);

    function pintar() {
      U.clear(panel);
      if (pestanaHV === 'resumen') {
        panel.appendChild(h('div', { class: 'kpis' },
          UI.kpi('Combustible', U.cop(k.combustible), U.n(k.galones, 1) + ' gal en ' + k.tanqueos + ' tanqueos'),
          UI.kpi('Mantenimiento', U.cop(k.mantenimiento), k.mantenimientos + ' trabajos'),
          UI.kpi('Documentos', U.cop(k.documentos)),
          UI.kpi('Costo total ' + anio, U.cop(k.total), null, 'fuerte'),
          UI.kpi('Km recorridos', U.n(k.km)),
          UI.kpi('Km por galón', k.kmGal ? U.n(k.kmGal, 1) : '—', 'tramos del año'),
          UI.kpi('Costo por km', k.costoKm ? U.cop(k.costoKm) : '—')));
        panel.appendChild(UI.seccion('Registro fotográfico', h('div', { class: 'pila sm' },
          V.esAdmin() ? h('p', { class: 'muted small' }, 'Use «Tomar o elegir» en cada ángulo; la fotografía se guarda de inmediato. Las anteriores quedan en la pestaña Fotografías.') : null,
          V.cuatroAngulos(v.placa, { editable: V.esAdmin(), inmediato: true, alCambiar: function () { var img = document.querySelector('.hv-cab .hv-foto'); var nv = FL.Datos.uno('vehiculos', v.placa); if (img && nv && nv.miniatura && img.tagName === 'IMG') img.src = nv.miniatura; } }).el)));
        panel.appendChild(UI.seccion('Próximo mantenimiento', h('div', { class: 'fila gap wrap' }, UI.chipEstado(mant.estado),
          h('span', null, [mant.km ? U.n(mant.km) + ' km' + (mant.faltaKm != null ? ' (' + (mant.faltaKm <= 0 ? 'excedido en ' + U.n(-mant.faltaKm) : 'faltan ' + U.n(mant.faltaKm)) + ' km)' : '') : '', mant.fecha ? U.fFecha(mant.fecha) : ''].filter(Boolean).join(' · ') || 'Registre el próximo mantenimiento al ingresar un trabajo, o defina el intervalo en los datos del vehículo.'))));
        panel.appendChild(UI.seccion('Vigencias', tablaVigencias(docs, v.placa)));
        var tr = rend.tramos.slice(-30);
        if (tr.length >= 2) panel.appendChild(h('section', { class: 'tarjeta' }, FL.Viz.linea({
          titulo: 'Rendimiento por tramo de tanque lleno (km por galón)', color: 'var(--s1)', unidad: 'km/gal', referencia: rend.referencia,
          puntos: tr.map(function (t) { return { etiqueta: U.fFecha(t.fecha).slice(0, 5), y: t.kmGal, color: t.estado === 'Bajo' ? 'var(--deny)' : null, detalle: U.n(t.km) + ' km · ' + U.n(t.galones, 2) + ' gal · ' + t.estado }; })
        })));
      } else if (pestanaHV === 'datos') {
        var campos = FL.ESQ.vehiculos.campos.filter(function (c) { return !c.solo || c.solo(v); });
        panel.appendChild(h('section', { class: 'tarjeta' }, UI.datosClave(campos.map(function (c) {
          var x = v[c.k];
          if (c.t === 'razon') x = UI.nombreRazon(x); else if (c.t === 'centro') x = UI.nombreCentro(x); else if (c.t === 'persona') x = x ? UI.nombrePersona(x) + ' · C. C. ' + x : '';
          else if (c.t === 'bool') x = x ? 'Sí' : 'No'; else if (c.t === 'multi') x = (x || []).join(', '); else if (c.t === 'date') x = x ? U.fFecha(x) : ''; else if (c.t === 'money') x = x != null ? U.cop(x) : ''; else if (c.t === 'number') x = x != null ? U.n(x, c.k === 'capacidadTanque' || c.k === 'rendimientoRef' ? 1 : 0) : '';
          return [c.l, x];
        })), h('p', { class: 'muted small' }, 'Registrado por ' + (v._creadoPorUsuario || '—') + ' el ' + U.fFechaHora(v._creado) + ' · última modificación ' + U.fFechaHora(v._mod) + ' por ' + (v._modPorUsuario || '—') + '.')));
      } else if (pestanaHV === 'combustible') {
        panel.appendChild(UI.seccion('Rendimiento por tramos de tanque lleno', UI.tabla({
          nombre: 'Rendimiento ' + v.placa,
          columnas: [{ l: 'Desde', v: function (t) { return t.desde.fecha; }, tipo: 'fechahora' }, { l: 'Hasta', v: function (t) { return t.fecha; }, tipo: 'fechahora' },
            { l: 'Km', v: function (t) { return t.km; }, tipo: 'num' }, { l: 'Galones', v: function (t) { return t.galones; }, tipo: 'num', dec: 2 },
            { l: 'Km/gal', v: function (t) { return t.kmGal; }, tipo: 'num', dec: 1 }, { l: 'Desvío vs. referencia', v: function (t) { return t.desvio; }, f: function (t) { return t.desvio == null ? '—' : (t.desvio > 0 ? '+' : '') + U.n(t.desvio, 0) + ' %'; } },
            { l: 'Costo/km', v: function (t) { return t.costoKm; }, tipo: 'cop' }, { l: 'Estado', v: function (t) { return t.estado; }, f: function (t) { return UI.chipEstado(t.estado); } }],
          filas: rend.tramos.slice().reverse(), vacio: 'Se necesitan dos tanqueos a tanque lleno con kilometraje para calcular el rendimiento.'
        })));
        panel.appendChild(UI.seccion('Tanqueos', tablaTanqueos(function () { return FL.Datos.lista('tanqueos').filter(function (x) { return x.placa === v.placa; }); }, true)));
      } else if (pestanaHV === 'uso') {
        panel.appendChild(UI.seccion('Uso diario', tablaUso(function () { return FL.Datos.lista('recorridos').filter(function (x) { return x.placa === v.placa; }); })));
      } else if (pestanaHV === 'mant') {
        panel.appendChild(UI.seccion('Mantenimientos y arreglos', tablaMant(function () { return FL.Datos.lista('mantenimientos').filter(function (x) { return x.placa === v.placa; }); })));
      } else if (pestanaHV === 'docs') {
        panel.appendChild(UI.seccion('Vigencias actuales', tablaVigencias(docs, v.placa)));
        panel.appendChild(UI.seccion('Historial de documentos', tablaDocs(function () { return FL.Datos.lista('documentos').filter(function (x) { return x.placa === v.placa; }); })));
      } else if (pestanaHV === 'asig') {
        panel.appendChild(UI.seccion('Historial de asignación del vehículo', UI.tabla({
          columnas: [{ l: 'Responsable', v: function (a) { return a.nombre; } }, { l: 'Cédula', v: function (a) { return a.cedula; } }, { l: 'Desde', v: function (a) { return a.desde; }, tipo: 'fechahora' }, { l: 'Hasta', v: function (a) { return a.hasta || 'Vigente'; } }, { l: 'Observaciones', v: function (a) { return a.observaciones; } }, { l: 'Registró', v: function (a) { return a._creadoPorUsuario; } }],
          filas: C.vigentes(d.asignaciones).filter(function (a) { return a.placa === v.placa; }), ordenInicial: 2, vacio: 'Sin asignaciones. Se registran al asignar un responsable en los datos del vehículo.',
          acciones: V.esAdmin() ? function (a) { return h('div', { class: 'fila gap' }, h('button', { class: 'btn xs', type: 'button', onclick: function () { editarAsignacion(v, a); } }, 'Editar'), V.botonEliminar('asignaciones', a)); } : null
        }), V.esAdmin() ? [h('button', { class: 'btn sm', type: 'button', onclick: function () { editarAsignacion(v, null); } }, '+ Agregar asignación')] : null));
        var conductores = U.agrupar(C.vigentes(d.recorridos).filter(function (x) { return x.placa === v.placa; }), function (x) { return x.cedula; });
        panel.appendChild(UI.seccion('Quiénes lo han conducido (uso diario)', UI.tabla({
          columnas: [{ l: 'Conductor', v: function (x) { return x.nombre; } }, { l: 'Cédula', v: function (x) { return x.cedula; } }, { l: 'Usos', v: function (x) { return x.n; }, tipo: 'num' }, { l: 'Km', v: function (x) { return x.km; }, tipo: 'num' }, { l: 'Último uso', v: function (x) { return x.ult; }, tipo: 'fechahora' }],
          filas: Object.keys(conductores).map(function (c) { var l = conductores[c]; return { cedula: c, nombre: l[0].personaNombre, n: l.length, km: U.sum(l, function (x) { return x.kmRecorridos; }), ult: l.map(function (x) { return x.fechaRecibe; }).sort().pop() }; }), ordenInicial: 3
        })));
      } else if (pestanaHV === 'fotos') {
        panel.appendChild(UI.seccion('Fotos y documentos del vehículo', V.galeria('vehiculos/' + v.placa, {
          tipos: ['Frente', 'Costado izquierdo', 'Costado derecho', 'Posterior', 'Interior', 'Odómetro', 'Daño o novedad', 'Licencia de tránsito (tarjeta de propiedad)', 'SOAT', 'Revisión técnico-mecánica', 'Póliza', 'Factura de compra', 'Certificado de blindaje', 'Improntas', 'Otro documento'],
          principal: async function (f) {
            await V.ponerMiniatura(v.placa, f.data);
            UI.toast('Foto principal actualizada.', 'ok'); App.refrescar();
          }
        })));
      }
    }
    pintar();
  }, TODOS);

  function tablaVigencias(docs, placa) {
    docs.forEach(function (x) { x.placa = x.placa || placa; });
    return UI.tabla({
      acciones: accionesVigencia,
      columnas: [{ l: 'Documento', v: function (x) { return x.tipo + (x.exigido ? '' : ' (no exigido)'); } }, { l: 'Número', v: function (x) { return x.doc ? x.doc.numero : ''; } }, { l: 'Entidad', v: function (x) { return x.doc ? x.doc.entidad : ''; } },
        { l: 'Vence', v: function (x) { return x.doc ? x.doc.fechaVencimiento : null; }, tipo: 'fecha' }, { l: 'Días', v: function (x) { return x.dias; }, tipo: 'num' }, { l: 'Estado', v: function (x) { return x.estado; }, f: function (x) { return UI.chipEstado(x.estado); } }],
      filas: docs, vacio: 'Defina en los datos del vehículo qué documentos se deben mantener vigentes.'
    });
  }
  function exportarVehiculo(v) {
    var f = function (col) { return FL.Datos.lista(col).filter(function (x) { return x.placa === v.placa; }); };
    FL.Exportar.excel('Vehículo ' + v.placa, [
      { nombre: 'Vehículo', columnas: V.columnasExport('vehiculos'), filas: [v] },
      { nombre: 'Tanqueos', columnas: V.columnasExport('tanqueos'), filas: f('tanqueos') },
      { nombre: 'Uso diario', columnas: V.columnasExport('recorridos'), filas: f('recorridos') },
      { nombre: 'Mantenimientos', columnas: V.columnasExport('mantenimientos'), filas: f('mantenimientos') },
      { nombre: 'Documentos', columnas: V.columnasExport('documentos'), filas: f('documentos') },
      { nombre: 'Asignaciones', columnas: V.columnasExport('asignaciones'), filas: f('asignaciones') }
    ], [['Vehículo', v.placa]]).catch(function (e) { UI.toast(e.message, 'error'); });
  }

  // ---------- Tablas de registros reutilizables ----------
  function tablaTanqueos(filas, sinVehiculo) {
    var cols = V.columnas('tanqueos').filter(function (c) { return !(sinVehiculo && (c.l === 'Vehículo' || c.l === 'Destino del combustible' || c.l === 'Equipo o uso')); });
    cols.splice(sinVehiculo ? 1 : 2, 0, { l: 'Tanque lleno', v: function (r) { return r.destino === 'Vehículo' ? (r.tanqueLleno === false ? 'No' : 'Sí') : ''; } });
    cols.push({ l: 'Razón social', v: function (r) { return r.razonNombre || ''; } });
    cols.push({ l: 'Nota', v: function (r) { return r.advertencias || ''; }, f: avisoAdvertencia });
    cols.push({ l: 'Registró', v: function (r) { return r._creadoPorUsuario; } });
    return UI.tabla({
      nombre: 'Tanqueos', columnas: cols, filas: filas, ordenInicial: 0,
      filtros: [filtroAnio('tanqueos', 'fecha'), filtroMes('fecha'), { l: 'Destino', opts: [['Vehículo', 'Vehículos'], ['Otro uso', 'Otros usos']], fn: function (r, v) { return r.destino === v; } }]
        .concat(sinVehiculo ? [] : [{ l: 'Vehículo', opts: opcVehiculos(), fn: function (r, v) { return r.placa === v; } }])
        .concat([{ l: 'Centro de costo', opts: opcCentros(), fn: function (r, v) { return r.centroId === v; } }, { l: 'Razón social', opts: opcRazones(), fn: function (r, v) { return r.razonId === v; } }, filtroAnulados]),
      acciones: function (r) {
        var extra = [h('button', { class: 'btn xs', type: 'button', onclick: function () { verSoportes('tanqueos', r); } }, '📎 Archivos')];
        if (!r.anulado && V.puedeIngresar()) extra.push(h('button', { class: 'btn xs', type: 'button', onclick: function () { UI.modal({ titulo: 'Aviso del tanqueo', ancho: true, cuerpo: FL.Notif.panel(r.id, false) }); } }, 'Avisar'));
        return V.accionesRegistro('tanqueos', r, extra);
      }
    });
  }
  function tablaUso(filas) {
    var br = C.brechas(FL.Datos.lista('recorridos'), App.param().kmBrecha);
    var cols = V.columnas('recorridos').filter(function (c) { return c.l !== 'Estado'; });
    cols.push({ l: 'Estado', v: function (r) { return r.estado; }, f: function (r) { return UI.chipEstado(r.estado); } });
    cols.push({ l: 'Km sin registrar antes del recibo', v: function (r) { return br[r.id] || null; }, f: function (r) { return br[r.id] ? UI.chip(U.n(br[r.id]) + ' km', br[r.id] > 0 ? 'mal' : 'alerta') : '—'; } });
    cols.push({ l: 'Nota', v: function (r) { return r.advertencias || ''; }, f: avisoAdvertencia });
    return UI.tabla({
      nombre: 'Uso diario', columnas: cols, filas: filas, ordenInicial: 2,
      filtros: [filtroAnio('recorridos', 'fechaRecibe'), filtroMes('fechaRecibe'), { l: 'Estado', opts: [['Abierto', 'Abiertos'], ['Cerrado', 'Cerrados']], fn: function (r, v) { return r.estado === v; } },
        { l: 'Vehículo', opts: opcVehiculos(), fn: function (r, v) { return r.placa === v; } }, filtroAnulados],
      acciones: function (r) {
        var extra = [h('button', { class: 'btn xs', type: 'button', onclick: function () { verSoportes('recorridos', r); } }, '📎 Archivos')];
        if (r.estado === 'Abierto' && !r.anulado && V.puedeIngresar()) extra.unshift(h('button', { class: 'btn xs primario', type: 'button', onclick: function () { V.registrarEntrega(r); } }, 'Entregar'));
        return V.accionesRegistro('recorridos', r, extra);
      }
    });
  }
  function tablaMant(filas) {
    var cols = V.columnas('mantenimientos');
    cols.push({ l: 'Centro de costo', v: function (r) { return r.centroNombre || UI.nombreCentro(r.centroId); } });
    cols.push({ l: 'Próximo', v: function (r) { return [r.proximoKm ? U.n(r.proximoKm) + ' km' : '', r.proximaFecha ? U.fFecha(r.proximaFecha) : ''].filter(Boolean).join(' / '); } });
    cols.push({ l: 'Registró', v: function (r) { return r._creadoPorUsuario; } });
    return UI.tabla({
      nombre: 'Mantenimientos', columnas: cols, filas: filas, ordenInicial: 0,
      filtros: [filtroAnio('mantenimientos', 'fecha'), filtroMes('fecha'), { l: 'Tipo', opts: FL.OPC.tiposMantenimiento.map(function (t) { return [t, t]; }), fn: function (r, v) { return r.tipo === v; } },
        { l: 'Vehículo', opts: opcVehiculos(), fn: function (r, v) { return r.placa === v; } }, filtroAnulados],
      acciones: function (r) { return V.accionesRegistro('mantenimientos', r, [h('button', { class: 'btn xs', type: 'button', onclick: function () { verSoportes('mantenimientos', r); } }, '📎 Archivos')]); }
    });
  }
  function tablaDocs(filas) {
    var cols = V.columnas('documentos');
    cols[1] = { l: 'Documento', v: function (r) { return C.claveDoc(r); }, ancho: 30 };
    cols.push({ l: 'Registró', v: function (r) { return r._creadoPorUsuario; } });
    return UI.tabla({
      nombre: 'Documentos', columnas: cols, filas: filas, ordenInicial: 4,
      filtros: [{ l: 'Documento', opts: FL.OPC.tiposDocumento.map(function (t) { return [t, t]; }), fn: function (r, v) { return r.tipo === v; } }, { l: 'Vehículo', opts: opcVehiculos(), fn: function (r, v) { return r.placa === v; } }, filtroAnulados],
      acciones: function (r) { return V.accionesRegistro('documentos', r, [h('button', { class: 'btn xs', type: 'button', onclick: function () { verSoportes('documentos', r); } }, '📎 Archivos')]); }
    });
  }
  // Asignación de responsable (el Administrador puede agregar el historial anterior, corregirlo o eliminarlo)
  function editarAsignacion(v, a) {
    var ced = h('input', { class: 'campo-input', list: 'dl-asig', inputmode: 'numeric', autocomplete: 'off', value: a ? a.cedula : '' });
    var dl = h('datalist', { id: 'dl-asig' }, FL.Datos.lista('personas').map(function (p) { return h('option', { value: p.cedula }, p.nombres); }));
    var desde = h('input', { class: 'campo-input', type: 'datetime-local', value: a ? (a.desde || '') : '' });
    var hasta = h('input', { class: 'campo-input', type: 'datetime-local', value: a ? (a.hasta || '') : '' });
    var obs = h('textarea', { class: 'campo-input', rows: 2 }); obs.value = a ? (a.observaciones || '') : '';
    var err = h('p', { class: 'txt-error small' });
    function f(l, el, ay) { return h('label', { class: 'campo' }, h('span', { class: 'campo-l' }, l), el, ay ? h('span', { class: 'campo-ayuda' }, ay) : null); }
    UI.modal({ titulo: (a ? 'Editar' : 'Agregar') + ' asignación · ' + v.placa, cuerpo: h('div', { class: 'pila' }, f('Responsable (cédula)', ced), dl, f('Desde', desde), f('Hasta', hasta, 'Vacío si sigue vigente.'), f('Observaciones', obs),
      h('p', { class: 'muted small' }, 'Este historial no cambia el responsable actual del vehículo; para eso use «Editar datos».'), err),
      acciones: [{ l: 'Cancelar' }, { l: 'Guardar', tipo: 'primario', fn: async function () {
        var c = U.normCedula(ced.value), p = FL.Datos.uno('personas', c);
        if (!p) { err.textContent = 'Cédula no registrada.'; return false; }
        if (!desde.value) { err.textContent = 'Indique la fecha de inicio.'; return false; }
        if (hasta.value && hasta.value < desde.value) { err.textContent = '«Hasta» no puede ser anterior a «Desde».'; return false; }
        var o = { placa: v.placa, cedula: c, nombre: p.nombres, desde: desde.value, hasta: hasta.value || null, observaciones: obs.value.trim() || null };
        if (a) await FL.Datos.modificar('asignaciones', a.id, o, 'Asignación ' + v.placa + ' a ' + p.nombres);
        else await FL.Datos.crear('asignaciones', o, null, 'Asignación ' + v.placa + ' a ' + p.nombres + ' (historial)');
        UI.toast('Asignación guardada.', 'ok'); App.refrescar();
      } }] });
  }

  var TIPOS_SOPORTE = {
    tanqueos: ['Factura o tirilla', 'Odómetro', 'Comprobante de pago', 'Otro soporte'],
    recorridos: ['Estado al recibir', 'Estado al entregar', 'Odómetro', 'Novedad', 'Otro soporte'],
    mantenimientos: ['Factura', 'Cotización', 'Antes del trabajo', 'Después del trabajo', 'Garantía', 'Otro soporte'],
    documentos: ['Documento escaneado', 'Foto del documento', 'Comprobante de pago', 'Otro soporte']
  };
  V.verArchivos = function (col, r) { verSoportes(col, r); };
  V.botonArchivos = function (col, r) { return h('button', { class: 'btn xs', type: 'button', onclick: function () { verSoportes(col, r); } }, '📎 Archivos'); };
  // Registrar un documento faltante desde la tabla de vigencias (vehículo y tipo ya diligenciados)
  V.nuevoDocumento = function (placa, tipo) {
    var esOtro = FL.OPC.tiposDocumento.indexOf(tipo) < 0;
    var f = UI.formulario('documentos', { placa: placa, tipo: esOtro ? 'Otro' : tipo, otroTipo: esOtro ? String(tipo).replace(/^Otro: /, '') : null });
    UI.modal({ titulo: 'Registrar ' + tipo + ' · ' + placa, ancho: true, cuerpo: f.el,
      acciones: [{ l: 'Cancelar' }, { l: 'Guardar', tipo: 'primario', fn: async function () {
        var r = f.leer(); if (!r) return false;
        if (r.fechaInicio && r.fechaVencimiento && r.fechaVencimiento < r.fechaInicio) { f.error('fechaVencimiento', 'El vencimiento no puede ser anterior al inicio de la vigencia.'); return false; }
        var id = await FL.Datos.crear('documentos', V.completar('documentos', r), null, 'documento ' + r.placa + ' ' + r.tipo);
        UI.toast('Documento registrado.', 'ok'); App.refrescar();
        V.ofrecerSoporte('documentos/' + id, 'Archivos del documento', ['Documento escaneado', 'Foto del documento', 'Comprobante de pago', 'Otro soporte']);
      } }] });
  };
  function accionesVigencia(x) {
    if (x.doc) return V.accionesRegistro('documentos', x.doc, [V.botonArchivos('documentos', x.doc)]);
    if (V.puedeIngresar() && !FL.Datos.esConductor()) return h('button', { class: 'btn xs primario', type: 'button', onclick: function () { V.nuevoDocumento(x.placa, x.tipo); } }, '+ Registrar');
    return null;
  }
  function verSoportes(col, r) {
    UI.modal({ titulo: 'Archivos · ' + FL.ESQ[col].uno + ' ' + (r.placa || r.equipo || ''), ancho: true, cuerpo: h('div', { class: 'pila' },
      r.advertencias ? h('p', { class: 'aviso' }, 'Nota registrada: ' + r.advertencias) : null,
      r.anulado ? h('p', { class: 'aviso mal' }, 'ANULADO por ' + r.anuladoPor + ' el ' + U.fFechaHora(r.anuladoEn) + '. Motivo: ' + r.motivoAnulacion) : null,
      h('p', { class: 'muted small' }, 'Registrado por ' + (r._creadoPorUsuario || '—') + ' el ' + U.fFechaHora(r._creado) + (r._mod !== r._creado ? ' · modificado por ' + (r._modPorUsuario || '—') + ' el ' + U.fFechaHora(r._mod) : '') + '.'),
      V.galeria(col + '/' + r.id, { tipos: TIPOS_SOPORTE[col] || ['Documento', 'Fotografía', 'Otro soporte'] })) });
  }

  // =================== LISTADOS ===================
  App.ruta('/tanqueos', function (cont) {
    if (FL.Datos.esConductor()) {
      cont.appendChild(V.titulo('Mis tanqueos', 'Tanqueos registrados a su nombre.', [botonNuevo('/registrar/tanqueo', '+ Registrar tanqueo')]));
      cont.appendChild(h('section', { class: 'tarjeta' }, tablaTanqueos(function () { return FL.Datos.lista('tanqueos'); })));
      return;
    }
    var d = App.datos(), p = App.param();
    cont.appendChild(V.titulo('Combustible y rendimiento', 'Rendimiento calculado entre tanqueos a tanque lleno.', [botonNuevo('/registrar/tanqueo', '+ Registrar tanqueo')]));
    var veh = C.vigentes(d.vehiculos).filter(function (v) { return v.combustible !== 'Eléctrico'; });
    cont.appendChild(UI.seccion('Rendimiento por vehículo', UI.tabla({
      nombre: 'Rendimiento por vehículo',
      columnas: [{ l: 'Placa', v: function (x) { return x.v.placa; } }, { l: 'Vehículo', v: function (x) { return [x.v.tipo, x.v.marca, x.v.linea].filter(Boolean).join(' '); } },
        { l: 'Tramos', v: function (x) { return x.r.tramos.length; }, tipo: 'num' }, { l: 'Km medidos', v: function (x) { return x.r.km; }, tipo: 'num' }, { l: 'Galones', v: function (x) { return x.r.galones; }, tipo: 'num', dec: 1 },
        { l: 'Km/gal promedio', v: function (x) { return x.r.promedio; }, tipo: 'num', dec: 1 }, { l: 'Referencia', v: function (x) { return x.v.rendimientoRef || null; }, tipo: 'num', dec: 1 },
        { l: 'Último tramo', v: function (x) { var t = x.r.tramos[x.r.tramos.length - 1]; return t ? t.kmGal : null; }, tipo: 'num', dec: 1 },
        { l: 'Estado último', v: function (x) { var t = x.r.tramos[x.r.tramos.length - 1]; return t ? t.estado : 'Sin datos'; }, f: function (x) { var t = x.r.tramos[x.r.tramos.length - 1]; return t ? UI.chipEstado(t.estado) : '—'; } },
        { l: 'Tramos con rendimiento bajo', v: function (x) { return x.r.tramos.filter(function (t) { return t.estado === 'Bajo'; }).length; }, tipo: 'num' }],
      filas: veh.map(function (v) { return { v: v, r: C.rendimiento(v, d.tanqueos, p.toleranciaRendimiento) }; }),
      alAbrir: function (x) { pestanaHV = 'combustible'; App.ir('/vehiculo/' + encodeURIComponent(x.v.placa)); }
    })));
    cont.appendChild(UI.seccion('Todos los tanqueos', tablaTanqueos(function () { return FL.Datos.lista('tanqueos'); })));
  }, CON_CONDUCTOR);

  App.ruta('/uso', function (cont) {
    var k = FL.Datos.esConductor();
    cont.appendChild(V.titulo(k ? 'Mis usos de vehículos' : 'Uso diario', k ? 'Vehículos que ha recibido y entregado.' : 'Quién condujo cada vehículo, con qué kilometraje lo recibió y lo entregó.', [botonNuevo('/registrar/uso', '+ Registrar uso')]));
    cont.appendChild(h('section', { class: 'tarjeta' }, tablaUso(function () { return FL.Datos.lista('recorridos'); })));
  }, CON_CONDUCTOR);
  App.ruta('/mantenimientos', function (cont) {
    cont.appendChild(V.titulo('Mantenimientos y arreglos', null, [botonNuevo('/registrar/mantenimiento', '+ Registrar mantenimiento')]));
    cont.appendChild(h('section', { class: 'tarjeta' }, tablaMant(function () { return FL.Datos.lista('mantenimientos'); })));
  }, TODOS);
  App.ruta('/documentos', function (cont) {
    var d = App.datos(), p = App.param();
    cont.appendChild(V.titulo('Documentos y vigencias', 'Estado actual de cada documento por vehículo, e historial de renovaciones.', [botonNuevo('/registrar/documento', '+ Registrar documento')]));
    var filas = [];
    C.vigentes(d.vehiculos).filter(function (v) { return v.estado !== 'Dado de baja'; }).forEach(function (v) { C.documentosVehiculo(v, d.documentos, p).forEach(function (x) { filas.push(Object.assign({ placa: v.placa }, x)); }); });
    cont.appendChild(UI.seccion('Vigencias actuales', UI.tabla({
      nombre: 'Vigencias',
      columnas: [{ l: 'Placa', v: function (x) { return x.placa; } }, { l: 'Documento', v: function (x) { return x.tipo; } }, { l: 'Exigido', v: function (x) { return x.exigido; } }, { l: 'Número', v: function (x) { return x.doc ? x.doc.numero : ''; } },
        { l: 'Entidad', v: function (x) { return x.doc ? x.doc.entidad : ''; } }, { l: 'Vence', v: function (x) { return x.doc ? x.doc.fechaVencimiento : null; }, tipo: 'fecha' }, { l: 'Días', v: function (x) { return x.dias; }, tipo: 'num' },
        { l: 'Estado', v: function (x) { return x.estado; }, f: function (x) { return UI.chipEstado(x.estado); } }],
      filas: filas, ordenInicial: 6, ordenDesc: false, acciones: accionesVigencia,
      filtros: [{ l: 'Estado', opts: [['Vencido', 'Vencidos'], ['Por vencer', 'Por vencer'], ['Sin registro', 'Sin registro'], ['Vigente', 'Vigentes']], fn: function (r, v) { return r.estado === v; } }, { l: 'Documento', opts: FL.OPC.tiposDocumento.map(function (t) { return [t, t]; }), fn: function (r, v) { return r.tipo === v; } }],
      alAbrir: function (x) { pestanaHV = 'docs'; App.ir('/vehiculo/' + encodeURIComponent(x.placa)); }
    })));
    cont.appendChild(UI.seccion('Historial de documentos', tablaDocs(function () { return FL.Datos.lista('documentos'); })));
  }, TODOS);

  // =================== REPORTES ===================
  App.ruta('/reportes', function (cont) {
    var anio = V.anio, d = App.datos(), r = C.rangoAnio(anio);
    var veh = FL.Datos.lista('vehiculos');
    var porVeh = veh.map(function (v) { return Object.assign({ v: v }, C.costoVehiculo(v, d, r[0], r[1])); });
    var porCentro = C.porCentro(d, r[0], r[1]);
    var razones = {};
    porCentro.forEach(function (f) {
      var c = FL.Datos.uno('centros', f.centroId), id = c ? c.razonId : '';
      var o = (razones[id] = razones[id] || { razonId: id, combVeh: 0, combOtros: 0, mantenimiento: 0, documentos: 0, total: 0 });
      ['combVeh', 'combOtros', 'mantenimiento', 'documentos', 'total'].forEach(function (k) { o[k] += f[k]; });
    });
    var porRazon = Object.keys(razones).map(function (k) { return razones[k]; });
    var mes = C.porMes(d, anio);
    var otros = C.vigentes(d.tanqueos).filter(function (x) { return x.destino !== 'Vehículo' && U.anio(x.fecha) === anio; });
    var gOtros = U.agrupar(otros, function (x) { return (x.equipo || 'Otro') + '|' + (x.centroId || ''); });
    var filasOtros = Object.keys(gOtros).map(function (k) { var l = gOtros[k]; return { equipo: l[0].equipo, centroId: l[0].centroId, n: l.length, galones: U.sum(l, function (x) { return x.galones; }), valor: U.sum(l, function (x) { return x.valorTotal; }) }; });

    var colVeh = [{ l: 'Placa', v: function (x) { return x.v.placa; } }, { l: 'Vehículo', v: function (x) { return [x.v.tipo, x.v.marca, x.v.linea].filter(Boolean).join(' '); } },
      { l: 'Centro de costo', v: function (x) { return UI.nombreCentro(x.v.centroId); } }, { l: 'Propietario', v: function (x) { return UI.nombreRazon(x.v.razonId); } },
      { l: 'Combustible', v: function (x) { return x.combustible; }, tipo: 'cop' }, { l: 'Galones', v: function (x) { return x.galones; }, tipo: 'num', dec: 1 },
      { l: 'Mantenimiento', v: function (x) { return x.mantenimiento; }, tipo: 'cop' }, { l: 'Documentos', v: function (x) { return x.documentos; }, tipo: 'cop' },
      { l: 'Total', v: function (x) { return x.total; }, tipo: 'cop' }, { l: 'Km', v: function (x) { return x.km; }, tipo: 'num' },
      { l: 'Km/gal', v: function (x) { return x.kmGal; }, tipo: 'num', dec: 1 }, { l: 'Costo por km', v: function (x) { return x.costoKm; }, tipo: 'cop' }];
    var colCentro = [{ l: 'Centro de costo', v: function (x) { return x.centroId ? UI.nombreCentro(x.centroId) : '(sin centro)'; } }, { l: 'Razón social', v: function (x) { var c = FL.Datos.uno('centros', x.centroId); return c ? UI.nombreRazon(c.razonId) : ''; } },
      { l: 'Combustible vehículos', v: function (x) { return x.combVeh; }, tipo: 'cop' }, { l: 'Combustible otros usos', v: function (x) { return x.combOtros; }, tipo: 'cop' },
      { l: 'Galones totales', v: function (x) { return x.galVeh + x.galOtros; }, tipo: 'num', dec: 1 },
      { l: 'Mantenimiento', v: function (x) { return x.mantenimiento; }, tipo: 'cop' }, { l: 'Documentos', v: function (x) { return x.documentos; }, tipo: 'cop' }, { l: 'Total', v: function (x) { return x.total; }, tipo: 'cop' }];
    var colRazon = [{ l: 'Razón social', v: function (x) { return x.razonId ? UI.nombreRazon(x.razonId) : '(sin razón social)'; } },
      { l: 'Combustible vehículos', v: function (x) { return x.combVeh; }, tipo: 'cop' }, { l: 'Combustible otros usos', v: function (x) { return x.combOtros; }, tipo: 'cop' },
      { l: 'Mantenimiento', v: function (x) { return x.mantenimiento; }, tipo: 'cop' }, { l: 'Documentos', v: function (x) { return x.documentos; }, tipo: 'cop' }, { l: 'Total', v: function (x) { return x.total; }, tipo: 'cop' }];
    var colMes = [{ l: 'Mes', v: function (x) { return U.MESES[x.mes] + ' ' + anio; } }, { l: 'Combustible', v: function (x) { return x.combustible; }, tipo: 'cop' }, { l: 'Galones', v: function (x) { return x.galones; }, tipo: 'num', dec: 1 },
      { l: 'Mantenimiento', v: function (x) { return x.mantenimiento; }, tipo: 'cop' }, { l: 'Documentos', v: function (x) { return x.documentos; }, tipo: 'cop' }, { l: 'Total', v: function (x) { return x.combustible + x.mantenimiento + x.documentos; }, tipo: 'cop' }];
    var colOtros = [{ l: 'Equipo o uso', v: function (x) { return x.equipo; } }, { l: 'Centro de costo', v: function (x) { return UI.nombreCentro(x.centroId); } }, { l: 'Tanqueos', v: function (x) { return x.n; }, tipo: 'num' }, { l: 'Galones', v: function (x) { return x.galones; }, tipo: 'num', dec: 1 }, { l: 'Valor', v: function (x) { return x.valor; }, tipo: 'cop' }];

    cont.appendChild(V.titulo('Costos y reportes', 'Costo total por año: combustible, mantenimientos y documentos.', [V.selectorAnio(anio, function (a) { V.anio = a; App.refrescar(); }),
      h('button', { class: 'btn', type: 'button', onclick: function () { FL.Exportar.excel('Reporte de costos ' + anio, [{ nombre: 'Por vehículo', columnas: colVeh, filas: porVeh }, { nombre: 'Por centro de costo', columnas: colCentro, filas: porCentro }, { nombre: 'Por razón social', columnas: colRazon, filas: porRazon }, { nombre: 'Por mes', columnas: colMes, filas: mes }, { nombre: 'Otros usos', columnas: colOtros, filas: filasOtros }], [['Año', anio]]).catch(function (e) { UI.toast(e.message, 'error'); }); } }, '⬇ Reporte completo (Excel)'),
      h('button', { class: 'btn', type: 'button', onclick: function () { FL.Exportar.todo().catch(function (e) { UI.toast(e.message, 'error'); }); } }, '⬇ Base completa (Excel)')]));
    cont.appendChild(UI.seccion('Costo por vehículo, ' + anio, UI.tabla({ nombre: 'Costo por vehículo ' + anio, columnas: colVeh, filas: porVeh, ordenInicial: 8, alAbrir: function (x) { App.ir('/vehiculo/' + encodeURIComponent(x.v.placa)); } })));
    cont.appendChild(UI.seccion('Costo por centro de costo, ' + anio, UI.tabla({ nombre: 'Costo por centro de costo ' + anio, columnas: colCentro, filas: porCentro, ordenInicial: 7 })));
    cont.appendChild(UI.seccion('Costo por razón social, ' + anio, UI.tabla({ nombre: 'Costo por razon social ' + anio, columnas: colRazon, filas: porRazon, ordenInicial: 5 })));
    cont.appendChild(UI.seccion('Combustible para otros usos, ' + anio, UI.tabla({ nombre: 'Otros usos ' + anio, columnas: colOtros, filas: filasOtros, ordenInicial: 4, vacio: 'Sin combustible para otros usos en el año.' })));
    cont.appendChild(UI.seccion('Costo por mes, ' + anio, UI.tabla({ nombre: 'Costo por mes ' + anio, columnas: colMes, filas: mes })));
  }, TODOS);
})();
