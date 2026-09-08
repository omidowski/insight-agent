/**
 * Startet den Stub-Server einmal für die gesamte Testsuite und richtet die Umgebung darauf aus.
 * Die Anwendung läuft dabei mit ihrem echten Provider-Code gegen echtes HTTP (Spec 42).
 */
import { startStubServer, type StubServer } from './doubles/stub-server';

let stub: StubServer | undefined;

export async function setup(): Promise<void> {
  stub = await startStubServer();
  process.env.STUB_ORIGIN = stub.origin;
  process.env.LLM_PROVIDER = 'compatible';
  process.env.LLM_BASE_URL = stub.baseUrlV1;
  process.env.LLM_API_KEY = 'stub-key';
  process.env.LLM_MODEL_FAST = 'stub/fast';
  process.env.LLM_MODEL_MAIN = 'stub/main';
  process.env.SEARCH_PROVIDER = 'tavily';
  process.env.TAVILY_API_KEY = 'stub-key';
  process.env.TAVILY_BASE_URL = stub.origin;
}

export async function teardown(): Promise<void> {
  await stub?.close();
}
