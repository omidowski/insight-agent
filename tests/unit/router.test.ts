import { describe, expect, it } from 'vitest';
import { route, needsLiveLookup } from '@/lib/agent/router';
import { FakeLLMProvider } from '../doubles/fake-llm';
import { getConfig, resetConfig } from '@/lib/config/env';
import type { LLMProvider, ObjectRequest } from '@/lib/llm/provider';

resetConfig();
const config = getConfig();
const llm = new FakeLLMProvider();

async function classify(request: string, mode: 'auto' | 'chat' | 'research' = 'auto') {
  return route({ request, history: [], mode, llm, config });
}

describe('Spec 13 — Request Router', () => {
  it('AC-13-01: Begrüßungen werden ohne Modellaufruf als conversation eingestuft', async () => {
    for (const greeting of ['Hallo', 'Hi', 'Guten Morgen', 'hey!']) {
      const decision = await classify(greeting);
      expect(decision.taskType).toBe('conversation');
      expect(decision.allowedTools).toHaveLength(0);
      expect(decision.showActivity).toBe(false);
    }
  });

  it('AC-13-02: Rechercheaufträge landen im Research-Pfad', async () => {
    for (const request of [
      'Recherchiere aktuelle Statistiken über Jamal Musiala.',
      'Finde aktuelle Marktzahlen zum europäischen Fußball.',
    ]) {
      const decision = await classify(request);
      expect(decision.needsResearch).toBe(true);
      expect(decision.allowedTools).toContain('web_search');
      expect(decision.showActivity).toBe(true);
      expect(decision.budgets.maxSources).toBeGreaterThan(0);
    }
  });

  it('erkennt Vergleiche und mehrstufige Aufgaben', async () => {
    const compare = await classify('Vergleiche die Umsätze der wertvollsten Vereine, aktuelle Zahlen.');
    expect(['comparison', 'multi_step_task']).toContain(compare.taskType);
  });

  it('AC-13-03: expliziter Modus überschreibt die Klassifikation', async () => {
    const chat = await classify('Recherchiere aktuelle Statistiken über Jamal Musiala.', 'chat');
    expect(chat.needsResearch).toBe(false);
    expect(chat.allowedTools).toHaveLength(0);
    const research = await classify('Hallo', 'research');
    expect(research.taskType).toBe('deep_research');
  });

  it('AC-13-02: geringe Sicherheit führt zum günstigeren Pfad', async () => {
    const lowConfidence: LLMProvider = {
      name: 'stub',
      generateText: async () => ({ text: '', model: 'stub', inputTokens: 0, outputTokens: 0, estimated: true }),
      streamText: async function* () { yield ''; },
      generateObject: async <T>(req: ObjectRequest<T>) =>
        req.schema.parse({
          taskType: 'deep_research', confidence: 0.45, summary: 'unsicher', clarificationNeeded: false,
        }),
    };
    const decision = await route({ request: 'Musiala?', history: [], mode: 'auto', llm: lowConfidence, config });
    expect(decision.taskType).toBe('web_lookup');
  });

  it('AC-13-05: Router-Fehler führen zum Fallback statt zum Abbruch', async () => {
    const broken: LLMProvider = {
      name: 'broken',
      generateText: async () => { throw new Error('down'); },
      streamText: async function* () { throw new Error('down'); },
      generateObject: async () => { throw new Error('down'); },
    };
    const decision = await route({
      request: 'Erkläre mir bitte den Unterschied zwischen Hefe und Backpulver.',
      history: [], mode: 'auto', llm: broken, config,
    });
    expect(decision.taskType).toBe('knowledge_question');
    expect(decision.confidence).toBe(0);
  });

  it('AC-13-05: bei tagesaktuellen Fragen führt der Fallback in die Websuche', async () => {
    const broken: LLMProvider = {
      name: 'kaputt',
      generateText: async () => { throw new Error('down'); },
      streamText: async function* () { throw new Error('down'); },
      generateObject: async () => { throw new Error('down'); },
    };
    const decision = await route({
      request: 'Wie ist das Wetter in Hamburg?', history: [], mode: 'auto', llm: broken, config,
    });
    expect(decision.taskType).toBe('web_lookup');
    expect(decision.needsResearch).toBe(true);
  });
});

describe('Spec 13 — tagesaktuelle Fragen erzwingen eine Websuche', () => {
  const cases = [
    'Wie ist das Wetter in Hamburg?',
    'Was kostet Bitcoin?',
    'Wie steht die Bundesliga-Tabelle?',
    'Wann fährt der nächste Zug?',
    'Was sind die neuesten Nachrichten?',
  ];
  for (const request of cases) {
    it(`erkennt „${request}" als Live-Anfrage`, () => {
      expect(needsLiveLookup(request)).toBe(true);
    });
  }

  it('lässt zeitlose Fragen unberührt', () => {
    expect(needsLiveLookup('Was ist ein Vektor-Embedding?')).toBe(false);
    expect(needsLiveLookup('Erkläre Photosynthese')).toBe(false);
  });
});
