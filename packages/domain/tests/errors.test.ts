import { describe, expect, it } from 'vitest';
import { AppError } from '../src';

describe('AppError', () => {
  it('maps codes to HTTP status and body', () => {
    const e = new AppError('forbidden', 'Keine Berechtigung');
    expect(e.status).toBe(403);
    expect(e.toBody()).toEqual({ code: 'forbidden', message: 'Keine Berechtigung' });
  });
});
