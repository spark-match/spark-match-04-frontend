import { Service, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { OrientationFilters, RegionOption } from './filters.model';
import { PERU_REGIONS } from '../../shared/data/peru-regions';

// El catálogo vivía aquí, duplicado con el del formulario de registro y sin
// coincidir con él. Ahora sale de `shared/data/peru-regions`, que es la única
// fuente. Ver el comentario de ese fichero para el porqué.
const MOCK_REGIONS: RegionOption[] = [...PERU_REGIONS];

@Service()
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
