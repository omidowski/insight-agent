/**
 * Deterministischer Test-Double für `LLMProvider` (Spec 42).
 * Ausschließlich für Tests — die Anwendung selbst enthält keine simulierten Antworten.
 */
import type { z } from 'zod';
import type { LLMInput, LLMProvider, ObjectRequest, TextRequest, TextResult, UsageSink } from '@/lib/llm/provider';
import { estimateTokens } from '@/lib/util/tokens';
import { appError, AppErrorException } from '@/lib/util/errors';

const GREETINGS = /^(hi|hallo|hey|guten (morgen|tag|abend)|moin|servus|hello|yo|na)\b/i;

const NO_SOURCE_NOTE = 'Zu dieser Frage lagen keine verwertbaren Quellen vor.';
const RESEARCH = /(recherch|research|aktuell|statistik|zahlen|quellen|vergleich|analysier|markt|studie|bericht|finde heraus|wie viele|wie viel|umsatz)/i;
// Fragen nach dem Jetzt-Zustand brauchen immer eine Quelle (Spec 13: web_lookup)
const LIVE_FACT = /(wetter|temperatur|regnet|schnee|kurs|aktienkurs|preis|kostet|börse|wechselkurs|verkehr|stau|fahrplan|verspätung|öffnungszeit|heute|gerade jetzt|im moment|momentan)/i;
const COMPARE = /(vergleich|versus|gegenüber|compare|besser als)/i;
const MULTISTEP = /(und erstelle|tabelle|schritt für schritt|mehrere|liste auf|plus)/i;

function userText(input: LLMInput[]): string {
  return input
    .filter((i): i is { role: 'user' | 'assistant'; text: string } => i.role === 'user')
    .map((i) => i.text)
    .join('\n');
}

function dataBlocks(input: LLMInput[]): { label: string; content: string }[] {
  return input
    .filter((i): i is { role: 'data'; label: string; content: string } => i.role === 'data')
    .map((i) => ({ label: i.label, content: i.content }));
}

function keywords(text: string): string[] {
  const stop = new Set([
    'und', 'oder', 'der', 'die', 'das', 'des', 'dem', 'den', 'ein', 'eine', 'einen', 'für', 'über',
    'mit', 'von', 'zum', 'zur', 'aktuelle', 'aktuellen', 'bitte', 'mir', 'eine', 'the', 'and', 'for',
    'recherchiere', 'recherche', 'vergleiche', 'analysiere', 'erstelle', 'finde', 'welche', 'wie',
    'viele', 'viel', 'sind', 'ist', 'zu', 'im', 'in', 'am', 'auf', 'nach',
    'belegten', 'belegte', 'grunddaten', 'kennzahlen', 'angaben', 'widersprechen', 'zwischen',
    'quellen', 'aufgabentyp', 'aufgabe', 'thema', 'gibt', 'weitere', 'bitte',
    'statistik', 'statistiken', 'statistics', 'über', 'ueber', 'daten', 'zahlen', 'information',
    'informationen', 'einen', 'einem', 'eines', 'dieser', 'diese', 'dieses', 'sowie', 'alle',
  ]);
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((w) => w.length > 3 && !stop.has(w)),
    ),
  );
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30);
}

function scoreSentence(sentence: string, terms: string[]): number {
  const lower = sentence.toLowerCase();
  let score = 0;
  for (const t of terms) if (lower.includes(t)) score += 2;
  if (/\d/.test(sentence)) score += 1;
  return score;
}

export class FakeLLMProvider implements LLMProvider {
  readonly name = 'fake';
  constructor(private readonly sink?: UsageSink) {}

  private track(req: TextRequest, outputText: string): TextResult {
    const inputTokens = estimateTokens(req.system + JSON.stringify(req.input));
    const outputTokens = estimateTokens(outputText);
    this.sink?.({
      ...(req.runId ? { runId: req.runId } : {}),
      kind: req.purpose, model: 'fake', inputTokens, outputTokens,
      costMicroUsd: 0, estimated: true,
    });
    return { text: outputText, model: 'fake', inputTokens, outputTokens, estimated: true };
  }

