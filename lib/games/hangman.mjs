// Виселица: один загадывает слово или фразу, второй открывает буквы.
import { other } from "./util.mjs";

export const MAX_WRONG = 6;

export const meta = {
  type: "hangman",
  title: "Виселица",
  players: 2,
  coop: false,
};

export function normalize(s) {
  return String(s || "").toUpperCase().replace(/Ё/g, "Е");
}

// буквы, которые надо открыть (пробелы и дефисы видны сразу)
function isLetter(ch) {
  return /[А-Я]/.test(ch);
}

export function create(userId) {
  return {
    phase: "setting", // setting -> guessing -> finished
    setter: userId,
    guesser: other(userId),
    word: "",
    hint: "",
    guessed: [], // открытые и промахнувшиеся буквы
    wrong: 0,
    status: "active",
    winner: null,
  };
}

export function turnOf(s) {
  if (s.status !== "active") return null;
  return s.phase === "setting" ? s.setter : s.guesser;
}

function solved(s) {
  for (const ch of s.word) {
    if (isLetter(ch) && !s.guessed.includes(ch)) return false;
  }
  return true;
}

export function move(s, userId, action) {
  if (s.status !== "active") return { error: "Игра уже закончена" };

  if (action.kind === "setWord") {
    if (userId !== s.setter) return { error: "Загадывает другой игрок" };
    if (s.phase !== "setting") return { error: "Уже загадано" };
    const w = normalize(action.word).trim();
    if (!w) return { error: "Введи слово или фразу" };
    if (w.length > 40) return { error: "Слишком длинно, до 40 знаков" };
    if (!/[А-Я]/.test(w)) return { error: "Нужны русские буквы" };
    if (!/^[А-Я\s-]+$/.test(w)) return { error: "Только русские буквы, пробел и дефис" };
    s.word = w;
    s.hint = String(action.hint || "").slice(0, 60);
    s.phase = "guessing";
    return { ok: true };
  }

  if (action.kind === "letter") {
    if (userId !== s.guesser) return { error: "Отгадывает другой игрок" };
    if (s.phase !== "guessing") return { error: "Слово ещё не загадано" };
    const ch = normalize(action.letter);
    if (ch.length !== 1 || !isLetter(ch)) return { error: "Одна русская буква" };
    if (s.guessed.includes(ch)) return { error: "Эту букву уже называли" };

    s.guessed.push(ch);
    const hit = s.word.includes(ch);
    if (!hit) s.wrong += 1;

    if (solved(s)) {
      s.status = "finished";
      s.phase = "finished";
      s.winner = s.guesser;
      return { ok: true, result: "win" };
    }
    if (s.wrong >= MAX_WRONG) {
      s.status = "finished";
      s.phase = "finished";
      s.winner = s.setter;
      return { ok: true, result: "lose" };
    }
    return { ok: true, result: hit ? "hit" : "miss" };
  }

  if (action.kind === "word") {
    if (userId !== s.guesser) return { error: "Отгадывает другой игрок" };
    if (s.phase !== "guessing") return { error: "Слово ещё не загадано" };
    const w = normalize(action.word).trim();
    if (w === s.word) {
      // открываем все буквы разом
      for (const ch of s.word) if (isLetter(ch) && !s.guessed.includes(ch)) s.guessed.push(ch);
      s.status = "finished";
      s.phase = "finished";
      s.winner = s.guesser;
      return { ok: true, result: "win" };
    }
    s.wrong += 1;
    if (s.wrong >= MAX_WRONG) {
      s.status = "finished";
      s.phase = "finished";
      s.winner = s.setter;
      return { ok: true, result: "lose" };
    }
    return { ok: true, result: "miss" };
  }

  return { error: "Неизвестное действие" };
}

export function view(s, userId) {
  const reveal = s.status !== "active" || userId === s.setter;
  const masked = s.word
    .split("")
    .map((ch) => {
      if (!isLetter(ch)) return ch;
      return s.guessed.includes(ch) || reveal ? ch : "_";
    })
    .join("");

  return {
    phase: s.phase,
    setter: s.setter,
    guesser: s.guesser,
    masked, // то, что видно на экране
    length: s.word.length,
    hint: s.hint,
    guessed: s.guessed,
    // промахи считаем отдельно, чтобы подсветить клавиатуру
    misses: s.guessed.filter((ch) => !s.word.includes(ch)),
    wrong: s.wrong,
    maxWrong: MAX_WRONG,
    status: s.status,
    winner: s.winner,
    word: s.status !== "active" ? s.word : undefined,
  };
}
