/** Calculator und Date/Time (Spec 21). */
import { z } from 'zod';
import type { ToolDefinition } from './types';
import { calculate, formatNumber } from './calculator';
import { appError, AppErrorException } from '@/lib/util/errors';

const calcParams = z.object({ expression: z.string().min(1).max(200) });
const calcResult = z.object({ value: z.number(), formatted: z.string(), expression: z.string() });

export const calculatorTool: ToolDefinition<z.infer<typeof calcParams>, z.infer<typeof calcResult>> = {
  name: 'calculator',
  description:
    'Berechnet arithmetische Ausdrücke (+ - * / % ^, Klammern). Nutze dieses Werkzeug immer, wenn du Werte aus Quellen verrechnest.',
  parameters: calcParams,
  result: calcResult,
  timeoutMs: 1000,
  maxRetries: 0,
  costClass: 'free',
  resultTokenBudget: 100,
  cacheable: true,
  async execute(args) {
    const outcome = calculate(args.expression);
    if (!outcome.ok) {
      throw new AppErrorException(appError('VALIDATION_FAILED', outcome.error, { userMessage: outcome.error }));
    }
    return { value: outcome.value, formatted: formatNumber(outcome.value), expression: args.expression };
  },
  summarize: (r) => `${r.expression} = ${r.formatted}`,
};

const dateParams = z.object({
  operation: z.enum(['now', 'diff', 'add']),
  from: z.string().optional(),
  to: z.string().optional(),
  amount: z.number().optional(),
  unit: z.enum(['days', 'hours', 'minutes', 'weeks']).optional(),
});
const dateResult = z.object({ iso: z.string(), human: z.string(), days: z.number().optional() });

const UNIT_MS: Record<string, number> = { minutes: 60_000, hours: 3_600_000, days: 86_400_000, weeks: 604_800_000 };

export const datetimeTool: ToolDefinition<z.infer<typeof dateParams>, z.infer<typeof dateResult>> = {
  name: 'datetime',
  description: 'Liefert das aktuelle Datum (UTC), berechnet Differenzen zwischen Daten oder addiert Zeiträume.',
  parameters: dateParams,
  result: dateResult,
  timeoutMs: 1000,
  maxRetries: 0,
  costClass: 'free',
  resultTokenBudget: 100,
  cacheable: false,
  async execute(args) {
    const parse = (value: string | undefined, fallback: Date): Date => {
      if (!value) return fallback;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        throw new AppErrorException(appError('VALIDATION_FAILED', `ungültiges Datum: ${value}`));
      }
      return date;
    };
    const now = new Date();
    if (args.operation === 'now') {
      return { iso: now.toISOString(), human: `Aktuelles Datum (UTC): ${now.toISOString().slice(0, 10)}` };
    }
    if (args.operation === 'diff') {
      const from = parse(args.from, now);
      const to = parse(args.to, now);
      const days = Math.round(Math.abs(to.getTime() - from.getTime()) / 86_400_000);
      return { iso: to.toISOString(), human: `${days} Tage zwischen ${from.toISOString().slice(0, 10)} und ${to.toISOString().slice(0, 10)}`, days };
    }
    const base = parse(args.from, now);
    const unit = args.unit ?? 'days';
    const result = new Date(base.getTime() + (args.amount ?? 0) * (UNIT_MS[unit] ?? 86_400_000));
    return { iso: result.toISOString(), human: `${result.toISOString().slice(0, 10)} (${args.amount ?? 0} ${unit} ab ${base.toISOString().slice(0, 10)})` };
  },
  summarize: (r) => r.human,
};
