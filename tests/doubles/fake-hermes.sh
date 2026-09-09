#!/bin/bash
# Test-Double für die Hermes-CLI. Verhalten über HERMES_STUB_MODE steuerbar.
PROMPT=""
MODEL=""
while [ $# -gt 0 ]; do
  case "$1" in
    -q) PROMPT="$2"; shift 2 ;;
    -m) MODEL="$2"; shift 2 ;;
    *) shift ;;
  esac
done
case "${HERMES_STUB_MODE:-text}" in
  unconfigured)
    echo "No inference provider configured. Run 'hermes model' to choose a provider and model, or set an API key (OPENROUTER_API_KEY, OPENAI_API_KEY, etc.) in ~/.hermes/.env." >&2
    exit 1 ;;
  no_credentials)
    echo "No usable credentials found for provider 'nvidia'. Set NVIDIA_API_KEY." >&2
    exit 1 ;;
  quota)
    echo "Error: You have no credits remaining." >&2; exit 1 ;;
  unauthorized)
    echo "Error 401 unauthorized: invalid api key" >&2; exit 1 ;;
  empty) exit 0 ;;
  json)
    echo '```json'
    echo '{"taskType":"deep_research","confidence":0.9,"summary":"ok","clarificationNeeded":false}'
    echo '```'
    echo "Session id: abc-123"
    exit 0 ;;
  badjson_then_good)
    if [ -f "${HERMES_STUB_STATE:-/tmp/hermes_stub_state}" ]; then
      echo '{"wert":"ok"}'; exit 0
    fi
    touch "${HERMES_STUB_STATE:-/tmp/hermes_stub_state}"
    echo 'kein json'; exit 0 ;;
  hang) sleep 120; exit 0 ;;
  *)
    echo "Antwort auf: ${PROMPT:0:40} (Modell ${MODEL:-default})"
    echo "Session id: abc-123"
    exit 0 ;;
esac
