/**
 * Lokaler Stub-Server für Tests (Spec 42).
 *
 * Er spricht echtes HTTP in den Formaten der realen Anbieter:
 *   POST /v1/chat/completions  — OpenAI-kompatibel (auch streamend)
 *   GET  /v1/models            — Modellkatalog
 *   POST /search               — Tavily-kompatible Websuche
 *   GET  /pages/:slug          — Testseiten als Rechercheziele
 *
 * Dadurch enthält die Anwendung selbst keinerlei simulierte Logik: Sie ruft denselben
 * Provider-Code auf wie in Produktion, nur zeigt die Basis-URL auf diesen Server.
 */
import { createServer, type Server } from 'node:http';
import { FakeLLMProvider } from './fake-llm';
import { TEST_PAGES, findTestPage, testPageUrl } from './pages';
import type { LLMInput } from '@/lib/llm/provider';

const MODELS = [
  'stub/fast', 'stub/main', 'meta/llama-3.3-70b-instruct', 'qwen/qwen2.5-72b-instruct',
];

/** Leitet den Aufrufzweck aus dem System-Prompt ab (der Stub kennt keine internen Felder). */
function purposeOf(system: string): string {
  if (/klassifizierst Nutzeranfragen/i.test(system)) return 'router';
  if (/zerlegst eine Rechercheaufgabe/i.test(system)) return 'plan';
  if (/formulierst präzise Websuchanfragen/i.test(system)) return 'queries';
  if (/extrahierst belegbare Angaben/i.test(system)) return 'extraction';
  if (/schreibst die Endantwort/i.test(system)) return 'synthesis';
  if (/erzeugst einen kurzen Titel/i.test(system)) return 'title';
  if (/entscheidest, ob eine Folgefrage/i.test(system)) return 'followup';
  return 'conversation';
}

/** Wandelt den gerenderten Nutzertext zurück in die strukturierte Eingabe des Providers. */
function parseInput(userContent: string): LLMInput[] {
  const input: LLMInput[] = [];
  const blockPattern = /<<<([^>]+)>>>\n([\s\S]*?)\n<<<END \1>>>/g;
  let rest = userContent;
  for (const match of userContent.matchAll(blockPattern)) {
    input.push({ role: 'data', label: match[1] as string, content: match[2] as string });
    rest = rest.replace(match[0], '');
  }
  for (const line of rest.split('\n')) {
    const user = /^NUTZER:\s*(.*)$/.exec(line.trim());
    if (user) input.push({ role: 'user', text: user[1] as string });
    const assistant = /^ASSISTENT:\s*(.*)$/.exec(line.trim());
    if (assistant) input.push({ role: 'assistant', text: assistant[1] as string });
  }
  if (!input.some((i) => i.role === 'user')) {
    input.push({ role: 'user', text: rest.replace(/Die folgenden Blöcke[^\n]*/g, '').trim() });
  }
  return input;
}

export interface StubServer {
  origin: string;
  baseUrlV1: string;
  requests: { path: string; model?: string }[];
  close: () => Promise<void>;
}

