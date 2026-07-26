// Шахматы со всеми правилами: рокировка, взятие на проходе, превращение,
// мат, пат и ничья по 50 ходам.
// Доска: индекс = y*8+x, y=0 - восьмая горизонталь (чёрные), y=7 - первая (белые).
// Белые фигуры - заглавные, чёрные - строчные.
import { other } from "./util.mjs";

export const meta = {
  type: "chess",
  title: "Шахматы",
  players: 2,
  coop: false,
};

const START = [
  "r", "n", "b", "q", "k", "b", "n", "r",
  "p", "p", "p", "p", "p", "p", "p", "p",
  ".", ".", ".", ".", ".", ".", ".", ".",
  ".", ".", ".", ".", ".", ".", ".", ".",
  ".", ".", ".", ".", ".", ".", ".", ".",
  ".", ".", ".", ".", ".", ".", ".", ".",
  "P", "P", "P", "P", "P", "P", "P", "P",
  "R", "N", "B", "Q", "K", "B", "N", "R",
];

const xy = (i) => [i % 8, Math.floor(i / 8)];
const idx = (x, y) => y * 8 + x;
const inB = (x, y) => x >= 0 && x < 8 && y >= 0 && y < 8;

const isEmpty = (ch) => ch === ".";
const sideOf = (ch) => (ch === "." ? null : ch === ch.toUpperCase() ? "w" : "b");
const kindOf = (ch) => (ch === "." ? null : ch.toLowerCase());

