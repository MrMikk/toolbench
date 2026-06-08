export type DiffType = 'eq' | 'add' | 'del';

export interface DiffRow {
  type: DiffType;
  text: string;
}

export interface DiffResult {
  rows: DiffRow[];
  added: number;
  removed: number;
}

/** Line-level diff via a longest-common-subsequence table. */
export function diffLines(aText: string, bText: string): DiffResult {
  const a = aText.split('\n');
  const b = bText.split('\n');
  const n = a.length;
  const m = b.length;

  // dp[i][j] = LCS length of a[i:] and b[j:]
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const rows: DiffRow[] = [];
  let added = 0;
  let removed = 0;
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ type: 'eq', text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ type: 'del', text: a[i] });
      removed++;
      i++;
    } else {
      rows.push({ type: 'add', text: b[j] });
      added++;
      j++;
    }
  }
  while (i < n) {
    rows.push({ type: 'del', text: a[i++] });
    removed++;
  }
  while (j < m) {
    rows.push({ type: 'add', text: b[j++] });
    added++;
  }
  return { rows, added, removed };
}
