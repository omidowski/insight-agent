/** Automatischer Indexierer für alle Prompts und generierten Daten im System. */
import type { Repositories } from '@/lib/db/repositories';
import type {
  Citation,
  Conflict,
  ExcerptRecord,
  Message,
  PlanStep,
  Run,
  SourceRecord,
  ToolCallRecord,
} from '@/lib/contracts/domain';
import type { VectorInput, VectorRecord } from './types';
import type { VectorStore } from './store';
import { getVectorStore } from './store';
import {
  routerPrompt,
  plannerPrompt,
  queryGenPrompt,
  extractionPrompt,
  synthesisPrompt,
  conversationPrompt,
  titlePrompt,
  followupContextPrompt,
  searchProviderInstruction,
  UNTRUSTED_RULE,
} from '@/lib/agent/prompts';
import { logger } from '@/lib/util/logger';

export class VectorIndexer {
  private store: VectorStore;

  constructor(store?: VectorStore) {
    this.store = store ?? getVectorStore();
  }

  /**
   * Indexiert alle statischen Prompt-Vorlagen und System-Regeln.
   */
  async indexStaticPrompts(): Promise<number> {
    const dummyRequest = 'Beispielanfrage für Prompt-Klassifikation und Recherche';
    const dummyHistory = ['Vorherige Konversation'];

    const staticPrompts: {
      id: string;
      name: string;
      version: string;
      purpose: string;
      system: string;
      description: string;
    }[] = [
      {
        id: 'prompt_router',
        name: 'routerPrompt',
        version: routerPrompt(dummyRequest, dummyHistory).version,
        purpose: 'Klassifiziert Nutzeranfragen für den Research-Agenten in Bearbeitungswege',
        system: routerPrompt(dummyRequest, dummyHistory).system,
        description: 'Router-Prompt zur Bestimmung von task_type (deep_research, web_lookup, conversation etc.)',
      },
      {
        id: 'prompt_planner',
        name: 'plannerPrompt',
        version: plannerPrompt(dummyRequest, 'deep_research', []).version,
        purpose: 'Zerlegt eine Rechercheaufgabe in eigenständig beantwortbare Teilfragen',
        system: plannerPrompt(dummyRequest, 'deep_research', []).system,
        description: 'Planner-Prompt zur Aufteilung komplexer Recherchefragen in sequentielle/parallele Einzelschritte',
      },
      {
        id: 'prompt_query_gen',
        name: 'queryGenPrompt',
        version: queryGenPrompt('Teilfrage', []).version,
        purpose: 'Formuliert präzise Websuchanfragen zu einer Teilfrage',
        system: queryGenPrompt('Teilfrage', []).system,
        description: 'Query-Generator für divergente und gezielte Suchbegriffe',
      },
      {
        id: 'prompt_extraction',
        name: 'extractionPrompt',
        version: extractionPrompt('Teilfrage', 1, 'example.com', null, 'Inhalt').version,
        purpose: 'Extrahiert belegbare Angaben und wörtliche Zitate aus Quellen',
        system: extractionPrompt('Teilfrage', 1, 'example.com', null, 'Inhalt').system,
        description: 'Extraktions-Prompt für verifizierbare Fakten (claimKey, value, excerpt)',
      },
      {
        id: 'prompt_synthesis',
        name: 'synthesisPrompt',
        version: synthesisPrompt({ request: '', plan: [], sources: [], conflicts: '', gaps: '' }).version,
        purpose: 'Formuliert die Endantwort einer Recherche mit Zitationsmarkern [n]',
        system: synthesisPrompt({ request: '', plan: [], sources: [], conflicts: '', gaps: '' }).system,
        description: 'Synthese-Prompt für fundierte Antworten mit Quellennachweisen und Widerspruchserwähnung',
      },
      {
        id: 'prompt_conversation',
        name: 'conversationPrompt',
        version: conversationPrompt(dummyRequest, []).version,
        purpose: 'Hilfsbereiter Assistenten-Chatmodus ohne erfundene Quellen',
        system: conversationPrompt(dummyRequest, []).system,
        description: 'Konversations-Prompt für direkte Dialoge ohne Webrecherche',
      },
      {
        id: 'prompt_title',
        name: 'titlePrompt',
        version: titlePrompt(dummyRequest, 'Antwort').version,
        purpose: 'Erzeugt prägnante Chat-Titel für Verläufe',
        system: titlePrompt(dummyRequest, 'Antwort').system,
        description: 'Titelgenerator für Konversationen',
      },
      {
        id: 'prompt_followup',
        name: 'followupContextPrompt',
        version: followupContextPrompt(dummyRequest, []).version,
        purpose: 'Prüft, ob Folgefragen mit vorhandenen Ergebnissen beantwortbar sind',
        system: followupContextPrompt(dummyRequest, []).system,
        description: 'Follow-up Kontextprüfer zur Wiederverwendung bereits erhobener Quellen',
      },
      {
        id: 'prompt_search_provider',
        name: 'searchProviderInstruction',
        version: 'v1',
        purpose: 'Instruktion für den gehosteten Web-Search-Pfad',
        system: searchProviderInstruction,
        description: 'Suchmaschinen-Instruktion für externe Websuche',
      },
      {
        id: 'prompt_untrusted_rule',
        name: 'UNTRUSTED_RULE',
        version: 'v1',
        purpose: 'Prompt-Injection-Schutz und Trennung von Daten und Code',
        system: UNTRUSTED_RULE,
        description: 'Zentrale Sicherheitsregel gegen Prompt Injections in Quelltexten',
      },
    ];

    const inputs: VectorInput[] = staticPrompts.map((p) => ({
      entityType: 'prompt',
      entityId: p.id,
      content: `${p.name} (${p.purpose})\n\nBeschreibung: ${p.description}\n\nSystem-Anweisung:\n${p.system}`,
      metadata: {
        type: 'template',
        name: p.name,
        version: p.version,
        purpose: p.purpose,
      },
    }));

    await this.store.upsertBatch(inputs);
    return inputs.length;
  }

