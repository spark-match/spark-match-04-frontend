import { Injectable, signal, computed } from '@angular/core';

export interface User {
  id: string;
  email: string;
  fullName: string;
  createdAt: string;
}

const STORAGE_KEY = 'spark-match.auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _currentUser = signal<User | null>(this.loadFromStorage());

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);

  setUser(user: User, token: string): void {
    this._currentUser.set(user);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, token }));
  }

  clear(): void {
    this._currentUser.set(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  getToken(): string | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw).token ?? null;
    } catch {
      return null;
    }
  }

  private loadFromStorage(): User | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw).user ?? null;
    } catch {
      return null;
    }
  }
}
