import { Injectable, inject } from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';
import { getAI, getGenerativeModel } from '@angular/fire/ai';

/**
 * Acceso a Gemini a través de Firebase AI Logic.
 *
 * La clave de la API de Gemini la custodia Firebase en el servidor: el código
 * del navegador no contiene ningún secreto. (Antes la clave iba escrita en el
 * frontend y cualquiera podía extraerla del JavaScript publicado.)
 *
 * Se importa desde '@angular/fire/ai' (y no desde 'firebase/ai') para usar la
 * misma instancia del SDK de Firebase que el resto de la app. getAI() usa por
 * defecto la Gemini Developer API.
 */
@Injectable({ providedIn: 'root' })
export class IaService {
  private app = inject(FirebaseApp);
  private modelo?: ReturnType<typeof getGenerativeModel>;

  async generar(prompt: string): Promise<string> {
    this.modelo ??= getGenerativeModel(getAI(this.app), { model: 'gemini-2.5-flash' });
    const resultado = await this.modelo.generateContent(prompt);
    return resultado.response.text();
  }
}
