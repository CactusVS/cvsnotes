// Морской бой. Два режима: классический и со способностями (радар, залп, мина).
// Корабли расставляются автоматически, игрок может перемешать - так удобнее на телефоне.
import { other } from "./util.mjs";

export const SIZE = 10;
export const SIZES = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];

export const meta = {
  type: "battleship",
  title: "Морской бой",
  players: 2,
  coop: false,
};

const xy = (i) => [i % SIZE, Math.floor(i / SIZE)];
const idx = (x, y) => y * SIZE + x;

function neighbors(i) {
  const [x, y] = xy(i);
  const out = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx,
        ny = y + dy;
      if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE) out.push(idx(nx, ny));
    }
  }
  return out;
}

function tryPlaceFleet() {
  const blocked = new Set();
  const ships = [];
  for (const size of SIZES) {
    let placed = false;
    for (let t = 0; t < 400 && !placed; t++) {
      const horiz = Math.random() < 0.5;
      const x = Math.floor(Math.random() * (horiz ? SIZE - size + 1 : SIZE));
      const y = Math.floor(Math.random() * (horiz ? SIZE : SIZE - size + 1));
      const cells = [];
      for (let k = 0; k < size; k++) cells.push(horiz ? idx(x + k, y) : idx(x, y + k));
      if (cells.some((c) => blocked.has(c))) continue;
      for (const c of cells) for (const nb of neighbors(c)) blocked.add(nb);
      ships.push({ size, cells, hits: [] });
      placed = true;
    }
    if (!placed) return null;
  }
  return ships;
}

export function randomFleet() {
  for (let i = 0; i < 60; i++) {
    const f = tryPlaceFleet();
    if (f) return f;
  }
  return [];
}

// Сколько кораблей каждого размера ещё осталось поставить
export function remaining(fleet) {
  const counts = {};
  for (const s of SIZES) counts[s] = (counts[s] || 0) + 1;
  for (const sh of fleet) counts[sh.size] = (counts[sh.size] || 0) - 1;
  return counts;
}

export function fleetComplete(fleet) {
  const r = remaining(fleet);
  return Object.keys(r).every((k) => r[k] === 0);
}

// Проверка постановки: в границах и не касается уже стоящих. Возвращает клетки или null
function canPlace(fleet, size, x, y, horiz) {
  const cells = [];
  for (let k = 0; k < size; k++) {
    const cx = horiz ? x + k : x;
    const cy = horiz ? y : y + k;
    if (cx < 0 || cx >= SIZE || cy < 0 || cy >= SIZE) return null;
    cells.push(idx(cx, cy));
  }
  // neighbors() включает саму клетку, поэтому пересечения тоже отсекаются
  const occupied = new Set(fleet.flatMap((s) => s.cells));
  for (const c of cells) {
    for (const nb of neighbors(c)) if (occupied.has(nb)) return null;
  }
  return cells;
}

export function create(userId, opts = {}) {
  const variant = opts.variant === "abilities" ? "abilities" : "classic";
  const mk = () => ({ radar: 1, salvo: 1, mine: 1 });
  return {
    variant,
    phase: "placing",
    ready: { angelina: false, kirill: false },
    // корабли игроки расставляют сами
    fleets: { angelina: [], kirill: [] },
    shots: { angelina: {}, kirill: {} }, // выстрелы игрока по чужому полю
    mines: { angelina: null, kirill: null }, // мина на своём поле
    abilities: { angelina: mk(), kirill: mk() },
    radarLog: { angelina: [], kirill: [] },
    skip: { angelina: false, kirill: false },
    turn: userId,
    status: "active",
    winner: null,
    log: [],
  };
}

export function turnOf(s) {
  if (s.status !== "active") return null;
  if (s.phase === "placing") {
    // ходят оба, пока не подтвердят расстановку
    return null;
  }
  return s.turn;
}

function shipAt(fleet, cell) {
  return fleet.find((sh) => sh.cells.includes(cell)) || null;
}
function isSunk(sh) {
  return sh.cells.every((c) => sh.hits.includes(c));
}
function allSunk(fleet) {
  return fleet.every(isSunk);
}

