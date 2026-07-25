import { Component, OnInit, inject, signal, ChangeDetectionStrategy, computed } from '@angular/core';

import { Router } from '@angular/router';
import {
  FormField,
  form,
  min,
  required,
  submit,
} from '@angular/forms/signals';
import { FiltersService } from './filters.service';
import { AcademicType, InstitutionType, OrientationFilters, RegionOption } from './filters.model';

interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  hint: string;
}

type FiltersModel = OrientationFilters;

const DEFAULT_FILTERS: FiltersModel = {
  region: '',
  institutionType: 'ambas',
  academicType: 'ambos',
  budget: 8000,
};

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

  readonly regions = signal<RegionOption[]>([]);
  readonly loadingRegions = signal(true);

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

  readonly filtersForm = form(this.filtersModel, (f) => {
    required(f.region, { message: 'Selecciona tu región' });
    required(f.institutionType, { message: 'Selecciona el tipo de institución' });
    required(f.academicType, { message: 'Selecciona el tipo de academia' });
    min(f.budget, 0, { message: 'El presupuesto no puede ser negativo' });
  });

  readonly isReady = computed(() => this.filtersForm().valid());

  readonly budgetLabel = computed(() => {
    const value = this.filtersModel().budget ?? 0;
    let tier = 'Bajo';
    if (value > 20000) tier = 'Alto';
    else if (value > 8000) tier = 'Moderado';
    return `S/. ${value.toLocaleString('es-PE')} / año · ${tier}`;
  });

  readonly completedCount = computed(() => {
    const { region, institutionType, academicType } = this.filtersModel();
    return [region, institutionType, academicType].filter(Boolean).length;
  });

  ngOnInit(): void {
    const existing = this.filtersService.currentFilters();
    if (existing) {
      this.filtersModel.set({ ...DEFAULT_FILTERS, ...existing });
    }

    this.filtersService.getRegions().subscribe((regions) => {
      this.regions.set(regions);
      this.loadingRegions.set(false);
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
      this.filtersService.setFilters(field().value());
      await this.router.navigate(['/assessment']);
      return [];
    });
  }
}
