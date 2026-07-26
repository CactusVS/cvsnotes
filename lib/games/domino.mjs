// Домино: классические камни от 0:0 до 6:6, подбор по числам на концах.
import { other, shuffle } from "./util.mjs";

export const meta = {
  type: "domino",
  title: "Домино",
  players: 2,
  coop: false,
};

const HAND = 7;

function fullSet() {
  const out = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) out.push([a, b]);
  return out;
}

function isDouble(t) {
  return t[0] === t[1];
}

function pips(hand) {
  return hand.reduce((sum, t) => sum + t[0] + t[1], 0);
}

// Кто ходит первым: у кого младший дубль, иначе у кого младший камень
function firstMover(hands) {
  let best = null;
  for (const id of Object.keys(hands)) {
    for (const t of hands[id]) {
      const weight = isDouble(t) ? t[0] : 100 + t[0] + t[1];
      if (!best || weight < best.weight) best = { id, weight, tile: t };
    }
  }
  return best ? best.id : "angelina";
}

export function create(userId) {
  const deck = shuffle(fullSet());
  const foe = other(userId);
  const hands = {
    [userId]: deck.splice(0, HAND),
    [foe]: deck.splice(0, HAND),
  };
  return {
    phase: "playing",
    hands,
    stock: deck,
    line: [], // камни в порядке выкладки, line[i][1] === line[i+1][0]
    turn: firstMover(hands),
    drewThisTurn: 0,
    last: null, // что случилось последним ходом - для подписи на экране
    status: "active",
    winner: null,
  };
}

export function turnOf(s) {
  return s.status === "active" ? s.turn : null;
}

export function ends(s) {
  if (!s.line.length) return null;
  return [s.line[0][0], s.line[s.line.length - 1][1]];
}

// Куда можно приложить камень: список сторон
export function sidesFor(s, tile) {
  if (!s.line.length) return ["right"];
  const e = ends(s);
  const out = [];
  if (tile[0] === e[0] || tile[1] === e[0]) out.push("left");
  if (tile[0] === e[1] || tile[1] === e[1]) out.push("right");
  return out;
}

function canPlayAny(s, hand) {
  return hand.some((t) => sidesFor(s, t).length > 0);
}

function finish(s, winner) {
  s.status = "finished";
  s.phase = "finished";
  s.winner = winner;
}

// Конец при "рыбе": считаем очки, меньше - тот и выиграл
function fish(s) {
  const a = pips(s.hands.angelina);
  const k = pips(s.hands.kirill);
  s.last = { kind: "fish", angelina: a, kirill: k };
  if (a === k) finish(s, null);
  else finish(s, a < k ? "angelina" : "kirill");
}

export function move(s, userId, action) {
  if (s.status !== "active") return { error: "Игра уже закончена" };
  if (userId !== s.turn) return { error: "Сейчас не твой ход" };
  const hand = s.hands[userId];

  if (action.kind === "play") {
    const i = Number(action.tile);
    const tile = hand[i];
    if (!tile) return { error: "Нет такого камня" };
    const sides = sidesFor(s, tile);
    if (!sides.length) return { error: "Этот камень не подходит" };
    const side = sides.includes(action.side) ? action.side : sides[0];

    hand.splice(i, 1);
    if (!s.line.length) {
      s.line.push(tile.slice());
    } else if (side === "left") {
      const e = s.line[0][0];
      // камень поворачиваем так, чтобы к линии примыкало совпавшее число
      s.line.unshift(tile[1] === e ? [tile[0], tile[1]] : [tile[1], tile[0]]);
    } else {
      const e = s.line[s.line.length - 1][1];
      s.line.push(tile[0] === e ? [tile[0], tile[1]] : [tile[1], tile[0]]);
    }
    s.last = { kind: "play", by: userId, tile };
    s.drewThisTurn = 0;

    if (!hand.length) {
      finish(s, userId);
      return { ok: true, result: "win" };
    }
    // соперник без ходов и базар пуст - партия заперта
    const foe = other(userId);
    if (!s.stock.length && !canPlayAny(s, s.hands[foe])) {
      fish(s);
      return { ok: true, result: "fish" };
    }
    s.turn = foe;
    return { ok: true };
  }

  if (action.kind === "draw") {
    if (canPlayAny(s, hand)) return { error: "У тебя есть чем ходить" };
    if (!s.stock.length) return { error: "Базар пуст" };
    hand.push(s.stock.pop());
    s.drewThisTurn += 1;
    s.last = { kind: "draw", by: userId };
    return { ok: true, result: "draw" };
  }

  if (action.kind === "pass") {
    if (canPlayAny(s, hand)) return { error: "У тебя есть чем ходить" };
    if (s.stock.length) return { error: "Сначала возьми из базара" };
    s.last = { kind: "pass", by: userId };
    s.drewThisTurn = 0;
    const foe = other(userId);
    // оба подряд не могут ходить - рыба
    if (!canPlayAny(s, s.hands[foe])) {
      fish(s);
      return { ok: true, result: "fish" };
    }
    s.turn = foe;
    return { ok: true };
  }

  return { error: "Неизвестное действие" };
}

export function view(s, userId) {
  const foe = other(userId);
  const hand = s.hands[userId] || [];
  const done = s.status !== "active";
  return {
    phase: s.phase,
    line: s.line,
    ends: ends(s),
    hand,
    // подсказка, чем вообще можно сходить
    playable: hand.map((t) => sidesFor(s, t)),
    canPlay: canPlayAny(s, hand),
    foeCount: (s.hands[foe] || []).length,
    stock: s.stock.length,
    turn: s.turn,
    myTurn: s.turn === userId && !done,
    last: s.last,
    myPips: pips(hand),
    status: s.status,
    winner: s.winner,
    // руку соперника открываем только в конце
    foeHand: done ? s.hands[foe] : undefined,
  };
}
