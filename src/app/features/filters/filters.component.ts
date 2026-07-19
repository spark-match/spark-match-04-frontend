import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { FiltersService } from '../../core/services/filters.service';
import {
  AcademicType,
  InstitutionType,
  OrientationFilters,
  RegionOption,
} from '../../core/models/filters.model';

interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  hint: string;
}

@Component({
  selector: 'app-filters',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './filters.component.html',
  styleUrl: './filters.component.scss',
})
export class FiltersComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private filtersService = inject(FiltersService);

  regions = signal<RegionOption[]>([]);
  loadingRegions = signal(true);

  // Mantenemos las opciones visuales del asistente
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

  minBudget = 0;
  maxBudget = 35000;

  // Formulario sin valores por defecto y con Validators
  form = this.fb.group({
    region: ['', Validators.required],
    institutionType: ['', Validators.required],
    academicType: ['', Validators.required],
    budget: [8000],
  });

  ngOnInit(): void {
    const existing = this.filtersService.currentFilters();
    if (existing) {
      this.form.patchValue(existing);
    }

    this.filtersService.getRegions().subscribe((regions) => {
      this.regions.set(regions);
      this.loadingRegions.set(false);
    });
  }

  get budgetLabel(): string {
    const value = this.form.value.budget ?? 0;
    let tier = 'Bajo';
    if (value > 20000) tier = 'Alto';
    else if (value > 8000) tier = 'Moderado';
    return `S/. ${value.toLocaleString('es-PE')} / año · ${tier}`;
  }

  //  Contamos valores reales, no defaults
  get completedCount(): number {
    const { region, institutionType, academicType } = this.form.value;
    return [region, institutionType, academicType].filter(Boolean).length;
  }

  // El botón se activa solo si todo es válido
  get isReady(): boolean {
    return this.form.valid;
  }

  startChat(): void {
    if (!this.isReady) return;

    const filters: OrientationFilters = {
      region: this.form.value.region!,
      institutionType: this.form.value.institutionType as InstitutionType,
      academicType: this.form.value.academicType as AcademicType,
      budget: this.form.value.budget ?? 0,
    };

    this.filtersService.setFilters(filters);
    this.router.navigate(['/assessment']); // El asistente cambió la ruta a /assessment
  }
}
