/* Configuración: personas, razones sociales y centros de costo, pico y placa, usuarios, parámetros, bitácora y manual. */
(function () {
  'use strict';
  var FL = (window.FL = window.FL || {});
  var U = FL.U, h = U.h, UI = FL.UI, V = FL.Vistas, App = FL.App, C = FL.Calc;
  var TODOS = ['Administrador', 'Analista', 'Gobierno Corporativo'];

  function botonEditar(col, r, extra) { return V.accionesMaestro(col, r, extra); }
  var TIPOS_PERSONA = ['Fotografía de la persona', 'Cédula de ciudadanía', 'Licencia de conducción', 'Certificado o curso', 'Autorización de tratamiento de datos', 'Otro documento'];
  // Archivos de la persona: fotografía, cédula, licencias y demás documentos
  V.archivosPersona = function (p) {
    UI.modal({ titulo: 'Archivos de ' + p.nombres, ancho: true, cuerpo: h('div', { class: 'pila' },
      h('p', { class: 'muted small' }, 'C. C. ' + p.cedula + (p.cargo ? ' · ' + p.cargo : '') + '. Cargue fotos o documentos (PDF, Word, Excel). La fotografía de la persona puede usarse como foto de su ficha.'),
      V.galeria('personas/' + p.cedula, { tipos: TIPOS_PERSONA, soloEscritor: true,
        principal: async function (f) {
          var mini = await U.miniatura(f.data, 240);
          await FL.Datos.modificar('personas', p.cedula, { miniatura: mini }, 'Foto de ' + p.nombres);
          UI.toast('Foto de la persona actualizada.', 'ok'); App.refrescar();
        } })) });
  };
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
    cols.unshift({ l: 'Foto', v: function () { return ''; }, f: function (r) { return r.miniatura ? h('img', { src: r.miniatura, alt: '', class: 'mini persona' }) : h('span', { class: 'mini vacia persona' }, '👤'); } });
    cont.appendChild(h('section', { class: 'tarjeta' }, UI.tabla({
      nombre: 'Personas', columnas: cols, filas: function () { return FL.Datos.lista('personas'); }, ordenInicial: 2, ordenDesc: false,
      filtros: [filtroActivo, { l: 'Conductores', opts: [['1', 'Solo autorizados para conducir']], fn: function (r) { return !!r.conductor; } },
        { l: 'Razón social', opts: FL.Datos.lista('razones').map(function (x) { return [x.id, x.nombre]; }), fn: function (r, v) { return r.razonId === v; } }],
      acciones: function (r) { return botonEditar('personas', r, [h('button', { class: 'btn xs', type: 'button', onclick: function () { V.archivosPersona(r); } }, '📎 Archivos')]); }
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
    cont.appendChild(V.titulo('Usuarios', 'Cada usuario se crea a partir de una persona registrada e ingresa con su propio usuario y contraseña.', [h('button', { class: 'btn primario', type: 'button', onclick: function () { formUsuario(null); } }, '+ Nuevo usuario')]));
    cont.appendChild(h('div', { class: 'tarjeta pila sm' },
      h('p', null, h('strong', null, 'Administrador: '), 'crea, modifica, anula y elimina todo, carga y quita archivos, corrige cédulas y placas; administra usuarios y parámetros.'),
      h('p', null, h('strong', null, 'Analista: '), 'ingresa tanqueos, uso diario, mantenimientos, documentos y fotografías. Consulta todo. No modifica ni anula.'),
      h('p', null, h('strong', null, 'Gobierno Corporativo: '), 'consulta, filtra y descarga todo, incluida la bitácora. No ingresa, no modifica, no borra.'),
      h('p', null, h('strong', null, 'Conductor: '), 'registra solo sus propios tanqueos y usos de vehículos (su cédula queda fija) y sus fotografías; ve únicamente sus registros, sus licencias y los vehículos a su cargo. No ve datos de otras personas.')));
    cont.appendChild(zona);
    var usuariosActuales = [];
    async function cargar() {
      try {
        var lista = await FL.Datos.usuarios();
        usuariosActuales = lista;
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
    function sugerirUsuario(nombres) {
      var p = U.sinTildes(nombres).replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
      if (!p.length) return '';
      var ape = p.length >= 3 ? p[p.length - 2] : p[p.length - 1];
      var base = (p[0][0] + (p.length > 1 ? ape : '')).slice(0, 24), u = base, n = 2;
      while (usuariosActuales.some(function (x) { return x.usuario === u; })) u = base + n++;
      return u;
    }
    // El usuario se crea a partir de una persona registrada: nombre, cédula y cargo vienen de su ficha
    function formUsuario(u) {
      var yo = FL.Datos.yo();
      var personas = FL.Datos.lista('personas').filter(function (p) { return p.activo !== false; }).sort(function (a, b) { return String(a.nombres).localeCompare(String(b.nombres), 'es'); });
      var conUsuario = {};
      usuariosActuales.forEach(function (x) { if (x.activo && x.cedula && (!u || x.usuario !== u.usuario)) conUsuario[x.cedula] = x.usuario; });
      var cedula = h('input', { class: 'campo-input', list: 'dl-personas-usuario', inputmode: 'numeric', autocomplete: 'off', placeholder: 'Digite la cédula o elija de la lista', value: u ? u.cedula || '' : '', disabled: !!u && !!FL.Datos.uno('personas', u.cedula) });
      var dl = h('datalist', { id: 'dl-personas-usuario' }, personas.map(function (p) { return h('option', { value: p.cedula }, p.nombres + (p.cargo ? ' — ' + p.cargo : '') + (conUsuario[p.cedula] ? ' (ya tiene usuario)' : '')); }));
      var ficha = h('div', { class: 'ficha-ref' });
      var usuario = h('input', { class: 'campo-input', value: u ? u.usuario : '', disabled: !!u, autocapitalize: 'none' });
      var rol = h('select', { class: 'campo-input' }, FL.OPC.roles.map(function (r) { return h('option', null, r); }));
      rol.value = u ? u.rol : 'Analista';
      if (u && u.usuario === yo.usuario) rol.disabled = true;
      var err = h('p', { class: 'txt-error' });
      var tocadoUsuario = !!u;
      usuario.addEventListener('input', function () { tocadoUsuario = true; });
      function persona() { return FL.Datos.uno('personas', U.normCedula(cedula.value)); }
      function pintarFicha() {
        U.clear(ficha);
        var p = persona();
        if (!cedula.value) return;
        if (!p) { ficha.appendChild(h('span', { class: 'txt-error small' }, 'Cédula no registrada. Primero cree la persona en Personas vinculadas.')); return; }
        ficha.appendChild(h('div', { class: 'ficha' }, h('strong', null, p.nombres), h('span', null, [p.cargo, UI.nombreRazon(p.razonId), p.centroId ? 'C. C. ' + UI.nombreCentro(p.centroId) : ''].filter(Boolean).join(' · ')),
          h('span', null, p.conductor ? 'Autorizado para conducir · ' + (FL.Calc.textoLicencias(p) || 'sin licencias registradas') : 'No autorizado para conducir'),
          conUsuario[p.cedula] ? h('span', { class: 'txt-error' }, 'Esta persona ya tiene el usuario activo «' + conUsuario[p.cedula] + '».') : null));
        if (!tocadoUsuario) usuario.value = sugerirUsuario(p.nombres);
      }
      cedula.addEventListener('input', pintarFicha);
      pintarFicha();
      function f(l, el, a) { return h('label', { class: 'campo' }, h('span', { class: 'campo-l' }, l), el, a ? h('span', { class: 'campo-ayuda' }, a) : null); }
      UI.modal({ titulo: u ? 'Editar usuario' : 'Nuevo usuario', cuerpo: h('div', { class: 'pila' },
        h('div', { class: 'campo' }, h('span', { class: 'campo-l req' }, 'Persona (cédula)'), cedula, dl, ficha, h('span', { class: 'campo-ayuda' }, 'Solo se pueden crear usuarios para personas registradas en Personas vinculadas.')),
        f('Usuario', usuario, 'Se sugiere a partir del nombre; puede cambiarlo. Sin espacios ni tildes.'),
        f('Rol', rol, 'Conductor: registra solo sus propios tanqueos y usos de vehículos, y ve solo sus registros.'), err),
        acciones: [{ l: 'Cancelar' }, { l: 'Guardar', tipo: 'primario', fn: async function () {
          err.textContent = '';
          var p = persona();
          if (!p && !(u && !FL.Datos.uno('personas', u.cedula))) { err.textContent = 'Elija una persona registrada.'; return false; }
          if (p && conUsuario[p.cedula]) { err.textContent = 'Esta persona ya tiene el usuario activo «' + conUsuario[p.cedula] + '».'; return false; }
          if (rol.value === 'Conductor' && (!p || !p.conductor)) { err.textContent = 'Para el rol Conductor, la persona debe estar marcada como autorizada para conducir en su ficha.'; return false; }
          if (rol.value === 'Conductor' && p && !FL.Calc.estadoLicencias(p).vigentes.length && !(await UI.confirmar('Licencias', p.nombres + ' no tiene licencias vigentes registradas. ¿Crear el usuario Conductor de todas formas?', 'Crear'))) return false;
          var datos = p ? { usuario: usuario.value, nombre: p.nombres, cedula: p.cedula, cargo: p.cargo || '', rol: rol.value }
            : { usuario: u.usuario, nombre: u.nombre, cedula: u.cedula || '', cargo: u.cargo || '', rol: rol.value };
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
    var TXT = [['emailjsServicio', 'Service ID de EmailJS'], ['emailjsPlantilla', 'Template ID de EmailJS'], ['emailjsClave', 'Public Key de EmailJS'], ['correoCopia', 'Copia oculta de cada aviso (opcional, por ejemplo el correo de la Dirección de Seguridad Integral)']];
    var correo = h('div', { class: 'pila' }, h('p', { class: 'muted small' }, 'Para que el aviso de cada tanqueo llegue solo al correo de la persona, la aplicación usa EmailJS (servicio externo, con plan gratuito limitado). Si deja estos campos vacíos, el aviso se prepara en el programa de correo del equipo y quien registra oprime «Enviar». El aviso por WhatsApp siempre se prepara para enviarlo con un toque.'));
    TXT.forEach(function (x) {
      inputs[x[0]] = h('input', { type: 'text', class: 'campo-input', autocomplete: 'off', spellcheck: 'false', value: p[x[0]] || '' });
      correo.appendChild(h('label', { class: 'campo' }, h('span', { class: 'campo-l' }, x[1]), inputs[x[0]]));
    });
    inputs.correoAutomatico = h('input', { type: 'checkbox', class: 'campo-check' }); inputs.correoAutomatico.checked = p.correoAutomatico !== false;
    correo.appendChild(h('label', { class: 'campo-bool' }, inputs.correoAutomatico, h('span', null, 'Enviar el correo automáticamente al guardar cada tanqueo')));
    var btn = h('button', { class: 'btn primario', type: 'button', onclick: async function () {
      var o = {}; PARAM.forEach(function (x) { var v = Number(inputs[x[0]].value); o[x[0]] = isFinite(v) && v >= 0 ? v : x[2]; });
      TXT.forEach(function (x) { o[x[0]] = inputs[x[0]].value.trim(); });
      o.correoAutomatico = inputs.correoAutomatico.checked;
      if (o.correoCopia && !FL.Notif.correoValido(o.correoCopia)) { UI.toast('El correo de copia no es válido.', 'error'); return; }
      btn.disabled = true;
      try { await FL.Datos.guardarParametros(o); await App.recargarParametros(); UI.toast('Parámetros guardados.', 'ok'); } catch (e) { UI.toast(e.message, 'error'); } finally { btn.disabled = false; }
    } }, 'Guardar parámetros');
    cont.appendChild(UI.seccion('Alertas', form));
    cont.appendChild(UI.seccion('Aviso de tanqueos por correo', correo));
    cont.appendChild(h('div', { class: 'form-acciones' }, btn));
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
      'Los usuarios se crean a partir de las personas registradas: elija la cédula, la aplicación toma el nombre y el cargo y sugiere el usuario. El rol Conductor solo se asigna a personas autorizadas para conducir. Al crear un usuario, la aplicación genera una contraseña temporal que se muestra una sola vez. Entréguela personalmente; la persona deberá cambiarla en su primer ingreso.'
    ]));
    cont.appendChild(sec('2. Tanqueos', [
      'Todo combustible que se tanquee o se retire debe quedar registrado. En «Registrar › Tanqueo» digite la cédula de quien tanquea: el nombre, el cargo, la razón social y el centro de costo se completan solos. Si el combustible va a un vehículo, elija la placa y escriba el kilometraje del odómetro. Si va a otro uso (planta eléctrica, guadaña, bidón, maquinaria), elija «Otro uso», indique el equipo y justifique para qué se lleva, dónde se usará y quién lo autorizó; el centro de costo es obligatorio.',
      'El rendimiento (kilómetros por galón) se calcula entre dos tanqueos a tanque lleno: kilómetros recorridos entre ambos divididos por los galones cargados después del primero. Por eso es importante marcar si se llenó el tanque y escribir el kilometraje exacto. Si un tramo cae por debajo de la referencia menos la tolerancia, la aplicación lo marca como «Bajo» y genera alerta: puede indicar desvío de combustible, fuga, falla mecánica o error de registro.',
      'Después de guardar se prepara el aviso a la persona que tanqueó: al correo registrado (automático si EmailJS está configurado en Parámetros) y por WhatsApp a su celular, con todos los datos del tanqueo, para que confirme o reporte de inmediato si no lo reconoce. Cada aviso queda en la bitácora. También puede adjuntar la foto de la factura o tirilla y del odómetro.',
      'Los conductores con usuario propio registran sus tanqueos y el uso de los vehículos con su cédula fija; solo ven sus registros, sus licencias y los vehículos a su cargo.'
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
      'El Analista no puede modificar, anular ni eliminar. Si se ingresó un dato errado, debe informarlo al Administrador, quien puede: editarlo («Editar», también los anulados), anularlo con un motivo (deja de sumar y se puede reactivar) o eliminarlo definitivamente («Eliminar»). Toda modificación queda en la bitácora con el valor anterior y el nuevo, y toda eliminación con una copia completa del registro, el motivo, quién la hizo y cuándo; la bitácora no se puede alterar.',
      'Una persona, vehículo, centro de costo o razón social que tenga registros asociados no se puede eliminar (quedarían registros sin dueño): primero se eliminan o reasignan esos registros, o se marca como inactivo o dado de baja. Si una cédula o una placa quedó mal escrita, use «Corregir cédula» o «Corregir placa» en la ventana de edición: se trasladan todos sus registros, archivos y usuario.',
      'Archivos: en cada persona («📎 Archivos»), vehículo (pestaña Fotos y documentos), documento, tanqueo, uso diario y mantenimiento («Archivos») se pueden cargar fotos y documentos PDF, Word o Excel de hasta 8 MB. El Administrador puede cambiar su tipo y descripción, descargarlos y eliminarlos.'
    ]));
    cont.appendChild(sec('6. Consultas y descargas', [
      'Todas las tablas permiten buscar, filtrar por año, mes, vehículo, centro de costo y razón social, ordenar por cualquier columna y descargar en Excel lo que se está viendo. En Costos y reportes se descarga el reporte completo del año o la base completa. Cada vehículo tiene su hoja de vida en PDF. Toda descarga queda en la bitácora con la huella SHA-256 del archivo.'
    ]));
    cont.appendChild(sec('7. Seguridad de la información', [
      'Cada usuario es personal e intransferible. No comparta su contraseña. Cierre la sesión en equipos compartidos. Los datos personales se tratan conforme a la Ley 1581 de 2012 únicamente para el control de flota y combustible; los archivos descargados no deben compartirse fuera de la compañía.'
    ]));
  }, TODOS);
})();