  /**
   * Indexiert einen dynamisch zur Laufzeit erzeugten Prompt.
   */
  async indexDynamicPrompt(args: {
    runId: string;
    purpose: string;
    system: string;
    userInput?: string;
    inputsText?: string;
  }): Promise<VectorRecord> {
    const content = `Dynamischer Prompt [${args.purpose}] für Run ${args.runId}\n\nSystem:\n${args.system}\n\nEingabe:\n${args.userInput ?? args.inputsText ?? ''}`;
    return this.store.upsert({
      entityType: 'prompt',
      entityId: `dyn_${args.runId}_${args.purpose}`,
      parentId: args.runId,
      content,
      metadata: {
        type: 'dynamic',
        runId: args.runId,
        purpose: args.purpose,
      },
    });
  }

  /**
   * Indexiert eine Chatnachricht (Nutzer oder Assistent).
   */
  async indexMessage(message: Message): Promise<VectorRecord | null> {
    if (!message.content || message.content.trim().length === 0) return null;
    const prefix = message.role === 'user' ? 'Nutzeranfrage: ' : 'Assistentenantwort: ';
    return this.store.upsert({
      entityType: 'message',
      entityId: message.id,
      parentId: message.conversationId,
      content: `${prefix}${message.content}`,
      metadata: {
        conversationId: message.conversationId,
        role: message.role,
        status: message.status,
        runId: message.runId,
        createdAt: message.createdAt,
      },
    });
  }

  /**
   * Indexiert einen Recherche-Lauf (Run).
   */
  async indexRun(run: Run): Promise<VectorRecord | null> {
    const planText = run.plan.map((s) => `${s.seq}. ${s.title}: ${s.question}`).join('\n');
    const content = `Recherche-Lauf ${run.id} [${run.taskType}]\nStatus: ${run.status}\nKonfidenz: ${run.confidence}\n\nPlan:\n${planText}`;
    return this.store.upsert({
      entityType: 'run',
      entityId: run.id,
      parentId: run.conversationId,
      content,
      metadata: {
        conversationId: run.conversationId,
        taskType: run.taskType,
        status: run.status,
        confidence: run.confidence,
        costMicroUsd: run.costMicroUsd,
      },
    });
  }

  /**
   * Indexiert einen einzelnen Plan-Schritt.
   */
  async indexStep(step: PlanStep, runId: string): Promise<VectorRecord | null> {
    const resultText = step.result ? `\nErgebnis: ${JSON.stringify(step.result)}` : '';
    const content = `Schritt ${step.seq}: ${step.title}\nFrage: ${step.question}\nStatus: ${step.status}${resultText}`;
    return this.store.upsert({
      entityType: 'step',
      entityId: step.id,
      parentId: runId,
      content,
      metadata: {
        runId,
        seq: step.seq,
        title: step.title,
        status: step.status,
      },
    });
  }

