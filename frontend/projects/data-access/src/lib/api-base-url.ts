import { InjectionToken } from '@angular/core';

/**
 * Base URL of the hexagonal backend. Each app may override it (e.g. a remote
 * deployed to another environment) without touching this library.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => 'http://localhost:3000',
});
