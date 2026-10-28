/*
 * ============================================================================
 *  AVO PAK S.A.S. — Control de Flota y Combustible
 *  Archivo de configuración. Es el ÚNICO archivo que debe editarse.
 * ============================================================================
 */

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCEh5a4LW6O2BhiPve2eEj9yW1OKTk_lzw",
  authDomain: "avopak-flota.firebaseapp.com",
  projectId: "avopak-flota",
  storageBucket: "avopak-flota.firebasestorage.app",
  messagingSenderId: "401043787827",
  appId: "1:401043787827:web:994e5610d76dc5f5fdd346"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
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