export async function handleStubRequest(
  url: URL,
  method: string,
  payload: Record<string, unknown> = {},
  origin = 'http://127.0.0.1',
  fake = new FakeLLMProvider(),
): Promise<Response> {
  const normMethod = method.toUpperCase();
  if (normMethod === 'GET' && url.pathname === '/v1/models') {
    return new Response(JSON.stringify({ data: MODELS.map((id) => ({ id, object: 'model' })) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (normMethod === 'GET' && url.pathname.startsWith('/pages/')) {
    const page = findTestPage(url.pathname.slice('/pages/'.length));
    if (!page) {
      return new Response('not found', { status: 404, headers: { 'Content-Type': 'text/plain' } });
    }
    return new Response(page.html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  if (url.pathname === '/robots.txt') {
    return new Response('User-agent: *\nAllow: /\n', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  if (normMethod === 'POST' && url.pathname === '/search') {
    const query = String(payload.query ?? '').toLowerCase();
    const terms = query.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 4);
    const hits = TEST_PAGES
      .filter((p) => p.slug !== 'injection-trap')
      .map((page) => ({
        page,
        score: terms.reduce(
          (n, term) => n + (page.keywords.some((k) => k.startsWith(term) || term.startsWith(k)) ? 1 : 0),
          0,
        ),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Number(payload.max_results ?? 8));

    return new Response(
      JSON.stringify({
        results: hits.map((h) => ({
          title: h.page.title,
          url: testPageUrl(h.page.slug, origin),
          content: h.page.snippet,
          published_date: h.page.publishedAt,
        })),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (normMethod === 'POST' && url.pathname === '/v1/chat/completions') {
    const messages = (payload.messages ?? []) as { role: string; content: string }[];
    const system = messages.find((m) => m.role === 'system')?.content ?? '';
    const user = messages.find((m) => m.role === 'user')?.content ?? '';
    const purpose = purposeOf(system);
    const input = parseInput(user);

    let content: string;
    if (payload.response_format) {
      const object = await fake.generateObjectRaw(purpose, input);
      content = JSON.stringify(object);
    } else {
      content = await fake.generateRawText(purpose, input);
    }

    if (payload.stream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          for (let i = 0; i < content.length; i += 40) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: content.slice(i, i + 40) } }] })}\n\n`),
            );
          }
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ choices: [{ delta: {} }], usage: { prompt_tokens: 10, completion_tokens: 20 } })}\n\n`,
            ),
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    return new Response(
      JSON.stringify({
        choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 20 },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(JSON.stringify({ error: { message: `unbekannter Pfad ${url.pathname}` } }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function startStubServer(port = 0): Promise<StubServer> {
  const fake = new FakeLLMProvider();
  const requests: { path: string; model?: string }[] = [];

  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');

    if (req.method === 'GET' && url.pathname === '/v1/models') {
      requests.push({ path: url.pathname });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: MODELS.map((id) => ({ id, object: 'model' })) }));
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/pages/')) {
      const page = findTestPage(url.pathname.slice('/pages/'.length));
      if (!page) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(page.html);
      return;
    }

    if (url.pathname === '/robots.txt') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('User-agent: *\nAllow: /\n');
      return;
    }

    let body = '';
    req.on('data', (chunk) => { body += String(chunk); });
    req.on('end', () => {
      void (async () => {
        try {
          const payload = body ? (JSON.parse(body) as Record<string, unknown>) : {};

          if (req.method === 'POST' && url.pathname === '/search') {
            const query = String(payload.query ?? '').toLowerCase();
            const terms = query.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 4);
            const hits = TEST_PAGES
              .filter((p) => p.slug !== 'injection-trap')
              .map((page) => ({
                page,
                score: terms.reduce(
                  (n, term) => n + (page.keywords.some((k) => k.startsWith(term) || term.startsWith(k)) ? 1 : 0),
                  0,
                ),
              }))
              .filter((x) => x.score > 0)
              .sort((a, b) => b.score - a.score)
              .slice(0, Number(payload.max_results ?? 8));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              results: hits.map((h) => ({
                title: h.page.title,
                url: testPageUrl(h.page.slug, origin),
                content: h.page.snippet,
                published_date: h.page.publishedAt,
              })),
            }));
            return;
          }

          if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
            const model = String(payload.model ?? 'stub/main');
            requests.push({ path: url.pathname, model });
            const messages = (payload.messages ?? []) as { role: string; content: string }[];
            const system = messages.find((m) => m.role === 'system')?.content ?? '';
            const user = messages.find((m) => m.role === 'user')?.content ?? '';
            const purpose = purposeOf(system);
            const input = parseInput(user);

            let content: string;
            if (payload.response_format) {
              const object = await fake.generateObjectRaw(purpose, input);
              content = JSON.stringify(object);
            } else {
              content = await fake.generateRawText(purpose, input);
            }

            if (payload.stream) {
              res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
              });
              for (let i = 0; i < content.length; i += 40) {
                res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: content.slice(i, i + 40) } }] })}\n\n`);
              }
              res.write(`data: ${JSON.stringify({ choices: [{ delta: {} }], usage: { prompt_tokens: 10, completion_tokens: 20 } })}\n\n`);
              res.write('data: [DONE]\n\n');
              res.end();
              return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }],
              usage: { prompt_tokens: 10, completion_tokens: 20 },
            }));
            return;
          }

          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: `unbekannter Pfad ${url.pathname}` } }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: String(err) } }));
        }
      })();
    });
  });

  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  const address = server.address();
  const boundPort = typeof address === 'object' && address ? address.port : port;
  const origin = `http://127.0.0.1:${boundPort}`;

  return {
    origin,
    baseUrlV1: `${origin}/v1`,
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
