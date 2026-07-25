// Кодовые имена: дуэт - кооператив на двоих.
// У каждого своя карта-подсказка: она говорит, какие слова ТЫ должен объяснить партнёру.
// Партнёр угадывает, а проверяется всегда карта того, кто давал подсказку.
import { other, shuffle } from "./util.mjs";
import { pickWords } from "./words.mjs";

export const GRID = 25;
export const TURNS = 9;
export const AGENTS_TOTAL = 15;

export const meta = {
  type: "codenames",
  title: "Кодовые имена: дуэт",
  players: 2,
  coop: true,
};

// Распределение ролей парами (роль у Ангелины, роль у Кирилла, сколько слов).
// Даёт каждому по 9 агентов и 3 убийцы, всего 15 уникальных агентов на двоих.
const PAIRS = [
  ["agent", "agent", 3],
  ["agent", "bystander", 5],
  ["agent", "assassin", 1],
  ["bystander", "agent", 5],
  ["assassin", "agent", 1],
  ["assassin", "bystander", 1],
  ["bystander", "assassin", 1],
  ["assassin", "assassin", 1],
  ["bystander", "bystander", 7],
];

function makeKeys() {
  const slots = [];
  for (const [a, b, n] of PAIRS) {
    for (let i = 0; i < n; i++) slots.push([a, b]);
  }
  const mixed = shuffle(slots);
  return {
    angelina: mixed.map((p) => p[0]),
    kirill: mixed.map((p) => p[1]),
  };
}

export function create(userId) {
  const keys = makeKeys();
  return {
    words: pickWords(GRID),
    keys,
    revealed: new Array(GRID).fill(null), // null | 'agent' | 'bystander' | 'assassin'
    giver: userId, // кто даёт подсказку
    phase: "clue", // clue -> guess -> clue ...
    clue: null, // { word, count, made }
    turnsLeft: TURNS,
    found: 0,
    status: "active", // active | won | lost
    winner: null, // 'both' при победе
    lostReason: null,
  };
}

export function turnOf(s) {
  if (s.status !== "active") return null;
  return s.phase === "clue" ? s.giver : other(s.giver);
}

function endTurn(s) {
  s.clue = null;
  s.giver = other(s.giver);
  s.phase = "clue";
  s.turnsLeft -= 1;
  if (s.turnsLeft <= 0 && s.status === "active") {
    s.status = "lost";
    s.lostReason = "time";
  }
}

export function move(s, userId, action) {
  if (s.status !== "active") return { error: "Игра уже закончена" };

  if (action.kind === "clue") {
    if (s.phase !== "clue") return { error: "Сейчас не время подсказки" };
    if (userId !== s.giver) return { error: "Подсказку даёт другой игрок" };
    const word = String(action.word || "").trim();
    const count = Number(action.count);
    if (!word) return { error: "Введи слово-подсказку" };
    if (word.length > 24) return { error: "Слишком длинная подсказка" };
    if (!Number.isInteger(count) || count < 1 || count > 9)
      return { error: "Число от 1 до 9" };
    s.clue = { word, count, made: 0 };
    s.phase = "guess";
    return { ok: true };
  }

  if (action.kind === "guess") {
    if (s.phase !== "guess") return { error: "Сначала нужна подсказка" };
    const guesser = other(s.giver);
    if (userId !== guesser) return { error: "Сейчас отгадывает другой игрок" };
    const i = Number(action.index);
    if (!Number.isInteger(i) || i < 0 || i >= GRID) return { error: "Нет такого слова" };
    if (s.revealed[i]) return { error: "Это слово уже открыто" };

    // проверяем ВСЕГДА по карте того, кто давал подсказку
    const role = s.keys[s.giver][i];
    s.revealed[i] = role;
    s.clue.made += 1;

    if (role === "assassin") {
      s.status = "lost";
      s.lostReason = "assassin";
      return { ok: true, result: "assassin" };
    }
    if (role === "bystander") {
      endTurn(s);
      return { ok: true, result: "bystander" };
    }

    // агент
    s.found += 1;
    if (s.found >= AGENTS_TOTAL) {
      s.status = "won";
      s.winner = "both";
      return { ok: true, result: "win" };
    }
    // угадывать можно на одну попытку больше, чем число в подсказке
    if (s.clue.made >= s.clue.count + 1) endTurn(s);
    return { ok: true, result: "agent" };
  }

  if (action.kind === "pass") {
    if (s.phase !== "guess") return { error: "Сейчас нечего пропускать" };
    if (userId !== other(s.giver)) return { error: "Пропустить может только отгадывающий" };
    endTurn(s);
    return { ok: true };
  }

  return { error: "Неизвестное действие" };
}

export function view(s, userId) {
  const out = {
    words: s.words,
    revealed: s.revealed,
    giver: s.giver,
    phase: s.phase,
    clue: s.clue,
    turnsLeft: s.turnsLeft,
    found: s.found,
    total: AGENTS_TOTAL,
    status: s.status,
    winner: s.winner,
    lostReason: s.lostReason,
    myKey: s.keys[userId] || null, // свою карту видишь всегда
  };
  // чужую карту показываем только после конца игры, чтобы разобрать партию
  if (s.status !== "active") out.partnerKey = s.keys[other(userId)] || null;
  return out;
}
