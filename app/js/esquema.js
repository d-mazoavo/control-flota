/* Definición de los datos: cada campo define el formulario, las tablas y las exportaciones. */
(function () {
  'use strict';
  var FL = (window.FL = window.FL || {});

  var O = (FL.OPC = {
    tiposVehiculo: ['Automóvil', 'Camioneta', 'Campero', 'Camión', 'Furgón', 'Volqueta', 'Microbús', 'Bus', 'Motocicleta', 'Tractor', 'Montacargas', 'Otro'],
    servicio: ['Particular', 'Público', 'Oficial', 'Diplomático', 'Especial'],
    estadoVehiculo: ['Activo', 'En mantenimiento', 'Fuera de servicio', 'Dado de baja'],
    combustibles: ['Gasolina corriente', 'Gasolina extra', 'ACPM / Diésel', 'Gas natural vehicular', 'Eléctrico', 'Híbrido'],
    combustiblesTanqueo: ['Gasolina corriente', 'Gasolina extra', 'ACPM / Diésel', 'Gas natural vehicular', 'Mezcla 2T', 'Otro'],
    destinos: ['Vehículo', 'Otro uso'],
    equipos: ['Planta eléctrica', 'Guadaña', 'Motobomba', 'Fumigadora', 'Maquinaria agrícola', 'Montacargas', 'Bidón / reserva', 'Otro'],
    formasPago: ['Tarjeta empresarial', 'Crédito / convenio con la estación', 'Efectivo (caja menor)', 'Anticipo', 'Otro'],
    nivelTanque: ['Reserva', '1/4', '1/2', '3/4', 'Lleno'],
    tiposMantenimiento: ['Preventivo', 'Correctivo', 'Reparación / arreglo', 'Llantas', 'Latonería y pintura', 'Eléctrico', 'Alistamiento / revisión', 'Lavado', 'Otro'],
    tiposDocumento: ['SOAT', 'Revisión técnico-mecánica (RTM)', 'Póliza todo riesgo', 'Póliza de responsabilidad civil', 'Impuesto vehicular', 'Autorización de blindaje', 'Tarjeta de operación', 'Extintor (recarga)', 'Otro'],
    categoriasLicencia: ['A1', 'A2', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'],
    digitoPyP: ['Último dígito', 'Primer dígito'],
    roles: ['Administrador', 'Analista', 'Gobierno Corporativo', 'Conductor'],
    angulos: ['Frente', 'Costado izquierdo', 'Costado derecho', 'Posterior']
  });

  // t: text | textarea | number | money | date | datetime | select | multi | bool | persona | vehiculo | centro | razon
  FL.ESQ = {
    razones: {
      titulo: 'Razones sociales', uno: 'razón social', maestro: true,
      campos: [
        { k: 'nombre', l: 'Razón social', t: 'text', req: true, lista: true, ancho: 34 },
        { k: 'nit', l: 'NIT', t: 'text', lista: true },
        { k: 'activo', l: 'Activa', t: 'bool', def: true, lista: true },
        { k: 'observaciones', l: 'Observaciones', t: 'textarea' }
      ]
    },
    centros: {
      titulo: 'Centros de costo', uno: 'centro de costo', maestro: true,
      campos: [
        { k: 'codigo', l: 'Código', t: 'text', lista: true },
        { k: 'nombre', l: 'Centro de costo', t: 'text', req: true, lista: true, ancho: 30 },
        { k: 'razonId', l: 'Razón social', t: 'razon', req: true, lista: true, ancho: 30 },
        { k: 'descripcion', l: 'Descripción', t: 'textarea' },
        { k: 'activo', l: 'Activo', t: 'bool', def: true, lista: true }
      ]
    },
    personas: {
      titulo: 'Personas vinculadas', uno: 'persona', maestro: true, idCampo: 'cedula',
      campos: [
        { k: 'cedula', l: 'Cédula', t: 'text', req: true, lista: true, fijo: true, inputmode: 'numeric', grupo: 'Identificación' },
        { k: 'nombres', l: 'Nombres y apellidos', t: 'text', req: true, lista: true, ancho: 32 },
        { k: 'cargo', l: 'Cargo', t: 'text', lista: true, ancho: 24 },
        { k: 'razonId', l: 'Razón social', t: 'razon', req: true, lista: true, ancho: 26 },
        { k: 'centroId', l: 'Centro de costo habitual', lc: 'Centro de costo', t: 'centro', lista: true, ancho: 24 },
        { k: 'telefono', l: 'Celular (WhatsApp)', t: 'text', inputmode: 'tel', ayuda: '10 dígitos. A este número se envía el aviso de cada tanqueo.' },
        { k: 'correo', l: 'Correo electrónico', t: 'text', inputmode: 'email', ayuda: 'A este correo se envía el aviso de cada tanqueo.' },
        { k: 'conductor', l: 'Autorizado para conducir vehículos de la compañía', lc: 'Conduce', t: 'bool', def: false, lista: true, grupo: 'Conducción' },
        { k: 'licencias', l: 'Licencias de conducción', t: 'licencias', lista: true, ancho: 34, solo: function (r) { return r.conductor; }, ayuda: 'Agregue una línea por cada categoría (A1, A2, B1, C1…), cada una con su propia fecha de vencimiento.' },
        { k: 'activo', l: 'Activa en la operación', lc: 'Activa', t: 'bool', def: true, lista: true, grupo: 'Estado' },
        { k: 'observaciones', l: 'Observaciones', t: 'textarea' }
      ]
    },
    vehiculos: {
      titulo: 'Vehículos', uno: 'vehículo', maestro: true, idCampo: 'placa',
      campos: [
        { k: 'placa', l: 'Placa', t: 'text', req: true, lista: true, fijo: true, grupo: 'Identificación', ayuda: 'Sin espacios ni guiones. No se puede cambiar después.' },
        { k: 'tipo', l: 'Tipo de vehículo', t: 'select', opts: O.tiposVehiculo, req: true, lista: true },
        { k: 'clase', l: 'Clase / carrocería', t: 'text' },
        { k: 'marca', l: 'Marca', t: 'text', req: true, lista: true },
        { k: 'linea', l: 'Línea', t: 'text', lista: true },
        { k: 'modelo', l: 'Modelo (año)', t: 'number', min: 1950, max: 2100, step: 1, lista: true },
        { k: 'color', l: 'Color', t: 'text' },
        { k: 'cilindraje', l: 'Cilindraje (cc)', t: 'number', min: 0, step: 1 },
        { k: 'servicio', l: 'Servicio', t: 'select', opts: O.servicio },
        { k: 'capacidad', l: 'Capacidad (pasajeros o toneladas)', t: 'text' },
        { k: 'numeroMotor', l: 'Número de motor', t: 'text' },
        { k: 'numeroChasis', l: 'Número de chasis / VIN', t: 'text' },
        { k: 'numeroSerie', l: 'Número de serie', t: 'text' },
        { k: 'licenciaTransito', l: 'Licencia de tránsito (tarjeta de propiedad) N.º', t: 'text' },
        { k: 'organismoTransito', l: 'Organismo de tránsito', t: 'text' },
        { k: 'fechaMatricula', l: 'Fecha de matrícula', t: 'date' },
        { k: 'razonId', l: 'Propietario (razón social)', t: 'razon', req: true, lista: true, ancho: 26, grupo: 'Propiedad y asignación' },
        { k: 'centroId', l: 'Centro de costo', t: 'centro', req: true, lista: true, ancho: 24 },
        { k: 'responsableCedula', l: 'Responsable asignado (cédula)', t: 'persona', lista: true, ancho: 28, ayuda: 'Cada cambio de responsable queda en el historial de asignaciones.' },
        { k: 'estado', l: 'Estado', t: 'select', opts: O.estadoVehiculo, req: true, def: 'Activo', lista: true },
        { k: 'fechaIngreso', l: 'Fecha de ingreso a la flota', t: 'date' },
        { k: 'valorComercial', l: 'Valor comercial / avalúo', t: 'money' },
        { k: 'combustible', l: 'Combustible', t: 'select', opts: O.combustibles, req: true, lista: true, grupo: 'Combustible y rendimiento' },
        { k: 'capacidadTanque', l: 'Capacidad del tanque (galones)', t: 'number', min: 0, step: 'any' },
        { k: 'rendimientoRef', l: 'Rendimiento de referencia (km por galón)', t: 'number', min: 0, step: 'any', ayuda: 'Ficha técnica o promedio esperado. Si se deja vacío, se compara con el promedio propio del vehículo.' },
        { k: 'odometroInicial', l: 'Kilometraje al ingresar a la aplicación', t: 'number', min: 0, step: 1 },
        { k: 'blindado', l: 'Vehículo blindado', t: 'bool', def: false, lista: true, grupo: 'Seguridad' },
        { k: 'nivelBlindaje', l: 'Nivel de blindaje', t: 'text', solo: function (r) { return r.blindado; } },
        { k: 'empresaBlindadora', l: 'Empresa blindadora', t: 'text', solo: function (r) { return r.blindado; } },
        { k: 'gps', l: 'Rastreo satelital (GPS)', t: 'bool', def: false },
        { k: 'proveedorGps', l: 'Proveedor del rastreo', t: 'text', solo: function (r) { return r.gps; } },
        { k: 'alarma', l: 'Alarma / inmovilizador', t: 'bool', def: false },
        { k: 'otrosDispositivos', l: 'Otros dispositivos de seguridad', t: 'text' },
        { k: 'aplicaPicoPlaca', l: 'Sujeto a pico y placa', t: 'bool', def: true, grupo: 'Restricciones y mantenimiento', ayuda: 'Desmarque si el vehículo está exento (por ejemplo, con permiso especial).' },
        { k: 'categoriasLicencia', l: 'Categorías de licencia que habilitan para conducirlo', t: 'multi', opts: O.categoriasLicencia, ayuda: 'Al registrar el uso diario se verifica que el conductor tenga vigente al menos una de estas categorías. Si no marca ninguna, basta cualquier licencia vigente.' },
        { k: 'intervaloKm', l: 'Mantenimiento preventivo cada (km)', t: 'number', min: 0, step: 1 },
        { k: 'intervaloMeses', l: 'Mantenimiento preventivo cada (meses)', t: 'number', min: 0, step: 1 },
        { k: 'docsExigidos', l: 'Documentos que se deben mantener vigentes', t: 'multi', opts: O.tiposDocumento, def: ['SOAT', 'Revisión técnico-mecánica (RTM)'], ayuda: 'La aplicación alerta si falta alguno o está por vencer.' },
        { k: 'observaciones', l: 'Observaciones', t: 'textarea' }
      ]
    },
    tanqueos: {
      titulo: 'Tanqueos', uno: 'tanqueo', registro: true,
      campos: [
        { k: 'fecha', l: 'Fecha y hora del tanqueo', t: 'datetime', req: true, lista: true, def: 'ahora', grupo: 'Tanqueo' },
        { k: 'destino', l: 'Destino del combustible', t: 'select', opts: O.destinos, req: true, def: 'Vehículo', lista: true },
        { k: 'placa', l: 'Vehículo', t: 'vehiculo', lista: true, req: function (r) { return r.destino === 'Vehículo'; }, solo: function (r) { return r.destino === 'Vehículo'; } },
        { k: 'equipo', l: 'Equipo o uso', t: 'select', opts: O.equipos, lista: true, req: function (r) { return r.destino === 'Otro uso'; }, solo: function (r) { return r.destino === 'Otro uso'; } },
        { k: 'justificacion', l: 'Justificación del uso', t: 'textarea', req: function (r) { return r.destino === 'Otro uso'; }, solo: function (r) { return r.destino === 'Otro uso'; }, ayuda: 'Para qué se lleva el combustible, dónde se usará y quién lo autorizó.' },
        { k: 'cedula', l: 'Cédula de quien tanquea / recibe', t: 'persona', req: true, lista: true, ancho: 28 },
        { k: 'centroId', l: 'Centro de costo', t: 'centro', req: true, lista: true, ancho: 22 },
        { k: 'combustible', l: 'Combustible', t: 'select', opts: O.combustiblesTanqueo, req: true, lista: true, grupo: 'Cantidad y valor' },
        { k: 'galones', l: 'Galones', t: 'number', req: true, min: 0.01, step: 'any', lista: true },
        { k: 'precioGalon', l: 'Precio por galón', t: 'money', req: true, lista: true },
        { k: 'valorTotal', l: 'Valor total', t: 'money', calc: true, lista: true },
        { k: 'odometro', l: 'Kilometraje (odómetro) al tanquear', t: 'number', min: 0, step: 1, lista: true, req: function (r) { return r.destino === 'Vehículo'; }, solo: function (r) { return r.destino === 'Vehículo'; } },
        { k: 'tanqueLleno', l: 'Se llenó el tanque', t: 'bool', def: true, solo: function (r) { return r.destino === 'Vehículo'; }, ayuda: 'El rendimiento (km por galón) se calcula entre dos tanqueos a tanque lleno.' },
        { k: 'estacion', l: 'Estación de servicio', t: 'text', lista: true, grupo: 'Soporte' },
        { k: 'municipio', l: 'Municipio', t: 'text' },
        { k: 'factura', l: 'N.º de factura o tirilla', t: 'text', lista: true },
        { k: 'formaPago', l: 'Forma de pago', t: 'select', opts: O.formasPago },
        { k: 'observaciones', l: 'Observaciones', t: 'textarea' }
      ]
    },
    recorridos: {
      titulo: 'Uso diario', uno: 'uso diario', registro: true,
      campos: [
        { k: 'placa', l: 'Vehículo', t: 'vehiculo', req: true, lista: true, grupo: 'Recibe' },
        { k: 'cedula', l: 'Cédula del conductor', t: 'persona', req: true, lista: true, ancho: 28 },
        { k: 'fechaRecibe', l: 'Fecha y hora en que recibe', t: 'datetime', req: true, def: 'ahora', lista: true },
        { k: 'kmRecibe', l: 'Kilometraje al recibir', t: 'number', req: true, min: 0, step: 1, lista: true },
        { k: 'combustibleRecibe', l: 'Nivel de combustible al recibir', t: 'select', opts: O.nivelTanque },
        { k: 'motivo', l: 'Destino / motivo del uso', t: 'text', req: true, lista: true, ancho: 30 },
        { k: 'centroId', l: 'Centro de costo', t: 'centro', req: true, lista: true },
        { k: 'novedadesRecibe', l: 'Novedades al recibir (estado, golpes, faltantes)', t: 'textarea' },
        { k: 'estado', l: 'Estado', t: 'text', lista: true, oculto: true },
        { k: 'fechaEntrega', l: 'Fecha y hora en que entrega', t: 'datetime', lista: true, grupo: 'Entrega', entrega: true },
        { k: 'kmEntrega', l: 'Kilometraje al entregar', t: 'number', min: 0, step: 1, lista: true, entrega: true },
        { k: 'kmRecorridos', l: 'Kilómetros recorridos', t: 'number', calc: true, lista: true },
        { k: 'combustibleEntrega', l: 'Nivel de combustible al entregar', t: 'select', opts: O.nivelTanque, entrega: true },
        { k: 'entregadoA', l: 'Entregado a', t: 'text', entrega: true },
        { k: 'novedadesEntrega', l: 'Novedades al entregar', t: 'textarea', entrega: true }
      ]
    },
    mantenimientos: {
      titulo: 'Mantenimientos y arreglos', uno: 'mantenimiento', registro: true,
      campos: [
        { k: 'fecha', l: 'Fecha', t: 'date', req: true, def: 'hoy', lista: true, grupo: 'Trabajo realizado' },
        { k: 'placa', l: 'Vehículo', t: 'vehiculo', req: true, lista: true },
        { k: 'tipo', l: 'Tipo', t: 'select', opts: O.tiposMantenimiento, req: true, lista: true },
        { k: 'descripcion', l: 'Descripción del trabajo', t: 'textarea', req: true, lista: true, ancho: 40 },
        { k: 'odometro', l: 'Kilometraje al momento del trabajo', t: 'number', min: 0, step: 1, lista: true },
        { k: 'taller', l: 'Taller o proveedor', t: 'text', req: true, lista: true, ancho: 26, grupo: 'Quién y dónde' },
        { k: 'nitTaller', l: 'NIT del taller', t: 'text' },
        { k: 'tecnico', l: 'Quién hizo el trabajo (técnico)', t: 'text', lista: true },
        { k: 'lugar', l: 'Lugar (municipio / dirección)', t: 'text', lista: true },
        { k: 'cedula', l: 'Quién llevó el vehículo (cédula)', t: 'persona' },
        { k: 'manoObra', l: 'Mano de obra', t: 'money', grupo: 'Costo' },
        { k: 'repuestos', l: 'Repuestos', t: 'money' },
        { k: 'valorTotal', l: 'Valor total', t: 'money', req: true, lista: true, ayuda: 'Se suma solo si diligencia mano de obra y repuestos; puede corregirlo según la factura.' },
        { k: 'factura', l: 'N.º de factura', t: 'text', lista: true },
        { k: 'centroId', l: 'Centro de costo', t: 'centro' },
        { k: 'garantia', l: 'Garantía', t: 'text' },
        { k: 'proximoKm', l: 'Próximo mantenimiento (km)', t: 'number', min: 0, step: 1, grupo: 'Próximo mantenimiento' },
        { k: 'proximaFecha', l: 'Próximo mantenimiento (fecha)', t: 'date' },
        { k: 'observaciones', l: 'Observaciones', t: 'textarea' }
      ]
    },
    documentos: {
      titulo: 'Documentos y vigencias', uno: 'documento', registro: true,
      campos: [
        { k: 'placa', l: 'Vehículo', t: 'vehiculo', req: true, lista: true },
        { k: 'tipo', l: 'Documento', t: 'select', opts: O.tiposDocumento, req: true, lista: true, ancho: 30 },
        { k: 'otroTipo', l: 'Cuál', t: 'text', req: function (r) { return r.tipo === 'Otro'; }, solo: function (r) { return r.tipo === 'Otro'; } },
        { k: 'numero', l: 'Número (póliza, certificado, resolución)', t: 'text', lista: true },
        { k: 'entidad', l: 'Entidad (aseguradora, CDA, organismo)', t: 'text', lista: true, ancho: 24 },
        { k: 'fechaExpedicion', l: 'Fecha de expedición', t: 'date' },
        { k: 'fechaInicio', l: 'Inicio de vigencia', t: 'date' },
        { k: 'fechaVencimiento', l: 'Vencimiento', t: 'date', req: true, lista: true },
        { k: 'valor', l: 'Valor pagado', t: 'money', lista: true },
        { k: 'observaciones', l: 'Observaciones', t: 'textarea' }
      ]
    },
    picoyplaca: {
      titulo: 'Pico y placa', uno: 'regla de pico y placa', maestro: true,
      campos: [
        { k: 'ciudad', l: 'Municipio', t: 'text', req: true, lista: true },
        { k: 'tipos', l: 'Tipos de vehículo a los que aplica (vacío = todos)', t: 'multi', opts: O.tiposVehiculo },
        { k: 'digito', l: 'Dígito que se compara', t: 'select', opts: O.digitoPyP, def: 'Último dígito', req: true },
        { k: 'd1', l: 'Lunes (dígitos)', t: 'text', lista: true, ayuda: 'Ejemplo: 1,7' },
        { k: 'd2', l: 'Martes (dígitos)', t: 'text', lista: true },
        { k: 'd3', l: 'Miércoles (dígitos)', t: 'text', lista: true },
        { k: 'd4', l: 'Jueves (dígitos)', t: 'text', lista: true },
        { k: 'd5', l: 'Viernes (dígitos)', t: 'text', lista: true },
        { k: 'd6', l: 'Sábado (dígitos)', t: 'text' },
        { k: 'horario', l: 'Horario', t: 'text', lista: true, ayuda: 'Ejemplo: 5:00 a. m. a 8:00 p. m.' },
        { k: 'vigenciaDesde', l: 'Vigente desde', t: 'date', req: true, lista: true },
        { k: 'vigenciaHasta', l: 'Vigente hasta', t: 'date', lista: true },
        { k: 'excluidas', l: 'Días sin restricción (festivos), uno por línea en formato AAAA-MM-DD', t: 'textarea' },
        { k: 'fuente', l: 'Acto administrativo o fuente oficial', t: 'text', ayuda: 'Decreto municipal que fija la medida. Verifíquelo cada semestre.' },
        { k: 'activo', l: 'Activa', t: 'bool', def: true, lista: true }
      ]
    }
  };

  FL.ESQ.tanqueos.campos.forEach(function (c) { if (c.k === 'valorTotal') c.ayuda = 'Galones × precio por galón.'; });

  // Campo por clave
  FL.campo = function (col, k) {
    var e = FL.ESQ[col]; if (!e) return null;
    for (var i = 0; i < e.campos.length; i++) if (e.campos[i].k === k) return e.campos[i];
    return null;
  };
  FL.COLECCIONES = ['razones', 'centros', 'personas', 'vehiculos', 'asignaciones', 'picoyplaca', 'tanqueos', 'recorridos', 'mantenimientos', 'documentos'];
})();
