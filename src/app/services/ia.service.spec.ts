import { TestBed } from '@angular/core/testing';
import { FirebaseApp } from '@angular/fire/app';
import { IaService } from './ia.service';

/** Modelo falso: devuelve un texto o lanza el error indicado. */
function modeloFalso(respuesta: string | Error) {
  return {
    generateContent: vi.fn(async () => {
      if (respuesta instanceof Error) throw respuesta;
      return { response: { text: () => respuesta } };
    }),
  };
}

describe('IaService', () => {
  let service: IaService;
  let modelos: Record<string, ReturnType<typeof modeloFalso>>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: FirebaseApp, useValue: {} }],
    });
    service = TestBed.inject(IaService);
    // Sustituye la creación real del modelo de Firebase por los modelos falsos
    vi.spyOn(service as any, 'modelo').mockImplementation(
      (nombre: unknown) => modelos[nombre as string],
    );
  });

  it('devuelve el texto del modelo principal', async () => {
    modelos = {
      'gemini-3.8-flash': modeloFalso('informe'),
      'gemini-3.5-flash-lite': modeloFalso('no debería usarse'),
    };

    await expect(service.generar('prompt')).resolves.toBe('informe');
    expect(modelos['gemini-3.5-flash-lite'].generateContent).not.toHaveBeenCalled();
  });

  it('usa el modelo de respaldo si el principal está saturado (500)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    modelos = {
      'gemini-3.8-flash': modeloFalso(
        new Error('[500 ] This model is currently experiencing high demand'),
      ),
      'gemini-3.5-flash-lite': modeloFalso('informe de respaldo'),
    };

    await expect(service.generar('prompt')).resolves.toBe('informe de respaldo');
  });

  it('no prueba otro modelo ante un error de App Check (401)', async () => {
    const error = new Error('[401 ] Firebase App Check token is invalid');
    modelos = {
      'gemini-3.8-flash': modeloFalso(error),
      'gemini-3.5-flash-lite': modeloFalso('no debería usarse'),
    };

    await expect(service.generar('prompt')).rejects.toBe(error);
    expect(modelos['gemini-3.5-flash-lite'].generateContent).not.toHaveBeenCalled();
  });

  it('propaga el último error si ningún modelo responde', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ultimo = new Error('[503 ] unavailable');
    modelos = {
      'gemini-3.8-flash': modeloFalso(new Error('[500 ] high demand')),
      'gemini-3.5-flash-lite': modeloFalso(ultimo),
    };

    await expect(service.generar('prompt')).rejects.toBe(ultimo);
  });
});
