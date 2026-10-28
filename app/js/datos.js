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
  var cacheFotos = {};          // fotografías ya consultadas en esta sesión, por registro

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
  // Colecciones cuyos avisos de eliminación puede leer el Conductor (no contienen datos personales)
  var PUBLICAS = ['vehiculos', 'centros', 'razones', 'picoyplaca', 'documentos'];
  function asiento(ref, col, id, accion, resumen, cambios) {
    return { ref: ref, coleccion: col, docId: String(id), accion: accion, resumen: String(resumen || '').slice(0, 500), cambios: String(cambios || '').slice(0, 8000),
      usuario: cuenta.usuario, nombre: cuenta.nombre || '', rol: cuenta.rol, _creado: ts(), _creadoPor: usuarioAuth.uid };
  }
  function idBorrado(col, id, creado) { return 'del_' + col + '_' + id + '_' + creado; }
  function copiaParaBitacora(r) {
    var o = {};
    Object.keys(r || {}).forEach(function (k) { if (k !== 'miniatura' && k !== 'data' && k !== '_aud') o[k] = r[k]; });
    return JSON.stringify(o);
  }
  // Cada operación se convierte en un grupo de escrituras que viajan juntas.
  // n: escrituras; a: consultas que hacen las reglas del servidor (máximo 20 por lote).
  function preparar(op) {
    if (op.tipo === 'crear' || op.tipo === 'modificar') {
      var ref = op.id ? db.collection(op.col).doc(String(op.id)) : db.collection(op.col).doc();
      var aud = db.collection('auditoria').doc();
      return { id: ref.id, n: 2, a: 2, cols: [op.col], fn: function (b) {
        var data = limpiar(op.data);
        data._aud = aud.id;
        if (op.tipo === 'crear') b.set(ref, Object.assign(data, selloCrea()));
        else b.update(ref, Object.assign(data, selloMod()));
        b.set(aud, asiento(op.col + '/' + ref.id, op.col, ref.id, op.accion || (op.tipo === 'crear' ? 'Creación' : 'Modificación'), op.resumen, op.cambios ? JSON.stringify(op.cambios) : ''));
      } };
    }
    if (op.tipo === 'eliminar') {
      var r = op.registro, cre = r && r._creado;
      if (!cre) throw err('El registro no tiene fecha de creación registrada; no se puede eliminar.');
      var did = idBorrado(op.col, op.id, cre), foto = op.col === 'fotos', partes = foto ? (Number(r.partes) || 0) : 0;
      return { id: String(op.id), n: foto ? 2 + partes : 3, a: foto ? 1 : 2, cols: foto ? ['fotos'] : [op.col, 'eliminados'], fn: function (b) {
        b.delete(db.collection(op.col).doc(String(op.id)));
        for (var i = 0; i < partes; i++) b.delete(db.doc('fotos/' + op.id + '/partes/' + i));
        b.set(db.collection('auditoria').doc(did), asiento(op.col + '/' + op.id, op.col, op.id, 'Eliminación', (op.resumen || '') + (op.motivo ? ' — Motivo: ' + op.motivo : ''), copiaParaBitacora(r)));
        if (!foto) b.set(db.collection('eliminados').doc(did), { col: op.col, docId: String(op.id), creado: cre, publico: PUBLICAS.indexOf(op.col) >= 0, _mod: ts() });
      } };
    }
    if (op.tipo === 'foto-modificar') {
      var fr = db.doc('fotos/' + op.foto.id), au = db.collection('auditoria').doc();
      return { id: op.foto.id, n: 2, a: 0, cols: ['fotos'], fn: function (b) {
        b.update(fr, Object.assign(limpiar(op.data), selloMod()));
        b.set(au, asiento('fotos/' + op.foto.id, 'fotos', op.foto.id, 'Modificación', op.resumen, JSON.stringify(op.cambios || op.data)));
      } };
    }
    if (op.tipo === 'directo') return { id: op.id || '', n: op.n, a: op.a || 0, cols: op.cols || [], fn: op.fn };
    throw err('Operación desconocida.');
  }
  // Envía los grupos en lotes que respetan los límites del servidor; los grupos nunca se parten.
  async function ejecutar(ops) {
    var grupos = ops.map(preparar), lote = [], n = 0, a = 0;
    async function enviar() {
      if (!lote.length) return;
      var b = db.batch(), marcas = {};
      lote.forEach(function (g) { g.fn(b); g.cols.forEach(function (c) { marcas[c] = ts(); }); });
      b.set(db.doc('meta/cambios'), marcas, { merge: true });
      await run(function () { return b.commit(); }, 60000);
      lote = []; n = 0; a = 0;
    }
    for (var i = 0; i < grupos.length; i++) {
      var g = grupos[i];
      if (lote.length && (n + g.n > 400 || a + g.a > 12)) await enviar();
      lote.push(g); n += g.n; a += g.a;
    }
    await enviar();
    Object.keys(cacheFotos).forEach(function (k) { delete cacheFotos[k]; });
    return grupos.map(function (g) { return g.id; });
  }
  async function confirmar(ops) {
    var salida = await ejecutar(ops);
    // Se trae del servidor lo recién escrito (hora oficial del servidor)
    await FL.Datos.sincronizar(true);
    return salida;
  }

  // Retira de la copia local lo que el Administrador eliminó (desde cualquier equipo)
  async function aplicarEliminados(m) {
    var me = m.eliminados || 0;
    var ce = (await FL.Store.get('c:_eliminados')) || { cursor: null };
    if (ce.cursor != null && me <= ce.cursor) return false;
    var conductor = cuenta && cuenta.rol === 'Conductor';
    var habiaCopia = false;
    for (var i = 0; i < FL.COLECCIONES.length; i++) if ((await copia(FL.COLECCIONES[i])).cursor != null) habiaCopia = true;
    if (ce.cursor == null && !habiaCopia) { ce.cursor = me; await FL.Store.set('c:_eliminados', ce); return false; }
    var desde = Math.max(0, (ce.cursor || 0) - SOLAPE);
    var snap;
    try {
      snap = await run(function () {
        return conductor ? db.collection('eliminados').where('publico', '==', true).get({ source: 'server' })
          : db.collection('eliminados').where('_mod', '>', firebase.firestore.Timestamp.fromMillis(desde)).get({ source: 'server' });
      }, 60000);
    } catch (e) {
      if (e.sinPermiso) return false;   // reglas del servidor aún sin publicar: la sincronización sigue normal
      throw e;
    }
    var cambio = false, tocadas = {};
    for (var k = 0; k < snap.docs.length; k++) {
      var x = snap.docs[k].data();
      if (!x.col || FL.COLECCIONES.indexOf(x.col) < 0) continue;
      var c = await copia(x.col), r = c.docs[x.docId];
      // Solo se retira la misma "versión" eliminada (no un registro creado después con el mismo identificador)
      if (r && (!r._creado || r._creado === x.creado)) { delete c.docs[x.docId]; cambio = true; tocadas[x.col] = 1; }
    }
    for (var col in tocadas) await FL.Store.set('c:' + col, cache[col]);
    ce.cursor = me;
    await FL.Store.set('c:_eliminados', ce);
    return cambio;
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
    yo: function () { return cuenta ? { uid: usuarioAuth.uid, usuario: cuenta.usuario, nombre: cuenta.nombre, rol: cuenta.rol, cedula: cuenta.cedula || '', temporal: !!cuenta.temporalHasta } : null; },
    esAdmin: function () { return !!cuenta && cuenta.rol === 'Administrador'; },
    esConductor: function () { return !!cuenta && cuenta.rol === 'Conductor'; },
    // Puede registrar tanqueos y uso diario (el Conductor, solo los propios)
    puedeIngresar: function () { return !!cuenta && (cuenta.rol === 'Administrador' || cuenta.rol === 'Analista' || cuenta.rol === 'Conductor'); },

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
      usuarioAuth = null; cuenta = null; cache = {}; marcador = null; cacheFotos = {};
      await FL.Store.limpiar();
    },

    // ---------- Lectura ----------
    // Trae solo lo modificado desde la última consulta (1 lectura si nada cambió)
    sincronizar: async function () {
      var m = await leerMarcador();
      var hubo = await aplicarEliminados(m);
      var conductor = cuenta && cuenta.rol === 'Conductor';
      for (var i = 0; i < FL.COLECCIONES.length; i++) {
        var col = FL.COLECCIONES[i], c = await copia(col), mk = m[col] || 0;
        if (c.cursor != null && mk <= c.cursor) continue;
        if (conductor && (col === 'asignaciones' || col === 'mantenimientos')) { c.cursor = mk; continue; }   // no las consulta
        if (conductor && (col === 'personas' || col === 'tanqueos' || col === 'recorridos')) {
          // El Conductor solo lee sus propios registros (las reglas del servidor no le permiten más)
          var ced = cuenta.cedula || '-';
          var sn = await run(function () { return db.collection(col).where('cedula', '==', ced).get({ source: 'server' }); }, 60000);
          c.docs = {};
          sn.forEach(function (dd) { c.docs[dd.id] = normDoc(dd); });
          c.cursor = mk;
          await FL.Store.set('c:' + col, c);
          hubo = true;
          continue;
        }
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
    // Aviso enviado o preparado (correo, WhatsApp) sobre un registro
    registrarNotificacion: async function (ref, canal, destino, detalle) {
      try {
        await run(function () {
          return db.collection('auditoria').add({ ref: ref, coleccion: ref.split('/')[0], docId: ref.split('/')[1] || '', accion: 'Notificación', resumen: (canal + ' a ' + destino + (detalle ? ' — ' + detalle : '')).slice(0, 500), cambios: '', usuario: cuenta.usuario, nombre: cuenta.nombre || '', rol: cuenta.rol, _creado: ts(), _creadoPor: usuarioAuth.uid });
        });
      } catch (e) { /* el aviso no se bloquea por la bitácora */ }
    },
    // Último kilometraje conocido del vehículo (para quien no ve todo el historial). No bloquea el registro si falla.
    actualizarOdometro: async function (placa, km, fecha) {
      var v = D.uno('vehiculos', placa);
      if (!v || typeof km !== 'number' || km <= (v.odometroUltimo || 0)) return;
      try { await confirmar([{ tipo: 'modificar', col: 'vehiculos', id: placa, data: { odometroUltimo: km, odometroFecha: fecha || new Date().toISOString() }, resumen: 'Último kilometraje ' + placa + ': ' + km }]); }
      catch (e) { /* reglas anteriores o sin conexión: el registro principal ya quedó */ }
    },
    auditoria: async function (limite) {
      var s = await run(function () { return db.collection('auditoria').orderBy('_creado', 'desc').limit(limite || 2000).get({ source: 'server' }); }, 60000);
      var out = []; s.forEach(function (d) { out.push(normDoc(d)); });
      return out;
    },

    // ---------- Fotografías (se consultan por demanda) ----------
    fotos: async function (ref, forzar) {
      if (!forzar && cacheFotos[ref]) return cacheFotos[ref].slice();
      var q = db.collection('fotos').where('ref', '==', ref);
      if (cuenta && cuenta.rol === 'Conductor') q = q.where('_creadoPor', '==', usuarioAuth.uid);
      var s = await run(function () { return q.get({ source: 'server' }); }, 60000);
      var out = []; s.forEach(function (d) { out.push(normDoc(d)); });
      out.sort(function (a, b) { return (a._creado || 0) - (b._creado || 0); });
      cacheFotos[ref] = out;
      return out.slice();
    },
    // Última fotografía de cada tipo (por ejemplo, de cada ángulo del vehículo)
    ultimasPorTipo: async function (ref) {
      var o = {};
      (await D.fotos(ref)).forEach(function (f) { if (D.esImagen(f)) o[f.tipo] = f; });
      return o;
    },
    esImagen: function (f) { return !!(f && typeof f.data === 'string' && f.data.indexOf('data:image/') === 0); },
    // Documentos (PDF, Word, Excel…) hasta 8 MB: se guardan por partes en la base de datos
    subirArchivo: async function (ref, file, tipo, descripcion) {
      var MAX = 8 * 1024 * 1024, TAM = 700000;
      if (file.size > MAX) throw err('«' + file.name + '» pesa ' + U.n(file.size / 1048576, 1) + ' MB; el máximo es 8 MB. Redúzcalo o divídalo.');
      var buf = await file.arrayBuffer();
      var huella = await U.sha256(new Blob([buf]));
      var bytes = new Uint8Array(buf), bin = '';
      for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      var b64 = btoa(bin), partes = Math.max(1, Math.ceil(b64.length / TAM));
      var f = db.collection('fotos').doc(), aud = db.collection('auditoria').doc(), b = db.batch();
      b.set(f, { ref: ref, tipo: tipo || 'Documento', descripcion: descripcion || '', nombre: String(file.name || 'archivo').slice(0, 200), mime: file.type || 'application/octet-stream',
        bytes: file.size, sha256: huella, data: '', partes: partes, completo: false, _creado: ts(), _creadoPor: usuarioAuth.uid, _creadoPorUsuario: cuenta.usuario });
      b.set(aud, asiento('fotos/' + f.id, 'fotos', f.id, 'Creación', (tipo || 'Documento') + ' «' + file.name + '» de ' + ref + (descripcion ? ' — ' + descripcion : ''), huella));
      await run(function () { return b.commit(); }, 60000);
      for (var p = 0; p < partes; p++) {
        var trozo = b64.slice(p * TAM, (p + 1) * TAM), n = p;
        await run(function () { return db.doc('fotos/' + f.id + '/partes/' + n).set({ i: n, data: trozo }); }, 120000);
      }
      await run(function () { return db.doc('fotos/' + f.id).update({ completo: true }); });
      delete cacheFotos[ref];
      return f.id;
    },
    // Contenido del archivo como Blob (imágenes o documentos por partes)
    contenidoArchivo: async function (f) {
      var tipo, b64;
      if (D.esImagen(f)) { tipo = f.data.slice(5, f.data.indexOf(';')); b64 = f.data.slice(f.data.indexOf(',') + 1); }
      else {
        var s = await run(function () { return db.collection('fotos').doc(f.id).collection('partes').get({ source: 'server' }); }, 120000);
        var partes = []; s.forEach(function (d) { partes.push(d.data()); });
        if (partes.length !== (Number(f.partes) || 0)) throw err('El archivo está incompleto (la carga no terminó). Elimínelo y cárguelo de nuevo.');
        partes.sort(function (a, b) { return a.i - b.i; });
        b64 = partes.map(function (p) { return p.data; }).join(''); tipo = f.mime || 'application/octet-stream';
      }
      var bin = atob(b64), arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: tipo });
    },
    editarArchivo: async function (f, datos) {
      var cambios = {};
      Object.keys(datos).forEach(function (k) { if ((f[k] || '') !== (datos[k] || '')) cambios[k] = [f[k] || '', datos[k] || '']; });
      if (!Object.keys(cambios).length) return;
      await ejecutar([{ tipo: 'foto-modificar', foto: f, data: datos, cambios: cambios, resumen: 'Archivo de ' + f.ref + ' (' + (f.nombre || f.tipo) + ')' }]);
    },
    eliminarArchivo: async function (f, motivo) {
      await ejecutar([{ tipo: 'eliminar', col: 'fotos', id: f.id, registro: f, motivo: motivo, resumen: (f.tipo || 'Archivo') + (f.nombre ? ' «' + f.nombre + '»' : '') + ' de ' + f.ref }]);
    },
    // Eliminación definitiva de un registro y de sus archivos (copia completa en la bitácora)
    eliminar: async function (col, id, motivo, resumen) {
      var r = D.uno(col, id);
      if (!r) throw err('El registro ya no existe.');
      var adj = await D.fotos(col + '/' + id, true), ops = [];
      adj.forEach(function (f) { ops.push({ tipo: 'eliminar', col: 'fotos', id: f.id, registro: f, motivo: 'Eliminación del registro ' + col + '/' + id + ': ' + motivo, resumen: (f.tipo || 'Archivo') + ' de ' + f.ref }); });
      ops.push({ tipo: 'eliminar', col: col, id: id, registro: r, motivo: motivo, resumen: resumen });
      await confirmar(ops);
    },
    // Corrige la cédula de una persona o la placa de un vehículo y traslada todo lo relacionado
    cambiarId: async function (col, viejo, nuevo) {
      var campo = col === 'personas' ? 'cedula' : 'placa';
      var r = D.uno(col, viejo);
      if (!r) throw err('El registro no existe.');
      if (!nuevo || nuevo === viejo) throw err('Escriba un valor distinto.');
      if (D.uno(col, nuevo)) throw err('Ya existe un registro con ' + (campo === 'cedula' ? 'la cédula ' : 'la placa ') + nuevo + '.');
      var nota = 'Corrección de ' + (campo === 'cedula' ? 'cédula' : 'placa') + ' ' + viejo + ' → ' + nuevo;
      var datos = {};
      Object.keys(r).forEach(function (k) { if (k !== 'id' && k[0] !== '_') datos[k] = r[k]; });
      datos[campo] = nuevo;
      var ops = [{ tipo: 'crear', col: col, id: nuevo, data: datos, resumen: nota, accion: 'Corrección de identificador' }];
      var rel = col === 'personas'
        ? [['tanqueos', 'cedula'], ['recorridos', 'cedula'], ['mantenimientos', 'cedula'], ['vehiculos', 'responsableCedula'], ['asignaciones', 'cedula']]
        : [['tanqueos', 'placa'], ['recorridos', 'placa'], ['mantenimientos', 'placa'], ['documentos', 'placa'], ['asignaciones', 'placa']];
      rel.forEach(function (x) {
        D.lista(x[0]).filter(function (y) { return y[x[1]] === viejo; }).forEach(function (y) {
          var o = {}; o[x[1]] = nuevo;
          if (col === 'vehiculos' && y.vehiculoDesc) o.vehiculoDesc = String(y.vehiculoDesc).replace(viejo, nuevo);
          var cmb = {}; cmb[x[1]] = [viejo, nuevo];
          ops.push({ tipo: 'modificar', col: x[0], id: y.id, data: o, resumen: nota, cambios: cmb, accion: 'Corrección de identificador' });
        });
      });
      (await D.fotos(col + '/' + viejo, true)).forEach(function (f) {
        ops.push({ tipo: 'foto-modificar', foto: f, data: { ref: col + '/' + nuevo }, cambios: { ref: [f.ref, col + '/' + nuevo] }, resumen: nota });
      });
      if (col === 'personas') {
        (await D.usuarios()).filter(function (u) { return u.cedula === viejo; }).forEach(function (u) {
          ops.push({ tipo: 'directo', id: u.usuario, n: 3, cols: [], fn: function (b) {
            b.update(db.doc('usuarios/' + u.usuario), Object.assign({ cedula: nuevo }, selloMod()));
            if (u.uid) b.update(db.doc('cuentas/' + u.uid), { cedula: nuevo, _mod: ts() });
            b.set(db.collection('auditoria').doc(), asiento('usuarios/' + u.usuario, 'usuarios', u.usuario, 'Corrección de identificador', nota, JSON.stringify({ cedula: [viejo, nuevo] })));
          } });
        });
      }
      ops.push({ tipo: 'eliminar', col: col, id: viejo, registro: r, motivo: nota, resumen: nota });
      await confirmar(ops);
    },
    subirFoto: async function (ref, dataUrl, tipo, descripcion) {
      if (dataUrl.length > 880000) throw err('La fotografía es demasiado pesada incluso reducida. Use una de menor resolución.');
      var huella = await U.sha256(dataUrl);
      var f = db.collection('fotos').doc(), aud = db.collection('auditoria').doc(), b = db.batch();
      b.set(f, { ref: ref, tipo: tipo || 'Fotografía', descripcion: descripcion || '', data: dataUrl, bytes: dataUrl.length, sha256: huella, _creado: ts(), _creadoPor: usuarioAuth.uid, _creadoPorUsuario: cuenta.usuario });
      b.set(aud, { ref: 'fotos/' + f.id, coleccion: 'fotos', docId: f.id, accion: 'Creación', resumen: (tipo || 'Fotografía') + ' de ' + ref + (descripcion ? ' — ' + descripcion : ''), cambios: huella, usuario: cuenta.usuario, nombre: cuenta.nombre || '', rol: cuenta.rol, _creado: ts(), _creadoPor: usuarioAuth.uid });
      await run(function () { return b.commit(); }, 90000);
      delete cacheFotos[ref];
      return f.id;
    },
    borrarFoto: async function (foto, motivo) { return D.eliminarArchivo(foto, motivo); },

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
      if (actual.uid) b.update(db.doc('cuentas/' + actual.uid), { rol: datos.rol, nombre: datos.nombre, cedula: U.normCedula(datos.cedula), _mod: ts() });
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
    }
  });

  async function cargarSesion() {
    var cs = await run(function () { return db.doc('cuentas/' + usuarioAuth.uid).get({ source: 'server' }); });
    if (!cs.exists) throw err('Este usuario no está habilitado en la aplicación.');
    var c = cs.data();
    if (c.activo !== true) throw err('Su usuario está de baja o su contraseña fue restablecida. Comuníquese con el Director de Seguridad Integral.');
    if (c.temporalHasta && millis(c.temporalHasta) < Date.now()) throw err('Su contraseña temporal venció. Solicite al Director de Seguridad Integral que la restablezca.');
    cuenta = { usuario: c.usuario, nombre: c.nombre || c.usuario, rol: c.rol, cedula: c.cedula || '', activo: true, temporalHasta: c.temporalHasta ? millis(c.temporalHasta) : null };
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
    b.set(db.doc('cuentas/' + ident.uid), { usuario: u, nombre: datos.nombre, rol: datos.rol, cedula: U.normCedula(datos.cedula), activo: true, temporalHasta: vence, _mod: ts() });
    if (uidAnterior && uidAnterior !== ident.uid) b.set(db.doc('cuentas/' + uidAnterior), { activo: false, reemplazadaPor: ident.uid, _mod: ts() }, { merge: true });
    b.set(db.doc('login/' + u), { email: emailDe(u, ident.version), _mod: ts() });
    b.set(aud, { ref: 'usuarios/' + u, coleccion: 'usuarios', docId: u, accion: accion, resumen: u + ' — ' + datos.nombre + ' — rol ' + datos.rol, cambios: '', usuario: cuenta.usuario, nombre: cuenta.nombre || '', rol: cuenta.rol, _creado: ts(), _creadoPor: usuarioAuth.uid });
    await run(function () { return b.commit(); });
  }
})();
