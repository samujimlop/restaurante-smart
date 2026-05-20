import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';

const firebaseConfig = {
apiKey: "AIzaSyCIwKNwi6e9zq6bYzM7GVP4758Wpxo_E6Y",
authDomain: "restaurante-smart-c1de7.firebaseapp.com",
projectId: "restaurante-smart-c1de7",
storageBucket: "restaurante-smart-c1de7.firebasestorage.app",
messagingSenderId: "488925030901",
appId: "1:488925030901:web:5536f4868320eacfc7d8bc",
measurementId: "G-G47E9HQK7V"
};

export const appConfig: ApplicationConfig = {
providers: [
provideRouter(routes),
provideFirebaseApp(() => initializeApp(firebaseConfig)),
provideFirestore(() => getFirestore())
]
};