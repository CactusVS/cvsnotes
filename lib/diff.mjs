// Диф на уровне слов + отслеживание авторства ("blame"), плюс посимвольный span-диф
// для подробной истории (что именно добавлено/убрано).

export function tokenize(text) {
  if (!text) return [];
  return text.match(/\s+|\S+/g) || [];
}

export function textFromTokens(tokens) {
  let s = "";
  for (let i = 0; i < tokens.length; i++) s += tokens[i].t;
  return s;
}

// Пересчитать токены с авторством.
// prevTokens: [{t,a}], newText: string, author: id
// -> { tokens: [{t,a}], added: chars, removed: chars }
export function reblame(prevTokens, newText, author) {
  const oldStrs = new Array(prevTokens.length);
  for (let i = 0; i < prevTokens.length; i++) oldStrs[i] = prevTokens[i].t;
  const newStrs = tokenize(newText);

  if (oldStrs.length * newStrs.length > 4000000) {
    let added = 0;
    for (const t of newStrs) added += t.length;
    let removed = 0;
    for (const t of oldStrs) removed += t.length;
    return { tokens: newStrs.map((t) => ({ t, a: author })), added, removed };
  }

  const pairs = lcsPairs(oldStrs, newStrs);
  const matchedNew = new Map();
  const matchedOld = new Set();
  for (const [i, j] of pairs) {
    matchedNew.set(j, i);
    matchedOld.add(i);
  }

  const tokens = new Array(newStrs.length);
  let added = 0;
  for (let j = 0; j < newStrs.length; j++) {
    if (matchedNew.has(j)) {
      tokens[j] = { t: newStrs[j], a: prevTokens[matchedNew.get(j)].a };
    } else {
      tokens[j] = { t: newStrs[j], a: author };
      added += newStrs[j].length;
    }
  }
  let removed = 0;
  for (let i = 0; i < oldStrs.length; i++) {
    if (!matchedOld.has(i)) removed += oldStrs[i].length;
  }

  return { tokens, added, removed };
}

// Посимвольный диф изменённого участка: общий префикс + общий суффикс,
// середина = что убрали (del) и что вставили (ins). Идеально для набора текста.
export function spanDiff(a, b) {
  a = a || "";
  b = b || "";
  let start = 0;
  const min = Math.min(a.length, b.length);
  while (start < min && a.charCodeAt(start) === b.charCodeAt(start)) start++;
  let endA = a.length,
    endB = b.length;
  while (endA > start && endB > start && a.charCodeAt(endA - 1) === b.charCodeAt(endB - 1)) {
    endA--;
    endB--;
  }
  return { del: a.slice(start, endA), ins: b.slice(start, endB), at: start };
}

function lcsPairs(a, b) {
  const n = a.length,
    m = b.length;
  if (n === 0 || m === 0) return [];
  const w = m + 1;
  const dp = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) dp[i * w + j] = dp[(i + 1) * w + (j + 1)] + 1;
      else {
        const down = dp[(i + 1) * w + j];
        const right = dp[i * w + (j + 1)];
        dp[i * w + j] = down >= right ? down : right;
      }
    }
  }
  const pairs = [];
  let i = 0,
    j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (dp[(i + 1) * w + j] >= dp[i * w + (j + 1)]) {
      i++;
    } else {
      j++;
    }
  }
  return pairs;
}
