import { Component, OnInit, inject, signal, ChangeDetectionStrategy, computed } from '@angular/core';

import { Router } from '@angular/router';
import { FormField, form, min, submit } from '@angular/forms/signals';
import { FiltersService } from './filters.service';
import { AcademicType, InstitutionType, OrientationFilters, RegionOption } from './filters.model';

interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  hint: string;
}

type FiltersModel = OrientationFilters;

/**
 * `budget: null` y `region: ''` significan «no lo ha dicho», no «sin filtro».
 *
 * El presupuesto valía 8000 por defecto, y eso era un dato inventado: un
 * estudiante que no tocara el deslizador acababa con una restricción de
 * S/ 8.000/año que nunca pidió. Ahora que estas preferencias se guardan en el
 * perfil y el agente las aplica como exclusión, un valor por defecto no
 * produce una respuesta mala: borra en silencio las opciones que cuesten más.
 */
const DEFAULT_FILTERS: FiltersModel = {
  region: '',
  institutionType: 'ambas',
  academicType: 'ambos',
  budget: null,
};

/** Dónde se dibuja el deslizador mientras no haya presupuesto. Solo visual. */
const POSICION_INICIAL_PRESUPUESTO = 8000;

@Component({
  selector: 'app-filters',
  standalone: true,
  imports: [FormField],
  templateUrl: './filters.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './filters.component.scss',
})
export class FiltersComponent implements OnInit {
  private router = inject(Router);
  private filtersService = inject(FiltersService);

  /**
   * Constante y sincrona: ver `FiltersService.getRegions`. No hay estado de
   * carga porque no hay nada que cargar, y por tanto tampoco hay un estado en
   * el que quedarse colgado -- que es justo lo que pasaba antes.
   */
  readonly regions: readonly RegionOption[] = this.filtersService.getRegions();

  institutionTypeOptions: ChoiceOption<InstitutionType>[] = [
    { value: 'publica', label: 'Pública', hint: 'Menor costo' },
    { value: 'privada', label: 'Privada', hint: 'Más opciones' },
    { value: 'ambas', label: 'Ambas', hint: 'Sin filtro' },
  ];

  academicTypeOptions: ChoiceOption<AcademicType>[] = [
    { value: 'universidad', label: 'Universidad', hint: 'Carreras de 5 años' },
    { value: 'instituto', label: 'Instituto', hint: 'Carreras técnicas' },
    { value: 'ambos', label: 'Ambos', hint: 'Sin filtro' },
  ];

  readonly filtersModel = signal<FiltersModel>({ ...DEFAULT_FILTERS });

  /**
   * Sin `required`: ninguna preferencia es obligatoria.
   *
   * La región lo era, y con el desplegable roto dejaba el botón deshabilitado
   * para siempre. Pero incluso funcionando era la decisión equivocada: obligaba
   * a rellenar un formulario antes de poder hablar con nada, cuando el agente
   * puede preguntar lo que necesite durante la conversación. Lo único que se
   * valida es que un presupuesto escrito no sea negativo.
   */
  readonly filtersForm = form(this.filtersModel, (f) => {
    min(f.budget, 0, { message: 'El presupuesto no puede ser negativo' });
  });

  readonly isReady = computed(() => this.filtersForm().valid());

  /** Posición del deslizador; la real si hay presupuesto, si no la de arranque. */
  readonly budgetSliderValue = computed(
    () => this.filtersModel().budget ?? POSICION_INICIAL_PRESUPUESTO,
  );

  readonly budgetLabel = computed(() => {
    const value = this.filtersModel().budget;
    if (value === null) {
      return 'Sin límite definido';
    }
    let tier = 'Bajo';
    if (value > 20000) tier = 'Alto';
    else if (value > 8000) tier = 'Moderado';
    return `S/. ${value.toLocaleString('es-PE')} / año · ${tier}`;
  });

  /** Cuántas preferencias ha indicado, de 4. Informativo, no una puerta. */
  readonly completedCount = computed(() => {
    const { region, institutionType, academicType, budget } = this.filtersModel();
    return [
      Boolean(region),
      institutionType !== 'ambas',
      academicType !== 'ambos',
      budget !== null,
    ].filter(Boolean).length;
  });

  ngOnInit(): void {
    const existing = this.filtersService.currentFilters();
    if (existing) {
      this.filtersModel.set({ ...DEFAULT_FILTERS, ...existing });
    }

    // Lo que el agente ya dedujo de la conversación. Esta pantalla es una
    // vista editable del perfil, así que arranca mostrando lo que hay: si el
    // estudiante dijo «quiero algo en Arequipa» hablando, aquí lo ve escrito y
    // puede corregirlo. Un fallo devuelve `null` y se sigue con los campos
    // vacíos — la pantalla ya no es obligatoria y no puede volver a bloquearse.
    this.filtersService.loadPreferences().subscribe((preferencias) => {
      if (preferencias) {
        this.filtersModel.set({ ...DEFAULT_FILTERS, ...preferencias });
      }
    });
  }

  setInstitutionType(value: InstitutionType): void {
    this.filtersForm.institutionType().value.set(value);
  }

  setAcademicType(value: AcademicType): void {
    this.filtersForm.academicType().value.set(value);
  }

  onBudgetInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.filtersForm.budget().value.set(value);
  }

  async startChat(): Promise<void> {
    await submit(this.filtersForm, async (field) => {
      // `savePreferences` actualiza el estado local antes de salir a la red y
      // nunca falla hacia fuera, así que no se espera la respuesta: navegar al
      // chat no puede depender de que el guardado remoto haya ido bien. Lo peor
      // que pasa si falla es que la próxima sesión no recuerde estas
      // preferencias, y el estudiante puede volver a decirlas hablando.
      this.filtersService.savePreferences(field().value()).subscribe();
      await this.router.navigate(['/assessment']);
      return [];
    });
  }
}
