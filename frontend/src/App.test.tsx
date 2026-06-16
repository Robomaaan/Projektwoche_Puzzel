import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => { it('shows loading or auth shell', () => { render(<App />); expect(screen.getByText(/Lade PuzzleStudio|Einloggen|Registrieren/i)).toBeTruthy(); }); });