function advance(s) {
  const next = other(s.turn);
  if (s.skip[next]) {
    s.skip[next] = false; // пропускает ход, ходим ещё раз
    return;
  }
  s.turn = next;
}

function pushLog(s, entry) {
  s.log.push(entry);
  if (s.log.length > 40) s.log.shift();
}

// Один выстрел. Возвращает 'hit' | 'miss' | 'sunk' | 'mine'
function resolveShot(s, shooter, cell) {
  const target = other(shooter);
  const fleet = s.fleets[target];
  const sh = shipAt(fleet, cell);

  if (sh) {
    sh.hits.push(cell);
    s.shots[shooter][cell] = "hit";
    if (isSunk(sh)) {
      pushLog(s, { by: shooter, cell, result: "sunk", size: sh.size });
      return "sunk";
    }
    pushLog(s, { by: shooter, cell, result: "hit" });
    return "hit";
  }

  s.shots[shooter][cell] = "miss";
  // мина противника на этой клетке - стрелявший теряет следующий ход
  if (s.variant === "abilities" && s.mines[target] === cell) {
    s.mines[target] = null;
    s.skip[shooter] = true;
    pushLog(s, { by: shooter, cell, result: "mine" });
    return "mine";
  }
  pushLog(s, { by: shooter, cell, result: "miss" });
  return "miss";
}

export function move(s, userId, action) {
  if (s.status !== "active") return { error: "Игра уже закончена" };

  // ---- расстановка ----
  if (s.phase === "placing") {
    if (s.ready[userId] && action.kind !== "ready") {
      return { error: "Расстановка уже подтверждена" };
    }

    if (action.kind === "place") {
      const size = Number(action.size);
      const x = Number(action.x);
      const y = Number(action.y);
      const horiz = !!action.horiz;
      if (!SIZES.includes(size)) return { error: "Нет такого корабля" };
      const fleet = s.fleets[userId];
      if ((remaining(fleet)[size] || 0) < 1)
        return { error: "Корабли этого размера кончились" };
      const cells = canPlace(fleet, size, x, y, horiz);
      if (!cells) return { error: "Сюда нельзя: выходит за поле или касается другого корабля" };
      fleet.push({ size, cells, hits: [] });
      // мина не должна оказаться под кораблём
      if (s.mines[userId] != null && cells.includes(s.mines[userId])) s.mines[userId] = null;
      return { ok: true };
    }

    if (action.kind === "remove") {
      const cell = Number(action.cell);
      const fleet = s.fleets[userId];
      const i = fleet.findIndex((sh) => sh.cells.includes(cell));
      if (i === -1) return { error: "Тут нет корабля" };
      fleet.splice(i, 1);
      return { ok: true };
    }

    if (action.kind === "auto") {
      s.fleets[userId] = randomFleet();
      s.mines[userId] = null;
      return { ok: true };
    }

    if (action.kind === "clear") {
      s.fleets[userId] = [];
      s.mines[userId] = null;
      return { ok: true };
    }

    if (action.kind === "mine") {
      if (s.variant !== "abilities") return { error: "В этом режиме мин нет" };
      const cell = Number(action.cell);
      if (!Number.isInteger(cell) || cell < 0 || cell >= SIZE * SIZE)
        return { error: "Нет такой клетки" };
      if (shipAt(s.fleets[userId], cell)) return { error: "Мина ставится на пустую клетку" };
      s.mines[userId] = s.mines[userId] === cell ? null : cell;
      return { ok: true };
    }
    if (action.kind === "ready") {
      if (!fleetComplete(s.fleets[userId]))
        return { error: "Сначала расставь все корабли" };
      s.ready[userId] = true;
      if (s.ready.angelina && s.ready.kirill) s.phase = "battle";
      return { ok: true };
    }
    return { error: "Сначала расставь корабли" };
  }

  // ---- бой ----
  if (s.turn !== userId) return { error: "Сейчас не твой ход" };
  const target = other(userId);

  if (action.kind === "shot") {
    const cell = Number(action.cell);
    if (!Number.isInteger(cell) || cell < 0 || cell >= SIZE * SIZE)
      return { error: "Нет такой клетки" };
    if (s.shots[userId][cell]) return { error: "Сюда уже стрелял" };

    const res = resolveShot(s, userId, cell);
    if (allSunk(s.fleets[target])) {
      s.status = "finished";
      s.winner = userId;
      return { ok: true, result: "win" };
    }
    // попал - стреляешь ещё раз
    if (res === "hit" || res === "sunk") return { ok: true, result: res };
    advance(s);
    return { ok: true, result: res };
  }

  if (action.kind === "salvo") {
    if (s.variant !== "abilities") return { error: "В этом режиме залпа нет" };
    if (s.abilities[userId].salvo < 1) return { error: "Залп уже использован" };
    const cells = Array.isArray(action.cells) ? action.cells.map(Number) : [];
    if (cells.length !== 3) return { error: "Нужно выбрать 3 клетки" };
    for (const c of cells) {
      if (!Number.isInteger(c) || c < 0 || c >= SIZE * SIZE)
        return { error: "Нет такой клетки" };
      if (s.shots[userId][c]) return { error: "По одной из клеток уже стрелял" };
    }
    if (new Set(cells).size !== 3) return { error: "Клетки должны быть разными" };

    s.abilities[userId].salvo -= 1;
    const results = cells.map((c) => resolveShot(s, userId, c));
    if (allSunk(s.fleets[target])) {
      s.status = "finished";
      s.winner = userId;
      return { ok: true, result: "win", results };
    }
    // за залп расплачиваешься следующим ходом
    s.skip[userId] = true;
    advance(s);
    return { ok: true, results };
  }

  if (action.kind === "radar") {
    if (s.variant !== "abilities") return { error: "В этом режиме радара нет" };
    if (s.abilities[userId].radar < 1) return { error: "Радар уже использован" };
    const cell = Number(action.cell);
    if (!Number.isInteger(cell) || cell < 0 || cell >= SIZE * SIZE)
      return { error: "Нет такой клетки" };
    const area = neighbors(cell);
    let count = 0;
    for (const c of area) if (shipAt(s.fleets[target], c)) count++;
    s.abilities[userId].radar -= 1;
    s.radarLog[userId].push({ center: cell, count });
    pushLog(s, { by: userId, cell, result: "radar", count });
    advance(s);
    return { ok: true, result: "radar", count };
  }

  return { error: "Неизвестное действие" };
}

