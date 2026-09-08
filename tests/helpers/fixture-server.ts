import { createServer, type Server } from 'node:http';
import { findTestPage } from '../doubles/pages';

export interface FixtureServer {
  origin: string;
  close: () => Promise<void>;
}

/** Liefert die Fixture-Seiten über echtes HTTP aus, damit der komplette Abrufpfad getestet wird. */
export async function startFixtureServer(): Promise<FixtureServer> {
  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (url.pathname === '/robots.txt') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('User-agent: *\nAllow: /\n');
      return;
    }
    const match = /^\/pages\/([a-z0-9-]+)$/.exec(url.pathname);
    const page = match ? findTestPage(match[1] as string) : undefined;
    if (!page) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page.html);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
