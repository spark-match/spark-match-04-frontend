import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { FiltersComponent } from './filters.component';
import { PERU_REGIONS } from '../../shared/data/peru-regions';

describe('FiltersComponent', () => {
  let component: ComponentFixture<FiltersComponent>['componentInstance'];
  let fixture: ComponentFixture<FiltersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FiltersComponent],
      // `FiltersService` inyecta HttpClient para leer y escribir las
      // preferencias del perfil del agente. En local `useMocks` va en true, así
      // que ninguna petición sale de verdad, pero la inyección sí ocurre.
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(FiltersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  /*
   * Hasta el 2026-08-09 las regiones se pedían por HTTP a
   * `{apiUrl}/catalog/regions`, un endpoint que no existe --el backend solo
   * tiene el contexto `identity`--. En los entornos desplegados la llamada daba
   * 404, `ngOnInit` se suscribía sin rama de error y el desplegable se quedaba
   * en «Cargando regiones...» indefinidamente.
   *
   * Y como la región es obligatoria, el botón de iniciar el chat no llegaba a
   * habilitarse nunca: la primera pantalla del producto bloqueaba el resto.
   *
   * El arreglo no fue añadir un `catch` sino dejar de llamar: los 25
   * departamentos son constantes y ya viajan en el bundle. Estas pruebas fijan
   * que sigan llegando sin red.
   */
  describe('las regiones no dependen de la red', () => {
    it('las ofrece todas sin haber hecho ninguna petición', () => {
      // El TestBed no provee HttpClient: si el servicio volviera a inyectarlo
      // para pedir las regiones, la creación del componente fallaría aquí.
      expect(component.regions.length).toBe(25);
      expect(component.regions).toEqual(PERU_REGIONS);
    });

    it('nunca muestra el mensaje de carga', () => {
      const html = fixture.nativeElement as HTMLElement;
      expect(html.textContent).not.toContain('Cargando regiones');
    });

    it('pinta las 25 opciones más el marcador de posición', () => {
      const html = fixture.nativeElement as HTMLElement;
      const opciones = html.querySelectorAll('#region option');

      expect(opciones.length).toBe(26);
      expect(opciones[0].textContent?.trim()).toBe('Selecciona tu región');
    });

    it('usa el nombre como valor, que es lo que cruza con el dataset', () => {
      // `region.code` ("la-libertad") no casa con la columna `location` del
      // dataset ("La Libertad") ni siquiera normalizando: el guion sobra.
      const html = fixture.nativeElement as HTMLElement;
      const valores = Array.from(html.querySelectorAll('#region option'))
        .map((o) => (o as HTMLOptionElement).value)
        .filter(Boolean);

      expect(valores).toContain('La Libertad');
      expect(valores).toContain('Áncash');
      expect(valores).not.toContain('la-libertad');
    });
  });

  /*
   * La pantalla dejó de ser una puerta el 2026-08-09. La región era obligatoria
   * y, con el desplegable roto, el botón quedaba deshabilitado para siempre;
   * pero incluso funcionando era la decisión equivocada, porque obligaba a
   * rellenar un formulario antes de poder hablar con nada. Ahora estas cuatro
   * preferencias forman parte del perfil que el agente mantiene conversando, y
   * esta pantalla es una vista editable de lo mismo.
   */
  describe('ninguna preferencia es obligatoria', () => {
    it('se puede iniciar el chat sin tocar nada', () => {
      expect(component.isReady()).toBe(true);
      expect(component.completedCount()).toBe(0);
    });

    it('el botón nunca arranca deshabilitado', () => {
      const html = fixture.nativeElement as HTMLElement;
      const boton = html.querySelector('.filters__submit') as HTMLButtonElement;

      expect(boton.disabled).toBe(false);
    });

    it('cuenta las preferencias que sí se indicaron', () => {
      component.filtersForm.region().value.set('Arequipa');
      component.setInstitutionType('publica');
      fixture.detectChanges();

      expect(component.completedCount()).toBe(2);
    });
  });

  /*
   * `budget` valía 8000 por defecto y eso era un dato inventado: quien no
   * tocara el deslizador acababa con una restricción que nunca pidió. Ahora que
   * el agente aplica el presupuesto como exclusión, un valor por defecto no da
   * una respuesta mala: borra en silencio las opciones que cuesten más.
   */
  describe('el presupuesto no se inventa', () => {
    it('arranca sin definir', () => {
      expect(component.filtersModel().budget).toBeNull();
      expect(component.budgetLabel()).toBe('Sin límite definido');
    });

    it('el deslizador se dibuja en una posición sin comprometerse a ella', () => {
      expect(component.budgetSliderValue()).toBe(8000);
      expect(component.filtersModel().budget).toBeNull();
    });

    it('solo hay presupuesto cuando el estudiante lo mueve', () => {
      component.onBudgetInput({ target: { value: '12000' } } as unknown as Event);
      fixture.detectChanges();

      expect(component.filtersModel().budget).toBe(12000);
      expect(component.budgetLabel()).toContain('12,000');
      expect(component.budgetLabel()).toContain('Moderado');
    });
  });
});
