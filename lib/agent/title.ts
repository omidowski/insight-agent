/** Derive a durable conversation title from model output or the user request. */

export function resolveConversationTitle(request: string, modelTitle: string): string {
  const fallback = request.replace(/\s+/g, ' ').trim().slice(0, 48) || 'Neue Recherche';
  const title = (modelTitle || '')
    .replace(/^["'«»“”„]+|["'«»“”„]+$/g, '')
    .replace(/^(titel|title):\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);

  if (title.length <= 2) return fallback;

  const normalized = title.toLowerCase().replace(/[.!?:;]+$/, '').trim();
  const placeholders = new Set(['neuer chat', 'new chat', 'untitled', 'ohne titel']);
  if (placeholders.has(normalized)) return fallback;

  return title;
}
