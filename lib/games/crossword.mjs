// Кроссворд на двоих. Сетка собирается заново при каждой партии,
// поэтому запомнить ответы не выйдет. Играем вместе, ходов по очереди нет.
import { shuffle } from "./util.mjs";
import { WORDS } from "./cw-words.mjs";

export const meta = {
  type: "crossword",
  title: "Кроссворд",
  players: 2,
  coop: true,
};

export const LEVELS = {
  small: { words: 10, limit: 11 },
  big: { words: 16, limit: 14 },
};

export function levelOf(v) {
  return LEVELS[v] ? v : "small";
}

const key = (r, c) => r + "," + c;

// ============================================================
//  ГЕНЕРАТОР
// ============================================================
function buildOnce(target, limit) {
  const pool = shuffle(WORDS.map(([w, clue]) => ({ w, clue })));
  const map = new Map();
  const placed = [];
  const used = new Set();
  let minR = 0, maxR = 0, minC = 0, maxC = 0;

  const put = (word, r, c, dir) => {
    for (let i = 0; i < word.length; i++) {
      const rr = dir === "down" ? r + i : r;
      const cc = dir === "across" ? c + i : c;
      map.set(key(rr, cc), word[i]);
      if (rr < minR) minR = rr;
      if (rr > maxR) maxR = rr;
      if (cc < minC) minC = cc;
      if (cc > maxC) maxC = cc;
    }
    placed.push({ w: word, r, c, dir });
    used.add(word);
  };

  // сколько пересечений даст такая постановка, 0 - так нельзя
  const fits = (word, r, c, dir) => {
    const len = word.length;
    const endR = dir === "down" ? r + len - 1 : r;
    const endC = dir === "across" ? c + len - 1 : c;
    // не даём сетке разрастись
    if (Math.max(maxR, endR) - Math.min(minR, r) + 1 > limit) return 0;
    if (Math.max(maxC, endC) - Math.min(minC, c) + 1 > limit) return 0;

    // клетки вплотную до и после слова должны быть пустыми
    const bR = dir === "down" ? r - 1 : r;
    const bC = dir === "across" ? c - 1 : c;
    if (map.has(key(bR, bC))) return 0;
    if (map.has(key(dir === "down" ? r + len : r, dir === "across" ? c + len : c))) return 0;

    let cross = 0;
    for (let i = 0; i < len; i++) {
      const rr = dir === "down" ? r + i : r;
      const cc = dir === "across" ? c + i : c;
      const cur = map.get(key(rr, cc));
      if (cur) {
        if (cur !== word[i]) return 0;
        cross += 1;
      } else {
        // рядом по бокам пусто, иначе слепится случайное слово
        const n1 = dir === "across" ? key(rr - 1, cc) : key(rr, cc - 1);
        const n2 = dir === "across" ? key(rr + 1, cc) : key(rr, cc + 1);
        if (map.has(n1) || map.has(n2)) return 0;
      }
    }
    return cross;
  };

  const seed = pool.find((x) => x.w.length >= 6 && x.w.length <= 8) || pool[0];
  put(seed.w, 0, 0, "across");

  // два прохода: во второй раз пробуем те слова, что не влезли сразу
  for (let pass = 0; pass < 2 && placed.length < target; pass++) {
    for (const cand of pool) {
      if (placed.length >= target) break;
      if (used.has(cand.w)) continue;
      let best = null;
      for (const p of placed) {
        const dir = p.dir === "across" ? "down" : "across";
        for (let i = 0; i < p.w.length; i++) {
          for (let j = 0; j < cand.w.length; j++) {
            if (p.w[i] !== cand.w[j]) continue;
            const cr = p.dir === "down" ? p.r + i : p.r;
            const cc = p.dir === "across" ? p.c + i : p.c;
            const r = dir === "down" ? cr - j : cr;
            const c = dir === "across" ? cc - j : cc;
            const score = fits(cand.w, r, c, dir);
            if (score > 0 && (!best || score > best.score)) best = { r, c, dir, score };
          }
        }
      }
      if (best) put(cand.w, best.r, best.c, best.dir);
    }
  }

  return { map, placed, minR, maxR, minC, maxC };
}

// Из готовой сетки вынимаем слова так, как их увидит игрок
function extract(res) {
  const { map, minR, maxR, minC, maxC } = res;
  const h = maxR - minR + 1;
  const w = maxC - minC + 1;
  const at = (r, c) => map.get(key(r + minR, c + minC));

  const clueOf = new Map(WORDS);
  const slots = [];
  let num = 0;

  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (!at(r, c)) continue;
      const startAcross = !at(r, c - 1) && !!at(r, c + 1);
      const startDown = !at(r - 1, c) && !!at(r + 1, c);
      if (!startAcross && !startDown) continue;
      num += 1;
      for (const dir of ["across", "down"]) {
        if (dir === "across" ? !startAcross : !startDown) continue;
        let word = "";
        for (let i = 0; ; i++) {
          const ch = dir === "across" ? at(r, c + i) : at(r + i, c);
          if (!ch) break;
          word += ch;
        }
        const clue = clueOf.get(word);
        if (!clue) return null; // слепилось что-то постороннее - пересобираем
        slots.push({ n: num, dir, r, c, len: word.length, clue, answer: word });
      }
    }
  }

  const cells = {};
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (at(r, c)) cells[key(r, c)] = { ch: "", by: null, wrong: false, ok: false };
    }
  }
  return { w, h, slots, cells };
}

