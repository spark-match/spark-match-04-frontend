import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { RegisterPage } from './register.page';

describe('RegisterPage (Signal Forms)', () => {
  let component: RegisterPage;
  let fixture: ComponentFixture<RegisterPage>;
  let router: Router;

  const validModel = {
    fullName: 'Andrea Prueba',
    email: 'andrea@correo.com',
    password: 'secreto',
    age: 17,
    region: 'Arequipa',
    interestArea: 'Ciencias',
  };

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [RegisterPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterPage);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('validacion', () => {
    it('no marca submitting cuando el formulario es invalido', async () => {
      component.registerModel.set({ ...validModel, email: '' });

      await component.submit();

      expect(component.submitting()).toBe(false);
    });

    it('es valido cuando todos los campos requeridos estan completos', () => {
      component.registerModel.set(validModel);
      expect(component.registerForm().valid()).toBe(true);
    });

    it('exige region', () => {
      component.registerModel.set({ ...validModel, region: '' });
      expect(component.registerForm.region().invalid()).toBe(true);
    });
  });

  describe('registro exitoso', () => {
    // El backend responde 201 sin token: el registro no abre sesion. Antes se
    // navegaba a /filters, que esta detras del authGuard, y funcionaba solo
    // porque el guard aceptaba el token basura del contrato viejo.
    it('redirige a login en vez de a una ruta protegida', async () => {
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      component.registerModel.set(validModel);

      await component.submit();

      expect(navigate).toHaveBeenCalledWith(
        ['/auth/login'],
        expect.objectContaining({ queryParams: { registered: validModel.email } }),
      );
    });

    it('no navega a /filters', async () => {
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      component.registerModel.set(validModel);

      await component.submit();

      expect(navigate).not.toHaveBeenCalledWith(['/filters']);
    });
  });

  describe('registro fallido', () => {
    it('libera submitting cuando el registro falla', async () => {
      vi.spyOn(router, 'navigate').mockRejectedValue(new Error('boom'));
      component.registerModel.set(validModel);

      await component.submit();

      expect(component.submitting()).toBe(false);
    });
  });
});
