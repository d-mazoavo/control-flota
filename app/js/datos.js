/*
 * Conexión con Firebase (Google): ingreso con usuario y contraseña, base de datos Firestore,
 * copia local incremental, bitácora de auditoría y administración de usuarios.
 * Nadie usa correo: cada usuario tiene internamente una dirección técnica que nunca recibe mensajes.
 */
(function () {
  'use strict';
  var FL = (window.FL = window.FL || {});
  var U = FL.U;

  var TIMEOUT = 25000;
  var SOLAPE = 120000;          // ms que se repiten en cada consulta incremental (escrituras simultáneas)
  var app = null, auth = null, db = null, cfg = null;
  var usuarioAuth = null;       // identidad de Firebase Authentication
  var cuenta = null;            // cuentas/{uid}: { usuario, nombre, rol, activo, temporalHasta }
  var cache = {};               // copia local por colección: { docs: {id: rec}, cursor: millis }
  var marcador = null;

  function err(msg, extra) { var e = new Error(msg); if (extra) Object.assign(e, extra); return e; }
  function FV() { return firebase.firestore.FieldValue; }
  function ts() { return FV().serverTimestamp(); }
  function millis(v) { return v && v.toMillis ? v.toMillis() : (typeof v === 'number' ? v : 0); }
  function emailDe(usuario, version) { return U.normUsuario(usuario) + '.' + (version || 1) + '@' + (cfg.dominioUsuarios || 'flota.avo-pak.com'); }
  function codigo(e) { return String((e && e.code) || '').replace(/^(firestore|auth)\//, ''); }

  function mapErr(e) {
    if (!e) return err('Error desconocido.');
    if (e.mapeado) return e;
    var c = codigo(e);
    var m = {
      'unavailable': 'Sin conexión con el servidor. Verifique el internet e intente de nuevo.',
      'deadline-exceeded': 'El servidor no respondió a tiempo. Intente de nuevo.',
      'network-request-failed': 'Sin conexión a internet.',
      'permission-denied': 'Su usuario no tiene permiso para esta operación.',
      'not-found': 'El registro no existe.',
      'already-exists': 'El registro ya existe.',
      'resource-exhausted': 'Se alcanzó el límite diario del plan gratuito de Firebase. Intente mañana o revise el plan.',
      'too-many-requests': 'Demasiados intentos. Espere unos minutos e intente de nuevo.',
      'wrong-password': 'Usuario o contraseña incorrectos.',
      'invalid-credential': 'Usuario o contraseña incorrectos.',
      'invalid-login-credentials': 'Usuario o contraseña incorrectos.',
      'user-not-found': 'Usuario o contraseña incorrectos.',
      'user-disabled': 'Este usuario está deshabilitado.',
      'weak-password': 'La contraseña es demasiado débil.',
      'requires-recent-login': 'Por seguridad, cierre sesión e ingrese de nuevo antes de cambiar la contraseña.'
    };
    return err(m[c] || (e && e.message) || String(e), { code: c, mapeado: true, sinPermiso: c === 'permission-denied' });
  }
  async function run(fn, ms) {
    if (navigator.onLine === false) throw err('Sin conexión a internet.', { mapeado: true, offline: true });
    var t;
    try {
      return await Promise.race([fn(), new Promise(function (_, rej) {
        t = setTimeout(function () { rej(err('El servidor no respondió (conexión lenta o ausente).', { mapeado: true, offline: true })); }, ms || TIMEOUT);
      })]);
    } catch (e) { throw mapErr(e); } finally { clearTimeout(t); }
  }

  // ---------- Formato de los registros ----------
  function normDoc(doc) {
    var d = doc.data() || {}, o = {};
    Object.keys(d).forEach(function (k) {
      var v = d[k];
      if (v && v.toMillis) v = v.toMillis();
      o[k] = v;
    });
    o.id = doc.id;
    return o;
  }
  function selloCrea() {
    return { _creado: ts(), _creadoPor: usuarioAuth.uid, _creadoPorUsuario: cuenta.usuario, _mod: ts(), _modPor: usuarioAuth.uid, _modPorUsuario: cuenta.usuario };
  }
  function selloMod() { return { _mod: ts(), _modPor: usuarioAuth.uid, _modPorUsuario: cuenta.usuario }; }
  function limpiar(o) {
    var r = {};
    Object.keys(o || {}).forEach(function (k) {
      if (k === 'id' || k[0] === '_') return;
      var v = o[k];
      if (v === undefined) return;
      if (typeof v === 'number' && !isFinite(v)) v = null;
      r[k] = v;
    });
    return r;
  }

  // ---------- Lote de escrituras con bitácora y marca de cambios ----------
  // ops: [{ tipo: 'crear'|'modificar', col, id?, data, accion, resumen, cambios? }]
  async function confirmar(ops) {
    var b = db.batch(), marcas = {}, salida = [];
    ops.forEach(function (op) {
      var ref = op.id ? db.collection(op.col).doc(String(op.id)) : db.collection(op.col).doc();
      var aud = db.collection('auditoria').doc();
      var data = limpiar(op.data);
      data._aud = aud.id;
      if (op.tipo === 'crear') b.set(ref, Object.assign(data, selloCrea()));
      else b.update(ref, Object.assign(data, selloMod()));
      b.set(aud, {
        ref: op.col + '/' + ref.id, coleccion: op.col, docId: ref.id,
        accion: op.accion || (op.tipo === 'crear' ? 'Creación' : 'Modificación'),
        resumen: String(op.resumen || '').slice(0, 500),
        cambios: op.cambios ? JSON.stringify(op.cambios).slice(0, 8000) : '',
        usuario: cuenta.usuario, nombre: cuenta.nombre || '', rol: cuenta.rol,
        _creado: ts(), _creadoPor: usuarioAuth.uid
      });
      marcas[op.col] = ts();
      salida.push(ref.id);
    });
    b.set(db.doc('meta/cambios'), marcas, { merge: true });
    await run(function () { return b.commit(); });
    // Se trae del servidor lo recién escrito (hora oficial del servidor)
    await FL.Datos.sincronizar(true);
    return salida;
  }

  // ---------- Copia local por colección ----------
  async function copia(col) {
    if (!cache[col]) cache[col] = (await FL.Store.get('c:' + col)) || { docs: {}, cursor: null };
    return cache[col];
  }
  async function leerMarcador() {
    var s = await run(function () { return db.doc('meta/cambios').get({ source: 'server' }); });
    var d = s.exists ? s.data() : {}, m = {};
    Object.keys(d).forEach(function (k) { m[k] = millis(d[k]); });
    marcador = m;
    return m;
  }

  var D = (FL.Datos = {
    listo: false,
    init: async function (config) {
      cfg = config;
      if (!window.firebase || !firebase.firestore || !firebase.auth) throw err('No se cargó la librería de Firebase.');
      var fc = cfg.firebase || {};
      if (!fc.apiKey || !fc.projectId || /PEGAR/i.test(fc.apiKey + fc.projectId)) {
        throw err('La aplicación aún no está conectada a Firebase: falta pegar el bloque de configuración en config.js.', { config: true });
      }
      app = firebase.initializeApp(fc);
      auth = app.auth();
      db = app.firestore();
      db.settings({ ignoreUndefinedProperties: true, merge: true });
      if (cfg.emulador) {
        auth.useEmulator(cfg.emulador.auth, { disableWarnings: true });
        db.useEmulator(cfg.emulador.firestore[0], cfg.emulador.firestore[1]);
      }
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      usuarioAuth = await new Promise(function (res) { var off = auth.onAuthStateChanged(function (u) { off(); res(u); }); });
      D.listo = true;
      if (usuarioAuth) {
        try { await cargarSesion(); } catch (e) { await D.salir(); return null; }
        return D.yo();
      }
      return null;
    },
    yo: function () { return cuenta ? { uid: usuarioAuth.uid, usuario: cuenta.usuario, nombre: cuenta.nombre, rol: cuenta.rol, temporal: !!cuenta.temporalHasta } : null; },
    esAdmin: function () { return !!cuenta && cuenta.rol === 'Administrador'; },
    puedeIngresar: function () { return !!cuenta && (cuenta.rol === 'Administrador' || cuenta.rol === 'Analista'); },

    ingresar: async function (usuario, clave) {
      var u = U.normUsuario(usuario);
      if (!u || !clave) throw err('Escriba su usuario y su contraseña.');
      var l = await run(function () { return db.doc('login/' + u).get({ source: 'server' }); });
      if (!l.exists) throw err('Usuario o contraseña incorrectos.');
      var cred = await run(function () { return auth.signInWithEmailAndPassword(l.data().email, String(clave)); });
      usuarioAuth = cred.user;
      try { await cargarSesion(); } catch (e) { await D.salir(); throw e; }
      return D.yo();
    },
    cambiarClave: async function (nueva) {
      await run(function () { return usuarioAuth.updatePassword(String(nueva)); });
      var b = db.batch();
      b.update(db.doc('cuentas/' + usuarioAuth.uid), { temporalHasta: null, _mod: ts() });
      b.update(db.doc('usuarios/' + cuenta.usuario), { claveTemporal: false, claveCambiadaEn: ts(), _mod: ts(), _modPor: usuarioAuth.uid, _modPorUsuario: cuenta.usuario });
      await run(function () { return b.commit(); });
      cuenta = Object.assign({}, cuenta, { temporalHasta: null });
    },
    salir: async function () {
      try { if (auth) await auth.signOut(); } catch (e) { /* sin conexión */ }
      usuarioAuth = null; cuenta = null; cache = {}; marcador = null;
      await FL.Store.limpiar();
    },

    // ---------- Lectura ----------
    // Trae solo lo modificado desde la última consulta (1 lectura si nada cambió)
    sincronizar: async function () {
      var m = await leerMarcador();
      var hubo = false;
      for (var i = 0; i < FL.COLECCIONES.length; i++) {
        var col = FL.COLECCIONES[i], c = await copia(col), mk = m[col] || 0;
        if (c.cursor != null && mk <= c.cursor) continue;
        var desde = Math.max(0, (c.cursor || 0) - SOLAPE);
        var snap = await run(function () {
          return db.collection(col).where('_mod', '>', firebase.firestore.Timestamp.fromMillis(desde)).get({ source: 'server' });
        }, 60000);
        snap.forEach(function (d) { c.docs[d.id] = normDoc(d); });
        c.cursor = mk;
        await FL.Store.set('c:' + col, c);
        hubo = true;
      }
      return hubo;
    },
    lista: function (col) {
      var c = cache[col]; if (!c) return [];
      return Object.keys(c.docs).map(function (id) { return c.docs[id]; });
    },
    uno: function (col, id) { var c = cache[col]; return c && id != null ? c.docs[String(id)] || null : null; },
    cargarCopia: async function () { for (var i = 0; i < FL.COLECCIONES.length; i++) await copia(FL.COLECCIONES[i]); },

    parametros: async function () {
      var p = Object.assign({}, cfg.parametros || {});
      try {
        var s = await run(function () { return db.doc('config/parametros').get(); });
        if (s.exists) Object.keys(s.data()).forEach(function (k) { if (k[0] !== '_') p[k] = s.data()[k]; });
      } catch (e) { /* se usan los valores por defecto de config.js */ }
      return p;
    },
    guardarParametros: async function (p) {
      var o = limpiar(p);
      o._mod = ts(); o._modPor = usuarioAuth.uid; o._modPorUsuario = cuenta.usuario;
      var aud = db.collection('auditoria').doc(), b = db.batch();
      b.set(db.doc('config/parametros'), o, { merge: true });
      b.set(aud, { ref: 'config/parametros', coleccion: 'config', docId: 'parametros', accion: 'Modificación', resumen: 'Parámetros de alertas', cambios: JSON.stringify(limpiar(p)), usuario: cuenta.usuario, nombre: cuenta.nombre || '', rol: cuenta.rol, _creado: ts(), _creadoPor: usuarioAuth.uid });
      await run(function () { return b.commit(); });
    },

    // ---------- Escritura ----------
    confirmar: confirmar,
    crear: async function (col, data, id, resumen) {
      var ids = await confirmar([{ tipo: 'crear', col: col, id: id, data: Object.assign({ anulado: false }, data), resumen: resumen }]);
      return ids[0];
    },
    modificar: async function (col, id, data, resumen, accion) {
      var antes = D.uno(col, id) || {}, cambios = {};
      Object.keys(limpiar(data)).forEach(function (k) {
        var a = antes[k], n = data[k];
        if (JSON.stringify(a === undefined ? null : a) !== JSON.stringify(n === undefined ? null : n)) cambios[k] = [a === undefined ? null : a, n];
      });
      if (!Object.keys(cambios).length) return id;
      var ids = await confirmar([{ tipo: 'modificar', col: col, id: id, data: data, resumen: resumen, accion: accion || 'Modificación', cambios: cambios }]);
      return ids[0];
    },
    anular: async function (col, id, motivo, resumen) {
      return D.modificar(col, id, { anulado: true, motivoAnulacion: String(motivo), anuladoPor: cuenta.usuario, anuladoEn: new Date().toISOString() }, resumen, 'Anulación');
    },
    restablecer: async function (col, id, resumen) {
      return D.modificar(col, id, { anulado: false, motivoAnulacion: '', anuladoPor: '', anuladoEn: '' }, resumen, 'Reactivación');
    },
    // Registro de exportaciones (descargas) en la bitácora
    registrarExportacion: async function (archivo, detalle, huella) {
      try {
        await run(function () {
          return db.collection('auditoria').add({ ref: 'exportacion/' + archivo, coleccion: 'exportacion', docId: archivo, accion: 'Exportación', resumen: String(detalle || '').slice(0, 500), cambios: huella || '', usuario: cuenta.usuario, nombre: cuenta.nombre || '', rol: cuenta.rol, _creado: ts(), _creadoPor: usuarioAuth.uid });
        });
      } catch (e) { /* la descarga no se bloquea por la bitácora */ }
    },
    auditoria: async function (limite) {
      var s = await run(function () { return db.collection('auditoria').orderBy('_creado', 'desc').limit(limite || 2000).get({ source: 'server' }); }, 60000);
      var out = []; s.forEach(function (d) { out.push(normDoc(d)); });
      return out;
    },

    // ---------- Fotografías (se consultan por demanda) ----------
    fotos: async function (ref) {
      var s = await run(function () { return db.collection('fotos').where('ref', '==', ref).get({ source: 'server' }); }, 60000);
      var out = []; s.forEach(function (d) { out.push(normDoc(d)); });
      return out.sort(function (a, b) { return (a._creado || 0) - (b._creado || 0); });
    },
    subirFoto: async function (ref, dataUrl, tipo, descripcion) {
      if (dataUrl.length > 880000) throw err('La fotografía es demasiado pesada incluso reducida. Use una de menor resolución.');
      var huella = await U.sha256(dataUrl);
      var f = db.collection('fotos').doc(), aud = db.collection('auditoria').doc(), b = db.batch();
      b.set(f, { ref: ref, tipo: tipo || 'Fotografía', descripcion: descripcion || '', data: dataUrl, bytes: dataUrl.length, sha256: huella, _creado: ts(), _creadoPor: usuarioAuth.uid, _creadoPorUsuario: cuenta.usuario });
      b.set(aud, { ref: 'fotos/' + f.id, coleccion: 'fotos', docId: f.id, accion: 'Creación', resumen: (tipo || 'Fotografía') + ' de ' + ref + (descripcion ? ' — ' + descripcion : ''), cambios: huella, usuario: cuenta.usuario, nombre: cuenta.nombre || '', rol: cuenta.rol, _creado: ts(), _creadoPor: usuarioAuth.uid });
      await run(function () { return b.commit(); }, 90000);
      return f.id;
    },
    borrarFoto: async function (foto, motivo) {
      var aud = db.collection('auditoria').doc(), b = db.batch();
      b.delete(db.doc('fotos/' + foto.id));
      b.set(aud, { ref: 'fotos/' + foto.id, coleccion: 'fotos', docId: foto.id, accion: 'Eliminación', resumen: 'Fotografía de ' + foto.ref + '. Motivo: ' + motivo, cambios: foto.sha256 || '', usuario: cuenta.usuario, nombre: cuenta.nombre || '', rol: cuenta.rol, _creado: ts(), _creadoPor: usuarioAuth.uid });
      await run(function () { return b.commit(); });
    },

    // ---------- Usuarios (solo Administrador) ----------
    usuarios: async function () {
      var s = await run(function () { return db.collection('usuarios').get({ source: 'server' }); });
      var out = []; s.forEach(function (d) { out.push(normDoc(d)); });
      return out;
    },
    crearUsuario: async function (datos, clave) {
      var u = U.normUsuario(datos.usuario);
      if (!/^[a-z0-9._-]{3,30}$/.test(u)) throw err('El usuario debe tener entre 3 y 30 caracteres: letras sin tildes, números, punto o guion.');
      var ex = await run(function () { return db.doc('login/' + u).get({ source: 'server' }); });
      if (ex.exists) throw err('Ese usuario ya existe (puede estar de baja). Elija otro.');
      var ident = await crearIdentidad(u, 1, clave);
      await escribirUsuario(u, ident, datos, null, 'Creación de usuario');
    },
    editarUsuario: async function (u, datos) {
      var s = await run(function () { return db.doc('usuarios/' + u).get({ source: 'server' }); });
      var actual = s.data();
      var b = db.batch(), aud = db.collection('auditoria').doc();
      var cambios = { nombre: datos.nombre, cedula: datos.cedula || '', cargo: datos.cargo || '', rol: datos.rol };
      b.update(db.doc('usuarios/' + u), Object.assign({}, cambios, selloMod()));
      if (actual.uid) b.update(db.doc('cuentas/' + actual.uid), { rol: datos.rol, nombre: datos.nombre, _mod: ts() });
      b.set(aud, { ref: 'usuarios/' + u, coleccion: 'usuarios', docId: u, accion: 'Modificación de usuario', resumen: u + ' — rol ' + datos.rol, cambios: JSON.stringify({ rol: [actual.rol, datos.rol], nombre: [actual.nombre, datos.nombre] }), usuario: cuenta.usuario, nombre: cuenta.nombre || '', rol: cuenta.rol, _creado: ts(), _creadoPor: usuarioAuth.uid });
      await run(function () { return b.commit(); });
    },
    // Nueva contraseña temporal: se crea una identidad nueva y la anterior queda sin efecto de inmediato
    restablecerUsuario: async function (u, clave) {
      var s = await run(function () { return db.doc('usuarios/' + u).get({ source: 'server' }); });
      var actual = s.data();
      var ident = await crearIdentidad(u, (Number(actual.version) || 1) + 1, clave);
      await escribirUsuario(u, ident, actual, actual.uid, 'Restablecimiento de contraseña');
    },
    bajaUsuario: async function (u, activo) {
      var s = await run(function () { return db.doc('usuarios/' + u).get({ source: 'server' }); });
      var actual = s.data();
      var b = db.batch(), aud = db.collection('auditoria').doc();
      b.update(db.doc('usuarios/' + u), Object.assign({ activo: !!activo }, selloMod()));
      if (actual.uid) b.update(db.doc('cuentas/' + actual.uid), { activo: !!activo, _mod: ts() });
      b.set(aud, { ref: 'usuarios/' + u, coleccion: 'usuarios', docId: u, accion: activo ? 'Reactivación de usuario' : 'Baja de usuario', resumen: u, cambios: '', usuario: cuenta.usuario, nombre: cuenta.nombre || '', rol: cuenta.rol, _creado: ts(), _creadoPor: usuarioAuth.uid });
      await run(function () { return b.commit(); });
    },

    // ---------- Instalación inicial ----------
    instalar: async function (o) {
      var u = U.normUsuario(o.usuario);
      if (!/^[a-z0-9._-]{3,30}$/.test(u)) throw err('El usuario debe tener entre 3 y 30 caracteres: letras sin tildes, números, punto o guion.');
      var cred;
      try { cred = await run(function () { return auth.createUserWithEmailAndPassword(emailDe(u, 1), String(o.clave)); }); }
      catch (e) {
        if (e.code === 'email-already-in-use') throw err('Ese usuario ya fue usado en un intento anterior. Escriba otro usuario.');
        throw e;
      }
      usuarioAuth = cred.user;
      cuenta = { usuario: u, nombre: o.nombre, rol: 'Administrador', activo: true };
      var b = db.batch(), aud = db.collection('auditoria').doc(), marcas = {};
      FL.COLECCIONES.forEach(function (c) { marcas[c] = ts(); });
      b.set(db.doc('config/instalacion'), { codigo: String(o.codigo || '').trim().toUpperCase(), adminUid: usuarioAuth.uid, usuario: u, fecha: ts() });
      b.set(db.doc('cuentas/' + usuarioAuth.uid), { usuario: u, nombre: o.nombre, rol: 'Administrador', activo: true, temporalHasta: null, _mod: ts() });
      b.set(db.doc('usuarios/' + u), Object.assign({ usuario: u, nombre: o.nombre, cedula: U.normCedula(o.cedula), cargo: o.cargo || 'Director de Seguridad Integral', rol: 'Administrador', activo: true, uid: usuarioAuth.uid, version: 1, claveTemporal: false }, selloCrea()));
      b.set(db.doc('login/' + u), { email: emailDe(u, 1), _mod: ts() });
      b.set(db.doc('meta/cambios'), marcas);
      b.set(aud, { ref: 'config/instalacion', coleccion: 'config', docId: 'instalacion', accion: 'Instalación', resumen: 'Instalación inicial de la aplicación y creación del Administrador ' + u, cambios: '', usuario: u, nombre: o.nombre, rol: 'Administrador', _creado: ts(), _creadoPor: usuarioAuth.uid });
      try { await run(function () { return b.commit(); }); }
      catch (e) {
        try { await usuarioAuth.delete(); } catch (x) { /* ignorar */ }
        await D.salir();
        if (e.sinPermiso) throw err('Código de instalación incorrecto, o la aplicación ya fue instalada.');
        throw e;
      }
      await cargarSesion();
      return D.yo();
    }
  });

  async function cargarSesion() {
    var cs = await run(function () { return db.doc('cuentas/' + usuarioAuth.uid).get({ source: 'server' }); });
    if (!cs.exists) throw err('Este usuario no está habilitado en la aplicación.');
    var c = cs.data();
    if (c.activo !== true) throw err('Su usuario está de baja o su contraseña fue restablecida. Comuníquese con el Director de Seguridad Integral.');
    if (c.temporalHasta && millis(c.temporalHasta) < Date.now()) throw err('Su contraseña temporal venció. Solicite al Director de Seguridad Integral que la restablezca.');
    cuenta = { usuario: c.usuario, nombre: c.nombre || c.usuario, rol: c.rol, activo: true, temporalHasta: c.temporalHasta ? millis(c.temporalHasta) : null };
  }

  // Crea la identidad de acceso en una instancia aparte, para no cerrar la sesión de quien la crea.
  async function crearIdentidad(usuario, version, clave) {
    var sec = firebase.initializeApp(cfg.firebase, 'alta-' + Date.now() + '-' + Math.floor(Math.random() * 1e6));
    try {
      var a2 = sec.auth();
      if (cfg.emulador) a2.useEmulator(cfg.emulador.auth, { disableWarnings: true });
      await a2.setPersistence(firebase.auth.Auth.Persistence.NONE);
      for (var v = version, i = 0; i < 10; v++, i++) {
        try {
          var r = await run(function () { return a2.createUserWithEmailAndPassword(emailDe(usuario, v), String(clave)); });
          var uid = r.user.uid;
          try { await a2.signOut(); } catch (e) { /* ignorar */ }
          return { uid: uid, version: v };
        } catch (e) {
          if (e.code === 'email-already-in-use') continue;   // identidad huérfana de un intento anterior
          throw e;
        }
      }
      throw err('No fue posible crear la cuenta de acceso. Intente de nuevo.');
    } finally { try { await sec.delete(); } catch (e) { /* ignorar */ } }
  }

  async function escribirUsuario(u, ident, datos, uidAnterior, accion) {
    var horas = cfg.horasClaveTemporal || 72;
    var vence = firebase.firestore.Timestamp.fromMillis(Date.now() + horas * 3600000);
    var b = db.batch(), aud = db.collection('auditoria').doc();
    var perfil = { usuario: u, nombre: datos.nombre, cedula: U.normCedula(datos.cedula), cargo: datos.cargo || '', rol: datos.rol, activo: true, uid: ident.uid, version: ident.version, claveTemporal: true };
    if (uidAnterior) b.update(db.doc('usuarios/' + u), Object.assign(perfil, selloMod()));
    else b.set(db.doc('usuarios/' + u), Object.assign(perfil, selloCrea()));
    b.set(db.doc('cuentas/' + ident.uid), { usuario: u, nombre: datos.nombre, rol: datos.rol, activo: true, temporalHasta: vence, _mod: ts() });
    if (uidAnterior && uidAnterior !== ident.uid) b.set(db.doc('cuentas/' + uidAnterior), { activo: false, reemplazadaPor: ident.uid, _mod: ts() }, { merge: true });
    b.set(db.doc('login/' + u), { email: emailDe(u, ident.version), _mod: ts() });
    b.set(aud, { ref: 'usuarios/' + u, coleccion: 'usuarios', docId: u, accion: accion, resumen: u + ' — ' + datos.nombre + ' — rol ' + datos.rol, cambios: '', usuario: cuenta.usuario, nombre: cuenta.nombre || '', rol: cuenta.rol, _creado: ts(), _creadoPor: usuarioAuth.uid });
    await run(function () { return b.commit(); });
  }
})();
