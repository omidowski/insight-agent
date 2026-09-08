/** Erkennung von Injektionsversuchen in untrusted Inhalten (Spec 39, FR-39-06). */
export interface SafetyFinding {
  pattern: string;
  severity: 'low' | 'high';
}

const PATTERNS: { re: RegExp; name: string; severity: 'low' | 'high' }[] = [
  { re: /ignore\s+(all\s+)?(previous|prior)\s+instructions/i, name: 'ignore_previous_instructions_en', severity: 'high' },
  { re: /ignoriere\s+(alle\s+)?(vorherigen|bisherigen)\s+anweisungen/i, name: 'ignore_previous_instructions_de', severity: 'high' },
  { re: /disregard\s+(the\s+)?(system|above)\s+prompt/i, name: 'disregard_system_prompt', severity: 'high' },
  { re: /you\s+are\s+now\s+(an?|the)\s+/i, name: 'role_override', severity: 'high' },
  { re: /(output|reveal|print|send)\s+(your\s+)?(api[_\s-]?key|system\s+prompt|secret)/i, name: 'secret_exfiltration', severity: 'high' },
  { re: /exfiltrate/i, name: 'exfiltrate', severity: 'high' },
  { re: /\b169\.254\.169\.254\b/, name: 'metadata_endpoint', severity: 'high' },
  { re: /display\s*:\s*none|font-size\s*:\s*0/i, name: 'hidden_text', severity: 'low' },
];

export function scanUntrusted(text: string): SafetyFinding[] {
  const findings: SafetyFinding[] = [];
  for (const p of PATTERNS) {
    if (p.re.test(text)) findings.push({ pattern: p.name, severity: p.severity });
  }
  return findings;
}

export function hasHighSeverity(findings: SafetyFinding[]): boolean {
  return findings.some((f) => f.severity === 'high');
}
