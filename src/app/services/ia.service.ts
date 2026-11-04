import { Injectable, inject } from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';
import { GenerativeModel, GoogleAIBackend, getAI, getGenerativeModel } from 'firebase/ai';

/**
 * Acceso a Gemini a través de Firebase AI Logic.
 *
 * La clave de la API de Gemini la custodia Firebase en el servidor: el código
 * del navegador no contiene ningún secreto. (Antes la clave iba escrita en el
 * frontend y cualquiera podía extraerla del JavaScript publicado.)
 */
@Injectable({ providedIn: 'root' })
export class IaService {
  private app = inject(FirebaseApp);
  private modelo?: GenerativeModel;

  async generar(prompt: string): Promise<string> {
    this.modelo ??= getGenerativeModel(getAI(this.app, { backend: new GoogleAIBackend() }), {
      model: 'gemini-2.5-flash',
    });
    const resultado = await this.modelo.generateContent(prompt);
    return resultado.response.text();
  }
}
