import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { OrientationFilters, RegionOption } from './filters.model';

const MOCK_REGIONS: RegionOption[] = [
  { code: 'amazonas', name: 'Amazonas' },
  { code: 'ancash', name: 'Áncash' },
  { code: 'apurimac', name: 'Apurímac' },
  { code: 'arequipa', name: 'Arequipa' },
  { code: 'ayacucho', name: 'Ayacucho' },
  { code: 'cajamarca', name: 'Cajamarca' },
  { code: 'callao', name: 'Callao' },
  { code: 'cusco', name: 'Cusco' },
  { code: 'huancavelica', name: 'Huancavelica' },
  { code: 'huanuco', name: 'Huánuco' },
  { code: 'ica', name: 'Ica' },
  { code: 'junin', name: 'Junín' },
  { code: 'la-libertad', name: 'La Libertad' },
  { code: 'lambayeque', name: 'Lambayeque' },
  { code: 'lima', name: 'Lima' },
  { code: 'loreto', name: 'Loreto' },
  { code: 'madre-de-dios', name: 'Madre de Dios' },
  { code: 'moquegua', name: 'Moquegua' },
  { code: 'pasco', name: 'Pasco' },
  { code: 'piura', name: 'Piura' },
  { code: 'puno', name: 'Puno' },
  { code: 'san-martin', name: 'San Martín' },
  { code: 'tacna', name: 'Tacna' },
  { code: 'tumbes', name: 'Tumbes' },
  { code: 'ucayali', name: 'Ucayali' },
];

@Injectable({ providedIn: 'root' })
export class FiltersService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/catalog`;

  private readonly _currentFilters = signal<OrientationFilters | null>(null);
  readonly currentFilters = this._currentFilters.asReadonly();
  readonly hasFilters = computed(() => this._currentFilters() !== null);

  getRegions(): Observable<RegionOption[]> {
    if (environment.useMocks) {
      return of(MOCK_REGIONS).pipe(delay(300));
    }
    return this.http.get<RegionOption[]>(`${this.base}/regions`);
  }

  setFilters(filters: OrientationFilters): void {
    this._currentFilters.set(filters);
  }

  clearFilters(): void {
    this._currentFilters.set(null);
  }
}
