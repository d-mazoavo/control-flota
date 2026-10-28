/*
 * Cálculos: rendimiento (km por galón), kilometraje, costos por periodo, vigencias,
 * mantenimientos, pico y placa y alertas. Funciones puras sobre los datos sincronizados.
 */
(function () {
  'use strict';
  var FL = (typeof window !== 'undefined' ? (window.FL = window.FL || {}) : (global.FL = global.FL || {}));
  var U = FL.U;
  var C = (FL.Calc = {});

  function vig(arr) { return (arr || []).filter(function (r) { return !r.anulado; }); }
  function t(v) { var d = U.toDate(v); return d ? d.getTime() : 0; }
  C.vigentes = vig;

  // ---------- Rendimiento por el método de tanque lleno a tanque lleno ----------
  C.tanqueosDe = function (placa, tanqueos) {
    return vig(tanqueos).filter(function (x) { return x.destino === 'Vehículo' && x.placa === placa && typeof x.odometro === 'number'; })
      .sort(function (a, b) { return (a.odometro - b.odometro) || (t(a.fecha) - t(b.fecha)); });
  };
  // Cada tramo va de un tanqueo a tanque lleno al siguiente; los galones del tramo son los
  // cargados después del primero, incluido el que cierra el tramo.
  C.tramos = function (lista) {
    var out = [], base = null, gal = 0, val = 0, n = 0;
    lista.forEach(function (x) {
      if (!base) { if (x.tanqueLleno !== false) { base = x; gal = 0; val = 0; n = 0; } return; }
      gal += x.galones || 0; val += x.valorTotal || 0; n++;
      if (x.tanqueLleno !== false) {
        var km = x.odometro - base.odometro;
        if (km > 0 && gal > 0) out.push({ id: x.id, desde: base, hasta: x, fecha: x.fecha, km: km, galones: gal, valor: val, tanqueos: n, kmGal: km / gal, costoKm: val / km });
        base = x; gal = 0; val = 0; n = 0;
      }
    });
    return out;
  };
  C.rendimiento = function (vehiculo, tanqueos, tol) {
    var tr = C.tramos(C.tanqueosDe(vehiculo.placa, tanqueos));
    var km = U.sum(tr, function (x) { return x.km; }), gal = U.sum(tr, function (x) { return x.galones; });
    var prom = gal > 0 ? km / gal : null;
    var ref = vehiculo.rendimientoRef > 0 ? vehiculo.rendimientoRef : prom;
    tol = (tol == null ? 20 : tol) / 100;
    tr.forEach(function (x) {
      x.referencia = ref;
      x.desvio = ref ? (x.kmGal - ref) / ref * 100 : null;
      x.estado = !ref || tr.length < 2 && !(vehiculo.rendimientoRef > 0) ? 'Sin referencia'
        : x.kmGal < ref * (1 - tol) ? 'Bajo' : x.kmGal > ref * (1 + tol * 1.5) ? 'Alto' : 'Normal';
    });
    return { tramos: tr, promedio: prom, referencia: ref, km: km, galones: gal };
  };

  // ---------- Kilometraje ----------
  C.lecturas = function (v, d) {
    var p = v.placa, out = [];
    if (typeof v.odometroInicial === 'number') out.push({ fecha: t(v.fechaIngreso) || 0, km: v.odometroInicial, fuente: 'Registro inicial' });
    if (C.usarResumen && typeof v.odometroUltimo === 'number') out.push({ fecha: t(v.odometroFecha) || 0, km: v.odometroUltimo, fuente: 'Último registro' });
    vig(d.tanqueos).forEach(function (x) { if (x.placa === p && x.destino === 'Vehículo' && typeof x.odometro === 'number') out.push({ fecha: t(x.fecha), km: x.odometro, fuente: 'Tanqueo', id: x.id }); });
    vig(d.recorridos).forEach(function (x) {
      if (x.placa !== p) return;
      if (typeof x.kmRecibe === 'number') out.push({ fecha: t(x.fechaRecibe), km: x.kmRecibe, fuente: 'Uso diario (recibe)', id: x.id });
      if (typeof x.kmEntrega === 'number') out.push({ fecha: t(x.fechaEntrega) || t(x.fechaRecibe), km: x.kmEntrega, fuente: 'Uso diario (entrega)', id: x.id });
    });
    vig(d.mantenimientos).forEach(function (x) { if (x.placa === p && typeof x.odometro === 'number') out.push({ fecha: t(x.fecha), km: x.odometro, fuente: 'Mantenimiento', id: x.id }); });
    return out.sort(function (a, b) { return (a.fecha - b.fecha) || (a.km - b.km); });
  };
  C.odometro = function (v, d) {
    var l = C.lecturas(v, d);
    return l.length ? Math.max.apply(null, l.map(function (x) { return x.km; })) : null;
  };
  C.ultimaLectura = function (v, d) {
    var l = C.lecturas(v, d);
    if (!l.length) return null;
    var max = l.reduce(function (a, b) { return b.km >= a.km ? b : a; });
    return max;
  };
  // Kilómetros recorridos en el periodo: mayor lectura del periodo menos la última lectura anterior al periodo
  C.kmPeriodo = function (v, d, desde, hasta) {
    var l = C.lecturas(v, d);
    var antes = l.filter(function (x) { return x.fecha < desde; });
    var dentro = l.filter(function (x) { return x.fecha >= desde && x.fecha < hasta; });
    if (!dentro.length) return 0;
    // Sin lecturas anteriores, la base es la primera lectura del periodo (por fecha)
    var base = antes.length ? Math.max.apply(null, antes.map(function (x) { return x.km; })) : dentro[0].km;
    var fin = Math.max.apply(null, dentro.map(function (x) { return x.km; }));
    return Math.max(0, fin - base);
  };

  // ---------- Costos ----------
  function enRango(v, a, b) { var x = t(v); return x >= a && x < b; }
  C.rangoAnio = function (anio) { return [new Date(anio, 0, 1).getTime(), new Date(anio + 1, 0, 1).getTime()]; };
  C.rangoMes = function (anio, mes) { return [new Date(anio, mes, 1).getTime(), new Date(anio, mes + 1, 1).getTime()]; };
  C.fechaDoc = function (x) { return x.fechaExpedicion || x.fechaInicio || x.fechaVencimiento; };

  C.costoVehiculo = function (v, d, desde, hasta) {
    var tq = vig(d.tanqueos).filter(function (x) { return x.destino === 'Vehículo' && x.placa === v.placa && enRango(x.fecha, desde, hasta); });
    var mt = vig(d.mantenimientos).filter(function (x) { return x.placa === v.placa && enRango(x.fecha, desde, hasta); });
    var dc = vig(d.documentos).filter(function (x) { return x.placa === v.placa && enRango(C.fechaDoc(x), desde, hasta); });
    var o = {
      combustible: U.sum(tq, function (x) { return x.valorTotal; }),
      galones: U.sum(tq, function (x) { return x.galones; }),
      tanqueos: tq.length,
      mantenimiento: U.sum(mt, function (x) { return x.valorTotal; }),
      mantenimientos: mt.length,
      documentos: U.sum(dc, function (x) { return x.valor; }),
      km: C.kmPeriodo(v, d, desde, hasta)
    };
    o.total = o.combustible + o.mantenimiento + o.documentos;
    o.costoKm = o.km > 0 ? o.total / o.km : null;
    var tr = C.tramos(C.tanqueosDe(v.placa, d.tanqueos)).filter(function (x) { return enRango(x.fecha, desde, hasta); });
    var kmT = U.sum(tr, function (x) { return x.km; }), galT = U.sum(tr, function (x) { return x.galones; });
    o.kmGal = galT > 0 ? kmT / galT : null;
    return o;
  };

  // Costos agrupados por mes del año (combustible incluye otros usos)
  C.porMes = function (d, anio, filtro) {
    filtro = filtro || function () { return true; };
    var out = [];
    for (var m = 0; m < 12; m++) {
      var r = C.rangoMes(anio, m);
      var tq = vig(d.tanqueos).filter(function (x) { return filtro(x) && enRango(x.fecha, r[0], r[1]); });
      var mt = vig(d.mantenimientos).filter(function (x) { return filtro(x) && enRango(x.fecha, r[0], r[1]); });
      var dc = vig(d.documentos).filter(function (x) { return filtro(x) && enRango(C.fechaDoc(x), r[0], r[1]); });
      out.push({
        mes: m,
        combustible: U.sum(tq, function (x) { return x.valorTotal; }),
        galones: U.sum(tq, function (x) { return x.galones; }),
        mantenimiento: U.sum(mt, function (x) { return x.valorTotal; }),
        documentos: U.sum(dc, function (x) { return x.valor; })
      });
    }
    return out;
  };

  // Costos por centro de costo en el periodo. Mantenimientos y documentos sin centro toman el del vehículo.
  C.porCentro = function (d, desde, hasta) {
    var veh = U.porId(d.vehiculos), o = {};
    function fila(id) { return (o[id || ''] = o[id || ''] || { centroId: id || '', combVeh: 0, combOtros: 0, galVeh: 0, galOtros: 0, mantenimiento: 0, documentos: 0 }); }
    vig(d.tanqueos).forEach(function (x) {
      if (!enRango(x.fecha, desde, hasta)) return;
      var f = fila(x.centroId);
      if (x.destino === 'Vehículo') { f.combVeh += x.valorTotal || 0; f.galVeh += x.galones || 0; }
      else { f.combOtros += x.valorTotal || 0; f.galOtros += x.galones || 0; }
    });
    vig(d.mantenimientos).forEach(function (x) {
      if (!enRango(x.fecha, desde, hasta)) return;
      fila(x.centroId || (veh[x.placa] || {}).centroId).mantenimiento += x.valorTotal || 0;
    });
    vig(d.documentos).forEach(function (x) {
      if (!enRango(C.fechaDoc(x), desde, hasta)) return;
      fila((veh[x.placa] || {}).centroId).documentos += x.valor || 0;
    });
    return Object.keys(o).map(function (k) { var f = o[k]; f.total = f.combVeh + f.combOtros + f.mantenimiento + f.documentos; return f; });
  };

  // ---------- Documentos y vigencias ----------
  C.claveDoc = function (x) { return x.tipo === 'Otro' ? 'Otro: ' + (x.otroTipo || '') : x.tipo; };
  C.documentosVehiculo = function (v, documentos, p) {
    p = p || {};
    var dias = p.diasAlerta || 30;
    var ultimos = {};
    vig(documentos).filter(function (x) { return x.placa === v.placa; }).forEach(function (x) {
      var k = C.claveDoc(x);
      if (!ultimos[k] || t(x.fechaVencimiento) > t(ultimos[k].fechaVencimiento)) ultimos[k] = x;
    });
    var claves = (v.docsExigidos || []).filter(function (k) { return k !== 'Otro'; });
    Object.keys(ultimos).forEach(function (k) { if (claves.indexOf(k) < 0) claves.push(k); });
    return claves.map(function (k) {
      var x = ultimos[k] || null;
      var dd = x ? U.diasHasta(x.fechaVencimiento) : null;
      var exigido = (v.docsExigidos || []).indexOf(k) >= 0;
      var estado = !x ? 'Sin registro' : dd < 0 ? 'Vencido' : dd <= dias ? 'Por vencer' : 'Vigente';
      return { tipo: k, doc: x, dias: dd, estado: estado, exigido: exigido };
    });
  };

  // ---------- Mantenimiento preventivo ----------
  function sumarMeses(fecha, m) { var d = U.toDate(fecha); return d ? new Date(d.getFullYear(), d.getMonth() + m, d.getDate()) : null; }
  C.proximoMantenimiento = function (v, d, p) {
    p = p || {};
    var mt = vig(d.mantenimientos).filter(function (x) { return x.placa === v.placa; }).sort(function (a, b) { return t(b.fecha) - t(a.fecha); });
    var conProx = mt.filter(function (x) { return x.proximoKm || x.proximaFecha; })[0];
    var prev = mt.filter(function (x) { return x.tipo === 'Preventivo'; })[0];
    var km = null, fecha = null, base = null;
    if (conProx) { km = conProx.proximoKm || null; fecha = conProx.proximaFecha || null; base = conProx; }
    else if (prev && (v.intervaloKm || v.intervaloMeses)) {
      base = prev;
      if (v.intervaloKm && typeof prev.odometro === 'number') km = prev.odometro + v.intervaloKm;
      if (v.intervaloMeses) fecha = U.ymd(sumarMeses(prev.fecha, v.intervaloMeses));
    }
    if (!km && !fecha) return { estado: (v.intervaloKm || v.intervaloMeses) && !prev ? 'Sin preventivo registrado' : 'Sin programar', km: null, fecha: null, base: base };
    var odo = C.odometro(v, d);
    var faltaKm = km && odo != null ? km - odo : null;
    var faltaDias = fecha ? U.diasHasta(fecha) : null;
    var estado = (faltaKm != null && faltaKm <= 0) || (faltaDias != null && faltaDias < 0) ? 'Vencido'
      : (faltaKm != null && faltaKm <= (p.kmAlertaMantenimiento || 500)) || (faltaDias != null && faltaDias <= (p.diasAlerta || 30)) ? 'Próximo' : 'Al día';
    return { estado: estado, km: km, fecha: fecha, faltaKm: faltaKm, faltaDias: faltaDias, base: base };
  };

  // ---------- Pico y placa ----------
  C.digitoPlaca = function (placa, cual) {
    var dig = String(placa || '').replace(/\D/g, '');
    if (!dig) return null;
    return cual === 'Primer dígito' ? dig[0] : dig[dig.length - 1];
  };
  C.picoYPlaca = function (v, fecha, reglas) {
    if (!v || v.aplicaPicoPlaca === false || v.estado === 'Dado de baja') return [];
    var f = U.toDate(fecha) || new Date(), dia = f.getDay(), ymd = U.ymd(f);
    if (dia === 0) return [];
    return vig(reglas).filter(function (r) {
      if (r.activo === false) return false;
      if (r.vigenciaDesde && ymd < r.vigenciaDesde) return false;
      if (r.vigenciaHasta && ymd > r.vigenciaHasta) return false;
      if (r.tipos && r.tipos.length && r.tipos.indexOf(v.tipo) < 0) return false;
      var excl = String(r.excluidas || '').split(/[\s,;]+/).map(function (s) { return s.trim(); });
      if (excl.indexOf(ymd) >= 0) return false;
      var dg = C.digitoPlaca(v.placa, r.digito);
      var lista = String(r['d' + dia] || '').split(/[^0-9]+/).filter(Boolean);
      return dg != null && lista.indexOf(dg) >= 0;
    }).map(function (r) { return { ciudad: r.ciudad, horario: r.horario || '', fuente: r.fuente || '' }; });
  };

  // ---------- Uso diario: kilómetros no registrados entre una entrega y el siguiente recibo ----------
  C.brechas = function (recorridos, tol) {
    tol = tol == null ? 5 : tol;
    var out = {};
    var g = U.agrupar(vig(recorridos), function (x) { return x.placa; });
    Object.keys(g).forEach(function (p) {
      var l = g[p].sort(function (a, b) { return t(a.fechaRecibe) - t(b.fechaRecibe); });
      for (var i = 1; i < l.length; i++) {
        var ant = l[i - 1];
        if (typeof ant.kmEntrega !== 'number') continue;
        var dif = l[i].kmRecibe - ant.kmEntrega;
        if (Math.abs(dif) > tol) out[l[i].id] = dif;
      }
    });
    return out;
  };

  // ---------- Licencias de conducción (varias categorías, cada una con su vencimiento) ----------
  C.licencias = function (p) {
    if (!p) return [];
    if (Array.isArray(p.licencias)) return p.licencias.filter(function (l) { return l && l.categoria; });
    if (p.licenciaCategoria || p.licenciaVence) return [{ categoria: p.licenciaCategoria || 'Sin categoría', vence: p.licenciaVence || null }];  // registros anteriores
    return [];
  };
  C.estadoLicencias = function (p, dias) {
    var o = { vigentes: [], porVencer: [], vencidas: [] };
    C.licencias(p).forEach(function (l) {
      var dd = l.vence ? U.diasHasta(l.vence) : null;
      if (dd == null || dd < 0) o.vencidas.push(l); else { o.vigentes.push(l); if (dd <= (dias || 30)) o.porVencer.push(l); }
    });
    o.estado = !C.licencias(p).length ? 'Sin registro' : !o.vigentes.length ? 'Vencido' : o.vencidas.length ? 'Alguna vencida' : o.porVencer.length ? 'Por vencer' : 'Vigente';
    return o;
  };
  // ¿La persona tiene vigente alguna categoría que habilite para el vehículo?
  C.habilitado = function (p, v) {
    var exig = (v && v.categoriasLicencia) || [];
    var vig = C.estadoLicencias(p).vigentes.map(function (l) { return l.categoria; });
    if (!exig.length) return { ok: vig.length > 0, exigidas: [], vigentes: vig };
    return { ok: exig.some(function (c) { return vig.indexOf(c) >= 0; }), exigidas: exig, vigentes: vig };
  };
  C.textoLicencias = function (p) {
    return C.licencias(p).map(function (l) { return l.categoria + (l.vence ? ' (vence ' + U.fFecha(l.vence) + ')' : ' (sin vencimiento)'); }).join('; ');
  };

  // ---------- Alertas ----------
  // nivel: 3 crítico, 2 alto, 1 medio, 0 informativo
  C.alertas = function (d, p) {
    p = p || {};
    var out = [], hoy = Date.now();
    var dias = p.diasAlerta || 30, diasC = p.diasCritico || 7;
    var activos = vig(d.vehiculos).filter(function (v) { return v.estado !== 'Dado de baja'; });

    activos.forEach(function (v) {
      C.documentosVehiculo(v, d.documentos, p).forEach(function (x) {
        if (x.estado === 'Vigente') return;
        if (x.estado === 'Sin registro') { if (x.exigido) out.push({ nivel: 2, tipo: 'Documento', placa: v.placa, texto: v.placa + ': no hay registro de ' + x.tipo + '.' }); return; }
        var nivel = x.estado === 'Vencido' ? 3 : x.dias <= diasC ? 2 : 1;
        out.push({ nivel: nivel, tipo: 'Documento', placa: v.placa, fecha: x.doc.fechaVencimiento,
          texto: v.placa + ': ' + x.tipo + (x.estado === 'Vencido' ? ' venció hace ' + (-x.dias) + ' día(s) (' + U.fFecha(x.doc.fechaVencimiento) + ').' : x.dias === 0 ? ' vence hoy.' : ' vence en ' + x.dias + ' día(s) (' + U.fFecha(x.doc.fechaVencimiento) + ').') });
      });
      var m = C.proximoMantenimiento(v, d, p);
      if (m.estado === 'Vencido' || m.estado === 'Próximo') {
        var det = [];
        if (m.km) det.push(m.faltaKm <= 0 ? 'pasó ' + U.n(-m.faltaKm) + ' km del límite (' + U.n(m.km) + ' km)' : 'faltan ' + U.n(m.faltaKm) + ' km (' + U.n(m.km) + ' km)');
        if (m.fecha) det.push(m.faltaDias < 0 ? 'fecha vencida el ' + U.fFecha(m.fecha) : 'fecha ' + U.fFecha(m.fecha));
        out.push({ nivel: m.estado === 'Vencido' ? 2 : 1, tipo: 'Mantenimiento', placa: v.placa, texto: v.placa + ': mantenimiento ' + (m.estado === 'Vencido' ? 'vencido' : 'próximo') + ' — ' + det.join('; ') + '.' });
      }
      var r = C.rendimiento(v, d.tanqueos, p.toleranciaRendimiento);
      var ult = r.tramos[r.tramos.length - 1];
      if (ult && (ult.estado === 'Bajo' || ult.estado === 'Alto') && hoy - t(ult.fecha) < 90 * 86400000) {
        out.push({ nivel: ult.estado === 'Bajo' ? 2 : 1, tipo: 'Rendimiento', placa: v.placa, fecha: ult.fecha,
          texto: v.placa + ': rendimiento ' + (ult.estado === 'Bajo' ? 'BAJO' : 'inusualmente ALTO') + ' en el último tramo (' + U.n(ult.kmGal, 1) + ' km/gal frente a ' + U.n(r.referencia, 1) + ' de referencia, ' + (ult.desvio > 0 ? '+' : '') + U.n(ult.desvio, 0) + ' %). ' + (ult.estado === 'Bajo' ? 'Verifique posible desvío de combustible, fuga o falla mecánica.' : 'Verifique el odómetro o tanqueos no marcados como tanque lleno.') });
      }
      C.picoYPlaca(v, new Date(), d.picoyplaca).forEach(function (pp) {
        out.push({ nivel: 0, tipo: 'Pico y placa', placa: v.placa, texto: v.placa + ': hoy tiene pico y placa en ' + pp.ciudad + (pp.horario ? ' (' + pp.horario + ')' : '') + '.' });
      });
    });

    vig(d.personas).forEach(function (x) {
      if (!x.conductor || x.activo === false) return;
      var lic = C.licencias(x);
      if (!lic.length) { out.push({ nivel: 1, tipo: 'Licencia', texto: x.nombres + ' está autorizado para conducir pero no tiene licencias registradas.' }); return; }
      lic.forEach(function (l) {
        if (!l.vence) { out.push({ nivel: 1, tipo: 'Licencia', texto: 'Licencia ' + l.categoria + ' de ' + x.nombres + ' sin fecha de vencimiento registrada.' }); return; }
        var dd = U.diasHasta(l.vence);
        if (dd < 0) out.push({ nivel: 3, tipo: 'Licencia', texto: 'Licencia ' + l.categoria + ' de ' + x.nombres + ' vencida desde el ' + U.fFecha(l.vence) + '. No debe conducir vehículos que exijan esa categoría.' });
        else if (dd <= dias) out.push({ nivel: dd <= diasC ? 2 : 1, tipo: 'Licencia', texto: 'Licencia ' + l.categoria + ' de ' + x.nombres + ' vence el ' + U.fFecha(l.vence) + ' (' + dd + ' día(s)).' });
      });
    });

    var veh = U.porId(d.vehiculos);
    vig(d.tanqueos).forEach(function (x) {
      if (x.destino !== 'Vehículo' || hoy - t(x.fecha) > 60 * 86400000) return;
      var v = veh[x.placa];
      if (v && v.capacidadTanque > 0 && x.galones > v.capacidadTanque * 1.05) {
        out.push({ nivel: 2, tipo: 'Combustible', placa: x.placa, fecha: x.fecha, texto: x.placa + ': el ' + U.fFecha(x.fecha) + ' se registraron ' + U.n(x.galones, 2) + ' galones, más que la capacidad del tanque (' + U.n(v.capacidadTanque, 1) + ' gal).' });
      }
    });
    vig(d.recorridos).forEach(function (x) {
      if (x.estado === 'Abierto' && hoy - t(x.fechaRecibe) > (p.horasRecorridoAbierto || 24) * 3600000) {
        out.push({ nivel: 1, tipo: 'Uso diario', placa: x.placa, texto: x.placa + ': uso diario abierto desde el ' + U.fFechaHora(x.fechaRecibe) + ' sin registrar la entrega.' });
      }
    });
    var br = C.brechas(d.recorridos, p.kmBrecha);
    var rec = U.porId(d.recorridos);
    Object.keys(br).forEach(function (id) {
      var x = rec[id];
      if (!x || hoy - t(x.fechaRecibe) > 60 * 86400000) return;
      out.push({ nivel: br[id] > 0 ? 2 : 1, tipo: 'Uso diario', placa: x.placa, texto: x.placa + ': ' + (br[id] > 0 ? U.n(br[id]) + ' km sin registrar entre la entrega anterior y el recibo del ' + U.fFechaHora(x.fechaRecibe) + '.' : 'el kilometraje al recibir (' + U.n(x.kmRecibe) + ') es menor que el de la entrega anterior.') });
    });
    return out.sort(function (a, b) { return b.nivel - a.nivel; });
  };
})();
