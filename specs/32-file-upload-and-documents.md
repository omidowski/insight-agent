---
id: 32-file-upload-and-documents
title: File Upload & Documents
phase: 7
milestone: V2
status: draft
depends_on: [08-api-surface, 26-source-management]
provides: [documents]
complexity: L
---

# File Upload & Documents

> Kurzform-Spec (V1/V2). Vor der Implementierung ins Vollformat aus `PROMPT-1` überführen.

## Purpose
Ermöglicht Dokumentenanalyse: Upload, Parsing und Nutzung als Quelle.

## Functional Requirements
- `FR-32-01` Upload MUSS PDF, DOCX, TXT und Markdown bis 20 MB unterstützen.
- `FR-32-02` Dateityp MUSS am Inhalt (Magic Bytes) geprüft werden, nicht an der Endung.
- `FR-32-03` Extrahierter Text MUSS mit Seiten-/Positionsangaben gespeichert werden.
- `FR-32-04` Dokumente MÜSSEN als Sources mit `source_type: primary` nutzbar sein.
- `FR-32-05` Dokumentinhalte sind untrusted und unterliegen Spec 39.
- `FR-32-06` Dateien MÜSSEN je Conversation löschbar sein.

## Acceptance Criteria
- `AC-32-01` Given ein PDF mit bekanntem Text, Then ist der Text mit Seitenzahl extrahiert.
- `AC-32-02` Given eine als PDF benannte EXE, Then wird der Upload abgelehnt.

## Dependencies
08, 26.
