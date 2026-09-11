import type { Citation, Conversation, Message, ResearchOptions, RunStatus, SourceRecord } from '@/lib/contracts/domain';
export type { ResearchOptions };

export interface ConversationSummary extends Conversation {
  messageCount: number;
  lastRunStatus: RunStatus | null;
}

export interface MessageView extends Message {
  citations: Citation[];
  researchOptions?: ResearchOptions;
}

export interface ConversationDetail {
  conversation: Conversation;
  messages: MessageView[];
  sources: SourceRecord[];
  lastRun: { id: string; status: RunStatus } | null;
}

export type Mode =
  | 'auto'
  | 'chat'
  | 'research'
  | 'deep_research'
  | 'web_lookup'
  | 'comparison'
  | 'data_analysis'
  | 'report_generation';
