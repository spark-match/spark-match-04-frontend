import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SidebarComponent } from './sidebar.component';

describe('SidebarComponent', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('exposes nav as a vertical toolbar for ARIA', () => {
    const nav = fixture.nativeElement.querySelector('.sidebar__nav') as HTMLElement;
    expect(nav).toBeTruthy();
    expect(nav.getAttribute('aria-orientation')).toBe('vertical');
    expect(nav.getAttribute('aria-label')).toBe('Navegación principal');
    expect(nav.getAttribute('role')).toBe('toolbar');
  });

  it('marks each nav item as a toolbar widget', () => {
    const navItems = fixture.nativeElement.querySelectorAll('.sidebar__nav-item');
    expect(navItems.length).toBe(5);
    navItems.forEach((item: Element) => {
      expect(item.tagName.toLowerCase()).toBe('a');
      expect(item.getAttribute('ngtoolbarwidget')).not.toBeNull();
      expect((item as HTMLAnchorElement).getAttribute('href'))
        .toMatch(/^\/(home|filters|assessment|results|profile)$/);
    });
  });

  it('toggles collapsed state when collapse button is clicked', () => {
    expect(component.collapsed()).toBe(false);
    component.toggleCollapsed();
    expect(component.collapsed()).toBe(true);
  });

  it('toggles admin mode when admin toggle handler is called', () => {
    expect(component.adminMode()).toBe(false);
    component.toggleAdminMode();
    expect(component.adminMode()).toBe(true);
  });
});