const KNIGHT = [
  [1, 2], [2, 1], [2, -1], [1, -2],
  [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const AROUND = DIAG.concat(ORTHO);

export function create(userId) {
  const colors = { [userId]: "w", [other(userId)]: "b" };
  return {
    board: START.slice(),
    colors,
    turn: userId, // белые начинают
    castling: { K: true, Q: true, k: true, q: true },
    ep: null, // поле для взятия на проходе
    halfmove: 0, // счётчик для правила 50 ходов
    fullmove: 1,
    lastMove: null,
    status: "active",
    winner: null,
    result: null, // checkmate | stalemate | fifty | material
    history: [],
  };
}

export function turnOf(s) {
  return s.status === "active" ? s.turn : null;
}

// ---------- атаки ----------
export function isAttacked(board, sq, by) {
  const [x, y] = xy(sq);

  // пешки
  const pd = by === "w" ? 1 : -1; // пешка by стоит "ниже" по y и бьёт вверх
  for (const dx of [-1, 1]) {
    const nx = x + dx,
      ny = y + pd;
    if (!inB(nx, ny)) continue;
    const ch = board[idx(nx, ny)];
    if (kindOf(ch) === "p" && sideOf(ch) === by) return true;
  }
  // кони
  for (const [dx, dy] of KNIGHT) {
    const nx = x + dx,
      ny = y + dy;
    if (!inB(nx, ny)) continue;
    const ch = board[idx(nx, ny)];
    if (kindOf(ch) === "n" && sideOf(ch) === by) return true;
  }
  // король рядом
  for (const [dx, dy] of AROUND) {
    const nx = x + dx,
      ny = y + dy;
    if (!inB(nx, ny)) continue;
    const ch = board[idx(nx, ny)];
    if (kindOf(ch) === "k" && sideOf(ch) === by) return true;
  }
  // слоны и ферзи по диагоналям
  for (const [dx, dy] of DIAG) {
    let nx = x + dx,
      ny = y + dy;
    while (inB(nx, ny)) {
      const ch = board[idx(nx, ny)];
      if (!isEmpty(ch)) {
        const k = kindOf(ch);
        if (sideOf(ch) === by && (k === "b" || k === "q")) return true;
        break;
      }
      nx += dx;
      ny += dy;
    }
  }
  // ладьи и ферзи по линиям
  for (const [dx, dy] of ORTHO) {
    let nx = x + dx,
      ny = y + dy;
    while (inB(nx, ny)) {
      const ch = board[idx(nx, ny)];
      if (!isEmpty(ch)) {
        const k = kindOf(ch);
        if (sideOf(ch) === by && (k === "r" || k === "q")) return true;
        break;
      }
      nx += dx;
      ny += dy;
    }
  }
  return false;
}

function kingSquare(board, side) {
  const k = side === "w" ? "K" : "k";
  return board.indexOf(k);
}

export function inCheck(board, side) {
  const ks = kingSquare(board, side);
  if (ks === -1) return false;
  return isAttacked(board, ks, side === "w" ? "b" : "w");
}

// ---------- псевдоходы одной фигуры ----------
function pseudoFrom(s, i) {
  const board = s.board;
  const ch = board[i];
  const side = sideOf(ch);
  if (!side) return [];
  const kind = kindOf(ch);
  const [x, y] = xy(i);
  const out = [];
  const push = (to, extra) => out.push(Object.assign({ from: i, to }, extra || {}));

  const canTake = (to) => {
    const t = board[to];
    return isEmpty(t) || sideOf(t) !== side;
  };

  if (kind === "p") {
    const dir = side === "w" ? -1 : 1;
    const startRow = side === "w" ? 6 : 1;
    const lastRow = side === "w" ? 0 : 7;
    // вперёд
    const f1x = x,
      f1y = y + dir;
    if (inB(f1x, f1y) && isEmpty(board[idx(f1x, f1y)])) {
      if (f1y === lastRow) for (const p of ["q", "r", "b", "n"]) push(idx(f1x, f1y), { promo: p });
      else push(idx(f1x, f1y));
      const f2y = y + 2 * dir;
      if (y === startRow && isEmpty(board[idx(x, f2y)])) push(idx(x, f2y), { double: true });
    }
    // взятия
    for (const dx of [-1, 1]) {
      const nx = x + dx,
        ny = y + dir;
      if (!inB(nx, ny)) continue;
      const to = idx(nx, ny);
      const t = board[to];
      if (!isEmpty(t) && sideOf(t) !== side) {
        if (ny === lastRow) for (const p of ["q", "r", "b", "n"]) push(to, { promo: p });
        else push(to);
      } else if (s.ep === to) {
        push(to, { ep: true });
      }
    }
    return out;
  }

  if (kind === "n") {
    for (const [dx, dy] of KNIGHT) {
      const nx = x + dx,
        ny = y + dy;
      if (inB(nx, ny) && canTake(idx(nx, ny))) push(idx(nx, ny));
    }
    return out;
  }

  if (kind === "k") {
    for (const [dx, dy] of AROUND) {
      const nx = x + dx,
        ny = y + dy;
      if (inB(nx, ny) && canTake(idx(nx, ny))) push(idx(nx, ny));
    }
    // рокировка
    const foe = side === "w" ? "b" : "w";
    const row = side === "w" ? 7 : 0;
    const kSide = side === "w" ? "K" : "k";
    const qSide = side === "w" ? "Q" : "q";
    if (i === idx(4, row) && !isAttacked(board, i, foe)) {
      if (
        s.castling[kSide] &&
        isEmpty(board[idx(5, row)]) &&
        isEmpty(board[idx(6, row)]) &&
        !isAttacked(board, idx(5, row), foe) &&
        !isAttacked(board, idx(6, row), foe)
      ) {
        push(idx(6, row), { castle: "k" });
      }
      if (
        s.castling[qSide] &&
        isEmpty(board[idx(3, row)]) &&
        isEmpty(board[idx(2, row)]) &&
        isEmpty(board[idx(1, row)]) &&
        !isAttacked(board, idx(3, row), foe) &&
        !isAttacked(board, idx(2, row), foe)
      ) {
        push(idx(2, row), { castle: "q" });
      }
    }
    return out;
  }

  const dirs = kind === "b" ? DIAG : kind === "r" ? ORTHO : AROUND;
  for (const [dx, dy] of dirs) {
    let nx = x + dx,
      ny = y + dy;
    while (inB(nx, ny)) {
      const to = idx(nx, ny);
      const t = board[to];
      if (isEmpty(t)) push(to);
      else {
        if (sideOf(t) !== side) push(to);
        break;
      }
      nx += dx;
      ny += dy;
    }
  }
  return out;
}

// Применить ход к копии состояния (без смены очереди) - для проверки на шах
function applyToBoard(s, mv) {
  const board = s.board.slice();
  const ch = board[mv.from];
  const side = sideOf(ch);
  board[mv.from] = ".";

  if (mv.ep) {
    const [tx, ty] = xy(mv.to);
    const capY = side === "w" ? ty + 1 : ty - 1;
    board[idx(tx, capY)] = ".";
  }
  board[mv.to] = mv.promo
    ? side === "w"
      ? mv.promo.toUpperCase()
      : mv.promo
    : ch;

  if (mv.castle) {
    const row = side === "w" ? 7 : 0;
    if (mv.castle === "k") {
      board[idx(5, row)] = board[idx(7, row)];
      board[idx(7, row)] = ".";
    } else {
      board[idx(3, row)] = board[idx(0, row)];
      board[idx(0, row)] = ".";
    }
  }
  return board;
}

// Все законные ходы стороны
export function legalMoves(s, side) {
  const out = [];
  for (let i = 0; i < 64; i++) {
    if (sideOf(s.board[i]) !== side) continue;
    for (const mv of pseudoFrom(s, i)) {
      const nb = applyToBoard(s, mv);
      if (!inCheck(nb, side)) out.push(mv);
    }
  }
  return out;
}

function onlyKings(board) {
  return board.every((ch) => ch === "." || kindOf(ch) === "k");
}

export function move(s, userId, action) {
  if (s.status !== "active") return { error: "Партия уже закончена" };
  if (s.turn !== userId) return { error: "Сейчас не твой ход" };
  if (action.kind !== "move") return { error: "Неизвестное действие" };

  const side = s.colors[userId];
  const from = Number(action.from);
  const to = Number(action.to);
  const promo = action.promo ? String(action.promo).toLowerCase() : null;

  const moves = legalMoves(s, side);
  let mv = moves.find(
    (m) => m.from === from && m.to === to && (!m.promo || !promo || m.promo === promo)
  );
  // если превращение не указано, ставим ферзя
  if (!mv) mv = moves.find((m) => m.from === from && m.to === to && m.promo === "q");
  if (!mv) return { error: "Так ходить нельзя" };

  const ch = s.board[mv.from];
  const captured = s.board[mv.to];
  const kind = kindOf(ch);

  s.board = applyToBoard(s, mv);

  // права на рокировку
  if (kind === "k") {
    if (side === "w") {
      s.castling.K = false;
      s.castling.Q = false;
    } else {
      s.castling.k = false;
      s.castling.q = false;
    }
  }
  const corners = { 0: "q", 7: "k", 56: "Q", 63: "K" };
  if (corners[mv.from]) s.castling[corners[mv.from]] = false;
  if (corners[mv.to]) s.castling[corners[mv.to]] = false;

  // поле для взятия на проходе
  s.ep = null;
  if (mv.double) {
    const [fx, fy] = xy(mv.from);
    s.ep = idx(fx, side === "w" ? fy - 1 : fy + 1);
  }

  // счётчик 50 ходов
  if (kind === "p" || (captured && captured !== ".")) s.halfmove = 0;
  else s.halfmove += 1;
  if (side === "b") s.fullmove += 1;

  s.lastMove = { from: mv.from, to: mv.to };
  s.history.push({ from: mv.from, to: mv.to, promo: mv.promo || null, by: userId });
  if (s.history.length > 200) s.history.shift();

  const foeId = other(userId);
  const foeSide = side === "w" ? "b" : "w";
  s.turn = foeId;

  const foeMoves = legalMoves(s, foeSide);
  if (foeMoves.length === 0) {
    s.status = "finished";
    if (inCheck(s.board, foeSide)) {
      s.winner = userId;
      s.result = "checkmate";
      return { ok: true, result: "checkmate" };
    }
    s.winner = null;
    s.result = "stalemate";
    return { ok: true, result: "stalemate" };
  }
  if (s.halfmove >= 100) {
    s.status = "finished";
    s.winner = null;
    s.result = "fifty";
    return { ok: true, result: "draw" };
  }
  if (onlyKings(s.board)) {
    s.status = "finished";
    s.winner = null;
    s.result = "material";
    return { ok: true, result: "draw" };
  }
  return { ok: true, check: inCheck(s.board, foeSide) };
}

export function view(s, userId) {
  const side = s.colors[userId];
  const out = {
    board: s.board,
    colors: s.colors,
    myColor: side,
    turn: s.turn,
    status: s.status,
    winner: s.winner,
    result: s.result,
    lastMove: s.lastMove,
    check: s.status === "active" ? inCheck(s.board, s.colors[s.turn]) : false,
    fullmove: s.fullmove,
  };
  // в шахматах скрытой информации нет, ходы подсказываем тому, чья очередь
  if (s.status === "active" && s.turn === userId) out.moves = legalMoves(s, side);
  return out;
}
