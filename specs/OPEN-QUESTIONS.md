# Offene Punkte und gewählte Defaults

| # | Frage | Gewählter Default | Alternative | Auswirkung bei Änderung |
|---|---|---|---|---|
| 1 | Mehrbenutzerbetrieb im MVP? | Nein — fester `local-user`, Auth hinter Flag `AUTH_ENABLED=false` | Auth ab Tag 1 | Spec 34/35 aktivieren; `user_id` ist bereits überall vorhanden |
| 2 | Suchanbieter | `openai` (Web-Search der Responses API), `brave`/`tavily` als Adapter vorbereitet, ohne Anbieter keine Recherche | Eigener SERP-Anbieter | Nur `lib/search/providers.ts` |
| 3 | UI-Sprache | Deutsch, Bezeichner/Code englisch | i18n zweisprachig | Textkonstanten in `lib/i18n/de.ts` zentralisiert |
| 4 | Kosten-Hardstop | 0,50 USD je Run, `MAX_RUN_COST_USD` | anderer Wert | Nur Env-Variable |
| 5 | Modellwahl | Standard über Env; zusätzlich Auswahl je Run aus dem Anbieterkatalog (Spec 48) | einheitliches Modell | `lib/llm/catalog.ts` |
| 6 | Fortsetzbare Runs | MVP: unterbrochene Runs werden als `failed` mit Teilergebnis angezeigt | Resume ab MVP | Spec 45 |
| 7 | Volltextspeicherung von Quellen | Nur Excerpts + Hash + max. 40 000 Zeichen Rohtext je Quelle | Volltextarchiv | Speicherbedarf, Urheberrecht |
| 8 | Rate Limit | 30 Runs/Stunde, 6 gleichzeitige Runs, 1 Anfrage/Sekunde je Zieldomain | anderer Wert | Env-Variablen |