// Сколько кораблей каждого размера ещё живо у игрока
function aliveBySize(fleet) {
  const out = {};
  for (const sh of fleet) {
    if (!isSunk(sh)) out[sh.size] = (out[sh.size] || 0) + 1;
  }
  return out;
}

export function view(s, userId) {
  const foe = other(userId);
  const myFleet = s.fleets[userId] || [];
  const foeFleet = s.fleets[foe] || [];

  // клетки потопленных вражеских кораблей показывать честно можно
  const enemySunkCells = [];
  for (const sh of foeFleet) if (isSunk(sh)) enemySunkCells.push(...sh.cells);

  const out = {
    variant: s.variant,
    phase: s.phase,
    status: s.status,
    winner: s.winner,
    turn: s.turn,
    ready: s.ready,
    myShips: myFleet.map((sh) => ({ size: sh.size, cells: sh.cells, hits: sh.hits })),
    myMine: s.mines[userId],
    incoming: s.shots[foe] || {}, // куда стрелял противник по мне
    myShots: s.shots[userId] || {}, // куда стрелял я
    enemySunkCells,
    enemyAlive: aliveBySize(foeFleet),
    myAlive: aliveBySize(myFleet),
    remaining: remaining(myFleet),
    complete: fleetComplete(myFleet),
    abilities: s.abilities[userId],
    radarLog: s.radarLog[userId] || [],
    skipMe: !!s.skip[userId],
    log: s.log.slice(-8),
  };
  // после конца партии можно посмотреть, где стояли корабли соперника
  if (s.status === "finished") {
    out.enemyShips = foeFleet.map((sh) => ({ size: sh.size, cells: sh.cells, hits: sh.hits }));
  }
  return out;
}
