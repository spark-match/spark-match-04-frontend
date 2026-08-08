import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AppLayoutComponent } from './app-layout.component';

describe('AppLayoutComponent', () => {
  let component: AppLayoutComponent;
  let fixture: ComponentFixture<AppLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppLayoutComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AppLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('renders the sidebar and the router-outlet host', () => {
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('app-sidebar')).toBeTruthy();
    expect(html.querySelector('router-outlet')).toBeTruthy();
    expect(html.querySelector('.app-layout')).toBeTruthy();
  });
});