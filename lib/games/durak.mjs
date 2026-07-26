// Подкидной дурак на двоих: 36 карт, козырь снизу колоды.
import { other, shuffle } from "./util.mjs";

export const meta = {
  type: "durak",
  title: "Дурак",
  players: 2,
  coop: false,
};

export const SUITS = ["s", "h", "d", "c"]; // пики, черви, бубны, трефы
export const RANKS = [6, 7, 8, 9, 10, 11, 12, 13, 14];
const HAND = 6;
const MAX_ATTACKS = 6;

function fullDeck() {
  const out = [];
  for (const s of SUITS) for (const r of RANKS) out.push({ r, s });
  return out;
}

function beats(def, att, trump) {
  if (def.s === att.s) return def.r > att.r;
  return def.s === trump && att.s !== trump;
}

function lowestTrump(hand, trump) {
  let best = null;
  for (const c of hand) {
    if (c.s !== trump) continue;
    if (!best || c.r < best.r) best = c;
  }
  return best;
}

export function create(userId) {
  const deck = shuffle(fullDeck());
  const foe = other(userId);
  const hands = { [userId]: deck.splice(0, HAND), [foe]: deck.splice(0, HAND) };
  // козырь - масть нижней карты, она же достаётся последней
  const trump = deck.length ? deck[0].s : hands[userId][0].s;

  // первым ходит тот, у кого младший козырь
  const a = lowestTrump(hands[userId], trump);
  const b = lowestTrump(hands[foe], trump);
  let attacker = userId;
  if (a && b) attacker = a.r <= b.r ? userId : foe;
  else if (b && !a) attacker = foe;

  return {
    phase: "playing",
    deck,
    trump,
    trumpCard: deck.length ? deck[0] : null,
    hands,
    attacker,
    table: [], // [{a: карта, d: карта или null}]
    taking: false, // защитник сказал "беру", атакующий может подкинуть
    discard: 0,
    status: "active",
    winner: null,
    last: null,
  };
}

function defenderOf(s) {
  return other(s.attacker);
}

export function turnOf(s) {
  if (s.status !== "active") return null;
  if (s.taking) return s.attacker;
  const open = s.table.some((p) => !p.d);
  return open ? defenderOf(s) : s.attacker;
}

// какие ранги уже лежат на столе - только их можно подкидывать
function tableRanks(s) {
  const set = new Set();
  for (const p of s.table) {
    set.add(p.a.r);
    if (p.d) set.add(p.d.r);
  }
  return set;
}

function drawUp(s, id) {
  const hand = s.hands[id];
  while (hand.length < HAND && s.deck.length) hand.push(s.deck.pop());
}

// Добор после круга: сначала атакующий, потом защитник
function refill(s) {
  const def = defenderOf(s);
  drawUp(s, s.attacker);
  drawUp(s, def);
}

function finishCheck(s) {
  if (s.deck.length) return false;
  const a = s.hands.angelina.length;
  const k = s.hands.kirill.length;
  if (a && k) return false;
  s.status = "finished";
  s.phase = "finished";
  // без карт остался - вышел. Дурак тот, у кого карты ещё есть
  if (!a && !k) s.winner = null;
  else s.winner = a ? "kirill" : "angelina";
  return true;
}

export function move(s, userId, action) {
  if (s.status !== "active") return { error: "Игра уже закончена" };
  const def = defenderOf(s);

  if (action.kind === "attack") {
    if (userId !== s.attacker) return { error: "Ходит другой игрок" };
    const hand = s.hands[userId];
    const card = hand[Number(action.card)];
    if (!card) return { error: "Нет такой карты" };
    if (s.table.length >= MAX_ATTACKS) return { error: "Больше шести карт не подкинешь" };
    if (s.table.length) {
      if (!tableRanks(s).has(card.r)) return { error: "Подкинуть можно только то, что уже на столе" };
      // нельзя подкинуть больше, чем у защитника карт на руках
      const open = s.table.filter((p) => !p.d).length;
      if (open >= s.hands[def].length) return { error: "У соперника не хватит карт" };
    }
    hand.splice(Number(action.card), 1);
    s.table.push({ a: card, d: null });
    s.last = { kind: "attack", by: userId, card };
    return { ok: true };
  }

  if (action.kind === "defend") {
    if (userId !== def) return { error: "Отбивается другой игрок" };
    if (s.taking) return { error: "Ты уже забираешь карты" };
    const hand = s.hands[userId];
    const card = hand[Number(action.card)];
    if (!card) return { error: "Нет такой карты" };
    const slot = s.table[Number(action.slot)];
    if (!slot) return { error: "Нет такой карты на столе" };
    if (slot.d) return { error: "Эта карта уже отбита" };
    if (!beats(card, slot.a, s.trump)) return { error: "Этой картой не побить" };
    hand.splice(Number(action.card), 1);
    slot.d = card;
    s.last = { kind: "defend", by: userId, card };
    // отбился и карт не осталось - круг можно закрывать
    return { ok: true };
  }

  if (action.kind === "take") {
    if (userId !== def) return { error: "Забирает защитник" };
    if (s.taking) return { error: "Ты уже забираешь" };
    if (!s.table.length) return { error: "На столе пусто" };
    s.taking = true;
    s.last = { kind: "take", by: userId };
    return { ok: true };
  }

  if (action.kind === "done") {
    if (userId !== s.attacker) return { error: "Круг закрывает атакующий" };
    if (!s.table.length) return { error: "Сначала походи" };

    if (s.taking) {
      // защитник забирает всё со стола
      for (const p of s.table) {
        s.hands[def].push(p.a);
        if (p.d) s.hands[def].push(p.d);
      }
      s.table = [];
      s.taking = false;
      s.last = { kind: "took", by: def };
      refill(s);
      // защитник пропускает ход, атакует тот же игрок
      if (finishCheck(s)) return { ok: true, result: "over" };
      return { ok: true, result: "took" };
    }

    if (s.table.some((p) => !p.d)) return { error: "Не все карты отбиты" };
    s.discard += s.table.length * 2;
    s.table = [];
    s.last = { kind: "beat", by: s.attacker };
    refill(s);
    if (finishCheck(s)) return { ok: true, result: "over" };
    // отбился - теперь он атакует
    s.attacker = def;
    return { ok: true, result: "beat" };
  }

  return { error: "Неизвестное действие" };
}

export function view(s, userId) {
  const foe = other(userId);
  const def = defenderOf(s);
  const hand = s.hands[userId] || [];
  const done = s.status !== "active";
  const open = s.table.filter((p) => !p.d).length;

  return {
    phase: s.phase,
    trump: s.trump,
    trumpCard: s.deck.length ? s.trumpCard : null,
    deck: s.deck.length,
    discard: s.discard,
    table: s.table,
    taking: s.taking,
    attacker: s.attacker,
    defender: def,
    iAttack: s.attacker === userId,
    hand,
    foeCount: (s.hands[foe] || []).length,
    turn: turnOf(s),
    myTurn: turnOf(s) === userId,
    // какие карты в руке чем бьются - чтобы подсветить на экране
    canBeat: hand.map((c) =>
      s.table.map((p) => (p.d ? false : beats(c, p.a, s.trump)))
    ),
    canAdd: hand.map((c) => !s.table.length || tableRanks(s).has(c.r)),
    openCount: open,
    canFinish: s.attacker === userId && s.table.length > 0 && (s.taking || open === 0),
    status: s.status,
    winner: s.winner,
    foeHand: done ? s.hands[foe] : undefined,
  };
}
