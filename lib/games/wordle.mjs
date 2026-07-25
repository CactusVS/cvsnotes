// Wordle-дуэль: один загадывает слово, второй отгадывает по буквам.
// Словарь не нужен - слово задаёт живой человек.
import { other } from "./util.mjs";

export const MIN_LEN = 4;
export const MAX_LEN = 8;
export const MAX_TRIES = 6;

export const meta = {
  type: "wordle",
  title: "Wordle-дуэль",
  players: 2,
  coop: false,
};

// ё приводим к е, чтобы не мучиться при вводе
export function normalize(s) {
  return String(s || "").toUpperCase().replace(/Ё/g, "Е").trim();
}

export function isValidWord(s) {
  const w = normalize(s);
  if (w.length < MIN_LEN || w.length > MAX_LEN) return false;
  return /^[А-Я]+$/.test(w);
}

export function create(userId) {
  return {
    phase: "setting", // setting -> guessing -> finished
    setter: userId,
    guesser: other(userId),
    word: "",
    guesses: [], // [{ text, marks }]
    status: "active",
    winner: null,
  };
}

// Раскраска попытки с правильным учётом повторов букв
export function markGuess(guess, word) {
  const n = word.length;
  const marks = new Array(n).fill("miss");
  const used = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    if (guess[i] === word[i]) {
      marks[i] = "hit";
      used[i] = true;
    }
  }
  for (let i = 0; i < n; i++) {
    if (marks[i] === "hit") continue;
    for (let j = 0; j < n; j++) {
      if (!used[j] && guess[i] === word[j]) {
        marks[i] = "near";
        used[j] = true;
        break;
      }
    }
  }
  return marks;
}

// Кто сейчас ходит
export function turnOf(s) {
  if (s.status !== "active") return null;
  return s.phase === "setting" ? s.setter : s.guesser;
}

export function move(s, userId, action) {
  if (s.status !== "active") return { error: "Игра уже закончена" };

  if (action.kind === "setWord") {
    if (userId !== s.setter) return { error: "Слово загадывает другой игрок" };
    if (s.phase !== "setting") return { error: "Слово уже загадано" };
    const w = normalize(action.word);
    if (!isValidWord(w))
      return { error: `Слово: только русские буквы, от ${MIN_LEN} до ${MAX_LEN}` };
    s.word = w;
    s.phase = "guessing";
    return { ok: true };
  }

  if (action.kind === "guess") {
    if (userId !== s.guesser) return { error: "Сейчас отгадывает другой игрок" };
    if (s.phase !== "guessing") return { error: "Слово ещё не загадано" };
    const g = normalize(action.word);
    if (!/^[А-Я]+$/.test(g)) return { error: "Только русские буквы" };
    if (g.length !== s.word.length)
      return { error: `В слове ${s.word.length} букв` };

    const marks = markGuess(g, s.word);
    s.guesses.push({ text: g, marks });

    if (g === s.word) {
      s.status = "finished";
      s.phase = "finished";
      s.winner = s.guesser;
    } else if (s.guesses.length >= MAX_TRIES) {
      s.status = "finished";
      s.phase = "finished";
      s.winner = s.setter;
    }
    return { ok: true };
  }

  return { error: "Неизвестное действие" };
}

// Что можно показывать конкретному игроку
export function view(s, userId) {
  const out = {
    phase: s.phase,
    setter: s.setter,
    guesser: s.guesser,
    guesses: s.guesses,
    maxTries: MAX_TRIES,
    status: s.status,
    winner: s.winner,
    wordLength: s.word ? s.word.length : 0,
  };
  // само слово видит только загадавший, а после конца игры - оба
  if (userId === s.setter || s.status === "finished") out.word = s.word;
  return out;
}
