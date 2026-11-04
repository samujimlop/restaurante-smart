// Configuración web de Firebase.
// Estos valores identifican el proyecto y son públicos por diseño: la seguridad
// la aplican Firebase Authentication y las reglas de Firestore (firestore.rules).
// Aquí NO debe ir nunca una clave privada (Gemini, Admin SDK, etc.).
export const firebaseConfig = {
  apiKey: 'AIzaSyCIwKNwi6e9zq6bYzM7GVP4758Wpxo_E6Y',
  authDomain: 'restaurante-smart-c1de7.firebaseapp.com',
  projectId: 'restaurante-smart-c1de7',
  storageBucket: 'restaurante-smart-c1de7.firebasestorage.app',
  messagingSenderId: '488925030901',
  appId: '1:488925030901:web:5536f4868320eacfc7d8bc',
  measurementId: 'G-G47E9HQK7V',
};

// Cada empleado inicia sesión con "usuario + PIN". Internamente se traduce a una
// cuenta de Firebase Auth con este dominio (el correo nunca se usa para enviar nada).
export const DOMINIO_EMPLEADOS = `${firebaseConfig.projectId}.web.app`;

// Clave de sitio de reCAPTCHA v3 para Firebase App Check (pública por diseño).
// App Check garantiza que solo esta web pueda consumir la cuota de Gemini.
export const RECAPTCHA_SITE_KEY = '6Lf74w8uAAAAABCA-6Jgpxl9juh1vyutvQpv1rMQ';
