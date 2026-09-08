/** Sicherer Ausdrucksparser (Shunting-Yard) ohne dynamische Codeausführung (Spec 21, FR-21-02). */
export type CalcResult = { ok: true; value: number } | { ok: false; error: string };

type Token = { type: 'num'; value: number } | { type: 'op'; value: string } | { type: 'paren'; value: '(' | ')' };

const PRECEDENCE: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3 };
const RIGHT_ASSOC = new Set(['^']);

function tokenize(input: string): Token[] | undefined {
  const tokens: Token[] = [];
  const normalized = input
    .replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\s+/g, '');
  let i = 0;
  while (i < normalized.length) {
    const char = normalized[i] as string;
    if (/[0-9.]/.test(char)) {
      let num = '';
      while (i < normalized.length && /[0-9.]/.test(normalized[i] as string)) {
        num += normalized[i];
        i++;
      }
      const value = Number(num);
      if (!Number.isFinite(value)) return undefined;
      tokens.push({ type: 'num', value });
      continue;
    }
    if (char in PRECEDENCE) {
      const previous = tokens[tokens.length - 1];
      const isUnary = char === '-' && (!previous || previous.type === 'op' || (previous.type === 'paren' && previous.value === '('));
      if (isUnary) {
        tokens.push({ type: 'num', value: 0 });
      }
      tokens.push({ type: 'op', value: char });
      i++;
      continue;
    }
    if (char === '(' || char === ')') {
      tokens.push({ type: 'paren', value: char });
      i++;
      continue;
    }
    return undefined; // nicht erlaubtes Zeichen
  }
  return tokens;
}

export function calculate(expression: string): CalcResult {
  if (expression.length > 200) return { ok: false, error: 'Ausdruck ist zu lang (max. 200 Zeichen)' };
  const tokens = tokenize(expression);
  if (!tokens || tokens.length === 0) return { ok: false, error: 'Ausdruck enthält unzulässige Zeichen' };

  const output: Token[] = [];
  const ops: Token[] = [];
  for (const token of tokens) {
    if (token.type === 'num') output.push(token);
    else if (token.type === 'op') {
      while (ops.length > 0) {
        const top = ops[ops.length - 1] as Token;
        if (top.type !== 'op') break;
        const topPrec = PRECEDENCE[top.value] ?? 0;
        const curPrec = PRECEDENCE[token.value] ?? 0;
        if (topPrec > curPrec || (topPrec === curPrec && !RIGHT_ASSOC.has(token.value))) {
          output.push(ops.pop() as Token);
        } else break;
      }
      ops.push(token);
    } else if (token.value === '(') ops.push(token);
    else {
      let found = false;
      while (ops.length > 0) {
        const top = ops.pop() as Token;
        if (top.type === 'paren' && top.value === '(') { found = true; break; }
        output.push(top);
      }
      if (!found) return { ok: false, error: 'Klammern sind unausgeglichen' };
    }
  }
  while (ops.length > 0) {
    const top = ops.pop() as Token;
    if (top.type === 'paren') return { ok: false, error: 'Klammern sind unausgeglichen' };
    output.push(top);
  }

  const stack: number[] = [];
  for (const token of output) {
    if (token.type === 'num') { stack.push(token.value); continue; }
    if (token.type !== 'op') return { ok: false, error: 'Ungültiger Ausdruck' };
    const b = stack.pop();
    const a = stack.pop();
    if (a === undefined || b === undefined) return { ok: false, error: 'Ungültiger Ausdruck' };
    switch (token.value) {
      case '+': stack.push(a + b); break;
      case '-': stack.push(a - b); break;
      case '*': stack.push(a * b); break;
      case '/':
        if (b === 0) return { ok: false, error: 'Division durch null' };
        stack.push(a / b);
        break;
      case '%':
        if (b === 0) return { ok: false, error: 'Division durch null' };
        stack.push(a % b);
        break;
      case '^': stack.push(Math.pow(a, b)); break;
      default: return { ok: false, error: 'Unbekannter Operator' };
    }
  }
  const value = stack.pop();
  if (value === undefined || stack.length > 0 || !Number.isFinite(value)) {
    return { ok: false, error: 'Ungültiger Ausdruck' };
  }
  return { ok: true, value };
}

export function formatNumber(value: number): string {
  if (Math.abs(value) >= 1e15 || (value !== 0 && Math.abs(value) < 1e-6)) return value.toExponential(6);
  return Number(value.toPrecision(15)).toLocaleString('de-DE', { maximumFractionDigits: 10 });
}
