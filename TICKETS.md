# Backlog — V1

Abgeleitet aus den V1-Specs unter `specs/` (29, 34, 35, 41, 44, 45).
ticketbot nimmt stündlich das erste unerledigte `- [ ]`.
Zustände: `- [ ]` offen · `- [x]` erledigt · `- [!]` blockiert (setzt der Bot).

Für jedes Ticket gilt: die zugehörige Spec ist eine **Kurzform**. Verbindlich ist der Ticket-Text;
die Spec liefert Kontext. Wird eine Spec erweitert, gehört die Änderung in dieselbe Commit-Einheit.
Bestehende Konventionen gelten unverändert: deutsche Texte, englische Bezeichner, Zod als
Schema-Quelle, kein `any`, keine Agentenlogik im Frontend, Tests neben dem Code.

## Phase A — Betrieb und Auslieferung (Spec 44)

- [ ] TICKET-001: CI-Workflow für Typecheck, Lint, Test und Build
      Spec 44, FR-44-01. GitHub-Actions-Workflow anlegen, der bei jedem Push und Pull Request
      auf `main` läuft: `npm ci`, dann `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
      Node-Version aus `engines` in package.json ableiten (>= 22), `actions/setup-node` mit npm-Cache.
      Der Smoke-Test bleibt außen vor, weil er einen Produktionsbuild startet — dafür kommt TICKET-002.
      Akzeptanz: Datei `.github/workflows/ci.yml` existiert, ist gültiges YAML, führt genau diese vier
      Schritte aus und setzt keine Secrets voraus.
      Dateien: `.github/workflows/ci.yml`
- [ ] TICKET-002: Smoke-Test in die CI aufnehmen
      Spec 44, FR-44-01. Zweiter Job im bestehenden Workflow, der nach dem Build `npm run test:smoke`
      ausführt. Der Smoke-Test startet den Produktionsbuild und den lokalen Stub-Server (ADR-014),
      braucht also keine Schlüssel. Job so einrichten, dass er den Build aus dem ersten Job
      wiederverwendet oder selbst baut, und mit einem Zeitlimit von 15 Minuten versehen.
      Akzeptanz: Der Workflow enthält einen Job `smoke`, der `npm run test:smoke` ausführt.
      Dateien: `.github/workflows/ci.yml`
- [ ] TICKET-003: Dockerfile mit persistentem Datenverzeichnis
      Spec 44, FR-44-03 und FR-44-05. Mehrstufiges Dockerfile: Build-Stufe mit `npm ci` und
      `npm run build`, schlanke Laufzeitstufe mit Node >= 22, non-root-Nutzer, `VOLUME /data`,
      `ENV DATABASE_PATH=/data/app.db`, `EXPOSE 3000`, Start über `npm start`.
      Keine Secrets im Image; alle Schlüssel kommen zur Laufzeit aus Umgebungsvariablen.
      `.dockerignore` mit `node_modules`, `.next`, `data`, `.env*`, `tests`.
      Akzeptanz: `docker build .` läuft durch; das Image enthält keine `.env`-Datei.
      Dateien: `Dockerfile`, `.dockerignore`
- [ ] TICKET-004: Readiness-Probe und Startprüfung der Migrationen
      Spec 44, FR-44-02 und FR-44-04. `/api/health` liefert bereits Zustand; ergänzen um
      `migrations: { applied: string[], pending: number }`, damit die Probe erkennt, ob das Schema
      aktuell ist. Migrationen laufen laut Spec 04 beim ersten DB-Zugriff — sicherstellen, dass ein
      zweiter Lauf nichts ändert, und das mit einem Test belegen.
      Antwort MUSS `ok: false` liefern, wenn Migrationen fehlschlagen.
      Akzeptanz: Test prüft, dass `/api/health` die angewandten Migrationen nennt und ein zweiter
      Migrationslauf eine leere Liste zurückgibt.
      Dateien: `app/api/health/route.ts`, `lib/db/client.ts`, `tests/integration/api.test.ts`

## Phase B — Mehrbenutzerbetrieb (Specs 34, 35)

- [ ] TICKET-005: Datenmodell und Migration für Nutzerkonten
      Spec 34. Migration `004_auth` ergänzen: `users` um `password_hash TEXT NULL`,
      `email_verified_at TEXT NULL`, `created_at` beibehalten; neue Tabelle
      `sessions(id TEXT PK, user_id TEXT, expires_at TEXT, created_at TEXT, user_agent TEXT NULL)`
      mit Index auf `user_id` und Fremdschlüssel mit Kaskadenlöschung.
      Repository `users` um `findByEmail`, `createWithPassword`, `setPassword` erweitern,
      neues Repository `sessions` mit `create`, `get`, `deleteExpired`, `deleteForUser`.
      Noch keine Routen, keine UI — nur Schema und Repositories mit Tests.
      Akzeptanz: Migration idempotent, Repository-Tests decken Anlegen, Finden und Kaskadenlöschung ab.
      Dateien: `lib/db/migrations.ts`, `lib/db/repositories/index.ts`, `tests/unit/db.test.ts`
- [ ] TICKET-006: Passwort-Hashing mit Argon2id
      Spec 34, FR-34-01. Modul `lib/auth/password.ts` mit `hashPassword` und `verifyPassword`.
      Argon2id ist gefordert; Node bringt kein Argon2 mit. Prüfe zuerst, ob `node:crypto` eine
      geeignete Funktion bereitstellt — falls nicht, ist `scrypt` aus `node:crypto` mit dokumentierten
      Parametern die Alternative, und die Abweichung gehört als ADR nach `specs/DECISIONS.md` sowie in
      die Spec 34. Keine neue Laufzeitabhängigkeit ohne ADR (Spec 03, FR-03-07).
      Konstante Vergleichszeit über `timingSafeEqual`.
      Akzeptanz: Tests für Hash/Verify, falsches Passwort, geänderter Hash pro Aufruf (Salt),
      und ein Test, der belegt, dass der Vergleich nicht früh abbricht.
      Dateien: `lib/auth/password.ts`, `tests/unit/password.test.ts`, ggf. `specs/DECISIONS.md`, `specs/34-authentication.md`
- [ ] TICKET-007: Session-Verwaltung mit sicheren Cookies
      Spec 34, FR-34-02. `lib/auth/session.ts`: Session anlegen, aus dem Request lesen, beenden.
      Cookie `httpOnly`, `secure` (außer bei `NODE_ENV=development`), `sameSite=lax`, Pfad `/`,
      Gültigkeit 30 Tage; Session-ID zufällig aus `randomBytes(32)`, in der Datenbank gespeichert,
      nicht im Cookie signiert abgelegt.
      Abgelaufene Sessions werden beim Lesen verworfen und gelöscht.
      Akzeptanz: Tests für Anlegen, Lesen, Ablauf, Abmelden; Cookie-Attribute werden geprüft.
      Dateien: `lib/auth/session.ts`, `tests/unit/session.test.ts`
- [ ] TICKET-008: Registrierung, Anmeldung und Abmeldung
      Spec 34, FR-34-01 und FR-34-04. Endpunkte `POST /api/auth/register`, `POST /api/auth/login`,
      `POST /api/auth/logout` über `withApi` aus `lib/api/handler.ts`, Eingaben mit Zod validiert
      (E-Mail-Format, Passwort mindestens 12 Zeichen).
      Fehlerfälle nutzen die vorhandene Fehler-Envelope; bei falschen Zugangsdaten IMMER dieselbe
      Meldung, damit vorhandene Konten nicht erkennbar sind. Ratelimit auf Anmeldeversuche
      (10 pro Stunde je IP) über `lib/util/rate-limit.ts`.
      Akzeptanz: Integrationstests für Registrieren, Anmelden, falsches Passwort, Abmelden.
      Dateien: `app/api/auth/*/route.ts`, `lib/contracts/schemas.ts`, `tests/integration/auth.test.ts`
- [ ] TICKET-009: AUTH_ENABLED-Schalter ohne Verhaltensänderung im Einzelbetrieb
      Spec 34, FR-34-03. `withApi` löst den Nutzer künftig über `lib/auth/current-user.ts` auf:
      Bei `AUTH_ENABLED=false` bleibt es beim festen `local-user` wie bisher; bei `true` wird die
      Session ausgewertet und ohne gültige Session `401` mit `UNAUTHORIZED` geliefert.
      Die Auth-Routen selbst bleiben auch bei `false` erreichbar, damit man Konten vorbereiten kann.
      Akzeptanz: Bestehende Tests laufen unverändert grün (Standard ist `false`); neuer Test belegt
      `401` bei `AUTH_ENABLED=true` ohne Session.
      Dateien: `lib/api/handler.ts`, `lib/auth/current-user.ts`, `tests/integration/auth.test.ts`
- [ ] TICKET-010: Ownership-Prüfung in den Repositories verankern
      Spec 35, FR-35-01 und FR-35-03. Alle lesenden und schreibenden Repository-Methoden für
      `runs`, `steps`, `events`, `sources`, `excerpts`, `citations`, `conflicts`, `toolCalls` und
      `usage` erhalten einen verpflichtenden `userId`-Parameter und filtern darauf — heute prüft nur
      `conversations`. Fremdzugriff liefert `undefined` bzw. eine leere Liste, die Handler daraus `404`.
      Kein `403`, um die Existenz nicht preiszugeben.
      Akzeptanz: Test legt Daten für Nutzer A an und weist nach, dass Nutzer B über jede Methode
      nichts sieht; alle bestehenden Tests bleiben grün.
      Dateien: `lib/db/repositories/index.ts`, `app/api/**/route.ts`, `tests/unit/db.test.ts`
- [ ] TICKET-011: Ownership im SSE-Stream und automatischer Routen-Test
      Spec 35, FR-35-02 und FR-35-04. Der Event-Stream prüft den Eigentümer vor dem ersten Chunk und
      liefert sonst `404`. Zusätzlich ein Test, der alle Dateien unter `app/api` einliest, die
      exportierten Methoden ermittelt und für jede eine Ownership-Prüfung nachweist — neue Routen
      ohne Prüfung lassen den Test fehlschlagen.
      Akzeptanz: Zugriff auf einen fremden Run-Stream ergibt `404`; der Routen-Test erkennt eine
      absichtlich ungeprüfte Testroute.
      Dateien: `app/api/runs/[id]/events/route.ts`, `tests/integration/ownership.test.ts`

## Phase C — Belastbare Ausführung (Spec 45)

- [ ] TICKET-012: Warteschlange und Worker für Runs
      Spec 45, FR-45-01. Tabelle `run_queue(run_id TEXT PK, state TEXT, attempts INTEGER,
      claimed_at TEXT NULL, created_at TEXT)` mit Migration `005_run_queue`.
      `POST /api/runs` stellt künftig nur noch ein statt direkt auszuführen (ersetzt ADR-006);
      ein In-Process-Worker in `lib/agent/worker.ts` holt Einträge mit atomarem Claim
      (`UPDATE ... WHERE state='queued'`) und ruft `executeRun` auf. Nebenläufigkeit über
      `MAX_CONCURRENT_RUNS` begrenzen.
      Akzeptanz: Test stellt drei Runs ein und weist nach, dass jeder genau einmal ausgeführt wird,
      auch bei zwei gleichzeitig laufenden Workern.
      Dateien: `lib/agent/worker.ts`, `lib/db/migrations.ts`, `app/api/runs/route.ts`, `tests/integration/worker.test.ts`
- [ ] TICKET-013: Unterbrochene Runs nach Neustart fortsetzen
      Spec 45, FR-45-02 und FR-45-03. Beim Start prüft der Worker auf Runs im Zustand `running`,
      deren Claim älter als `RUN_STALE_AFTER_MS` ist, und nimmt sie ab dem ersten nicht
      abgeschlossenen Schritt wieder auf. Schritte mit Status `completed` werden übersprungen.
      Wiederholtes Ausführen darf keine doppelten Quellen, Nachrichten oder Events erzeugen —
      Quellen sind über `UNIQUE(run_id, canonical_url)` geschützt, für Nachrichten und Events sind
      Idempotenzschlüssel zu ergänzen.
      Akzeptanz: Test bricht einen Run nach Schritt 2 ab, startet den Worker neu und weist nach,
      dass ab Schritt 3 fortgesetzt wird und keine Quelle doppelt vorliegt.
      Dateien: `lib/agent/worker.ts`, `lib/agent/orchestrator.ts`, `tests/integration/worker.test.ts`
- [ ] TICKET-014: Pausieren und Fortsetzen einzelner Runs
      Spec 45, FR-45-04. Endpunkte `POST /api/runs/:id/pause` und `POST /api/runs/:id/resume`.
      Pause setzt `runs.status = 'paused'` (der Zustand existiert bereits im Statusmodell) und wirkt
      wie der Abbruch über das persistente Flag aus ADR-011, ohne den Run zu beenden.
      Resume stellt ihn erneut in die Warteschlange. Die Statusübergangsmatrix in `lib/agent/state.ts`
      entsprechend erweitern.
      Akzeptanz: Test pausiert einen laufenden Run, prüft den Status und setzt ihn erfolgreich fort.
      Dateien: `app/api/runs/[id]/pause/route.ts`, `app/api/runs/[id]/resume/route.ts`, `lib/agent/state.ts`, `tests/integration/worker.test.ts`
- [ ] TICKET-015: Endgültiges Scheitern nach drei Versuchen
      Spec 45, FR-45-05. Der Worker zählt Versuche je Run in `run_queue.attempts`. Nach dem dritten
      Fehlschlag wird der Run endgültig `failed` mit einer Fehler-Envelope, die die Versuche nennt,
      und nicht erneut eingestellt. Zwischen den Versuchen exponentieller Abstand.
      Akzeptanz: Test lässt einen Run dreimal scheitern und weist nach, dass es keinen vierten
      Versuch gibt und der Endzustand `failed` ist.
      Dateien: `lib/agent/worker.ts`, `tests/integration/worker.test.ts`

## Phase D — Berichte (Spec 29)

- [ ] TICKET-016: Gliederung aus dem Rechercheplan erzeugen
      Spec 29, FR-29-02. Neues Modul `lib/agent/research/outline.ts`, das aus dem Plan und den
      vorhandenen Quellen eine Berichtsgliederung als Structured Output erzeugt: 3 bis 8 Abschnitte
      mit Titel, Leitfrage und den zugeordneten Quellennummern.
      Die Gliederung wird als neues Event `report.outline` sichtbar gemacht — Event-Typ und
      Payload-Schema gehören nach `lib/contracts/events.ts` und in die Tabelle in Spec 05.
      Akzeptanz: Unit-Test mit einem Plan erzeugt 3 bis 8 Abschnitte; der Contract-Test bleibt grün,
      also hat der neue Event-Typ ein Payload-Schema.
      Dateien: `lib/agent/research/outline.ts`, `lib/contracts/events.ts`, `specs/05-shared-contracts.md`, `tests/unit/outline.test.ts`
- [ ] TICKET-017: Abschnittsweise Erzeugung des Berichts
      Spec 29, FR-29-01 und FR-29-03. `lib/agent/research/report.ts` erzeugt je Abschnitt einen
      eigenen Modellaufruf mit nur den zugeordneten Quellen im Kontext und streamt das Ergebnis über
      die vorhandenen `message.delta`-Events. Der Task-Typ `report_generation` nutzt künftig diesen
      Pfad statt der Einzelsynthese.
      Reihenfolge: Gliederung, Abschnitte, Fazit, Quellenverzeichnis.
      Akzeptanz: Integrationstest mit dem Stub-Server liefert eine Antwort mit Gliederung,
      mindestens drei Abschnitten und Quellenverzeichnis.
      Dateien: `lib/agent/research/report.ts`, `lib/agent/orchestrator.ts`, `lib/agent/prompts/index.ts`, `tests/integration/report.test.ts`
- [ ] TICKET-018: Citations je Abschnitt erhalten
      Spec 29, FR-29-04. `applyCitations` aus `lib/agent/research/citations.ts` wird je Abschnitt
      angewendet, die Ergebnisse werden zusammengeführt; Marker bleiben über den ganzen Bericht
      hinweg eindeutig und zeigen weiterhin auf tatsächlich abgerufene Quellen.
      Akzeptanz: Test mit drei Abschnitten und überlappenden Quellen weist nach, dass jede Citation
      auf eine vorhandene Quelle zeigt und kein Marker doppelt vergeben wird.
      Dateien: `lib/agent/research/report.ts`, `lib/agent/research/citations.ts`, `tests/unit/citations.test.ts`
- [ ] TICKET-019: Fehlerhafte Abschnitte isolieren
      Spec 29, AC-29-02. Scheitert die Erzeugung eines Abschnitts, bleiben die übrigen erhalten;
      der betroffene Abschnitt erscheint mit einem Hinweis im Bericht, und der Run endet trotzdem
      als `completed`.
      Akzeptanz: Test lässt den zweiten von drei Abschnitten scheitern und prüft, dass Abschnitt 1
      und 3 im Ergebnis stehen und der Hinweis vorhanden ist.
      Dateien: `lib/agent/research/report.ts`, `tests/integration/report.test.ts`

## Phase E — Qualitätsmessung (Spec 41)

- [ ] TICKET-020: Golden-Set für die Bewertung anlegen
      Spec 41, FR-41-01. Verzeichnis `evals/` mit mindestens 20 Aufgaben als JSON: Anfrage,
      erwarteter Task-Typ, erwartete Fakten mit Toleranz, erwartete Quellenarten, Kennzeichen für
      erwartete Konflikte. Die Aufgaben müssen gegen den Stub-Server aus `tests/doubles/` laufen —
      Spec 41 nennt noch den Demo-Modus, den es seit ADR-013 nicht mehr gibt; die Spec ist
      entsprechend zu korrigieren.
      Akzeptanz: 20 Einträge, jeder validiert gegen ein Zod-Schema; ein Test prüft die Gültigkeit.
      Dateien: `evals/cases/*.json`, `evals/schema.ts`, `tests/unit/evals-schema.test.ts`, `specs/41-evaluation-harness.md`
- [ ] TICKET-021: Bewertungslauf mit Kennzahlen
      Spec 41, FR-41-02 und FR-41-03. Skript `npm run eval` führt jede Aufgabe über den Orchestrator
      gegen den Stub-Server aus und misst: Citation-Abdeckung, Anteil verifizierter Excerpts,
      Quellenvielfalt, erkannte Konflikte, Laufzeit und Kosten. Faktentreue wird gegen die
      Erwartungswerte geprüft, numerisch mit der Toleranz aus dem Fall.
      Akzeptanz: `npm run eval` läuft ohne Schlüssel durch und gibt alle Kennzahlen aus.
      Dateien: `scripts/eval.mjs` oder `evals/run.ts`, `package.json`, `tests/unit/evals-schema.test.ts`
- [ ] TICKET-022: Bericht mit Vergleich zum vorherigen Lauf
      Spec 41, FR-41-04 und AC-41-02. Ergebnisse werden als `evals/results/<zeitstempel>.json`
      abgelegt und mit dem jüngsten vorherigen Lauf verglichen; Ausgabe als Markdown-Tabelle mit
      Differenz je Kennzahl. Fällt die Citation-Abdeckung um mehr als 10 Prozentpunkte, endet der
      Lauf mit Exitcode 1.
      Akzeptanz: Test mit zwei erfundenen Ergebnisdateien belegt Vergleich und Fehlschlag bei
      Verschlechterung.
      Dateien: `evals/report.ts`, `tests/unit/evals-report.test.ts`

## Phase F — Später, nicht vom Bot

**TICKET-023: Postgres-Adapter für den Betrieb auf Vercel** — bewusst **ohne** Kontrollkästchen,
damit ticketbot es nicht aufgreift. Spec 44, FR-44-06 und ADR-002: zweiter Repository-Adapter,
Migrationsdialekt, Verbindungspooling, geänderte Ereignis-Sequenzvergabe. Zu groß für einen
45-Minuten-Lauf und zu grundlegend für eine unbeaufsichtigte Umsetzung.
Vorgehen: Spec 44 ins Vollformat überführen, ADR zur Adapterschnittstelle schreiben, dann in
vier bis sechs Tickets zerlegen und als `- [ ]` hier eintragen.
Dateien: `lib/db/adapters/postgres/*`, `specs/44-deployment-and-ci.md`, `specs/DECISIONS.md`
