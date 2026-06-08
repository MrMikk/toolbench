/**
 * Subsequence fuzzy match. Returns a score (higher is better) when every char of
 * `query` appears in `text` in order, otherwise null. Consecutive matches and
 * word-start matches score higher; longer text is mildly penalised so tighter
 * matches rank first.
 */
export function fuzzyScore(query: string, text: string): number | null {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (q === '') return 0;

  let qi = 0;
  let score = 0;
  let lastMatch = -1;
  let streak = 0;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] !== q[qi]) continue;
    streak = ti === lastMatch + 1 ? streak + 1 : 0;
    let bonus = 1 + streak * 2;
    if (ti === 0 || /[\W_]/.test(t[ti - 1])) bonus += 3; // word boundary
    score += bonus;
    lastMatch = ti;
    qi++;
  }

  return qi === q.length ? score - text.length * 0.01 : null;
}

/** Filter and rank items by fuzzy-matching `query` against `key(item)`. */
export function fuzzyFilter<T>(query: string, items: readonly T[], key: (item: T) => string): T[] {
  if (!query.trim()) return items.slice();
  return items
    .map((item) => ({ item, score: fuzzyScore(query, key(item)) }))
    .filter((r): r is { item: T; score: number } => r.score !== null)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item);
}
