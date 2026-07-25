import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-auth-shell',
  standalone: true,
  templateUrl: './auth-shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './auth-shell.component.scss',
})
export class AuthShellComponent {}
