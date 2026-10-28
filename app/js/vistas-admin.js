/* Configuración: personas, razones sociales y centros de costo, pico y placa, usuarios, parámetros, bitácora y manual. */
(function () {
  'use strict';
  var FL = (window.FL = window.FL || {});
  var U = FL.U, h = U.h, UI = FL.UI, V = FL.Vistas, App = FL.App, C = FL.Calc;
  var TODOS = ['Administrador', 'Analista', 'Gobierno Corporativo'];

  function botonEditar(col, r) { return V.esAdmin() ? h('button', { class: 'btn xs', type: 'button', onclick: function () { V.editarMaestro(col, r); } }, 'Editar') : null; }
  function botonNuevoMaestro(col, texto) { return V.esAdmin() ? h('button', { class: 'btn primario', type: 'button', onclick: function () { V.editarMaestro(col, null); } }, texto) : null; }
  var filtroActivo = { l: 'Estado', opts: [['1', 'Activos'], ['0', 'Inactivos']], def: '1', fn: function (r, v) { return (r.activo !== false) === (v === '1'); } };

  // =================== PERSONAS ===================
  App.ruta('/personas', function (cont) {
    cont.appendChild(V.titulo('Personas vinculadas a la operación', 'Al registrar un tanqueo o un uso diario basta digitar la cédula: el resto se completa con estos datos.', [botonNuevoMaestro('personas', '+ Nueva persona')]));
    cont.appendChild(h('p', { class: 'aviso' }, 'Datos personales tratados conforme a la Ley 1581 de 2012 y a la política de tratamiento de la compañía, solo para el control de flota y combustible. Registre únicamente lo necesario.'));
    var cols = V.columnas('personas');
    var ilic = cols.findIndex(function (c) { return c.l === 'Licencias de conducción'; });
    if (ilic >= 0) cols[ilic].f = function (r) {
      if (!r.conductor) return '—';
      var l = FL.Calc.licencias(r);
      if (!l.length) return UI.chip('Sin licencias', 'alerta');
      return h('span', { class: 'fila gap wrap' }, l.map(function (x) { var dd = x.vence ? U.diasHasta(x.vence) : null; return UI.chip(x.categoria + ' · ' + (x.vence ? U.fFecha(x.vence) : 'sin fecha'), dd == null || dd < 0 ? 'mal' : dd <= (App.param().diasAlerta || 30) ? 'alerta' : 'bien'); }));
    };
    cols.push({ l: 'Estado de licencias', v: function (r) { return r.conductor ? FL.Calc.estadoLicencias(r, App.param().diasAlerta).estado : ''; }, f: function (r) { return r.conductor ? UI.chipEstado(FL.Calc.estadoLicencias(r, App.param().diasAlerta).estado) : '—'; } });
    cont.appendChild(h('section', { class: 'tarjeta' }, UI.tabla({
      nombre: 'Personas', columnas: cols, filas: function () { return FL.Datos.lista('personas'); }, ordenInicial: 1, ordenDesc: false,
      filtros: [filtroActivo, { l: 'Conductores', opts: [['1', 'Solo autorizados para conducir']], fn: function (r) { return !!r.conductor; } },
        { l: 'Razón social', opts: FL.Datos.lista('razones').map(function (x) { return [x.id, x.nombre]; }), fn: function (r, v) { return r.razonId === v; } }],
      acciones: function (r) { return botonEditar('personas', r); }
    })));
  }, TODOS);

  // =================== RAZONES SOCIALES Y CENTROS DE COSTO ===================
  App.ruta('/centros', function (cont) {
    cont.appendChild(V.titulo('Razones sociales y centros de costo', 'Cada centro de costo pertenece a una razón social. Todo tanqueo, uso diario y mantenimiento se imputa a un centro de costo.'));
    cont.appendChild(UI.seccion('Razones sociales', UI.tabla({ nombre: 'Razones sociales', columnas: V.columnas('razones'), filas: function () { return FL.Datos.lista('razones'); }, filtros: [filtroActivo], acciones: function (r) { return botonEditar('razones', r); }, vacio: 'Cree primero las razones sociales (por ejemplo, Avo Pak S.A.S.).' }), [botonNuevoMaestro('razones', '+ Nueva razón social')]));
    cont.appendChild(UI.seccion('Centros de costo', UI.tabla({ nombre: 'Centros de costo', columnas: V.columnas('centros'), filas: function () { return FL.Datos.lista('centros'); }, filtros: [filtroActivo], acciones: function (r) { return botonEditar('centros', r); }, vacio: 'Sin centros de costo.' }), [botonNuevoMaestro('centros', '+ Nuevo centro de costo')]));
  }, TODOS);

  // =================== PICO Y PLACA ===================
  App.ruta('/picoyplaca', function (cont) {
    var d = App.datos();
    var fecha = h('input', { type: 'date', class: 'campo-input', value: U.ymd(new Date()) });
    var res = h('div');
    function consultar() {
      U.clear(res);
      var f = U.toDate(fecha.value) || new Date();
      var filas = [];
      C.vigentes(d.vehiculos).forEach(function (v) { C.picoYPlaca(v, f, d.picoyplaca).forEach(function (x) { filas.push({ placa: v.placa, ciudad: x.ciudad, horario: x.horario, resp: UI.nombrePersona(v.responsableCedula) }); }); });
      res.appendChild(h('p', { class: 'muted' }, U.DIAS[f.getDay()] + ' ' + U.fFecha(f) + ': ' + (filas.length ? filas.length + ' restricción(es).' : 'ningún vehículo con restricción según las reglas registradas.')));
      if (filas.length) res.appendChild(UI.tabla({ columnas: [{ l: 'Placa', v: function (x) { return x.placa; } }, { l: 'Municipio', v: function (x) { return x.ciudad; } }, { l: 'Horario', v: function (x) { return x.horario; } }, { l: 'Responsable', v: function (x) { return x.resp; } }], filas: filas }));
    }
    fecha.addEventListener('change', consultar);
    cont.appendChild(V.titulo('Pico y placa', 'Las reglas cambian por decreto municipal, normalmente cada semestre. Regístrelas con su fuente y vigencia; la aplicación avisa a diario qué vehículos tienen restricción.', [botonNuevoMaestro('picoyplaca', '+ Nueva regla')]));
    cont.appendChild(UI.seccion('Consultar un día', h('div', { class: 'pila' }, h('label', { class: 'campo corto' }, h('span', { class: 'campo-l' }, 'Fecha'), fecha), res)));
    var cols = V.columnas('picoyplaca');
    cols.splice(1, 0, { l: 'Dígito', v: function (r) { return r.digito; } }, { l: 'Aplica a', v: function (r) { return r.tipos && r.tipos.length ? r.tipos.join(', ') : 'Todos'; } });
    cols.push({ l: 'Fuente', v: function (r) { return r.fuente; } });
    cont.appendChild(UI.seccion('Reglas registradas', UI.tabla({ nombre: 'Pico y placa', columnas: cols, filas: function () { return FL.Datos.lista('picoyplaca'); }, filtros: [filtroActivo], acciones: function (r) { return botonEditar('picoyplaca', r); }, vacio: 'Sin reglas. Registre las de los municipios por donde circulan los vehículos.' })));
    consultar();
  }, TODOS);

  // =================== USUARIOS ===================
  App.ruta('/usuarios', function (cont) {
    var zona = h('div', null, h('p', { class: 'muted' }, 'Cargando usuarios…'));
    cont.appendChild(V.titulo('Usuarios', 'Cada persona ingresa con su propio usuario y contraseña. Nadie usa correo.', [h('button', { class: 'btn primario', type: 'button', onclick: function () { formUsuario(null); } }, '+ Nuevo usuario')]));
    cont.appendChild(h('div', { class: 'tarjeta pila sm' },
      h('p', null, h('strong', null, 'Administrador: '), 'crea, modifica y anula todo; administra usuarios y parámetros.'),
      h('p', null, h('strong', null, 'Analista: '), 'ingresa tanqueos, uso diario, mantenimientos, documentos y fotografías. Consulta todo. No modifica ni anula.'),
      h('p', null, h('strong', null, 'Gobierno Corporativo: '), 'consulta, filtra y descarga todo, incluida la bitácora. No ingresa, no modifica, no borra.')));
    cont.appendChild(zona);
    async function cargar() {
      try {
        var lista = await FL.Datos.usuarios();
        U.clear(zona).appendChild(h('section', { class: 'tarjeta' }, UI.tabla({
          nombre: 'Usuarios',
          columnas: [{ l: 'Usuario', v: function (u) { return u.usuario; } }, { l: 'Nombre', v: function (u) { return u.nombre; } }, { l: 'Cédula', v: function (u) { return u.cedula; } }, { l: 'Cargo', v: function (u) { return u.cargo; } },
            { l: 'Rol', v: function (u) { return u.rol; } }, { l: 'Contraseña', v: function (u) { return u.claveTemporal ? 'Temporal' : 'Personal'; }, f: function (u) { return u.claveTemporal ? UI.chip('Temporal (pendiente de cambio)', 'alerta') : UI.chip('Personal', 'bien'); } },
            { l: 'Estado', v: function (u) { return u.activo ? 'Activo' : 'De baja'; }, f: function (u) { return UI.chipEstado(u.activo ? 'Activo' : 'Dado de baja'); } }, { l: 'Creado', v: function (u) { return u._creado; }, tipo: 'fechahora' }],
          filas: lista, ordenInicial: 1, ordenDesc: false,
          acciones: function (u) {
            var yo = FL.Datos.yo(), b = [];
            b.push(h('button', { class: 'btn xs', type: 'button', onclick: function () { formUsuario(u); } }, 'Editar'));
            if (u.usuario !== yo.usuario) {
              b.push(h('button', { class: 'btn xs', type: 'button', onclick: function () { restablecer(u); } }, 'Restablecer contraseña'));
              b.push(h('button', { class: 'btn xs ' + (u.activo ? 'peligro-t' : ''), type: 'button', onclick: async function () {
                if (!(await UI.confirmar(u.activo ? 'Dar de baja' : 'Reactivar', (u.activo ? 'El usuario ' : 'El usuario ') + u.usuario + (u.activo ? ' no podrá ingresar desde este momento.' : ' podrá ingresar de nuevo con su contraseña actual.'), u.activo ? 'Dar de baja' : 'Reactivar', u.activo))) return;
                try { await FL.Datos.bajaUsuario(u.usuario, !u.activo); UI.toast('Listo.', 'ok'); cargar(); } catch (e) { UI.toast(e.message, 'error'); }
              } }, u.activo ? 'Dar de baja' : 'Reactivar'));
            }
            return h('div', { class: 'fila gap wrap' }, b);
          }
        })));
      } catch (e) { U.clear(zona).appendChild(h('p', { class: 'txt-error' }, e.message)); }
    }
    function claveTemporal() {
      var a = 'abcdefghijkmnpqrstuvwxyz', n = '23456789', s = '';
      var r = new Uint32Array(10); crypto.getRandomValues(r);
      for (var i = 0; i < 10; i++) s += i % 3 === 2 ? n[r[i] % n.length] : a[r[i] % a.length];
      return s.slice(0, 5) + '-' + s.slice(5);
    }
    function mostrarClave(u, clave) {
      UI.modal({ titulo: 'Contraseña temporal', fijo: true, cuerpo: h('div', { class: 'pila' },
        h('p', null, 'Entregue estos datos personalmente a ', h('strong', null, u), '. La contraseña se muestra una sola vez, vence en ' + (FL.CFG.horasClaveTemporal || 72) + ' horas y la aplicación obligará a cambiarla en el primer ingreso.'),
        h('div', { class: 'credencial' }, h('div', null, 'Usuario: ', h('strong', null, u)), h('div', null, 'Contraseña temporal: ', h('strong', { class: 'mono' }, clave))),
        h('p', { class: 'muted small' }, 'Dirección de la aplicación: ' + location.href.split('#')[0])), acciones: [{ l: 'Ya la entregué', tipo: 'primario' }] });
    }
    function formUsuario(u) {
      var c = {
        usuario: h('input', { class: 'campo-input', value: u ? u.usuario : '', disabled: !!u, autocapitalize: 'none' }),
        nombre: h('input', { class: 'campo-input', value: u ? u.nombre : '' }),
        cedula: h('input', { class: 'campo-input', value: u ? u.cedula || '' : '', inputmode: 'numeric' }),
        cargo: h('input', { class: 'campo-input', value: u ? u.cargo || '' : '' }),
        rol: h('select', { class: 'campo-input' }, FL.OPC.roles.map(function (r) { return h('option', null, r); }))
      };
      c.rol.value = u ? u.rol : 'Analista';
      if (u && u.usuario === FL.Datos.yo().usuario) c.rol.disabled = true;
      var err = h('p', { class: 'txt-error' });
      function f(l, k, a) { return h('label', { class: 'campo' }, h('span', { class: 'campo-l' }, l), c[k], a ? h('span', { class: 'campo-ayuda' }, a) : null); }
      UI.modal({ titulo: u ? 'Editar usuario' : 'Nuevo usuario', cuerpo: h('div', { class: 'pila' }, f('Usuario', 'usuario', 'Sin espacios ni tildes. Ejemplo: analista.flota'), f('Nombre completo', 'nombre'), f('Cédula', 'cedula'), f('Cargo', 'cargo'), f('Rol', 'rol'), err),
        acciones: [{ l: 'Cancelar' }, { l: 'Guardar', tipo: 'primario', fn: async function () {
          var datos = { usuario: c.usuario.value, nombre: c.nombre.value.trim(), cedula: c.cedula.value, cargo: c.cargo.value.trim(), rol: c.rol.value };
          if (!datos.nombre) { err.textContent = 'Escriba el nombre.'; return false; }
          if (u) { await FL.Datos.editarUsuario(u.usuario, datos); UI.toast('Usuario actualizado.', 'ok'); cargar(); return; }
          var clave = claveTemporal();
          try { await FL.Datos.crearUsuario(datos, clave); } catch (e) { err.textContent = e.message; return false; }
          cargar(); mostrarClave(U.normUsuario(datos.usuario), clave);
        } }] });
    }
    async function restablecer(u) {
      if (!(await UI.confirmar('Restablecer contraseña', 'Se genera una contraseña temporal para ' + u.usuario + '. La contraseña anterior deja de servir de inmediato y su sesión abierta se cierra.', 'Restablecer'))) return;
      var clave = claveTemporal();
      try { await FL.Datos.restablecerUsuario(u.usuario, clave); cargar(); mostrarClave(u.usuario, clave); } catch (e) { UI.toast(e.message, 'error'); }
    }
    cargar();
  }, ['Administrador']);

  // =================== PARÁMETROS ===================
  var PARAM = [
    ['diasAlerta', 'Días de anticipación para alertar vencimientos (documentos, licencias, mantenimiento)', 30],
    ['diasCritico', 'Días antes del vencimiento en que la alerta pasa a «alta»', 7],
    ['toleranciaRendimiento', 'Tolerancia del rendimiento (%): por debajo de la referencia menos este porcentaje se alerta «rendimiento bajo»', 20],
    ['kmAlertaMantenimiento', 'Kilómetros de anticipación para alertar el próximo mantenimiento', 500],
    ['horasRecorridoAbierto', 'Horas tras las cuales un uso diario sin entrega genera alerta', 24],
    ['kmBrecha', 'Diferencia de kilómetros entre una entrega y el siguiente recibo que se considera «sin registrar»', 5],
    ['kmMaxDia', 'Kilómetros en un solo uso diario a partir de los cuales se pide confirmación', 800]
  ];
  App.ruta('/parametros', function (cont) {
    var p = App.param(), inputs = {};
    cont.appendChild(V.titulo('Parámetros de alertas'));
    var form = h('div', { class: 'pila' });
    PARAM.forEach(function (x) {
      inputs[x[0]] = h('input', { type: 'number', class: 'campo-input corto', min: 0, step: 1, value: p[x[0]] != null ? p[x[0]] : x[2] });
      form.appendChild(h('label', { class: 'campo' }, h('span', { class: 'campo-l' }, x[1]), inputs[x[0]]));
    });
    var btn = h('button', { class: 'btn primario', type: 'button', onclick: async function () {
      var o = {}; PARAM.forEach(function (x) { var v = Number(inputs[x[0]].value); o[x[0]] = isFinite(v) && v >= 0 ? v : x[2]; });
      btn.disabled = true;
      try { await FL.Datos.guardarParametros(o); await App.recargarParametros(); UI.toast('Parámetros guardados.', 'ok'); } catch (e) { UI.toast(e.message, 'error'); } finally { btn.disabled = false; }
    } }, 'Guardar parámetros');
    cont.appendChild(h('section', { class: 'tarjeta' }, form, h('div', { class: 'form-acciones' }, btn)));
  }, ['Administrador']);

  // =================== BITÁCORA ===================
  App.ruta('/auditoria', function (cont) {
    var zona = h('div', null, h('p', { class: 'muted' }, 'Consultando la bitácora en el servidor…'));
    cont.appendChild(V.titulo('Bitácora de auditoría', 'Registro inalterable de toda creación, modificación, anulación, cambio de usuarios y descarga. Ni el Administrador puede editarlo ni borrarlo.'));
    cont.appendChild(zona);
    FL.Datos.auditoria(3000).then(function (l) {
      var acciones = {}, usuarios = {};
      l.forEach(function (a) { acciones[a.accion] = 1; usuarios[a.usuario] = 1; });
      U.clear(zona).appendChild(h('section', { class: 'tarjeta' }, UI.tabla({
        nombre: 'Bitacora de auditoria',
        columnas: [{ l: 'Fecha y hora (servidor)', v: function (a) { return a._creado; }, tipo: 'fechahora' }, { l: 'Usuario', v: function (a) { return a.usuario; } }, { l: 'Nombre', v: function (a) { return a.nombre; } }, { l: 'Rol', v: function (a) { return a.rol; } },
          { l: 'Acción', v: function (a) { return a.accion; } }, { l: 'Colección', v: function (a) { return a.coleccion; } }, { l: 'Registro', v: function (a) { return a.docId; } }, { l: 'Resumen', v: function (a) { return a.resumen; }, ancho: 50 },
          { l: 'Cambios (antes → después) o huella', v: function (a) { return a.cambios; }, f: function (a) { return a.cambios ? h('details', null, h('summary', null, 'Ver'), h('code', { class: 'huella' }, a.cambios)) : '—'; }, ancho: 60 }],
        filas: l, ordenInicial: 0,
        filtros: [{ l: 'Acción', opts: Object.keys(acciones).sort().map(function (x) { return [x, x]; }), fn: function (r, v) { return r.accion === v; } }, { l: 'Usuario', opts: Object.keys(usuarios).sort().map(function (x) { return [x, x]; }), fn: function (r, v) { return r.usuario === v; } }]
      })));
      if (l.length >= 3000) zona.appendChild(h('p', { class: 'muted small' }, 'Se muestran los 3.000 asientos más recientes.'));
    }).catch(function (e) { U.clear(zona).appendChild(h('p', { class: 'txt-error' }, e.message)); });
  }, ['Administrador', 'Gobierno Corporativo']);

  // =================== MANUAL ===================
  App.ruta('/ayuda', function (cont) {
    function sec(t, parrafos) { return UI.seccion(t, h('div', { class: 'pila sm texto' }, parrafos.map(function (p) { return h('p', null, p); }))); }
    cont.appendChild(V.titulo('Manual de uso', 'Control de Flota y Combustible · Dirección de Seguridad Integral'));
    cont.appendChild(sec('1. Puesta en marcha (Administrador)', [
      'Cree, en este orden: las razones sociales (Configuración › Razones sociales y centros de costo), los centros de costo de cada razón social, las personas vinculadas a la operación (con su cédula, cargo, razón social y centro de costo habitual; marque «Autorizado para conducir» y registre cada categoría de licencia con su propio vencimiento), los vehículos con todos sus datos y sus fotografías de los cuatro ángulos (frente, costado izquierdo, costado derecho y posterior), que quedan en la hoja de vida y en su PDF, y, por último, los usuarios.',
      'Al crear un usuario, la aplicación genera una contraseña temporal que se muestra una sola vez. Entréguela personalmente; la persona deberá cambiarla en su primer ingreso.'
    ]));
    cont.appendChild(sec('2. Tanqueos', [
      'Todo combustible que se tanquee o se retire debe quedar registrado. En «Registrar › Tanqueo» digite la cédula de quien tanquea: el nombre, el cargo, la razón social y el centro de costo se completan solos. Si el combustible va a un vehículo, elija la placa y escriba el kilometraje del odómetro. Si va a otro uso (planta eléctrica, guadaña, bidón, maquinaria), elija «Otro uso», indique el equipo y justifique para qué se lleva, dónde se usará y quién lo autorizó; el centro de costo es obligatorio.',
      'El rendimiento (kilómetros por galón) se calcula entre dos tanqueos a tanque lleno: kilómetros recorridos entre ambos divididos por los galones cargados después del primero. Por eso es importante marcar si se llenó el tanque y escribir el kilometraje exacto. Si un tramo cae por debajo de la referencia menos la tolerancia, la aplicación lo marca como «Bajo» y genera alerta: puede indicar desvío de combustible, fuga, falla mecánica o error de registro.',
      'Después de guardar, puede adjuntar la foto de la factura o tirilla y del odómetro.'
    ]));
    cont.appendChild(sec('3. Uso diario', [
      'Cuando una persona recibe un vehículo, registre el recibo con su cédula y el kilometraje. Cuando lo devuelva, registre la entrega con el kilometraje final (botón «Entregar» en la lista de vehículos pendientes). Si se diligencia al final del día, marque «Registrar el uso completo de una vez».',
      'La aplicación advierte si el conductor no está autorizado o no tiene vigente ninguna de las categorías de licencia que exige el vehículo, si el vehículo tiene pico y placa, si ya había un uso abierto y si hay kilómetros sin registrar entre la entrega anterior y el nuevo recibo. Si se confirma el registro pese a la advertencia, queda una nota visible en los reportes.'
    ]));
    cont.appendChild(sec('4. Mantenimientos y documentos', [
      'Registre cada mantenimiento o arreglo con el taller, el técnico, el lugar, el kilometraje y el valor, y si aplica, el próximo mantenimiento (por kilómetros o por fecha). También puede definir en los datos del vehículo un intervalo de mantenimiento preventivo.',
      'Registre cada SOAT, revisión técnico-mecánica, póliza, impuesto o autorización de blindaje con su vencimiento. En cada renovación se ingresa un registro nuevo: la aplicación toma el de vencimiento más reciente y alerta con la anticipación definida en Parámetros.'
    ]));
    cont.appendChild(sec('5. Correcciones', [
      'El Analista no puede modificar ni anular. Si se ingresó un dato errado, debe informarlo al Administrador, quien lo corrige («Editar») o lo anula con un motivo. Nada se borra: el registro anulado deja de sumar, pero permanece con su motivo, autor y fecha, y la bitácora conserva el valor anterior y el nuevo de toda modificación.'
    ]));
    cont.appendChild(sec('6. Consultas y descargas', [
      'Todas las tablas permiten buscar, filtrar por año, mes, vehículo, centro de costo y razón social, ordenar por cualquier columna y descargar en Excel lo que se está viendo. En Costos y reportes se descarga el reporte completo del año o la base completa. Cada vehículo tiene su hoja de vida en PDF. Toda descarga queda en la bitácora con la huella SHA-256 del archivo.'
    ]));
    cont.appendChild(sec('7. Seguridad de la información', [
      'Cada usuario es personal e intransferible. No comparta su contraseña. Cierre la sesión en equipos compartidos. Los datos personales se tratan conforme a la Ley 1581 de 2012 únicamente para el control de flota y combustible; los archivos descargados no deben compartirse fuera de la compañía.'
    ]));
  }, TODOS);
})();
