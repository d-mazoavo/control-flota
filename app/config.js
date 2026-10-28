/*
 * ============================================================================
 *  AVO PAK S.A.S. — Control de Flota y Combustible
 *  Archivo de configuración. Es el ÚNICO archivo que debe editarse.
 * ============================================================================
 */

// ====== PEGUE AQUÍ, reemplazando las 8 líneas siguientes, el bloque que le muestra Firebase ======
const firebaseConfig = {
  apiKey: "PEGAR_AQUI",
  authDomain: "PEGAR_AQUI",
  projectId: "PEGAR_AQUI",
  storageBucket: "PEGAR_AQUI",
  messagingSenderId: "PEGAR_AQUI",
  appId: "PEGAR_AQUI"
};
// ====== FIN DEL BLOQUE DE FIREBASE ======

window.FLOTA_CONFIG = {
  firebase: firebaseConfig,

  // Dominio técnico interno de los usuarios: nadie recibe correos en él. No lo cambie después de crear usuarios.
  dominioUsuarios: 'flota.avo-pak.com',

  empresa: 'Avo Pak S.A.S.',

  // Horas de vigencia de la contraseña temporal que se entrega a cada usuario nuevo o restablecido.
  horasClaveTemporal: 72,

  // Valores iniciales de las alertas (el Administrador los cambia en la aplicación: Configuración › Parámetros de alertas).
  parametros: {
    diasAlerta: 30,
    diasCritico: 7,
    toleranciaRendimiento: 20,
    kmAlertaMantenimiento: 500,
    horasRecorridoAbierto: 24,
    kmBrecha: 5,
    kmMaxDia: 800
  }
};
