import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-filters',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './filters.component.html',
  styleUrls: ['./filters.component.scss'],
})
export class FiltersComponent {
  private fb = inject(FormBuilder);

  public filtersForm: FormGroup = this.fb.group({
    region: ['', Validators.required],
    fundingType: ['', Validators.required], // publica, privada, ambas
    institutionType: ['', Validators.required], // universidad, instituto, ambos
    budget: [8000], // Valor por defecto del slider
  });

  // Regiones de ejemplo (luego pueden venir del backend)
  public regiones = ['Arequipa', 'Lima', 'Cusco', 'Piura', 'Trujillo'];

  // Getter para formatear el presupuesto en la vista (Ej: "8,000")
  get formattedBudget(): string {
    const value = this.filtersForm.get('budget')?.value || 0;
    return value.toLocaleString('en-US');
  }

  // Verifica si los primeros 3 filtros están completos
  get isFormComplete(): boolean {
    const { region, fundingType, institutionType } = this.filtersForm.value;
    return !!(region && fundingType && institutionType);
  }

  onSubmit() {
    if (this.filtersForm.valid) {
      console.log('Filtros listos para enviar a la IA:', this.filtersForm.value);
      // Aquí irá la lógica para redirigir al chat
    }
  }
}
