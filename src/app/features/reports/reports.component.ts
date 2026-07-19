import { Component, OnInit, inject, signal } from '@angular/core';
import { ReportsService } from './reports.service';
import { FiltersService } from '../filters/filters.service';
import { CareerMatch, FeedbackValue, OrientationReport } from '../careers/career.model';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent implements OnInit {
  private reportsService = inject(ReportsService);
  private filtersService = inject(FiltersService);

  loading = signal(true);
  report = signal<OrientationReport | null>(null);

  get careers(): CareerMatch[] {
    return this.report()?.careers ?? [];
  }

  get careersFound(): number {
    return this.careers.length;
  }

  get profile(): string {
    return this.report()?.profileSummary ?? '';
  }

  ngOnInit(): void {
    const filters = this.filtersService.currentFilters();
    this.reportsService.getReport(filters).subscribe((report) => {
      this.report.set(report);
      this.loading.set(false);
    });
  }

  rate(careerId: string, value: FeedbackValue): void {
    const current = this.report();
    if (!current) return;

    const nextValue: FeedbackValue | null =
      current.careers.find((c) => c.id === careerId)?.userFeedback === value ? null : value;

    this.report.set({
      ...current,
      careers: current.careers.map((c) =>
        c.id === careerId ? { ...c, userFeedback: nextValue } : c,
      ),
    });

    if (nextValue) {
      this.reportsService.submitFeedback(current.id, careerId, nextValue).subscribe();
    }
  }

  exportPdf(): void {
    window.print();
  }
}
