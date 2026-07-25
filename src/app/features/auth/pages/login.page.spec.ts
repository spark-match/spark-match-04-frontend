import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { LoginPage } from './login.page';

describe('LoginPage (Signal Forms)', () => {
  let component: LoginPage;
  let fixture: ComponentFixture<LoginPage>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  it('no envía credenciales cuando el formulario es inválido', async () => {
    component.loginModel.set({ email: '', password: '' });

    await component.submit();

    expect(component.submitting()).toBe(false);
  });

  it('muestra el mensaje de error cuando email es inválido y se tocó', () => {
    component.loginModel.set({ email: 'no-es-email', password: '' });
    component.loginForm.email().markAsTouched();
    fixture.detectChanges();

    const errors = component.loginForm.email().errors();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toBeTruthy();
  });

  it('muestra el mensaje de error cuando password es muy corto', () => {
    component.loginModel.set({ email: 'a@b.com', password: '123' });
    component.loginForm.password().markAsTouched();
    fixture.detectChanges();

    const errors = component.loginForm.password().errors();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('6');
  });

  it('el formulario es válido con email y contraseña >= 6 caracteres', () => {
    component.loginModel.set({ email: 'a@b.com', password: 'secreto' });
    expect(component.loginForm().valid()).toBe(true);
  });

  it('email inválido cuando el valor está vacío', () => {
    component.loginModel.set({ email: '', password: 'secreto' });
    expect(component.loginForm.email().invalid()).toBe(true);
  });

  it('submit envía credenciales cuando el form es válido', async () => {
    component.loginModel.set({ email: 'a@b.com', password: 'secreto' });

    const promise = component.submit();
    expect(component.submitting()).toBe(true);
    await expect(promise).resolves.toBeUndefined();
  });
});
