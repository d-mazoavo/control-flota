/* Descargas: Excel de cualquier tabla o de toda la base, y hoja de vida del vehículo en PDF.
 * Cada descarga queda en la bitácora con su huella SHA-256. */
(function () {
  'use strict';
  var FL = (window.FL = window.FL || {});
  var U = FL.U, h = U.h;
  var E = (FL.Exportar = {});

  function nombreHoja(s) { return String(s || 'Datos').replace(/[\[\]\*\?\/\\:]/g, ' ').slice(0, 31); }
  function celda(c, r) {
    var v = c.v(r);
    if (v === null || v === undefined || v === '') return { value: '', type: String };
    if (c.tipo === 'fecha' || c.tipo === 'fechahora') {
      var d = U.toDate(v);
      // Excel guarda la hora "de pared": se traslada la hora local de Colombia sin desfase de zona horaria
      if (d) d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()));
      return d ? { value: d, type: Date, format: c.tipo === 'fecha' ? 'dd/mm/yyyy' : 'dd/mm/yyyy hh:mm' } : { value: String(v), type: String };
    }
    if (c.tipo === 'cop') return { value: Number(v), type: Number, format: '#,##0' };
    if (c.tipo === 'num') return { value: Number(v), type: Number, format: c.dec ? '#,##0.' + '0'.repeat(c.dec) : '#,##0' };
    if (typeof v === 'number') return { value: v, type: Number };
    if (typeof v === 'boolean') return { value: v ? 'Sí' : 'No', type: String };
    if (Array.isArray(v)) return { value: v.join(', '), type: String };
    return { value: String(v), type: String };
  }

  async function terminar(blob, archivo, detalle) {
    var huella = await U.sha256(blob);
    U.download(blob, archivo);
    await FL.Datos.registrarExportacion(archivo, detalle, huella);
    FL.UI.modal({
      titulo: 'Archivo generado',
      cuerpo: h('div', { class: 'pila' },
        h('p', null, 'Se descargó ', h('strong', null, archivo), '.'),
        h('p', { class: 'muted small' }, 'Huella SHA-256, registrada en la bitácora de auditoría (permite demostrar que el archivo no fue alterado después de generado):'),
        h('code', { class: 'huella' }, huella),
        h('p', { class: 'muted small' }, 'El archivo contiene datos personales tratados conforme a la Ley 1581 de 2012: úselo solo para la finalidad para la que se descargó y no lo comparta fuera de la compañía.')),
      acciones: [{ l: 'Cerrar', tipo: 'primario' }]
    });
  }

  // hojas: [{ nombre, columnas: [{ l, v, tipo, ancho }], filas }]
  E.excel = async function (titulo, hojas, filtros) {
    if (!window.writeXlsxFile) return FL.UI.toast('La librería de Excel no está disponible.', 'error');
    var yo = FL.Datos.yo();
    var archivo = U.nombreArchivo('flota ' + titulo) + '_' + U.sello() + '.xlsx';
    var libros = hojas.map(function (hj) {
      var cab = hj.columnas.map(function (c) { return { value: c.l, fontWeight: 'bold', backgroundColor: '#E4EEDF' }; });
      return {
        data: [cab].concat(hj.filas.map(function (r) { return hj.columnas.map(function (c) { return celda(c, r); }); })),
        sheet: nombreHoja(hj.nombre),
        columns: hj.columnas.map(function (c) { return { width: c.ancho || (c.tipo === 'fecha' ? 12 : c.tipo === 'fechahora' ? 17 : c.tipo === 'cop' ? 15 : 18) }; }),
        stickyRowsCount: 1
      };
    });
    var info = [
      ['Empresa', FL.CFG.empresa || 'Avo Pak S.A.S.'],
      ['Reporte', titulo],
      ['Generado por', yo.nombre + ' (' + yo.usuario + ', ' + yo.rol + ')'],
      ['Fecha y hora', U.fFechaHora(new Date())]
    ].concat(filtros || []).concat(hojas.map(function (hj) { return ['Registros en «' + nombreHoja(hj.nombre) + '»', String(hj.filas.length)]; }));
    libros.push({
      data: [[{ value: 'Información de la descarga', fontWeight: 'bold' }]].concat(info.map(function (x) { return [{ value: x[0], fontWeight: 'bold' }, { value: String(x[1]) }]; }))
        .concat([[{ value: '' }], [{ value: 'Contiene datos personales (Ley 1581 de 2012). Uso interno exclusivo para la finalidad de control de flota y combustible. La huella SHA-256 del archivo queda registrada en la bitácora de auditoría.', wrap: true }]]),
      sheet: 'Información', columns: [{ width: 30 }, { width: 70 }]
    });
    var blob = await window.writeXlsxFile(libros).toBlob();
    await terminar(blob, archivo, titulo + ' — ' + hojas.map(function (hj) { return hj.filas.length + ' ' + hj.nombre; }).join(', ') + (filtros && filtros.length ? ' — filtros: ' + filtros.map(function (f) { return f[0] + ' = ' + f[1]; }).join('; ') : ''));
  };

  // Descarga completa de la base (todas las colecciones), útil para auditoría o respaldo
  E.todo = async function () {
    var V = FL.Vistas;
    var hojas = ['vehiculos', 'personas', 'centros', 'razones', 'tanqueos', 'recorridos', 'mantenimientos', 'documentos', 'asignaciones', 'picoyplaca'].map(function (col) {
      return { nombre: col === 'asignaciones' ? 'Asignaciones' : FL.ESQ[col].titulo, columnas: V.columnasExport(col), filas: FL.Datos.lista(col) };
    });
    await E.excel('Base completa', hojas, []);
  };

  // ---------- PDF: hoja de vida del vehículo ----------
  function imagenBase64(src) {
    return new Promise(function (res) {
      var img = new Image();
      img.onload = function () { var c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0); res(c.toDataURL('image/png')); };
      img.onerror = function () { res(null); };
      img.src = src;
    });
  }
  function tabla(doc, o) { return typeof doc.autoTable === 'function' ? doc.autoTable(o) : window.autoTable(doc, o); }

  E.hojaDeVida = async function (placa, anio) {
    if (!window.jspdf) return FL.UI.toast('La librería de PDF no está disponible.', 'error');
    var v = FL.Datos.uno('vehiculos', placa), d = FL.App.datos(), p = FL.App.param(), yo = FL.Datos.yo();
    var C = FL.Calc, UI = FL.UI;
    var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'letter' });
    var W = doc.internal.pageSize.getWidth(), M = 14;
    var logo = await imagenBase64('img/logo-informe.png');
    var verde = [88, 126, 80];
    function cab() {
      if (logo) doc.addImage(logo, 'PNG', M, 9, 19, 14);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(30);
      doc.text((FL.CFG.empresa || 'Avo Pak S.A.S.').toUpperCase() + ' — DIRECCIÓN DE SEGURIDAD INTEGRAL', M + 23, 14);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
      doc.text('Hoja de vida del vehículo ' + v.placa + ' — Control de flota y combustible', M + 23, 19.5);
      doc.setDrawColor.apply(doc, verde); doc.setLineWidth(0.6); doc.line(M, 25, W - M, 25);
    }
    var y = 30;
    var estilo = { theme: 'grid', styles: { fontSize: 8, cellPadding: 1.4, overflow: 'linebreak' }, headStyles: { fillColor: verde, textColor: 255, fontStyle: 'bold' }, margin: { left: M, right: M, top: 30 }, didDrawPage: cab };
    function titulo(t) {
      if (y > 245) { doc.addPage(); y = 30; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(30); doc.text(t, M, y + 4); y += 6;
    }
    function t2(head, body, extra) {
      tabla(doc, Object.assign({}, estilo, { startY: y, head: [head], body: body.length ? body : [[{ content: 'Sin registros.', colSpan: head.length }]] }, extra || {}));
      y = doc.lastAutoTable.finalY + 6;
    }
    cab();

    var odo = C.odometro(v, d);
    var datos = [
      ['Placa', v.placa], ['Tipo / clase', [v.tipo, v.clase].filter(Boolean).join(' / ')], ['Marca / línea / modelo', [v.marca, v.linea, v.modelo].filter(Boolean).join(' / ')],
      ['Color', v.color], ['Cilindraje', v.cilindraje ? U.n(v.cilindraje) + ' cc' : ''], ['Servicio', v.servicio], ['Capacidad', v.capacidad],
      ['Número de motor', v.numeroMotor], ['Número de chasis / VIN', v.numeroChasis], ['Número de serie', v.numeroSerie],
      ['Licencia de tránsito', v.licenciaTransito], ['Organismo de tránsito', v.organismoTransito], ['Fecha de matrícula', v.fechaMatricula ? U.fFecha(v.fechaMatricula) : ''],
      ['Propietario', UI.nombreRazon(v.razonId)], ['Centro de costo', UI.nombreCentro(v.centroId)], ['Responsable asignado', v.responsableCedula ? UI.nombrePersona(v.responsableCedula) + ' (C. C. ' + v.responsableCedula + ')' : ''],
      ['Estado', v.estado], ['Combustible', v.combustible], ['Capacidad del tanque', v.capacidadTanque ? U.n(v.capacidadTanque, 1) + ' gal' : ''],
      ['Rendimiento de referencia', v.rendimientoRef ? U.n(v.rendimientoRef, 1) + ' km/gal' : ''], ['Kilometraje actual registrado', odo != null ? U.n(odo) + ' km' : ''],
      ['Blindaje', v.blindado ? 'Sí' + (v.nivelBlindaje ? ', nivel ' + v.nivelBlindaje : '') + (v.empresaBlindadora ? ', ' + v.empresaBlindadora : '') : 'No'],
      ['Rastreo satelital', v.gps ? 'Sí' + (v.proveedorGps ? ' (' + v.proveedorGps + ')' : '') : 'No'], ['Alarma / inmovilizador', v.alarma ? 'Sí' : 'No'], ['Otros dispositivos', v.otrosDispositivos],
      ['Pico y placa', v.aplicaPicoPlaca === false ? 'Exento' : 'Sujeto'], ['Preventivo cada', [v.intervaloKm ? U.n(v.intervaloKm) + ' km' : '', v.intervaloMeses ? v.intervaloMeses + ' meses' : ''].filter(Boolean).join(' o ')],
      ['Valor comercial', v.valorComercial ? U.cop(v.valorComercial) : ''], ['Observaciones', v.observaciones]
    ].filter(function (x) { return x[1]; });
    titulo('1. Datos del vehículo');
    t2(['Campo', 'Valor'], datos, { columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } } });

    titulo('2. Documentos y vigencias (a la fecha de generación)');
    t2(['Documento', 'Número', 'Entidad', 'Vencimiento', 'Estado'], C.documentosVehiculo(v, d.documentos, p).map(function (x) {
      return [x.tipo, x.doc ? x.doc.numero || '' : '', x.doc ? x.doc.entidad || '' : '', x.doc ? U.fFecha(x.doc.fechaVencimiento) : '', x.estado + (x.doc && x.dias != null ? ' (' + (x.dias < 0 ? 'hace ' + (-x.dias) : x.dias) + ' días)' : '')];
    }));

    var r = C.rangoAnio(anio), k = C.costoVehiculo(v, d, r[0], r[1]);
    titulo('3. Indicadores del año ' + anio);
    t2(['Combustible', 'Galones', 'Mantenimiento', 'Documentos', 'Costo total', 'Km recorridos', 'Km por galón', 'Costo por km'],
      [[U.cop(k.combustible), U.n(k.galones, 2), U.cop(k.mantenimiento), U.cop(k.documentos), U.cop(k.total), U.n(k.km), k.kmGal ? U.n(k.kmGal, 1) : '—', k.costoKm ? U.cop(k.costoKm) : '—']]);

    var rend = C.rendimiento(v, d.tanqueos, p.toleranciaRendimiento);
    titulo('4. Rendimiento por tramos de tanque lleno (últimos 25)');
    t2(['Hasta (fecha)', 'Odómetro inicial', 'Odómetro final', 'Km', 'Galones', 'Km/gal', 'Costo/km', 'Estado'], rend.tramos.slice(-25).map(function (x) {
      return [U.fFecha(x.fecha), U.n(x.desde.odometro), U.n(x.hasta.odometro), U.n(x.km), U.n(x.galones, 2), U.n(x.kmGal, 1), U.cop(x.costoKm), x.estado];
    }));

    titulo('5. Tanqueos del año ' + anio);
    t2(['Fecha', 'Conductor', 'Galones', 'Precio/gal', 'Valor', 'Odómetro', 'Lleno', 'Estación'], C.vigentes(d.tanqueos).filter(function (x) { return x.placa === v.placa && U.anio(x.fecha) === anio; })
      .sort(function (a, b) { return U.toDate(a.fecha) - U.toDate(b.fecha); }).map(function (x) {
        return [U.fFechaHora(x.fecha), x.personaNombre || x.cedula, U.n(x.galones, 2), U.cop(x.precioGalon), U.cop(x.valorTotal), U.n(x.odometro), x.tanqueLleno === false ? 'No' : 'Sí', x.estacion || ''];
      }));

    titulo('6. Mantenimientos y arreglos (historial completo)');
    t2(['Fecha', 'Tipo', 'Descripción', 'Taller / técnico', 'Lugar', 'Km', 'Valor'], C.vigentes(d.mantenimientos).filter(function (x) { return x.placa === v.placa; })
      .sort(function (a, b) { return U.toDate(a.fecha) - U.toDate(b.fecha); }).map(function (x) {
        return [U.fFecha(x.fecha), x.tipo, x.descripcion, [x.taller, x.tecnico].filter(Boolean).join(' / '), x.lugar || '', x.odometro != null ? U.n(x.odometro) : '', U.cop(x.valorTotal)];
      }), { columnStyles: { 2: { cellWidth: 55 } } });

    titulo('7. Uso diario del año ' + anio);
    t2(['Recibe', 'Conductor', 'Km recibe', 'Entrega', 'Km entrega', 'Km', 'Motivo'], C.vigentes(d.recorridos).filter(function (x) { return x.placa === v.placa && U.anio(x.fechaRecibe) === anio; })
      .sort(function (a, b) { return U.toDate(a.fechaRecibe) - U.toDate(b.fechaRecibe); }).map(function (x) {
        return [U.fFechaHora(x.fechaRecibe), x.personaNombre || x.cedula, U.n(x.kmRecibe), x.fechaEntrega ? U.fFechaHora(x.fechaEntrega) : 'Abierto', x.kmEntrega != null ? U.n(x.kmEntrega) : '', x.kmRecorridos != null ? U.n(x.kmRecorridos) : '', x.motivo || ''];
      }));

    titulo('8. Historial de asignación');
    t2(['Desde', 'Hasta', 'Responsable', 'Cédula'], C.vigentes(d.asignaciones).filter(function (x) { return x.placa === v.placa; })
      .sort(function (a, b) { return U.toDate(a.desde) - U.toDate(b.desde); }).map(function (x) {
        return [U.fFechaHora(x.desde), x.hasta ? U.fFechaHora(x.hasta) : 'Vigente', x.nombre || '', x.cedula || ''];
      }));

    var n = doc.getNumberOfPages();
    for (var i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(90);
      doc.text('Generado el ' + U.fFechaHora(new Date()) + ' por ' + yo.nombre + ' (' + yo.rol + ') desde la aplicación Control de Flota y Combustible. Uso interno; contiene datos personales (Ley 1581 de 2012).', M, 271, { maxWidth: W - 2 * M - 22 });
      doc.text('Página ' + i + ' de ' + n, W - M, 271, { align: 'right' });
    }
    var blob = doc.output('blob');
    await terminar(blob, U.nombreArchivo('hoja de vida ' + v.placa + ' ' + anio) + '_' + U.sello() + '.pdf', 'Hoja de vida ' + v.placa + ' año ' + anio);
  };
})();
