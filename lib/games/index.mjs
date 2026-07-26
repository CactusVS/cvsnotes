// Реестр игр: единая точка входа для API.
// Важно: наружу отдаём только view(), чтобы секреты (корабли, слово, карта) не утекли сопернику.
import * as battleship from "./battleship.mjs";
import * as checkers from "./checkers.mjs";
import * as chess from "./chess.mjs";
import * as codenames from "./codenames.mjs";
import * as crossword from "./crossword.mjs";
import * as domino from "./domino.mjs";
import * as durak from "./durak.mjs";
import * as hangman from "./hangman.mjs";
import * as uno from "./uno.mjs";
import * as wordle from "./wordle.mjs";

export const ENGINES = {
  battleship,
  checkers,
  chess,
  codenames,
  crossword,
  domino,
  durak,
  hangman,
  uno,
  wordle,
};

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
    type: "chess",
    title: "Шахматы",
    tagline: "Классика",
    coop: false,
    variants: null,
    rules: [
      "Обычные шахматы: рокировка, взятие на проходе, превращение пешки - всё работает.",
      "Создатель партии играет белыми и ходит первым.",
      "Нажми на фигуру - подсветятся её ходы. Ходы, после которых король под боем, не показываются.",
      "Пешка на последней горизонтали превращается в ферзя.",
      "Партия кончается матом, патом или ничьей по правилу 50 ходов.",
    ],
  },
  {
    type: "hangman",
    title: "Виселица",
    tagline: "Открывай буквы, пока есть попытки",
    coop: false,
    variants: null,
    rules: [
      "Один загадывает слово или фразу, можно добавить подсказку.",
      "Второй называет буквы. Промахов можно допустить шесть.",
      "Можно попробовать назвать слово целиком, но ошибка стоит попытки.",
      "Открыл все буквы - победа отгадывающего, кончились попытки - победа загадавшего.",
      "Буква ё считается за е.",
    ],
  },
  {
    type: "durak",
    title: "Дурак",
    tagline: "Подкидной, до последней карты",
    coop: false,
    variants: null,
    rules: [
      "Колода 36 карт. Козырь - масть нижней карты, она видна рядом с колодой.",
      "Первым заходит тот, у кого младший козырь.",
      "Отбить можно старшей картой той же масти или любым козырем.",
      "Отбился - жми бито, не хочешь или нечем - беру. Взял, значит пропускаешь заход.",
      "Подкидывать можно только те номиналы, что уже лежат на столе, и не больше шести карт.",
      "После круга оба добирают до шести. Дурак тот, у кого останутся карты.",
    ],
  },
  {
    type: "domino",
    title: "Домино",
    tagline: "Классические камни от нуля до шести",
    coop: false,
    variants: null,
    rules: [
      "У каждого семь камней, остальные - базар.",
      "Первым ходит тот, у кого младший дубль, а если дублей нет - младший камень.",
      "Камень прикладывают к любому концу линии, числа должны совпасть.",
      "Нечем ходить - берёшь из базара, пока не появится подходящий.",
      "Базар пуст и ходить нечем - пропускаешь. Оба пропустили, значит рыба.",
      "При рыбе считаем очки на руках: у кого меньше, тот и выиграл.",
    ],
  },
  {
    type: "uno",
    title: "Уно",
    tagline: "Сбрось карты первым",
    coop: false,
    variants: null,
    rules: [
      "Кладёшь карту того же цвета или того же значения, что сверху.",
      "Чёрные карты кладутся на что угодно, ты сам выбираешь новый цвет.",
      "Пропуск и разворот вдвоём работают одинаково: соперник теряет ход.",
      "Плюс два и плюс четыре: соперник берёт карты и пропускает ход.",
      "Нечем ходить - берёшь одну карту. Подошла - можно сходить ею сразу.",
      "Остаётся одна карта - загорается УНО. Выигрывает тот, кто сбросил всё.",
    ],
  },
  {
    type: "codenames",
    title: "Кодовые имена",
    tagline: "Вы вдвоём против поля",
    coop: true,
    variants: [
      { id: "easy", title: "Полегче", hint: "9 агентов, 12 ходов, 1 смерть" },
      { id: "normal", title: "Обычная", hint: "15 агентов, 9 ходов" },
      { id: "hard", title: "Сложная", hint: "15 агентов, 7 ходов" },
    ],
    rules: [
      "Вы не соперники, а команда. Нужно вместе найти всех агентов за отведённые ходы.",
      "У каждого своя карта. На ней подсвечено, какие слова ДОЛЖЕН УГАДАТЬ ПАРТНЁР с твоей подсказки.",
      "Ты даёшь одно слово-ассоциацию и число - сколько слов оно описывает.",
      "Партнёр открывает слова. Угадал агента - продолжает, попал в постороннего - ход переходит.",
      "Открыть можно на одно слово больше, чем сказано в подсказке.",
      "Красное слово - смерть, мгновенный проигрыш. Проверяется карта того, кто давал подсказку.",
    ],
  },
  {
    type: "crossword",
    title: "Кроссворд",
    tagline: "Одна сетка на двоих, каждый раз новая",
    coop: true,
    variants: [
      { id: "small", title: "Поменьше", hint: "около десяти слов" },
      { id: "big", title: "Побольше", hint: "около шестнадцати слов" },
    ],
    rules: [
      "Сетка собирается заново каждую партию, выучить ответы не выйдет.",
      "Очереди нет: вписывать буквы можно вдвоём и одновременно.",
      "Тапни клетку, чтобы выбрать слово. Повторный тап разворачивает его.",
      "Верные буквы подсвечиваются и больше не стираются.",
      "Проверить покажет, какие буквы стоят неправильно.",
      "Подсказать букву откроет одну букву в выбранном слове, счётчик это запомнит.",
    ],
  },
  {
    type: "wordle",
    title: "Wordle",
    tagline: "Загадай слово, другой отгадывает",
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

  // Wordle считаем отдельно на каждого отгадывающего
  const wordleBuckets = {
    all: { tries: [], solved: 0, failed: 0 },
    angelina: { tries: [], solved: 0, failed: 0 },
    kirill: { tries: [], solved: 0, failed: 0 },
  };
  // Кодовые имена - отдельно по сложностям
  const cnLevels = {
    easy: { won: 0, lost: 0, best: 0 },
    normal: { won: 0, lost: 0, best: 0 },
    hard: { won: 0, lost: 0, best: 0 },
  };
  // Кроссворд: сколько разгадали и сколько раз обошлись без подсказок
  const cw = { solved: 0, words: 0, hints: 0, clean: 0 };
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
      const who = st.guesser;
      const solved = st.winner && st.winner === st.guesser;
      const targets = [wordleBuckets.all, wordleBuckets[who]].filter(Boolean);
      for (const t of targets) {
        if (solved) {
          t.solved += 1;
          t.tries.push(n);
        } else {
          t.failed += 1;
        }
      }
    }

    if (g.type === "crossword" && g.winner === "both") {
      const st = g.state || {};
      cw.solved += 1;
      cw.words += (st.slots || []).length;
      cw.hints += st.hints || 0;
      if (!st.hints) cw.clean += 1;
    }

    if (g.type === "codenames") {
      const st = g.state || {};
      const lvl = cnLevels[st.level] ? st.level : "normal";
      if (g.winner === "both") cnLevels[lvl].won += 1;
      else cnLevels[lvl].lost += 1;
      const found = typeof st.found === "number" ? st.found : 0;
      if (found > cnLevels[lvl].best) cnLevels[lvl].best = found;
    }
  }

  const wordleSet = (b) => {
    const dist = [0, 0, 0, 0, 0, 0];
    for (const n of b.tries) if (n >= 1 && n <= 6) dist[n - 1] += 1;
    const sum = b.tries.reduce((a, x) => a + x, 0);
    return {
      solved: b.solved,
      failed: b.failed,
      best: b.tries.length ? Math.min(...b.tries) : 0,
      avg: b.tries.length ? Math.round((sum / b.tries.length) * 10) / 10 : 0,
      dist,
    };
  };
  if (wordleBuckets.all.solved || wordleBuckets.all.failed) {
    byType.wordle.extra = {
      kind: "wordle",
      all: wordleSet(wordleBuckets.all),
      angelina: wordleSet(wordleBuckets.angelina),
      kirill: wordleSet(wordleBuckets.kirill),
    };
  }
  if (byType.codenames.played) {
    byType.codenames.extra = { kind: "codenames", levels: cnLevels };
  }
  if (cw.solved) {
    byType.crossword.extra = { kind: "crossword", ...cw };
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
