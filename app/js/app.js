/* Arranque, sesión, menú por rol y navegación. */
(function () {
  'use strict';
  var FL = (window.FL = window.FL || {});
  var U = FL.U, h = U.h, UI = FL.UI;
  var raiz, principal, yo = null, param = {}, rutas = {}, ultimaSync = 0, sincronizando = false;
  FL.CFG = window.FLOTA_CONFIG || {};
  FL.VERSION = 'Versión 1 · 27/10/2026';

  var App = (FL.App = {
    datos: function () {
      var o = {};
      FL.COLECCIONES.forEach(function (c) { o[c] = FL.Datos.lista(c); });
      return o;
    },
    param: function () { return param; },
    yo: function () { return yo; },
    ruta: function (patron, fn, roles) { rutas[patron] = { fn: fn, roles: roles }; },
    ir: function (r) { if (location.hash === '#' + r) render(); else location.hash = r; },
    refrescar: function () { render(); },
    recargarParametros: async function () { param = await FL.Datos.parametros(); }
  });

  // ---------- Menú por rol ----------
  var A = 'Administrador', N = 'Analista', G = 'Gobierno Corporativo';
  var MENU = [
    { r: '/tablero', l: 'Tablero', i: '◧', roles: [A, N, G] },
    { sep: 'Registrar', roles: [A, N] },
    { r: '/registrar/tanqueo', l: 'Tanqueo', i: '⛽', roles: [A, N] },
    { r: '/registrar/uso', l: 'Uso diario (recibe / entrega)', i: '⇄', roles: [A, N] },
    { r: '/registrar/mantenimiento', l: 'Mantenimiento o arreglo', i: '🔧', roles: [A, N] },
    { r: '/registrar/documento', l: 'Documento (SOAT, RTM, póliza)', i: '📄', roles: [A, N] },
    { sep: 'Consultar', roles: [A, N, G] },
    { r: '/vehiculos', l: 'Vehículos y hojas de vida', i: '🚙', roles: [A, N, G] },
    { r: '/tanqueos', l: 'Combustible y rendimiento', i: '⛽', roles: [A, N, G] },
    { r: '/uso', l: 'Uso diario', i: '⇄', roles: [A, N, G] },
    { r: '/mantenimientos', l: 'Mantenimientos', i: '🔧', roles: [A, N, G] },
    { r: '/documentos', l: 'Documentos y vigencias', i: '📄', roles: [A, N, G] },
    { r: '/reportes', l: 'Costos y reportes', i: '▤', roles: [A, N, G] },
    { sep: 'Configuración', roles: [A, N, G] },
    { r: '/personas', l: 'Personas vinculadas', i: '👤', roles: [A, N, G] },
    { r: '/centros', l: 'Razones sociales y centros de costo', i: '🏷', roles: [A, N, G] },
    { r: '/picoyplaca', l: 'Pico y placa', i: '⊘', roles: [A, N, G] },
    { r: '/usuarios', l: 'Usuarios', i: '🔑', roles: [A] },
    { r: '/parametros', l: 'Parámetros de alertas', i: '⚙', roles: [A] },
    { r: '/auditoria', l: 'Bitácora de auditoría', i: '🛡', roles: [A, G] },
    { r: '/ayuda', l: 'Manual de uso', i: '?', roles: [A, N, G] }
  ];

  // ---------- Arranque ----------
  async function iniciar() {
    raiz = document.getElementById('app');
    var tema = null; try { tema = localStorage.getItem('fl-tema'); } catch (e) { /* sin almacenamiento */ }
    if (tema) document.documentElement.setAttribute('data-theme', tema);
    raiz.appendChild(h('div', { class: 'pantalla-centro' }, h('div', { class: 'giro' })));
    try { yo = await FL.Datos.init(FL.CFG); }
    catch (e) { return pantallaError(e); }
    if (!yo) return pantallaIngreso();
    await entrar();
  }
  function pantallaError(e) {
    U.clear(raiz).appendChild(h('div', { class: 'pantalla-centro' }, h('div', { class: 'tarjeta acceso' },
      h('img', { src: 'img/logo-informe.png', alt: 'Avo Pak', class: 'logo-acceso' }),
      h('h1', null, 'No fue posible iniciar'), h('p', null, e.message || String(e)),
      e.config ? h('p', { class: 'muted small' }, 'Siga el paso 4 de LEEME.txt (registrar la app web en Firebase y pegar el bloque en config.js).') : null)));
  }

  async function entrar() {
    if (yo.temporal) return pantallaCambioClave(true);
    var listo = UI.cargando('Cargando datos…');
    try {
      await FL.Datos.cargarCopia();
      param = await FL.Datos.parametros();
      await FL.Datos.sincronizar();
      ultimaSync = Date.now();
    } catch (e) {
      UI.toast('No se pudo actualizar con el servidor: ' + e.message + ' Se muestra la última copia disponible.', 'error');
    } finally { listo(); }
    armarMarco();
    window.addEventListener('hashchange', render);
    if (!location.hash || location.hash === '#/') location.hash = '/tablero'; else render();
    setInterval(function () { if (document.visibilityState === 'visible' && Date.now() - ultimaSync > 180000) sincronizar(false); }, 30000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && Date.now() - ultimaSync > 60000) sincronizar(false); });
  }

  async function sincronizar(manual) {
    if (sincronizando) return;
    sincronizando = true;
    var ind = document.getElementById('sync-estado');
    if (ind) ind.textContent = 'Actualizando…';
    try {
      var hubo = await FL.Datos.sincronizar();
      if (manual) param = await FL.Datos.parametros();
      ultimaSync = Date.now();
      if (hubo || manual) render();
      if (manual) UI.toast('Datos actualizados.', 'ok');
    } catch (e) {
      if (manual) UI.toast(e.message, 'error');
    } finally {
      sincronizando = false;
      if (ind) ind.textContent = 'Actualizado ' + U.fFechaHora(ultimaSync).slice(11);
    }
  }
  App.sincronizar = sincronizar;

  // ---------- Pantallas de acceso ----------
  function pantallaIngreso() {
    var u = h('input', { class: 'campo-input', id: 'login-usuario', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false' });
    var c = h('input', { class: 'campo-input', id: 'login-clave', type: 'password', autocomplete: 'current-password' });
    var err = h('p', { class: 'txt-error', role: 'alert' });
    var btn = h('button', { class: 'btn primario ancho', type: 'submit' }, 'Ingresar');
    var form = h('form', { class: 'pila', onsubmit: async function (e) {
      e.preventDefault(); err.textContent = ''; btn.disabled = true;
      try { yo = await FL.Datos.ingresar(u.value, c.value); await entrar(); }
      catch (x) { err.textContent = x.message; btn.disabled = false; }
    } },
      h('label', { class: 'campo' }, h('span', { class: 'campo-l' }, 'Usuario'), u),
      h('label', { class: 'campo' }, h('span', { class: 'campo-l' }, 'Contraseña'), c),
      err, btn);
    U.clear(raiz).appendChild(h('div', { class: 'pantalla-centro' }, h('div', { class: 'tarjeta acceso' },
      h('img', { src: 'img/logo-informe.png', alt: 'Avo Pak', class: 'logo-acceso' }),
      h('h1', null, 'Control de Flota y Combustible'),
      h('p', { class: 'muted' }, (FL.CFG.empresa || 'Avo Pak S.A.S.') + ' · Dirección de Seguridad Integral'),
      form,
      h('p', { class: 'muted small' }, 'Uso exclusivo del personal autorizado. Las actuaciones quedan registradas con usuario, fecha y hora.'),
      h('p', { class: 'muted small' }, FL.VERSION),
      h('button', { class: 'enlace small', type: 'button', onclick: pantallaInstalacion }, 'Instalación inicial (solo la primera vez)'))));
    setTimeout(function () { u.focus(); }, 50);
  }

  function pantallaInstalacion() {
    var campos = {
      codigo: h('input', { class: 'campo-input', autocapitalize: 'characters' }),
      nombre: h('input', { class: 'campo-input', value: '' }),
      cedula: h('input', { class: 'campo-input', inputmode: 'numeric' }),
      usuario: h('input', { class: 'campo-input', autocapitalize: 'none' }),
      clave: h('input', { class: 'campo-input', type: 'password', autocomplete: 'new-password' }),
      clave2: h('input', { class: 'campo-input', type: 'password', autocomplete: 'new-password' })
    };
    var err = h('p', { class: 'txt-error', role: 'alert' });
    var btn = h('button', { class: 'btn primario ancho', type: 'submit' }, 'Instalar y crear Administrador');
    function f(l, k, ayuda) { return h('label', { class: 'campo' }, h('span', { class: 'campo-l' }, l), campos[k], ayuda ? h('span', { class: 'campo-ayuda' }, ayuda) : null); }
    U.clear(raiz).appendChild(h('div', { class: 'pantalla-centro' }, h('div', { class: 'tarjeta acceso' },
      h('h1', null, 'Instalación inicial'),
      h('p', { class: 'muted small' }, 'Se hace una sola vez. Crea el usuario Administrador (Director de Seguridad Integral).'),
      h('form', { class: 'pila', onsubmit: async function (e) {
        e.preventDefault(); err.textContent = '';
        var msg = FL.Vistas.reglaClave(campos.clave.value, campos.usuario.value);
        if (!campos.codigo.value.trim()) msg = 'Escriba el código de instalación (está en LEEME.txt).';
        else if (!campos.nombre.value.trim()) msg = 'Escriba su nombre completo.';
        else if (campos.clave.value !== campos.clave2.value) msg = 'Las contraseñas no coinciden.';
        if (msg) { err.textContent = msg; return; }
        btn.disabled = true;
        try {
          yo = await FL.Datos.instalar({ codigo: campos.codigo.value, nombre: campos.nombre.value.trim(), cedula: campos.cedula.value, usuario: campos.usuario.value, clave: campos.clave.value });
          UI.toast('Instalación completada.', 'ok');
          await entrar();
        } catch (x) { err.textContent = x.message; btn.disabled = false; }
      } },
        f('Código de instalación', 'codigo', 'Aparece en LEEME.txt y en el archivo de reglas.'),
        f('Nombre completo', 'nombre'), f('Cédula', 'cedula'),
        f('Usuario', 'usuario', 'Sin espacios ni tildes. Ejemplo: dmazo'),
        f('Contraseña', 'clave', 'Mínimo 10 caracteres, con letras y números.'), f('Repita la contraseña', 'clave2'),
        err, btn),
      h('button', { class: 'enlace small', type: 'button', onclick: pantallaIngreso }, '← Volver al ingreso'))));
  }

  function pantallaCambioClave(obligatorio) {
    var c1 = h('input', { class: 'campo-input', type: 'password', autocomplete: 'new-password' });
    var c2 = h('input', { class: 'campo-input', type: 'password', autocomplete: 'new-password' });
    var err = h('p', { class: 'txt-error', role: 'alert' });
    var btn = h('button', { class: 'btn primario ancho', type: 'submit' }, 'Guardar mi contraseña');
    U.clear(raiz).appendChild(h('div', { class: 'pantalla-centro' }, h('div', { class: 'tarjeta acceso' },
      h('h1', null, obligatorio ? 'Defina su contraseña personal' : 'Cambiar contraseña'),
      h('p', { class: 'muted small' }, 'Su contraseña es personal e intransferible. Nadie más debe conocerla, ni siquiera el Administrador.'),
      h('form', { class: 'pila', onsubmit: async function (e) {
        e.preventDefault(); err.textContent = '';
        var msg = FL.Vistas.reglaClave(c1.value, yo.usuario);
        if (!msg && c1.value !== c2.value) msg = 'Las contraseñas no coinciden.';
        if (msg) { err.textContent = msg; return; }
        btn.disabled = true;
        try { await FL.Datos.cambiarClave(c1.value); yo.temporal = false; UI.toast('Contraseña actualizada.', 'ok'); if (obligatorio) await entrar(); else { armarMarco(); render(); } }
        catch (x) { err.textContent = x.message; btn.disabled = false; }
      } },
        h('label', { class: 'campo' }, h('span', { class: 'campo-l' }, 'Nueva contraseña'), c1, h('span', { class: 'campo-ayuda' }, 'Mínimo 10 caracteres, con letras y números.')),
        h('label', { class: 'campo' }, h('span', { class: 'campo-l' }, 'Repita la contraseña'), c2),
        err, btn),
      h('button', { class: 'enlace small', type: 'button', onclick: salir }, 'Cerrar sesión'))));
  }
  App.cambiarClave = function () { pantallaCambioClave(false); };

  async function salir() {
    await FL.Datos.salir();
    yo = null;
    location.hash = '';
    location.reload();
  }

  // ---------- Marco de la aplicación ----------
  function armarMarco() {
    var nav = h('nav', { class: 'menu', 'aria-label': 'Menú principal' });
    MENU.forEach(function (m) {
      if (m.roles.indexOf(yo.rol) < 0) return;
      if (m.sep) { nav.appendChild(h('div', { class: 'menu-sep' }, m.sep)); return; }
      nav.appendChild(h('a', { href: '#' + m.r, class: 'menu-item', 'data-r': m.r, onclick: function () { document.body.classList.remove('menu-abierto'); } }, h('span', { class: 'menu-i', 'aria-hidden': 'true' }, m.i), m.l));
    });
    principal = h('main', { class: 'principal', id: 'principal', tabindex: '-1' });
    var lateral = h('aside', { class: 'lateral' },
      h('div', { class: 'marca' }, h('img', { src: 'img/logo-avo.png', alt: '' }), h('div', null, h('strong', null, 'Flota y Combustible'), h('span', null, FL.CFG.empresa || 'Avo Pak S.A.S.'))),
      nav,
      h('div', { class: 'lateral-pie' },
        h('div', { class: 'quien' }, h('strong', null, yo.nombre), h('span', null, yo.rol + ' · ' + yo.usuario), h('span', { class: 'block' }, FL.VERSION)),
        h('div', { class: 'fila gap wrap' },
          h('button', { class: 'btn sm oscuro', type: 'button', onclick: App.cambiarClave }, 'Contraseña'),
          h('button', { class: 'btn sm oscuro', type: 'button', onclick: function () { alternarTema(); } }, 'Tema'),
          h('button', { class: 'btn sm oscuro', type: 'button', onclick: salir }, 'Salir'))));
    var barra = h('header', { class: 'barra' },
      h('button', { class: 'btn-icono menu-btn', type: 'button', 'aria-label': 'Abrir menú', onclick: function () { document.body.classList.toggle('menu-abierto'); } }, '☰'),
      h('span', { class: 'barra-t', id: 'barra-titulo' }, ''),
      h('span', { class: 'flex1' }),
      h('span', { class: 'muted small sync', id: 'sync-estado' }, 'Actualizado ' + U.fFechaHora(ultimaSync || Date.now()).slice(11)),
      h('button', { class: 'btn sm', type: 'button', onclick: function () { sincronizar(true); } }, '↻ Actualizar'));
    U.clear(raiz).appendChild(h('div', { class: 'marco' }, lateral, h('div', { class: 'contenido' }, barra, principal), h('div', { class: 'velo', onclick: function () { document.body.classList.remove('menu-abierto'); } })));
  }
  function alternarTema() {
    var act = document.documentElement.getAttribute('data-theme');
    var oscuro = act ? act === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    var nuevo = oscuro ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nuevo);
    try { localStorage.setItem('fl-tema', nuevo); } catch (e) { /* sin almacenamiento */ }
  }

  function render() {
    if (!yo || !principal) return;
    var hash = location.hash.replace(/^#/, '') || '/tablero';
    var partes = hash.split('/').filter(Boolean);
    var clave = '/' + partes[0] + (partes[0] === 'registrar' && partes[1] ? '/' + partes[1] : '');
    var arg = partes[0] === 'registrar' ? partes.slice(2) : partes.slice(1);
    var r = rutas[clave] || rutas['/tablero'];
    Array.from(document.querySelectorAll('.menu-item')).forEach(function (a) { a.classList.toggle('activo', a.getAttribute('data-r') === clave || (clave === '/vehiculo' && a.getAttribute('data-r') === '/vehiculos')); });
    U.clear(principal);
    if (r.roles && r.roles.indexOf(yo.rol) < 0) { principal.appendChild(UI.seccion('Sin acceso', h('p', null, 'Su rol (' + yo.rol + ') no tiene acceso a esta sección.'))); return; }
    try { r.fn(principal, arg.map(decodeURIComponent)); }
    catch (e) { console.error(e); principal.appendChild(UI.seccion('Error', h('p', { class: 'txt-error' }, e.message || String(e)))); }
    var t = principal.querySelector('h1');
    var bt = document.getElementById('barra-titulo'); if (bt) bt.textContent = t ? t.textContent : '';
    principal.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
