import { describe, expect, it } from 'vitest';
import { calculate } from '@/lib/tools/calculator';
import { calculatorTool, datetimeTool } from '@/lib/tools/utilities';

describe('Spec 21 — Utilities', () => {
  it('AC-21-01: rechnet mit korrekter Präzedenz', () => {
    expect(calculate('(1200+300)*0.19')).toEqual({ ok: true, value: 285 });
    expect(calculate('2+3*4')).toEqual({ ok: true, value: 14 });
    expect(calculate('2^3^2')).toEqual({ ok: true, value: 512 });
    expect(calculate('-5+3')).toEqual({ ok: true, value: -2 });
  });

  it('AC-21-02: Division durch null wird abgelehnt', () => {
    expect(calculate('1/0').ok).toBe(false);
  });

  it('AC-21-03: Code wird nicht ausgeführt', () => {
    expect(calculate('process.exit(1)').ok).toBe(false);
    expect(calculate('require("fs")').ok).toBe(false);
    expect(calculate('a'.repeat(250)).ok).toBe(false);
  });

  it('lehnt unausgeglichene Klammern ab', () => {
    expect(calculate('(1+2').ok).toBe(false);
    expect(calculate('1+2)').ok).toBe(false);
  });

  it('AC-21-04: Datumsdifferenz wird korrekt berechnet', async () => {
    const result = await datetimeTool.execute(
      { operation: 'diff', from: '2026-01-01T00:00:00.000Z', to: '2026-09-01T00:00:00.000Z' },
      {} as never,
    );
    expect(result.days).toBe(243);
  });

  it('formatiert Ergebnisse lesbar', async () => {
    const result = await calculatorTool.execute({ expression: '1500*1000' }, {} as never);
    expect(result.value).toBe(1_500_000);
    expect(result.formatted).toContain('1.500.000');
  });
});
