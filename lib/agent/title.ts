/** Derive a durable conversation title from model output or the user request. */

export function resolveConversationTitle(request: string, modelTitle: string): string {
  const fallback = request.replace(/\s+/g, ' ').trim().slice(0, 48) || 'Neue Recherche';
  const title = modelTitle.replace(/\s+/g, ' ').trim().slice(0, 60);
  if (title.length <= 2) return fallback;
  if (title.toLowerCase() === 'neuer chat') return fallback;
  return title;
}