export function generate(level) {
  const cfg = LEVELS[levelOf(level)];
  let best = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const raw = buildOnce(cfg.words, cfg.limit);
    if (raw.placed.length < 4) continue;
    const grid = extract(raw);
    if (!grid) continue;
    if (!best || grid.slots.length > best.slots.length) best = grid;
    if (best.slots.length >= cfg.words) break;
  }
  return best;
}

// ============================================================
//  ПАРТИЯ
// ============================================================
export function create(userId, opts = {}) {
  const level = levelOf(opts.variant);
  const grid = generate(level);
  return {
    phase: "playing",
    level,
    w: grid.w,
    h: grid.h,
    slots: grid.slots,
    cells: grid.cells,
    hints: 0,
    checks: 0,
    started: Date.now(),
    status: "active",
    winner: null,
  };
}

// вместе, без очереди - ходит кто хочет
export function turnOf() {
  return null;
}

function norm(ch) {
  return String(ch || "").toUpperCase().replace(/Ё/g, "Е");
}

function answerAt(s, r, c) {
  for (const sl of s.slots) {
    for (let i = 0; i < sl.len; i++) {
      const rr = sl.dir === "down" ? sl.r + i : sl.r;
      const cc = sl.dir === "across" ? sl.c + i : sl.c;
      if (rr === r && cc === c) return sl.answer[i];
    }
  }
  return null;
}

// Слово считается взятым, когда все его буквы верные
function markSolved(s) {
  let all = true;
  for (const sl of s.slots) {
    let done = true;
    for (let i = 0; i < sl.len; i++) {
      const rr = sl.dir === "down" ? sl.r + i : sl.r;
      const cc = sl.dir === "across" ? sl.c + i : sl.c;
      const cell = s.cells[key(rr, cc)];
      if (!cell || cell.ch !== sl.answer[i]) {
        done = false;
        break;
      }
    }
    sl.done = done;
    if (!done) all = false;
  }
  for (const k of Object.keys(s.cells)) {
    const [r, c] = k.split(",").map(Number);
    s.cells[k].ok = s.cells[k].ch !== "" && s.cells[k].ch === answerAt(s, r, c);
  }
  if (all && s.slots.length) {
    s.status = "finished";
    s.phase = "finished";
    s.winner = "both";
    s.solvedAt = Date.now();
  }
  return all;
}

export function move(s, userId, action) {
  if (s.status !== "active") return { error: "Кроссворд уже разгадан" };

  if (action.kind === "set") {
    const r = Number(action.r);
    const c = Number(action.c);
    const cell = s.cells[key(r, c)];
    if (!cell) return { error: "Нет такой клетки" };
    if (cell.ok) return { error: "Эта буква уже на месте" };
    const ch = norm(action.ch);
    if (ch && !/^[А-Я]$/.test(ch)) return { error: "Только русские буквы" };
    cell.ch = ch;
    cell.by = ch ? userId : null;
    cell.wrong = false;
    const all = markSolved(s);
    return { ok: true, result: all ? "win" : "set" };
  }

  if (action.kind === "check") {
    let bad = 0;
    for (const k of Object.keys(s.cells)) {
      const cell = s.cells[k];
      const [r, c] = k.split(",").map(Number);
      if (cell.ch && cell.ch !== answerAt(s, r, c)) {
        cell.wrong = true;
        bad += 1;
      } else {
        cell.wrong = false;
      }
    }
    s.checks += 1;
    return { ok: true, result: "check", bad };
  }

  if (action.kind === "hint") {
    const sl = s.slots[Number(action.slot)];
    if (!sl) return { error: "Нет такого слова" };
    const free = [];
    for (let i = 0; i < sl.len; i++) {
      const rr = sl.dir === "down" ? sl.r + i : sl.r;
      const cc = sl.dir === "across" ? sl.c + i : sl.c;
      const cell = s.cells[key(rr, cc)];
      if (cell && cell.ch !== sl.answer[i]) free.push({ rr, cc, ch: sl.answer[i] });
    }
    if (!free.length) return { error: "Тут и так всё верно" };
    const pick = free[Math.floor(Math.random() * free.length)];
    const cell = s.cells[key(pick.rr, pick.cc)];
    cell.ch = pick.ch;
    cell.by = "hint";
    cell.wrong = false;
    s.hints += 1;
    const all = markSolved(s);
    return { ok: true, result: all ? "win" : "hint", cell: [pick.rr, pick.cc] };
  }

  return { error: "Неизвестное действие" };
}

export function view(s, userId) {
  const done = s.status !== "active";
  return {
    phase: s.phase,
    level: s.level,
    w: s.w,
    h: s.h,
    // ответы наружу не отдаём никогда, только подсказки и длина
    slots: s.slots.map((sl, i) => ({
      i,
      n: sl.n,
      dir: sl.dir,
      r: sl.r,
      c: sl.c,
      len: sl.len,
      clue: sl.clue,
      done: !!sl.done,
      answer: done ? sl.answer : undefined,
    })),
    cells: s.cells,
    total: s.slots.length,
    found: s.slots.filter((sl) => sl.done).length,
    hints: s.hints,
    checks: s.checks,
    status: s.status,
    winner: s.winner,
  };
}