  private assertLive(signal?: AbortSignal): void {
    if (signal?.aborted) throw new AppErrorException(appError('RUN_CANCELLED', 'aborted'));
  }

  async generateText(req: TextRequest): Promise<TextResult> {
    this.assertLive(req.signal);
    return this.track(req, this.compose(req));
  }

  async *streamText(req: TextRequest): AsyncIterable<string> {
    const text = this.compose(req);
    this.track(req, text);
    for (let i = 0; i < text.length; i += 24) {
      this.assertLive(req.signal);
      yield text.slice(i, i + 24);
      await new Promise((r) => setTimeout(r, 2));
    }
  }

  async generateObject<T>(req: ObjectRequest<T>): Promise<T> {
    this.assertLive(req.signal);
    const raw = this.buildObject(req);
    const parsed = (req.schema as z.ZodType<T>).safeParse(raw);
    if (!parsed.success) {
      throw new AppErrorException(
        appError('LLM_BAD_OUTPUT', `fake output invalid for ${req.purpose}: ${parsed.error.message}`),
      );
    }
    this.track(req, JSON.stringify(raw));
    return parsed.data;
  }

  /** Für den Stub-Server: erzeugt das Objekt allein aus Zweck und Eingabe. */
  async generateObjectRaw(purpose: string, input: LLMInput[]): Promise<unknown> {
    return this.buildObject({
      system: '', input, purpose, schema: undefined as never, schemaName: purpose,
    } as unknown as ObjectRequest<unknown>);
  }

  /** Für den Stub-Server: erzeugt den Freitext allein aus Zweck und Eingabe. */
  async generateRawText(purpose: string, input: LLMInput[]): Promise<string> {
    return this.compose({ system: '', input, purpose } as TextRequest);
  }