  /**
   * Indexiert eine gefundene Webquelle.
   */
  async indexSource(source: SourceRecord): Promise<VectorRecord | null> {
    const content = `Quelle [${source.indexNum}]: ${source.title}\nURL: ${source.url}\nDomain: ${source.domain}\nTyp: ${source.sourceType}\nVertrauenswürdigkeit: ${source.trustScore}${source.note ? `\nNotiz: ${source.note}` : ''}`;
    return this.store.upsert({
      entityType: 'source',
      entityId: source.id,
      parentId: source.runId,
      content,
      metadata: {
        runId: source.runId,
        conversationId: source.conversationId,
        indexNum: source.indexNum,
        domain: source.domain,
        url: source.url,
        trustScore: source.trustScore,
        status: source.status,
      },
    });
  }

  /**
   * Indexiert einen extrahierten Beleg / ein Excerpt.
   */
  async indexExcerpt(excerpt: ExcerptRecord, sourceTitle?: string): Promise<VectorRecord | null> {
    const key = excerpt.claimKey ? `Behauptung [${excerpt.claimKey}]: ` : '';
    const val = excerpt.extractedValue ? `\nWert: ${excerpt.extractedValue}` : '';
    const src = sourceTitle ? `\nQuelle: ${sourceTitle}` : '';
    const content = `${key}"${excerpt.text}"${val}${src}`;
    return this.store.upsert({
      entityType: 'excerpt',
      entityId: excerpt.id,
      parentId: excerpt.runId,
      content,
      metadata: {
        sourceId: excerpt.sourceId,
        runId: excerpt.runId,
        claimKey: excerpt.claimKey,
        extractedValue: excerpt.extractedValue,
      },
    });
  }

  /**
   * Indexiert einen erkannten Widerspruch zwischen Quellen.
   */
  async indexConflict(conflict: Conflict): Promise<VectorRecord | null> {
    const entries = conflict.entries
      .map((e) => `- Quelle [${e.index}]: ${e.value}`)
      .join('\n');
    const content = `Widerspruch zu "${conflict.claimKey}":\n${conflict.description}\n${entries}`;
    return this.store.upsert({
      entityType: 'conflict',
      entityId: conflict.id,
      parentId: conflict.runId,
      content,
      metadata: {
        runId: conflict.runId,
        claimKey: conflict.claimKey,
        description: conflict.description,
      },
    });
  }

  /**
   * Indexiert ein Zitat.
   */
  async indexCitation(citation: Citation, sourceTitle?: string): Promise<VectorRecord | null> {
    const claim = citation.claimText ? `Aussage: ${citation.claimText}\n` : '';
    const src = sourceTitle ? `Quelle: ${sourceTitle}` : `Quellen-ID: ${citation.sourceId}`;
    const content = `Zitationsmarker [${citation.marker}]\n${claim}${src}`;
    return this.store.upsert({
      entityType: 'citation',
      entityId: citation.id,
      parentId: citation.runId,
      content,
      metadata: {
        messageId: citation.messageId,
        runId: citation.runId,
        marker: citation.marker,
        sourceId: citation.sourceId,
      },
    });
  }

  /**
   * Indexiert einen Werkzeugaufruf.
   */
  async indexToolCall(toolCall: ToolCallRecord): Promise<VectorRecord | null> {
    const argsStr = JSON.stringify(toolCall.args);
    const result = toolCall.resultSummary ? `\nErgebnis: ${toolCall.resultSummary}` : '';
    const content = `Tool-Aufruf: ${toolCall.toolName}\nArgumente: ${argsStr}\nStatus: ${toolCall.status}${result}`;
    return this.store.upsert({
      entityType: 'tool_call',
      entityId: toolCall.id,
      parentId: toolCall.runId,
      content,
      metadata: {
        runId: toolCall.runId,
        toolName: toolCall.toolName,
        status: toolCall.status,
        durationMs: toolCall.durationMs,
      },
    });
  }

