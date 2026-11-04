import { Injectable, inject } from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';
import { getAI, getGenerativeModel } from '@angular/fire/ai';

/**
 * Modelos en orden de preferencia. Si uno está saturado o no disponible,
 * se prueba el siguiente. Lista de modelos: https://firebase.google.com/docs/ai-logic/models
 */
const MODELOS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite'];

/** Errores transitorios o de disponibilidad que justifican probar otro modelo. */
const PROBAR_OTRO_MODELO = /\[(404|429|500|503)\b/;

/**
 * Acceso a Gemini a través de Firebase AI Logic.
 *
 * La clave de la API de Gemini la custodia Firebase en el servidor: el código
 * del navegador no contiene ningún secreto. (Antes la clave iba escrita en el
 * frontend y cualquiera podía extraerla del JavaScript publicado.)
 *
 * Se importa desde '@angular/fire/ai' (y no desde 'firebase/ai') para usar la
 * misma instancia del SDK de Firebase que el resto de la app. getAI() usa por
 * defecto la Gemini Developer API. Las peticiones van firmadas con App Check.
 */
@Injectable({ providedIn: 'root' })
export class IaService {
  private app = inject(FirebaseApp);
  private modelos = new Map<string, ReturnType<typeof getGenerativeModel>>();

  async generar(prompt: string): Promise<string> {
    let ultimoError: unknown;
    for (const nombre of MODELOS) {
      try {
        const resultado = await this.modelo(nombre).generateContent(prompt);
        return resultado.response.text();
      } catch (error) {
        ultimoError = error;
        if (!PROBAR_OTRO_MODELO.test(String((error as Error)?.message))) break;
        console.warn(`Gemini: ${nombre} no disponible, probando el siguiente modelo`);
      }
    }
    throw ultimoError;
  }

  private modelo(nombre: string) {
    let modelo = this.modelos.get(nombre);
    if (!modelo) {
      modelo = getGenerativeModel(getAI(this.app), { model: nombre });
      this.modelos.set(nombre, modelo);
    }
    return modelo;
  }
}