  private buildObject(req: ObjectRequest<unknown>): unknown {
    const question = userText(req.input);
    switch (req.purpose) {
      case 'router': {
        const text = question.trim();
        let taskType = 'knowledge_question';
        let confidence = 0.62;
        if (GREETINGS.test(text) && text.split(/\s+/).length <= 4) {
          taskType = 'conversation'; confidence = 0.95;
        } else if (COMPARE.test(text) && RESEARCH.test(text)) {
          taskType = 'comparison'; confidence = 0.88;
        } else if (MULTISTEP.test(text) && RESEARCH.test(text)) {
          taskType = 'multi_step_task'; confidence = 0.85;
        } else if (RESEARCH.test(text)) {
          taskType = 'deep_research'; confidence = 0.9;
        } else if (LIVE_FACT.test(text)) {
          taskType = 'web_lookup'; confidence = 0.82;
        } else if (text.split(/\s+/).length <= 3) {
          taskType = 'web_lookup'; confidence = 0.55;
        }
        return {
          taskType, confidence,
          summary: `Anfrage als ${taskType} eingeordnet`,
          clarificationNeeded: false,
        };
      }
      case 'plan': {
        const terms = keywords(question);
        const subject = terms.slice(0, 2).join(' ') || 'das Thema';
        const steps = [
          { title: 'Grunddaten sammeln', question: `Welche belegten Grunddaten gibt es zu ${subject}?`, dependsOn: [] as number[] },
          { title: 'Aktuelle Kennzahlen', question: `Welche aktuellen Kennzahlen und Statistiken zu ${subject} sind belegt?`, dependsOn: [] as number[] },
        ];
        if (COMPARE.test(question) || MULTISTEP.test(question)) {
          steps.push({ title: 'Quellen abgleichen', question: `Welche Angaben zu ${subject} widersprechen sich zwischen den Quellen?`, dependsOn: [0, 1] });
        }
        return { steps };
      }
      case 'queries': {
        const terms = keywords(question);
        const base = terms.slice(0, 4).join(' ');
        const previous = dataBlocks(req.input).find((b) => b.label === 'BEREITS_GESTELLT')?.content ?? '';
        const candidates = [base || question.slice(0, 60), `${base} aktuell`]
          .map((q) => q.trim())
          .filter((q) => q.length > 2 && !previous.toLowerCase().includes(q.toLowerCase()));
        return { queries: candidates.length > 0 ? candidates : [question.slice(0, 60)] };
      }
      case 'extraction': {
        const blocks = dataBlocks(req.input);
        const terms = keywords(question);
        const items: unknown[] = [];
        for (const block of blocks) {
          const ranked = sentences(block.content)
            .map((s) => ({ s, score: scoreSentence(s, terms) }))
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);
          for (const { s } of ranked) {
            const numeric = /(-?[\d.,]+\s*(?:%|mio\.?|mrd\.?|millionen|milliarden|euro|€|tore|assists|spiele|punkte)?)/i.exec(s);
            const label = s.split(/[:,–-]/)[0]?.trim().slice(0, 120) ?? 'Angabe';
            items.push({
              claimKey: `${(terms[0] ?? 'thema')}.${label.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 40)}`,
              label,
              value: (numeric?.[1] ?? label).trim().slice(0, 200),
              excerpt: s.slice(0, 500),
              confidence: 0.8,
            });
          }
        }
        return { items: items.slice(0, 8), summary: `${items.length} Angaben extrahiert` };
      }
      case 'followup': {
        const needsNew = /\b(19|20)\d{2}\b|und wie|außerdem|zusätzlich|neue|anderer|andere/i.test(question)
          && !/kürzer|zusammenfass|erkläre|formuliere|tabelle daraus/i.test(question);
        return {
          needsNewResearch: needsNew,
          reason: needsNew ? 'Neue Information erforderlich' : 'Vorhandene Quellen genügen',
        };
      }
      case 'title': {
        const terms = keywords(question);
        const title = (terms.slice(0, 4).join(' ') || question.slice(0, 40)).trim();
        return { title: title.charAt(0).toUpperCase() + title.slice(1, 58) };
      }
      case 'selection': {
        return { urls: [] };
      }
      default:
        return {};
    }
  }

  private compose(req: TextRequest): string {
    const question = userText(req.input);
    if (req.purpose === 'conversation') {
      if (GREETINGS.test(question.trim())) {
        return 'Hallo! Wie kann ich dir helfen? Ich kann normale Fragen beantworten oder eine Recherche mit Quellen für dich durchführen.';
      }
      return [
        `Ich kann deine Frage „${question.trim().slice(0, 160)}" im Demo-Modus nicht inhaltlich beantworten.`,
        '',
        NO_SOURCE_NOTE,
      ].join('\n');
    }
    if (req.purpose === 'synthesis') {
      return this.composeSynthesis(req, question);
    }
    return `Antwort zu: ${question.slice(0, 200)}`;
  }

  private composeSynthesis(req: TextRequest, question: string): string {
    const blocks = dataBlocks(req.input);
    const findings = blocks.filter((b) => b.label.startsWith('SOURCE'));
    const conflictBlock = blocks.find((b) => b.label === 'CONFLICTS');
    const gapsBlock = blocks.find((b) => b.label === 'GAPS');

    if (findings.length === 0) {
      return [
        `Ich habe zu „${question.trim().slice(0, 120)}" keine belastbaren Quellen gefunden.`,
        '',
        NO_SOURCE_NOTE,
      ].join('\n');
    }

    const lines: string[] = [];
    lines.push(`## Ergebnis\n`);
    lines.push(`Zu „${question.trim().slice(0, 160)}" habe ich ${findings.length} Quellen ausgewertet.\n`);
    for (const block of findings) {
      const marker = /SOURCE (\d+)/.exec(block.label)?.[1] ?? '1';
      const first = block.content
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 20)
        .slice(0, 2);
      for (const line of first) {
        lines.push(`- ${line.slice(0, 260)} [${marker}]`);
      }
    }
    if (conflictBlock && conflictBlock.content.trim().length > 0) {
      lines.push(`\n## Abweichungen zwischen Quellen\n`);
      lines.push(conflictBlock.content.trim());
    }
    if (gapsBlock && gapsBlock.content.trim().length > 0) {
      lines.push(`\n## Offene Punkte\n`);
      lines.push(gapsBlock.content.trim());
    }
    return lines.join('\n');
  }
}
