---
id: 22-tool-file-search-retrieval
title: File Search & Retrieval
phase: 7
milestone: V2
status: draft
depends_on: [18-tool-system-core, 32-file-upload-and-documents]
provides: [file_search]
complexity: L
---

# File Search & Retrieval

> Kurzform-Spec (V1/V2). Vor der Implementierung ins Vollformat aus `PROMPT-1` überführen.

## Purpose
Semantische Suche in hochgeladenen Dokumenten, damit der Agent Dokumentenwissen wie Webquellen behandeln kann.

## Scope / Out of Scope
In Scope: Chunking, Embeddings, Vektorspeicher, `file_search`-Tool, Zitierfähigkeit auf Chunk-Ebene.
Out of Scope: Parsing der Dateien (Spec 32), Websuche (Spec 19).

## Functional Requirements
- `FR-22-01` Dokumente MÜSSEN in überlappende Chunks (800 Token, 15 % Overlap) zerlegt werden.
- `FR-22-02` Embeddings MÜSSEN über den LLM-Provider erzeugt und persistiert werden.
- `FR-22-03` `file_search(query, k)` MUSS die k relevantesten Chunks mit Dateiname, Seite/Position und Score liefern.
- `FR-22-04` Treffer MÜSSEN als Sources mit `source_type: primary` zitierfähig sein.
- `FR-22-05` Der Vektorspeicher MUSS austauschbar sein (SQLite-Tabelle im MVP, externer Store später).

## Acceptance Criteria
- `AC-22-01` Given ein Dokument mit bekanntem Satz, When danach gesucht wird, Then ist der zugehörige Chunk unter den Top 3.
- `AC-22-02` Given ein Treffer, Then entsteht eine zitierfähige Quelle mit Positionsangabe.

## Dependencies
18, 32.

## Implementation Notes
Kosinusähnlichkeit in SQL oder im Speicher; bei > 50 000 Chunks externer Store nötig (ADR).
