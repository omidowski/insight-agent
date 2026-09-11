import type { Mode } from './types';
import type { ResearchDepth, ResearchOutputFormat, ResearchTimeframe, ResearchOptions } from '@/lib/contracts/domain';

export type BadgeTone = 'accent' | 'purple' | 'amber' | 'cyan' | 'emerald' | 'blue' | 'muted';

export interface ResearchModeConfig {
  id: Mode;
  name: string;
  shortName: string;
  badge: string;
  badgeTone: BadgeTone;
  icon: string;
  shortDesc: string;
  description: string;
  highlights: string[];
  defaultOptions?: ResearchOptions;
  samplePrompts: string[];
}

export const RESEARCH_MODES: ResearchModeConfig[] = [
  {
    id: 'auto',
    name: 'Auto (Intelligent)',
    shortName: 'Auto',
    badge: 'Autonom',
    badgeTone: 'accent',
    icon: '✨',
    shortDesc: 'Agent entscheidet dynamisch je nach Frage',
    description: 'Analysiert die Komplexität der Anfrage automatisch und wählt den optimalen Pfad (Chat, Schnellsuche oder Tiefenrecherche).',
    highlights: ['Dynamisches Budget', 'Maximale Effizienz', 'Empfohlener Standard'],
    defaultOptions: {},
    samplePrompts: [
      'Wer ist Jamal Musiala und welche Erfolge feierte er bisher?',
      'Wie funktioniert Reinforcement Learning with Verifiable Rewards?',
      'Vergleiche SQLite und DuckDB für lokale KI-Anwendungen',
    ],
  },
  {
    id: 'deep_research',
    name: 'Deep Research',
    shortName: 'Deep',
    badge: 'Gründlich',
    badgeTone: 'purple',
    icon: '🔬',
    shortDesc: 'Iterative Tiefenrecherche mit Quellenprüfung',
    description: 'Mehrstufige Quellenrecherche mit detailliertem Rechercheplan, Quervergleichen, Widerspruchsprüfung und lückenlosen Citations.',
    highlights: ['Bis zu 12 Suchrunden & 15 Quellen', 'Konflikterkennung', 'Vollständiger Belegapparat'],
    defaultOptions: { depth: 'deep', outputFormat: 'standard' },
    samplePrompts: [
      'Umfassende Marktanalyse autonomer KI-Coding-Agenten im Jahr 2026',
      'Aktueller Forschungsstand zu Feststoffbatterien für Elektromobilität',
      'Regulatorische Anforderungen des EU AI Act an generative Modelle',
    ],
  },
  {
    id: 'web_lookup',
    name: 'Schnellsuche (Web Lookup)',
    shortName: 'Schnellsuche',
    badge: 'Echtzeit',
    badgeTone: 'amber',
    icon: '⚡',
    shortDesc: 'Tagesaktuelle Fakten, Kurse & News',
    description: 'Gezielte, blitzschnelle Web-Recherche für Live-Daten, aktuelle Ereignisse, Wetter, Termine und Kennzahlen.',
    highlights: ['Minimalste Latenz', 'Gezielte Top-Quellen', 'Ideal für Live-Daten'],
    defaultOptions: { depth: 'quick', timeframe: 'day' },
    samplePrompts: [
      'Wie steht der DAX und der EUR/USD Wechselkurs heute?',
      'Wann findet der nächste SpaceX-Raketenstart statt?',
      'Aktuelle Nachrichten und Schlagzeilen zum Halbleitermarkt',
    ],
  },
  {
    id: 'comparison',
    name: 'Vergleich & Matrix',
    shortName: 'Vergleich',
    badge: 'Matrix',
    badgeTone: 'cyan',
    icon: '⚖️',
    shortDesc: 'Gegenüberstellung von Optionen & Produkten',
    description: 'Systematische Gegenüberstellung von Alternativen mit tabellarischer Matrix, Vor- und Nachteilen sowie begründetem Fazit.',
    highlights: ['Markdown-Vergleichstabelle', 'Kriterien-Matrix', 'Vor- & Nachteile'],
    defaultOptions: { depth: 'standard', outputFormat: 'comparison_table' },
    samplePrompts: [
      'Vergleiche Next.js App Router vs Remix für große B2B-Anwendungen',
      'PostgreSQL mit pgvector vs spezialisierte Vektordatenbanken wie Qdrant',
      'Vergleich von Claude 3.5 Sonnet vs GPT-4o für Software-Engineering',
    ],
  },
  {
    id: 'data_analysis',
    name: 'Daten & Kennzahlen',
    shortName: 'Daten',
    badge: 'Metriken',
    badgeTone: 'emerald',
    icon: '📊',
    shortDesc: 'Quantitative Zahlen, KPIs & Rechnen',
    description: 'Fokus auf statistische Kennzahlen, Trends, tabellarische Messwerte und Rechen-Tools zur Faktenprüfung.',
    highlights: ['Aktivierter Rechner', 'Präzise Zahlen & Einheiten', 'Statistische Validierung'],
    defaultOptions: { depth: 'standard' },
    samplePrompts: [
      'BIP-Wachstum und Inflationsraten der führenden Industrienationen',
      'Aktuelle Marktanteile von Smartphone-Betriebssystemen weltweit',
      'Finanzkennzahlen und Umsatzentwicklung von NVIDIA der letzten 4 Quartale',
    ],
  },
  {
    id: 'report_generation',
    name: 'Ausführlicher Report',
    shortName: 'Report',
    badge: 'Langform',
    badgeTone: 'blue',
    icon: '📑',
    shortDesc: 'Gegliederter Langform-Bericht',
    description: 'Erstellt einen vollständigen, formalen Recherchebericht mit Executive Summary, Gliederung, Kapitelanalysen und Quellenverzeichnis.',
    highlights: ['Executive Summary', 'Vollständige Kapitelstruktur', 'Detaillierter Anhang'],
    defaultOptions: { depth: 'deep', outputFormat: 'detailed_report' },
    samplePrompts: [
      'Erstelle einen umfassenden Branchenreport über autonome Agenten in der Medizin',
      'Detaillierter Bericht zur globalen Lieferkette von Seltenerdmetallen',
      'Strategischer Report zur Energiewende und Netzstabilität in Europa',
    ],
  },
  {
    id: 'chat',
    name: 'Direkter Chat',
    shortName: 'Chat',
    badge: 'Direkt',
    badgeTone: 'muted',
    icon: '💬',
    shortDesc: 'Sofortige Antwort ohne Web-Recherche',
    description: 'Beantwortet Fragen direkt aus dem Wissen des Modells ohne Websuche. Perfekt für Programmierung, Textgestaltung und Brainstorming.',
    highlights: ['Sofortige Antwort', 'Kein Such-Overhead', 'Ideal für Coding & Text'],
    defaultOptions: {},
    samplePrompts: [
      'Erkläre das Repository-Pattern in TypeScript mit einem Code-Beispiel',
      'Schreibe einen Entwurf für eine Release-Ankündigung eines Open-Source-Tools',
      'Wie unterscheidet sich Prozess- von Thread-Scheduling?',
    ],
  },
];

