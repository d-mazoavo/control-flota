/*
 * Avisos de cada tanqueo a la persona que tanqueó: correo electrónico y WhatsApp.
 * - Correo automático: por medio de EmailJS (servicio externo; se configura en Parámetros).
 *   Sin EmailJS, se abre el programa de correo del equipo con el mensaje listo.
 * - WhatsApp: se abre WhatsApp con el número y el mensaje listos; quien registra oprime "Enviar".
 * Cada aviso queda en la bitácora de auditoría.
 */
(function () {
  'use strict';
  var FL = (window.FL = window.FL || {});
  var U = FL.U, h = U.h;
  var N = (FL.Notif = {});

  N.celular = function (tel) {
    var d = U.normCedula(tel);
    if (d.length === 10 && d[0] === '3') return '57' + d;
    if (d.length === 12 && d.slice(0, 3) === '573') return d;
    return null;
  };
  N.correoValido = function (c) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(c || '').trim()); };
  N.emailjsListo = function () { var p = FL.App.param(); return !!(p.emailjsServicio && p.emailjsPlantilla && p.emailjsClave); };

  N.asunto = function (t) { return 'Registro de tanqueo — ' + (t.placa || t.equipo || '') + ' — ' + U.fFecha(t.fecha); };
  N.mensaje = function (t) {
    return [
      (FL.CFG.empresa || 'Avo Pak S.A.S.') + ' — Dirección de Seguridad Integral',
      'Se registró un tanqueo a su nombre:',
      'Fecha y hora: ' + U.fFechaHora(t.fecha),
      t.destino === 'Vehículo'
        ? 'Vehículo: ' + t.placa + (typeof t.odometro === 'number' ? ' · Kilometraje: ' + U.n(t.odometro) + ' km' : '')
        : 'Uso: ' + (t.equipo || '') + (t.justificacion ? ' — ' + t.justificacion : ''),
      'Combustible: ' + (t.combustible || '') + ' · ' + U.n(t.galones, 2) + ' galones a ' + U.cop(t.precioGalon) + ' = ' + U.cop(t.valorTotal),
      'Estación: ' + (t.estacion || '—') + (t.municipio ? ', ' + t.municipio : ''),
      'Centro de costo: ' + (t.centroNombre || ''),
      t.factura ? 'Factura o tirilla: ' + t.factura : null,
      'Registrado por: ' + (t._creadoPorUsuario || ''),
      '',
      'Si usted no reconoce este registro o algún dato no corresponde, informe de inmediato a la Dirección de Seguridad Integral.'
    ].filter(function (x) { return x !== null; }).join('\n');
  };

  N.enviarCorreo = async function (ref, t, p) {
    var cfg = FL.App.param();
    if (navigator.onLine === false) throw new Error('Sin conexión a internet.');
    var r = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: cfg.emailjsServicio, template_id: cfg.emailjsPlantilla, user_id: cfg.emailjsClave,
        template_params: { to_email: String(p.correo).trim(), to_name: p.nombres, subject: N.asunto(t), message: N.mensaje(t), copia: cfg.correoCopia || '', empresa: FL.CFG.empresa || 'Avo Pak S.A.S.' }
      })
    });
    if (!r.ok) { var txt = ''; try { txt = await r.text(); } catch (e) { /* sin detalle */ } throw new Error('El servicio de correo no aceptó el envío' + (txt ? ': ' + txt.slice(0, 160) : '.')); }
    await FL.Datos.registrarNotificacion(ref, 'Correo automático', String(p.correo).trim(), N.asunto(t));
  };
  N.abrirCorreo = function (ref, t, p) {
    location.href = 'mailto:' + encodeURIComponent(String(p.correo).trim()) + '?subject=' + encodeURIComponent(N.asunto(t)) + '&body=' + encodeURIComponent(N.mensaje(t));
    FL.Datos.registrarNotificacion(ref, 'Correo (preparado en el programa de correo)', String(p.correo).trim(), N.asunto(t));
  };
  N.abrirWhatsApp = function (ref, t, p) {
    var num = N.celular(p.telefono);
    window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(N.mensaje(t)), '_blank', 'noopener');
    FL.Datos.registrarNotificacion(ref, 'WhatsApp (preparado)', '+' + num, N.asunto(t));
  };

  // Panel de avisos de un tanqueo. auto: enviar el correo de inmediato si EmailJS está configurado.
  N.panel = function (tanqueoId, auto) {
    var ref = 'tanqueos/' + tanqueoId;
    var t = FL.Datos.uno('tanqueos', tanqueoId);
    var p = t ? FL.Datos.uno('personas', t.cedula) : null;
    var cont = h('div', { class: 'avisos-tanqueo pila sm' });
    if (!t || !p) { cont.appendChild(h('p', { class: 'muted small' }, 'No se encontró el registro o la persona.')); return cont; }
    cont.appendChild(h('p', null, 'Aviso a ', h('strong', null, p.nombres), ' (C. C. ' + p.cedula + ')'));

    var filaCorreo = h('div', { class: 'aviso-canal' });
    var estado = h('span', { class: 'small' });
    if (!N.correoValido(p.correo)) {
      filaCorreo.appendChild(h('span', { class: 'muted small' }, '✉ Sin correo registrado. Regístrelo en Personas para enviarle el aviso.'));
    } else if (N.emailjsListo()) {
      var reintentar = h('button', { class: 'btn xs hidden', type: 'button', onclick: function () { enviar(); } }, 'Reintentar');
      var manual = h('button', { class: 'btn xs hidden', type: 'button', onclick: function () { N.abrirCorreo(ref, t, p); } }, 'Abrir en mi correo');
      var enviarBtn = h('button', { class: 'btn xs', type: 'button', onclick: function () { enviar(); } }, '✉ Enviar correo a ' + p.correo);
      filaCorreo.appendChild(h('div', { class: 'fila gap wrap' }, enviarBtn, estado, reintentar, manual));
      var enviar = async function () {
        enviarBtn.disabled = true; reintentar.classList.add('hidden'); estado.className = 'small muted'; estado.textContent = 'Enviando…';
        try { await N.enviarCorreo(ref, t, p); estado.className = 'small txt-ok'; estado.textContent = '✓ Correo enviado a ' + p.correo; enviarBtn.classList.add('hidden'); }
        catch (e) { estado.className = 'small txt-error'; estado.textContent = '✕ ' + e.message; reintentar.classList.remove('hidden'); manual.classList.remove('hidden'); enviarBtn.disabled = false; }
      };
      if (auto && FL.App.param().correoAutomatico !== false) setTimeout(enviar, 50);
    } else {
      filaCorreo.appendChild(h('div', { class: 'fila gap wrap' },
        h('button', { class: 'btn xs', type: 'button', onclick: function () { N.abrirCorreo(ref, t, p); estado.textContent = 'Se abrió el programa de correo con el mensaje listo: oprima Enviar allí.'; } }, '✉ Enviar correo a ' + p.correo), estado));
    }
    cont.appendChild(filaCorreo);

    var filaWa = h('div', { class: 'aviso-canal' });
    var num = N.celular(p.telefono);
    if (num) {
      var estWa = h('span', { class: 'small muted' });
      filaWa.appendChild(h('div', { class: 'fila gap wrap' }, h('button', { class: 'btn xs whatsapp', type: 'button', onclick: function () { N.abrirWhatsApp(ref, t, p); estWa.textContent = 'Se abrió WhatsApp con el mensaje listo: oprima Enviar allí.'; } }, '💬 Enviar por WhatsApp al ' + String(p.telefono).replace(/\D/g, '').slice(-10)), estWa));
    } else filaWa.appendChild(h('span', { class: 'muted small' }, '💬 Sin celular válido registrado (10 dígitos que empiecen por 3). Regístrelo en Personas para enviarle el aviso.'));
    cont.appendChild(filaWa);
    return cont;
  };
})();
