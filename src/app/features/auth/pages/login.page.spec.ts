import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { LoginPage } from './login.page';

describe('LoginPage (Signal Forms)', () => {
  let component: LoginPage;
  let fixture: ComponentFixture<LoginPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('does not set submitting when the form is invalid', async () => {
    component.loginModel.set({ email: '', password: '' });

    await component.submit();

    expect(component.submitting()).toBe(false);
  });

  it('reports an error when email is invalid', () => {
    component.loginModel.set({ email: 'no-es-email', password: '' });
    component.loginForm.email().markAsTouched();
    fixture.detectChanges();

    const errors = component.loginForm.email().errors();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toBeTruthy();
  });

  it('reports an error when password is too short', () => {
    component.loginModel.set({ email: 'a@b.com', password: '123' });
    component.loginForm.password().markAsTouched();
    fixture.detectChanges();

    const errors = component.loginForm.password().errors();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('6');
  });

  it('is valid when email and password meet requirements', () => {
    component.loginModel.set({ email: 'a@b.com', password: 'secreto' });
    expect(component.loginForm().valid()).toBe(true);
  });

  it('treats empty email as invalid', () => {
    component.loginModel.set({ email: '', password: 'secreto' });
    expect(component.loginForm.email().invalid()).toBe(true);
  });
});