  /**
   * Vollständige Synchronisierung: Durchsucht alle Tabellen der Datenbank und indexiert
   * alle statischen Prompts sowie sämtliche generierten Daten.
   */
  async syncAll(repos: Repositories): Promise<{
    indexed: number;
    byType: Record<string, number>;
    durationMs: number;
  }> {
    const started = Date.now();
    logger.info('Starte vollständige Vektor-Synchronisierung aller Daten und Prompts', {
      module: 'vector',
    });

    const counts = {
      prompt: 0,
      message: 0,
      run: 0,
      step: 0,
      source: 0,
      excerpt: 0,
      conflict: 0,
      citation: 0,
      tool_call: 0,
    };

    // 1. Statische Prompts indexieren
    const promptCount = await this.indexStaticPrompts();
    counts.prompt += promptCount;

    // 2. Alle Konversationen und Nachrichten
    const conversations = repos.conversations.listByUser('usr_local', 1000);
    const allMessages: Message[] = [];
    for (const conv of conversations) {
      const msgs = repos.messages.listByConversation(conv.id, 1000);
      allMessages.push(...msgs);
    }

    const messageInputs: VectorInput[] = allMessages
      .filter((m) => m.content && m.content.trim().length > 0)
      .map((m) => ({
        entityType: 'message',
        entityId: m.id,
        parentId: m.conversationId,
        content: `${m.role === 'user' ? 'Nutzeranfrage: ' : 'Assistentenantwort: '}${m.content}`,
        metadata: {
          conversationId: m.conversationId,
          role: m.role,
          status: m.status,
          runId: m.runId,
        },
      }));
    if (messageInputs.length > 0) {
      await this.store.upsertBatch(messageInputs);
      counts.message += messageInputs.length;
    }

    // 3. Alle Runs und Steps
    const allRuns: Run[] = [];
    for (const conv of conversations) {
      const runs = repos.runs.listByConversation(conv.id, 200);
      allRuns.push(...runs);
    }

    const runInputs: VectorInput[] = allRuns.map((r) => ({
      entityType: 'run',
      entityId: r.id,
      parentId: r.conversationId,
      content: `Recherche-Lauf ${r.id} [${r.taskType}]\nStatus: ${r.status}\nKonfidenz: ${r.confidence}\n\nPlan:\n${r.plan.map((s) => `${s.seq}. ${s.title}: ${s.question}`).join('\n')}`,
      metadata: {
        conversationId: r.conversationId,
        taskType: r.taskType,
        status: r.status,
        confidence: r.confidence,
      },
    }));
    if (runInputs.length > 0) {
      await this.store.upsertBatch(runInputs);
      counts.run += runInputs.length;
    }

    // Steps aus allen Runs
    const stepInputs: VectorInput[] = [];
    for (const run of allRuns) {
      const steps = repos.steps.listByRun(run.id);
      for (const step of steps) {
        stepInputs.push({
          entityType: 'step',
          entityId: step.id,
          parentId: run.id,
          content: `Schritt ${step.seq}: ${step.title}\nFrage: ${step.question}\nStatus: ${step.status}${step.result ? `\nErgebnis: ${JSON.stringify(step.result)}` : ''}`,
          metadata: {
            runId: run.id,
            seq: step.seq,
            title: step.title,
            status: step.status,
          },
        });
      }
    }
    if (stepInputs.length > 0) {
      await this.store.upsertBatch(stepInputs);
      counts.step += stepInputs.length;
    }

    // 4. Sources und Excerpts
    const sourceInputs: VectorInput[] = [];
    const excerptInputs: VectorInput[] = [];
    const sourceMap = new Map<string, SourceRecord>();

    for (const run of allRuns) {
      const sources = repos.sources.listByRun(run.id);
      for (const s of sources) {
        sourceMap.set(s.id, s);
        sourceInputs.push({
          entityType: 'source',
          entityId: s.id,
          parentId: s.runId,
          content: `Quelle [${s.indexNum}]: ${s.title}\nURL: ${s.url}\nDomain: ${s.domain}\nTyp: ${s.sourceType}\nVertrauenswürdigkeit: ${s.trustScore}${s.note ? `\nNotiz: ${s.note}` : ''}`,
          metadata: {
            runId: s.runId,
            conversationId: s.conversationId,
            indexNum: s.indexNum,
            domain: s.domain,
            url: s.url,
            trustScore: s.trustScore,
            status: s.status,
          },
        });
      }

      const excerpts = repos.excerpts.listByRun(run.id);
      for (const e of excerpts) {
        const src = sourceMap.get(e.sourceId);
        excerptInputs.push({
          entityType: 'excerpt',
          entityId: e.id,
          parentId: e.runId,
          content: `${e.claimKey ? `Behauptung [${e.claimKey}]: ` : ''}"${e.text}"${e.extractedValue ? `\nWert: ${e.extractedValue}` : ''}${src ? `\nQuelle: ${src.title}` : ''}`,
          metadata: {
            sourceId: e.sourceId,
            runId: e.runId,
            claimKey: e.claimKey,
            extractedValue: e.extractedValue,
          },
        });
      }
    }

    if (sourceInputs.length > 0) {
      await this.store.upsertBatch(sourceInputs);
      counts.source += sourceInputs.length;
    }
    if (excerptInputs.length > 0) {
      await this.store.upsertBatch(excerptInputs);
      counts.excerpt += excerptInputs.length;
    }

    // 5. Conflicts & Citations
    const conflictInputs: VectorInput[] = [];
    const citationInputs: VectorInput[] = [];

    for (const run of allRuns) {
      const conflicts = repos.conflicts.listByRun(run.id);
      for (const c of conflicts) {
        conflictInputs.push({
          entityType: 'conflict',
          entityId: c.id,
          parentId: c.runId,
          content: `Widerspruch zu "${c.claimKey}":\n${c.description}\n${c.entries.map((e) => `- Quelle [${e.index}]: ${e.value}`).join('\n')}`,
          metadata: {
            runId: c.runId,
            claimKey: c.claimKey,
            description: c.description,
          },
        });
      }
    }

    for (const msg of allMessages) {
      if (msg.role === 'assistant') {
        const citations = repos.citations.listByMessage(msg.id);
        for (const cit of citations) {
          const src = sourceMap.get(cit.sourceId);
          citationInputs.push({
            entityType: 'citation',
            entityId: cit.id,
            parentId: cit.runId,
            content: `Zitationsmarker [${cit.marker}]\n${cit.claimText ? `Aussage: ${cit.claimText}\n` : ''}${src ? `Quelle: ${src.title}` : `Quellen-ID: ${cit.sourceId}`}`,
            metadata: {
              messageId: cit.messageId,
              runId: cit.runId,
              marker: cit.marker,
              sourceId: cit.sourceId,
            },
          });
        }
      }
    }

    if (conflictInputs.length > 0) {
      await this.store.upsertBatch(conflictInputs);
      counts.conflict += conflictInputs.length;
    }
    if (citationInputs.length > 0) {
      await this.store.upsertBatch(citationInputs);
      counts.citation += citationInputs.length;
    }

    // 6. Tool Calls
    const toolCallInputs: VectorInput[] = [];
    for (const run of allRuns) {
      const calls = repos.toolCalls.listByRun(run.id);
      for (const call of calls) {
        toolCallInputs.push({
          entityType: 'tool_call',
          entityId: call.id,
          parentId: call.runId,
          content: `Tool-Aufruf: ${call.toolName}\nArgumente: ${JSON.stringify(call.args)}\nStatus: ${call.status}${call.resultSummary ? `\nErgebnis: ${call.resultSummary}` : ''}`,
          metadata: {
            runId: call.runId,
            toolName: call.toolName,
            status: call.status,
            durationMs: call.durationMs,
          },
        });
      }
    }

    if (toolCallInputs.length > 0) {
      await this.store.upsertBatch(toolCallInputs);
      counts.tool_call += toolCallInputs.length;
    }

    const totalIndexed = Object.values(counts).reduce((a, b) => a + b, 0);
    const durationMs = Date.now() - started;

    logger.info('Vektor-Synchronisierung abgeschlossen', {
      module: 'vector',
      totalIndexed,
      counts,
      durationMs,
    });

    return {
      indexed: totalIndexed,
      byType: counts,
      durationMs,
    };
  }
}

let defaultIndexer: VectorIndexer | undefined;

export function getVectorIndexer(store?: VectorStore): VectorIndexer {
  if (store) return new VectorIndexer(store);
  if (!defaultIndexer) {
    defaultIndexer = new VectorIndexer(getVectorStore());
  }
  return defaultIndexer;
}

export function resetVectorIndexer(): void {
  defaultIndexer = undefined;
}