export function getResearchMode(id: Mode): ResearchModeConfig {
  const normalized = id === 'research' ? 'deep_research' : id;
  return (RESEARCH_MODES.find((m) => m.id === normalized) ?? RESEARCH_MODES[0]) as ResearchModeConfig;
}

export const TIMEFRAME_LABELS: Record<ResearchTimeframe, string> = {
  all: 'Beliebig (Alle Zeiten)',
  day: 'Letzte 24 Stunden',
  week: 'Letzte Woche',
  month: 'Letzter Monat',
  year: 'Letztes Jahr',
};

export const DEPTH_LABELS: Record<ResearchDepth, { label: string; desc: string }> = {
  quick: { label: 'Schnell', desc: '1 Runde, bis zu 5 Quellen' },
  standard: { label: 'Standard', desc: '2 Runden, bis zu 10 Quellen' },
  deep: { label: 'Tief', desc: 'Bis zu 3 Runden & 15 Quellen' },
};

export const OUTPUT_FORMAT_LABELS: Record<ResearchOutputFormat, { label: string; icon: string }> = {
  standard: { label: 'Standard-Text', icon: '📝' },
  detailed_report: { label: 'Ausführlicher Bericht', icon: '📑' },
  comparison_table: { label: 'Vergleichstabelle', icon: '⚖️' },
  bullet_points: { label: 'Prägnante Stichpunkte', icon: '📌' },
};
