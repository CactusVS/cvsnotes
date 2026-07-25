// Русские шашки: бой обязателен, бьют и назад, дамка ходит и бьёт на любое расстояние.
// Побитые шашки снимаются только в конце серии и повторно не бьются (правило турецкого удара).
import { other } from "./util.mjs";

export const N = 8;

export const meta = {
  type: "checkers",
  title: "Шашки",
  players: 2,
  coop: false,
};

const DIRS = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

const xy = (i) => [i % N, Math.floor(i / N)];
const idx = (x, y) => y * N + x;
const inB = (x, y) => x >= 0 && x < N && y >= 0 && y < N;
const colorOf = (ch) => (ch === "." ? null : ch.toLowerCase());
const isKing = (ch) => ch !== "." && ch === ch.toUpperCase();

export function initialBoard() {
  const b = new Array(N * N).fill(".");
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if ((x + y) % 2 !== 1) continue; // играем только по тёмным клеткам
      if (y <= 2) b[idx(x, y)] = "b";
      else if (y >= 5) b[idx(x, y)] = "w";
    }
  }
  return b;
}

export function create(userId) {
  // создатель играет белыми и ходит первым
  const colors = { [userId]: "w", [other(userId)]: "b" };
  return {
    board: initialBoard(),
    colors,
    turn: userId,
    chain: null, // { from, captured: [] } - незаконченная серия взятий
    status: "active",
    winner: null,
    moveCount: 0,
  };
}

export function turnOf(s) {
  return s.status === "active" ? s.turn : null;
}

// Взятия конкретной шашкой. blocked - уже побитые в этой серии (блокируют, но не бьются)
function capturesFrom(board, i, blocked) {
  const ch = board[i];
  if (ch === ".") return [];
  const me = colorOf(ch);
  const king = isKing(ch);
  const [x0, y0] = xy(i);
  const out = [];

  for (const [dx, dy] of DIRS) {
    if (!king) {
      const mx = x0 + dx,
        my = y0 + dy;
      const lx = x0 + 2 * dx,
        ly = y0 + 2 * dy;
      if (!inB(lx, ly)) continue;
      const mi = idx(mx, my),
        li = idx(lx, ly);
      const mc = board[mi];
      if (mc === "." || colorOf(mc) === me) continue;
      if (blocked.has(mi)) continue;
      if (board[li] !== ".") continue;
      out.push({ from: i, to: li, cap: mi });
    } else {
      let x = x0 + dx,
        y = y0 + dy;
      while (inB(x, y) && board[idx(x, y)] === ".") {
        x += dx;
        y += dy;
      }
      if (!inB(x, y)) continue;
      const vi = idx(x, y);
      if (colorOf(board[vi]) === me) continue;
      if (blocked.has(vi)) continue;
      let lx = x + dx,
        ly = y + dy;
      while (inB(lx, ly) && board[idx(lx, ly)] === ".") {
        out.push({ from: i, to: idx(lx, ly), cap: vi });
        lx += dx;
        ly += dy;
      }
    }
  }
  return out;
}

function quietFrom(board, i) {
  const ch = board[i];
  if (ch === ".") return [];
  const me = colorOf(ch);
  const king = isKing(ch);
  const [x0, y0] = xy(i);
  const out = [];

  if (king) {
    for (const [dx, dy] of DIRS) {
      let x = x0 + dx,
        y = y0 + dy;
      while (inB(x, y) && board[idx(x, y)] === ".") {
        out.push({ from: i, to: idx(x, y), cap: null });
        x += dx;
        y += dy;
      }
    }
  } else {
    const fy = me === "w" ? -1 : 1; // белые идут вверх по доске
    for (const dx of [-1, 1]) {
      const x = x0 + dx,
        y = y0 + fy;
      if (inB(x, y) && board[idx(x, y)] === ".") {
        out.push({ from: i, to: idx(x, y), cap: null });
      }
    }
  }
  return out;
}

// Все допустимые ходы цвета с учётом обязательного боя
export function legalMoves(s, color) {
  const board = s.board;
  if (s.chain) {
    return capturesFrom(board, s.chain.from, new Set(s.chain.captured));
  }
  const caps = [];
  const quiet = [];
  for (let i = 0; i < board.length; i++) {
    if (colorOf(board[i]) !== color) continue;
    caps.push(...capturesFrom(board, i, new Set()));
  }
  if (caps.length) return caps;
  for (let i = 0; i < board.length; i++) {
    if (colorOf(board[i]) !== color) continue;
    quiet.push(...quietFrom(board, i));
  }
  return quiet;
}

function hasPieces(board, color) {
  return board.some((ch) => colorOf(ch) === color);
}

export function move(s, userId, action) {
  if (s.status !== "active") return { error: "Игра уже закончена" };
  if (s.turn !== userId) return { error: "Сейчас не твой ход" };
  if (action.kind !== "move") return { error: "Неизвестное действие" };

  const color = s.colors[userId];
  const from = Number(action.from);
  const to = Number(action.to);
  const moves = legalMoves(s, color);
  const mv = moves.find((m) => m.from === from && m.to === to);
  if (!mv) {
    const mustCapture = moves.length && moves[0].cap != null;
    return { error: mustCapture ? "Бить обязательно" : "Так ходить нельзя" };
  }

  const board = s.board;
  const ch = board[mv.from];
  board[mv.from] = ".";
  board[mv.to] = ch;

  // проход в дамки, в том числе посреди серии взятий
  const [, ty] = xy(mv.to);
  if (!isKing(ch)) {
    if ((color === "w" && ty === 0) || (color === "b" && ty === N - 1)) {
      board[mv.to] = ch.toUpperCase();
    }
  }

  let continues = false;
  if (mv.cap != null) {
    if (!s.chain) s.chain = { from: mv.to, captured: [] };
    s.chain.captured.push(mv.cap);
    s.chain.from = mv.to;
    const more = capturesFrom(board, mv.to, new Set(s.chain.captured));
    if (more.length) {
      continues = true;
    } else {
      for (const c of s.chain.captured) board[c] = ".";
      s.chain = null;
    }
  }

  if (continues) return { ok: true, continues: true };

  s.moveCount += 1;
  const foeColor = color === "w" ? "b" : "w";
  const foeId = other(userId);

  if (!hasPieces(board, foeColor)) {
    s.status = "finished";
    s.winner = userId;
    return { ok: true, result: "win" };
  }
  s.turn = foeId;
  if (legalMoves(s, foeColor).length === 0) {
    s.status = "finished";
    s.winner = userId;
    return { ok: true, result: "win" };
  }
  return { ok: true };
}

export function view(s, userId) {
  const color = s.colors[userId];
  const out = {
    board: s.board,
    colors: s.colors,
    myColor: color,
    turn: s.turn,
    status: s.status,
    winner: s.winner,
    chain: s.chain ? { from: s.chain.from } : null,
    moveCount: s.moveCount,
  };
  // подсказываем допустимые ходы тому, чей сейчас ход (скрытой информации в шашках нет)
  if (s.status === "active" && s.turn === userId) {
    out.moves = legalMoves(s, color);
  }
  return out;
}
