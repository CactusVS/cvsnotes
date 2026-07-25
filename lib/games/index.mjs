// Реестр игр: единая точка входа для API.
// Важно: наружу отдаём только view(), чтобы секреты (корабли, слово, карта) не утекли сопернику.
import * as battleship from "./battleship.mjs";
import * as checkers from "./checkers.mjs";
import * as codenames from "./codenames.mjs";
import * as wordle from "./wordle.mjs";

export const ENGINES = { battleship, checkers, codenames, wordle };

export const CATALOG = [
  {
    type: "battleship",
    title: "Морской бой",
    tagline: "Найди и потопи флот соперника",
    coop: false,
    variants: [
      { id: "abilities", title: "Со способностями", hint: "радар, залп и мина" },
      { id: "classic", title: "Классический", hint: "как на бумаге" },
    ],
    rules: [
      "Сначала расставь флот: выбери корабль, поверни кнопкой и ткни в клетку.",
      "Корабли не должны касаться даже углами. Нажми на свой корабль, чтобы убрать его.",
      "Попал - стреляешь ещё раз. Промахнулся - ход переходит.",
      "Радар: показывает, сколько палуб в квадрате 3 на 3, но не где именно. Тратит ход.",
      "Залп: три выстрела подряд, но следующий ход пропускаешь.",
      "Мина: ставишь на своё пустое поле. Соперник попал по ней - теряет ход.",
      "Каждая способность работает один раз за партию.",
    ],
  },
  {
    type: "checkers",
    title: "Шашки",
    tagline: "Русские шашки с дамками",
    coop: false,
    variants: null,
    rules: [
      "Бить обязательно. Если есть несколько вариантов боя, выбираешь любой.",
      "Простые шашки ходят вперёд, а бьют и вперёд, и назад.",
      "Дошёл до последнего ряда - стал дамкой. Дамка ходит и бьёт на любое расстояние.",
      "Побил несколько подряд - серия продолжается тем же ходом.",
      "Проиграл тот, у кого не осталось шашек или ходов.",
    ],
  },
  {
    type: "codenames",
    title: "Кодовые имена: дуэт",
    tagline: "Кооператив: вы вдвоём против поля",
    coop: true,
    variants: null,
    rules: [
      "Вы не соперники, а команда. Нужно вместе найти 15 агентов за 9 ходов.",
      "У каждого своя карта. На ней подсвечено, какие слова ДОЛЖЕН УГАДАТЬ ПАРТНЁР с твоей подсказки.",
      "Ты даёшь одно слово-ассоциацию и число - сколько слов оно описывает.",
      "Партнёр открывает слова. Угадал агента - продолжает, попал в постороннего - ход переходит.",
      "Открыть можно на одно слово больше, чем сказано в подсказке.",
      "Убийца - мгновенный проигрыш. Проверяется всегда карта того, кто давал подсказку.",
    ],
  },
  {
    type: "wordle",
    title: "Wordle-дуэль",
    tagline: "Загадай слово - пусть отгадывает",
    coop: false,
    variants: null,
    rules: [
      "Ты загадываешь слово от 4 до 8 букв, партнёр отгадывает за 6 попыток.",
      "Зелёная буква - на своём месте. Жёлтая - есть в слове, но не там.",
      "Словаря нет: загадывать можно что угодно, хоть имена и свои словечки.",
      "Буква ё считается за е.",
    ],
  },
];

export function catalogEntry(type) {
  return CATALOG.find((c) => c.type === type) || null;
}

export function createGame(type, userId, opts = {}) {
  const eng = ENGINES[type];
  if (!eng) return { error: "Нет такой игры" };
  const state = eng.create(userId, opts);
  return { state };
}

export function applyMove(game, userId, action) {
  const eng = ENGINES[game.type];
  if (!eng) return { error: "Нет такой игры" };
  const res = eng.move(game.state, userId, action || {});
  if (res && res.error) return res;
  // движок сам решает, закончена ли партия
  const st = game.state;
  game.status = st.status === "active" ? "active" : "finished";
  game.winner = st.winner || null;
  return res;
}

