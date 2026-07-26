// Уно на двоих: цвета, пропуск, разворот, плюс два и плюс четыре.
import { other, shuffle } from "./util.mjs";

export const meta = {
  type: "uno",
  title: "Уно",
  players: 2,
  coop: false,
};

export const COLORS = ["r", "y", "g", "b"];
const HAND = 7;

// Карта: {c: цвет или null у чёрных, v: значение}
// v: "0".."9" | "skip" | "rev" | "d2" | "wild" | "wd4"
function fullDeck() {
  const out = [];
  for (const c of COLORS) {
    out.push({ c, v: "0" });
    for (let n = 1; n <= 9; n++) {
      out.push({ c, v: String(n) });
      out.push({ c, v: String(n) });
    }
    for (const v of ["skip", "rev", "d2"]) {
      out.push({ c, v });
      out.push({ c, v });
    }
  }
  for (let i = 0; i < 4; i++) {
    out.push({ c: null, v: "wild" });
    out.push({ c: null, v: "wd4" });
  }
  return out;
}

export function isBlack(card) {
  return card.v === "wild" || card.v === "wd4";
}

export function playable(card, topColor, topValue) {
  if (isBlack(card)) return true;
  return card.c === topColor || card.v === topValue;
}

export function create(userId) {
  const deck = shuffle(fullDeck());
  const foe = other(userId);
  const hands = { [userId]: deck.splice(0, HAND), [foe]: deck.splice(0, HAND) };

  // первая карта на столе должна быть обычной цветной
  let first = deck.pop();
  while (isBlack(first) || first.v === "skip" || first.v === "rev" || first.v === "d2") {
    deck.unshift(first);
    first = deck.pop();
  }

  return {
    phase: "playing",
    deck,
    pile: [first], // сброс, последняя карта сверху
    color: first.c,
    value: first.v,
    hands,
    turn: userId,
    drawn: false, // взял карту и ещё не решил, играть её или пас
    said: { angelina: false, kirill: false }, // объявил "уно"
    last: null,
    status: "active",
    winner: null,
  };
}

export function turnOf(s) {
  return s.status === "active" ? s.turn : null;
}

// Колода кончилась - мешаем сброс заново, верхнюю карту оставляем
function reshuffle(s) {
  if (s.deck.length || s.pile.length < 2) return;
  const top = s.pile.pop();
  const rest = s.pile.map((c) => (isBlack(c) ? { c: null, v: c.v } : c));
  s.deck = shuffle(rest);
  s.pile = [top];
}

function drawCards(s, id, n) {
  const hand = s.hands[id];
  for (let i = 0; i < n; i++) {
    reshuffle(s);
    if (!s.deck.length) break;
    hand.push(s.deck.pop());
  }
}

export function move(s, userId, action) {
  if (s.status !== "active") return { error: "Игра уже закончена" };
  if (userId !== s.turn) return { error: "Сейчас не твой ход" };
  const hand = s.hands[userId];
  const foe = other(userId);

  if (action.kind === "play") {
    const i = Number(action.card);
    const card = hand[i];
    if (!card) return { error: "Нет такой карты" };
    if (!playable(card, s.color, s.value)) return { error: "Эта карта не подходит" };

    let color = card.c;
    if (isBlack(card)) {
      color = COLORS.includes(action.color) ? action.color : COLORS[0];
    }

    hand.splice(i, 1);
    s.pile.push(card);
    s.color = color;
    s.value = card.v;
    s.drawn = false;
    s.last = { kind: "play", by: userId, card, color };

    if (!hand.length) {
      s.status = "finished";
      s.phase = "finished";
      s.winner = userId;
      return { ok: true, result: "win" };
    }
    // остался один - отмечаем "уно", чтобы соперник видел
    s.said[userId] = hand.length === 1;

    // на двоих разворот работает как пропуск: ходишь ещё раз
    if (card.v === "skip" || card.v === "rev") return { ok: true, result: "again" };
    if (card.v === "d2") {
      drawCards(s, foe, 2);
      s.said[foe] = s.hands[foe].length === 1;
      return { ok: true, result: "again" };
    }
    if (card.v === "wd4") {
      drawCards(s, foe, 4);
      s.said[foe] = s.hands[foe].length === 1;
      return { ok: true, result: "again" };
    }
    s.turn = foe;
    return { ok: true };
  }

  if (action.kind === "draw") {
    if (s.drawn) return { error: "Карта уже взята" };
    if (hand.some((c) => playable(c, s.color, s.value)))
      return { error: "У тебя есть чем походить" };
    reshuffle(s);
    if (!s.deck.length) {
      // брать нечего - просто передаём ход
      s.last = { kind: "pass", by: userId };
      s.turn = foe;
      return { ok: true, result: "empty" };
    }
    const card = s.deck.pop();
    hand.push(card);
    s.said[userId] = false;
    s.last = { kind: "draw", by: userId };
    // взятой картой можно сходить, иначе ход уходит сам
    if (playable(card, s.color, s.value)) {
      s.drawn = true;
      return { ok: true, result: "drawn" };
    }
    s.turn = foe;
    return { ok: true, result: "drawnPass" };
  }

  if (action.kind === "pass") {
    if (!s.drawn) return { error: "Сначала возьми карту" };
    s.drawn = false;
    s.last = { kind: "pass", by: userId };
    s.turn = foe;
    return { ok: true };
  }

  return { error: "Неизвестное действие" };
}

export function view(s, userId) {
  const foe = other(userId);
  const hand = s.hands[userId] || [];
  const done = s.status !== "active";
  const top = s.pile[s.pile.length - 1];

  return {
    phase: s.phase,
    top,
    color: s.color,
    value: s.value,
    hand,
    playable: hand.map((c) => playable(c, s.color, s.value)),
    canPlayAny: hand.some((c) => playable(c, s.color, s.value)),
    drawn: s.drawn,
    deck: s.deck.length,
    foeCount: (s.hands[foe] || []).length,
    foeUno: s.said[foe] && (s.hands[foe] || []).length === 1,
    myUno: hand.length === 1,
    turn: s.turn,
    myTurn: s.turn === userId && !done,
    last: s.last,
    status: s.status,
    winner: s.winner,
    foeHand: done ? s.hands[foe] : undefined,
  };
}
