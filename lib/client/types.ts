/** Client-seitige Sichten auf API-Daten. */
import type { Citation, Conversation, Message, RunStatus, SourceRecord } from '@/lib/contracts/domain';

export interface ConversationSummary extends Conversation {
  messageCount: number;
  lastRunStatus: RunStatus | null;
}

export interface MessageView extends Message {
  citations: Citation[];
}

export interface ConversationDetail {
  conversation: Conversation;
  messages: MessageView[];
  sources: SourceRecord[];
  lastRun: { id: string; status: RunStatus } | null;
}

export type Mode = 'auto' | 'chat' | 'research';
