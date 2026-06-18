import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App, formatElapsed, friendlyAuthError, isRotationAligned } from './App';

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

  it('formats puzzle completion time for the finish dialog', () => {
    expect(formatElapsed(0)).toBe('00:00:00');
    expect(formatElapsed(65)).toBe('00:01:05');
    expect(formatElapsed(3661)).toBe('01:01:01');
  });

  it('accepts only near-zero rotation as solved alignment', () => {
    expect(isRotationAligned(0)).toBe(true);
    expect(isRotationAligned(8)).toBe(true);
    expect(isRotationAligned(352)).toBe(true);
    expect(isRotationAligned(90)).toBe(false);
    expect(isRotationAligned(180)).toBe(false);
  });
});
