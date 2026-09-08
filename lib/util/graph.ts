/** Topologische Sortierung mit Zyklusauflösung (Spec 15, FR-15-03). */
export interface GraphNode {
  id: string;
  dependsOn: string[];
}

export interface TopoResult<T extends GraphNode> {
  ordered: T[];
  removedEdges: { from: string; to: string }[];
}

export function topoSort<T extends GraphNode>(nodes: readonly T[]): TopoResult<T> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const removedEdges: { from: string; to: string }[] = [];
  const deps = new Map<string, Set<string>>();
  for (const n of nodes) {
    deps.set(n.id, new Set(n.dependsOn.filter((d) => byId.has(d) && d !== n.id)));
  }

  const ordered: T[] = [];
  const remaining = new Set(nodes.map((n) => n.id));

  while (remaining.size > 0) {
    let progressed = false;
    for (const id of Array.from(remaining)) {
      const d = deps.get(id);
      if (!d || Array.from(d).every((x) => !remaining.has(x))) {
        ordered.push(byId.get(id) as T);
        remaining.delete(id);
        progressed = true;
      }
    }
    if (!progressed) {
      // Zyklus: Kante des zuerst verbliebenen Knotens entfernen
      const id = Array.from(remaining)[0] as string;
      const d = deps.get(id);
      if (d) {
        for (const target of Array.from(d)) {
          if (remaining.has(target)) {
            d.delete(target);
            removedEdges.push({ from: id, to: target });
            break;
          }
        }
      }
    }
  }
  return { ordered, removedEdges };
}

export function hasCycle(nodes: readonly GraphNode[]): boolean {
  return topoSort(nodes).removedEdges.length > 0;
}
