/**
 * @fileoverview Pure Critical Path Method (CPM) and Schedule Network Domain Logic.
 * Standards: PMI Practice Standard for Scheduling 3rd Ed, CPM Network Analysis.
 *
 * Constraints:
 * - Pure calculations only: zero DOM, zero storage, zero framework dependencies.
 * - Under 300 lines per file (AGENTS.md §2).
 */

/**
 * Standard duration in workdays from estimated work hours.
 * Assuming standard 8-hour workday, minimum 1 workday for milestone/discrete task.
 * @param {Object} card
 * @returns {number}
 */
export function taskDurationDays(card) {
  if (!card) return 0;
  return Math.max(1, card.estimateHours || 8) / 8;
}

/**
 * Compute the critical path across a network of cards.
 * Finds the longest path through the activity dependency graph.
 *
 * @param {Array<Object>} cards - List of cards with id, estimateHours, deps
 * @returns {{ set: Record<string, boolean>, lengthDays: number }}
 */
export function computeCriticalPath(cards = []) {
  const byId = Object.create(null);
  for (const c of cards) {
    byId[c.id] = c;
  }

  const memo = Object.create(null);
  const stack = Object.create(null);

  function longest(id) {
    if (memo[id] != null) return memo[id];
    if (stack[id]) return 0; // Guard against dependency cycles

    stack[id] = true;
    const c = byId[id];
    let best = 0;

    const deps = (c && c.deps) || [];
    for (const dep of deps) {
      if (byId[dep]) {
        best = Math.max(best, longest(dep));
      }
    }

    stack[id] = false;
    return (memo[id] = best + taskDurationDays(c));
  }

  let maxLen = 0;
  let endId = null;

  for (const c of cards) {
    const l = longest(c.id);
    if (l > maxLen) {
      maxLen = l;
      endId = c.id;
    }
  }

  // Walk back along the max-length predecessor chain to assemble the critical path.
  const pathSet = Object.create(null);
  let cur = endId;

  while (cur) {
    if (pathSet[cur]) break; // Guard against cycle in backtrack
    pathSet[cur] = true;
    const c = byId[cur];
    let next = null;
    let nv = -1;

    const deps = (c && c.deps) || [];
    for (const dep of deps) {
      if (byId[dep] && memo[dep] > nv) {
        nv = memo[dep];
        next = dep;
      }
    }
    cur = next;
  }

  return {
    set: pathSet,
    lengthDays: Math.round(maxLen),
  };
}

/**
 * Perform a topological sort on task dependency graph.
 *
 * @param {Array<Object>} cards
 * @returns {{ sorted: Array<string>, hasCycle: boolean }}
 */
export function topologicalSort(cards = []) {
  const byId = Object.create(null);
  const inDegree = Object.create(null);
  const adj = Object.create(null);

  for (const c of cards) {
    byId[c.id] = c;
    inDegree[c.id] = 0;
    adj[c.id] = [];
  }

  for (const c of cards) {
    const deps = c.deps || [];
    for (const dep of deps) {
      if (adj[dep]) {
        adj[dep].push(c.id);
        inDegree[c.id] = (inDegree[c.id] || 0) + 1;
      }
    }
  }

  const queue = [];
  for (const id in inDegree) {
    if (inDegree[id] === 0) queue.push(id);
  }

  const sorted = [];
  while (queue.length > 0) {
    const u = queue.shift();
    sorted.push(u);
    for (const v of adj[u] || []) {
      inDegree[v]--;
      if (inDegree[v] === 0) queue.push(v);
    }
  }

  const hasCycle = sorted.length !== cards.length;
  return { sorted, hasCycle };
}
