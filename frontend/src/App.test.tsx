import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App, friendlyAuthError } from './App';

describe('App', () => {
  it('shows loading or auth shell', () => {
    render(<App />);
    expect(screen.getByText(/Lade PuzzleStudio|Einloggen|Registrieren/i)).toBeTruthy();
  });

  it('maps Supabase auth errors to German user-facing messages', () => {
    expect(friendlyAuthError('Invalid login credentials', 'login')).toMatch(/Passwort stimmt nicht/i);
    expect(friendlyAuthError('User already registered', 'register')).toMatch(/bereits registriert/i);
    expect(friendlyAuthError('Failed to fetch', 'register')).toMatch(/Backend nicht erreichbar/i);
  });
});