export function viewGame(game, userId) {
  const eng = ENGINES[game.type];
  if (!eng) return null;
  return eng.view(game.state, userId);
}

export function turnOf(game) {
  const eng = ENGINES[game.type];
  if (!eng || !eng.turnOf) return null;
  return eng.turnOf(game.state);
}

// Короткая карточка для списка игр
export function summary(game, userId) {
  const entry = catalogEntry(game.type);
  const turn = turnOf(game);
  return {
    id: game.id,
    type: game.type,
    variant: game.variant || null,
    title: entry ? entry.title : game.type,
    coop: !!(entry && entry.coop),
    status: game.status,
    winner: game.winner || null,
    turn,
    yourTurn: turn === userId,
    created_by: game.created_by,
    created_at: game.created_at,
    updated_at: game.updated_at,
    phase: game.state && game.state.phase ? game.state.phase : null,
  };
}

// Статистика по завершённым партиям
export function buildStats(games) {
  const byType = {};
  for (const c of CATALOG) {
    byType[c.type] = {
      type: c.type,
      title: c.title,
      coop: !!c.coop,
      played: 0,
      active: 0,
      wins: { angelina: 0, kirill: 0 },
      coopWon: 0,
      coopLost: 0,
      bestFound: 0, // для кооператива - лучший результат
      extra: null,
    };
  }

  const wordleTries = [];
  let wordleSolved = 0;
  let wordleFailed = 0;
  let totalActive = 0;

  for (const g of games) {
    const row = byType[g.type];
    if (!row) continue;
    if (g.status === "active") {
      row.active += 1;
      totalActive += 1;
      continue;
    }
    row.played += 1;

    if (row.coop) {
      if (g.winner === "both") row.coopWon += 1;
      else row.coopLost += 1;
      const found = g.state && typeof g.state.found === "number" ? g.state.found : 0;
      if (found > row.bestFound) row.bestFound = found;
    } else if (g.winner === "angelina" || g.winner === "kirill") {
      row.wins[g.winner] += 1;
    }

    if (g.type === "wordle") {
      const st = g.state || {};
      const n = (st.guesses || []).length;
      // слово отгадано, если победил тот, кто отгадывал
      if (st.winner && st.winner === st.guesser) {
        wordleSolved += 1;
        wordleTries.push(n);
      } else {
        wordleFailed += 1;
      }
    }
  }

  if (wordleSolved || wordleFailed) {
    const dist = [0, 0, 0, 0, 0, 0];
    for (const n of wordleTries) if (n >= 1 && n <= 6) dist[n - 1] += 1;
    const sum = wordleTries.reduce((a, b) => a + b, 0);
    byType.wordle.extra = {
      kind: "wordle",
      solved: wordleSolved,
      failed: wordleFailed,
      best: wordleTries.length ? Math.min(...wordleTries) : 0,
      avg: wordleTries.length ? Math.round((sum / wordleTries.length) * 10) / 10 : 0,
      dist,
    };
  }

  // общие показатели - без противопоставления игроков
  let played = 0;
  let coopWon = 0;
  let favorite = null;
  for (const k of Object.keys(byType)) {
    const r = byType[k];
    played += r.played;
    coopWon += r.coopWon;
    if (r.played > 0 && (!favorite || r.played > favorite.played)) {
      favorite = { title: r.title, type: r.type, played: r.played };
    }
  }

  // соперничество сверху, совместные снизу, внутри - по числу партий
  const order = Object.values(byType).sort((a, b) => {
    if (a.coop !== b.coop) return a.coop ? 1 : -1;
    if (b.played !== a.played) return b.played - a.played;
    return b.active - a.active;
  });

  return {
    totals: { played, active: totalActive, coopWon, favorite },
    byType: order,
  };
}
