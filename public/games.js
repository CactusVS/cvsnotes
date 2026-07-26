// Игры: панель со списком, экраны игр и статистика.
import { I, state, h, icon, api, nameOf, nameGen, WON, plural, ago, toast } from "./core.js";
import { buzz } from "./extras.js";

let panel = null; // оверлей
let mode = "list"; // list | game | stats
let current = null; // текущая игра (ответ сервера)
let poll = null;
let badgeTimer = null;

// локальное состояние досок
let bsMode = "shot"; // shot | salvo | radar
let bsPicks = [];
let bsShip = null; // размер корабля, который сейчас ставим
let bsHoriz = true; // ориентация при постановке
let chSel = null; // выбранная шашка
let csSel = null; // выбранная шахматная фигура
let wStatTab = "all"; // вкладка статистики Wordle
let lastStats = null; // последний ответ статистики, чтобы перерисовывать без запроса

const TYPE_ICON = {
  battleship: "anchor",
  checkers: "disc",
  chess: "crown",
  codenames: "grid",
  hangman: "noose",
  wordle: "letters",
};

// Unicode-фигуры: рисуются шрифтом, никаких картинок не нужно
const CHESS_GLYPH = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

const ALPHABET = "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ".split("");

// ============================================================
//  ОТКРЫТИЕ / ЗАКРЫТИЕ
// ============================================================
export function openGames() {
  if (panel) return;
  history.pushState({ mn: "games" }, "");
  mode = "list";
  current = null;
  panel = h(
    "div",
    { class: "editor games-panel" },
    h("div", { class: "editor-scrim", onclick: () => closeGames() }),
    h("div", { class: "editor-panel", id: "gamesInner" })
  );
  document.body.appendChild(panel);
  renderList(true);
  startPoll();
}

export function closeGames() {
  if (!panel) return;
  if (history.state && history.state.mn === "games") history.back();
  else destroyGames();
}

function destroyGames() {
  stopPoll();
  if (panel) panel.remove();
  panel = null;
  current = null;
  mode = "list";
  refreshBadge();
}

window.addEventListener("popstate", () => {
  if (panel) destroyGames();
});

function inner() {
  return document.getElementById("gamesInner");
}

// ============================================================
//  ОПРОС СЕРВЕРА
// ============================================================
function startPoll() {
  stopPoll();
  poll = setInterval(async () => {
    if (!panel || document.hidden) return;
    try {
      if (mode === "game" && current) {
        const { game } = await api("/api/games/" + current.id);
        // не перерисовываем, пока игрок что-то выбирает своим ходом
        if (game.updated_at !== current.updated_at) {
          current = game;
          renderGame();
        }
      } else if (mode === "list") {
        const data = await api("/api/games");
        state.games = data;
        renderList(false);
      }
    } catch {}
  }, 4000);
}
function stopPoll() {
  if (poll) clearInterval(poll);
  poll = null;
}

// точка на кнопке игр, если где-то твой ход
export function startGamesBadge() {
  refreshBadge();
  if (badgeTimer) clearInterval(badgeTimer);
  badgeTimer = setInterval(refreshBadge, 15000);
}

let wasWaiting = false;

async function refreshBadge() {
  const btn = document.getElementById("gamesBtn");
  if (!btn || !state.me) return;
  try {
    const data = await api("/api/games");
    const waiting = (data.games || []).some((g) => g.status === "active" && g.yourTurn);
    btn.classList.toggle("has-badge", waiting);
    // ход перешёл к нам, пока приложение открыто - тихо звякнем
    if (waiting && !wasWaiting) buzz();
    wasWaiting = waiting;
  } catch {}
}

// ============================================================
//  ШАПКА ПАНЕЛИ
// ============================================================
function head(title, opts = {}) {
  return h(
    "div",
    { class: "editor-top" },
    h("button", {
      class: "btn icon-btn btn-ghost",
      "aria-label": "Назад",
      title: "Назад",
      html: I.back,
      onclick: opts.onBack || (() => closeGames()),
    }),
    h("div", { class: "games-title" }, title),
    h("div", { class: "spacer" }),
    ...(opts.actions || [])
  );
}

// ============================================================
//  СПИСОК ИГР
// ============================================================
async function renderList(showLoading) {
  const box = inner();
  if (!box) return;
  if (showLoading) {
    box.replaceChildren(
      head("Игры"),
      h("div", { class: "editor-scroll" }, h("div", { class: "skeleton", style: "height:120px" }))
    );
  }
  let data = state.games;
  try {
    data = await api("/api/games");
    state.games = data;
  } catch (e) {
    if (e.status === 401) return;
    if (!data) {
      const b = inner();
      if (b)
        b.replaceChildren(
          head("Игры"),
          h(
            "div",
            { class: "editor-scroll" },
            h(
              "div",
              { class: "empty" },
              h("div", { class: "empty-mark", html: I.alert }),
              h("h3", {}, "Не удалось загрузить"),
              h("button", { class: "btn", style: "margin-top:1rem", onclick: () => renderList(true) }, "Повторить")
            )
          )
        );
      return;
    }
  }
  if (mode !== "list") return;

  const games = data.games || [];
  const catalog = data.catalog || [];
  const active = games.filter((g) => g.status === "active");
  const done = games.filter((g) => g.status !== "active");

  const scroll = h("div", { class: "editor-scroll" });

  if (active.length) {
    scroll.appendChild(h("div", { class: "section-label" }, "Идут сейчас"));
    const wrap = h("div", { class: "game-list" });
    active.forEach((g) => wrap.appendChild(activeRow(g)));
    scroll.appendChild(wrap);
  }

  const versus = catalog.filter((c) => !c.coop);
  const together = catalog.filter((c) => c.coop);
  if (versus.length) {
    scroll.appendChild(h("div", { class: "section-label" }, "Друг против друга"));
    const g1 = h("div", { class: "game-new-grid" });
    versus.forEach((c) => g1.appendChild(newGameCard(c)));
    scroll.appendChild(g1);
  }
  if (together.length) {
    scroll.appendChild(h("div", { class: "section-label" }, "Вместе"));
    const g2 = h("div", { class: "game-new-grid" });
    together.forEach((c) => g2.appendChild(newGameCard(c)));
    scroll.appendChild(g2);
  }

  if (done.length) {
    scroll.appendChild(h("div", { class: "section-label" }, "Сыгранные"));
    const wrap = h("div", { class: "game-list" });
    done.slice(0, 12).forEach((g) => wrap.appendChild(doneRow(g)));
    scroll.appendChild(wrap);
  }

  const box2 = inner();
  if (box2)
    box2.replaceChildren(
      head("Игры", {
        actions: [
          h("button", {
            class: "btn icon-btn",
            title: "Статистика",
            "aria-label": "Статистика",
            html: I.stats,
            onclick: () => openStats(),
          }),
        ],
      }),
      scroll
    );
}

function turnLabel(g) {
  if (g.status !== "active") return null;
  if (g.type === "battleship" && g.phase === "placing") return "расстановка";
  if (!g.turn) return "ждём";
  return g.yourTurn ? "твой ход" : "ход " + nameGen(g.turn);
}

function activeRow(g) {
  const label = turnLabel(g);
  return h(
    "button",
    { class: "game-row" + (g.yourTurn ? " mine" : ""), onclick: () => openGame(g.id) },
    h("span", { class: "game-row-ic", html: I[TYPE_ICON[g.type]] || I.gamepad }),
    h(
      "span",
      { class: "game-row-main" },
      h("span", { class: "game-row-title" }, g.title),
      h("span", { class: "game-row-sub" }, ago(g.updated_at))
    ),
    label ? h("span", { class: "turn-chip" + (g.yourTurn ? " on" : "") }, label) : null
  );
}

function resultLabel(g) {
  if (g.coop) {
    if (g.winner === "both") return "прошли вместе";
    return "поражение";
  }
  if (!g.winner) return "ничья";
  return "победа: " + nameOf(g.winner);
}

function doneRow(g) {
  const win = g.coop ? g.winner === "both" : !!g.winner;
  return h(
    "button",
    { class: "game-row done", onclick: () => openGame(g.id) },
    h("span", { class: "game-row-ic", html: I[TYPE_ICON[g.type]] || I.gamepad }),
    h(
      "span",
      { class: "game-row-main" },
      h("span", { class: "game-row-title" }, g.title),
      h("span", { class: "game-row-sub" }, resultLabel(g) + " · " + ago(g.updated_at))
    ),
    win ? h("span", { class: "game-row-ic win", html: I.trophy }) : null
  );
}

function newGameCard(c) {
  const variants = c.variants || null;
  return h(
    "div",
    { class: "game-new" },
    h(
      "div",
      { class: "game-new-head" },
      h("span", { class: "game-new-ic", html: I[TYPE_ICON[c.type]] || I.gamepad }),
      h(
        "div",
        {},
        h("div", { class: "game-new-title" }, c.title),
        h("div", { class: "game-new-sub" }, c.tagline)
      )
    ),
    h("div", { class: "game-new-rules" }, h("button", {
      class: "link-btn",
      onclick: () => showRules(c),
    }, "как играть")),
    h(
      "button",
      {
        class: "btn btn-primary btn-sm",
        onclick: (e) =>
          variants ? chooseVariant(c) : create(c.type, null, e.currentTarget),
      },
      "Начать"
    )
  );
}

// Выбор режима отдельным окном, чтобы кнопка на карточке была одна и та же везде
function chooseVariant(c) {
  const scrim = h(
    "div",
    { class: "modal-scrim", onclick: (e) => e.target === scrim && scrim.remove() },
    h(
      "div",
      { class: "modal glass rules-modal" },
      h("h3", {}, c.title),
      h("div", { class: "rules-sub" }, "Выбери режим"),
      h(
        "div",
        { class: "variant-list" },
        ...c.variants.map((v) =>
          h(
            "button",
            {
              class: "variant-opt",
              onclick: async () => {
                scrim.remove();
                await create(c.type, v.id);
              },
            },
            h("span", { class: "variant-opt-title" }, v.title),
            v.hint ? h("span", { class: "variant-opt-hint" }, v.hint) : null
          )
        )
      ),
      h(
        "div",
        { class: "modal-actions" },
        h("button", { class: "btn", onclick: () => scrim.remove() }, "Отмена")
      )
    )
  );
  document.body.appendChild(scrim);
}

function showRules(c) {
  const scrim = h(
    "div",
    { class: "modal-scrim", onclick: (e) => e.target === scrim && scrim.remove() },
    h(
      "div",
      { class: "modal glass rules-modal" },
      h("h3", {}, c.title),
      h("div", { class: "rules-sub" }, c.tagline),
      h("ul", { class: "rules-list" }, ...c.rules.map((r) => h("li", {}, r))),
      h(
        "div",
        { class: "modal-actions" },
        h("button", { class: "btn btn-primary", onclick: () => scrim.remove() }, "Понятно")
      )
    )
  );
  document.body.appendChild(scrim);
}

async function create(type, variant, btn) {
  if (btn) {
    btn.disabled = true;
    btn.textContent = "…";
  }
  try {
    const { game } = await api("/api/games", "POST", { type, variant });
    current = game;
    mode = "game";
    renderGame();
  } catch (e) {
    if (e.status !== 401) toast("Не удалось создать игру", "err");
    renderList(true);
  }
}

async function openGame(id) {
  try {
    const { game } = await api("/api/games/" + id);
    current = game;
    mode = "game";
    bsMode = "shot";
    bsPicks = [];
    chSel = null;
    csSel = null;
    renderGame();
  } catch (e) {
    if (e.status === 404) {
      toast("Игра удалена", "info");
      renderList(true);
    } else if (e.status !== 401) toast("Не удалось открыть", "err");
  }
}

// ============================================================
//  ХОД
// ============================================================
async function doMove(action) {
  if (!current) return;
  try {
    const { game } = await api("/api/games/" + current.id + "/move", "POST", { action });
    current = game;
    renderGame();
    return true;
  } catch (e) {
    if (e.status === 401) return false;
    if (e.data && e.data.game) {
      current = e.data.game;
      renderGame();
    }
    toast((e.data && e.data.error) || "Так нельзя", "err");
    return false;
  }
}

async function removeGame() {
  if (!current) return;
  const id = current.id;
  const scrim = h(
    "div",
    { class: "modal-scrim", onclick: (e) => e.target === scrim && scrim.remove() },
    h(
      "div",
      { class: "modal glass" },
      h("h3", {}, "Удалить игру?"),
      h("p", {}, "Партия исчезнет у вас обоих."),
      h(
        "div",
        { class: "modal-actions" },
        h("button", { class: "btn", onclick: () => scrim.remove() }, "Отмена"),
        h(
          "button",
          {
            class: "btn btn-primary",
            style: "background:linear-gradient(135deg,#fb7185,#f43f5e);color:#2a0710",
            onclick: async () => {
              scrim.remove();
              try {
                await api("/api/games/" + id, "DELETE");
                mode = "list";
                current = null;
                renderList(true);
                toast("Игра удалена", "ok");
              } catch (e) {
                if (e.status !== 401) toast("Не удалось удалить", "err");
              }
            },
          },
          "Удалить"
        )
      )
    )
  );
  document.body.appendChild(scrim);
}

// ============================================================
//  ЭКРАН ИГРЫ
// ============================================================
function renderGame() {
  const box = inner();
  if (!box || !current) return;
  const g = current;

  const scroll = h("div", { class: "editor-scroll game-screen" });
  scroll.appendChild(statusBar(g));

  if (g.type === "wordle") scroll.appendChild(wordleBoard(g));
  else if (g.type === "codenames") scroll.appendChild(codenamesBoard(g));
  else if (g.type === "battleship") scroll.appendChild(battleshipBoard(g));
  else if (g.type === "checkers") scroll.appendChild(checkersBoard(g));
  else if (g.type === "chess") scroll.appendChild(chessBoard(g));
  else if (g.type === "hangman") scroll.appendChild(hangmanBoard(g));

  box.replaceChildren(
    head(g.title, {
      onBack: () => {
        mode = "list";
        current = null;
        renderList(true);
      },
      actions: [
        h("button", {
          class: "btn icon-btn",
          title: "Правила",
          "aria-label": "Правила",
          html: I.book,
          onclick: () => showRules({ title: g.title, tagline: g.tagline, rules: g.rules }),
        }),
        h("button", {
          class: "btn icon-btn btn-ghost btn-danger",
          title: "Удалить",
          "aria-label": "Удалить",
          html: I.trash,
          onclick: removeGame,
        }),
      ],
    }),
    scroll
  );
}

function statusBar(g) {
  const v = g.view;
  let text, tone;

  if (g.status !== "active") {
    if (g.coop) {
      if (g.winner === "both") {
        text = "Прошли вместе! Найдено " + v.found + " из " + v.total;
        tone = "win";
      } else {
        text =
          v.lostReason === "assassin"
            ? "Наткнулись на смерть. Найдено " + v.found + " из " + v.total
            : "Ходы кончились. Найдено " + v.found + " из " + v.total;
        tone = "lose";
      }
    } else if (!g.winner) {
      const why =
        v.result === "stalemate" ? "Пат" : v.result === "fifty" ? "Ничья по 50 ходам" : "Ничья";
      text = why;
      tone = "wait";
    } else if (g.winner === state.me.user) {
      text = v.result === "checkmate" ? "Мат! Ты победил" : "Ты победил!";
      tone = "win";
    } else {
      text = (WON[g.winner] || "Победил") + (v.result === "checkmate" ? " матом" : "") + "!";
      tone = "lose";
    }
  } else if (g.type === "battleship" && v.phase === "placing") {
    text = v.ready[state.me.user] ? "Ждём соперника" : "Расставь корабли";
    tone = v.ready[state.me.user] ? "wait" : "you";
  } else if (g.yourTurn) {
    text = "Твой ход";
    tone = "you";
  } else {
    text = "Ход " + nameGen(g.turn);
    tone = "wait";
  }

  return h("div", { class: "game-status " + tone }, text);
}

// ============================================================
//  WORDLE
// ============================================================
function wordleBoard(g) {
  const v = g.view;
  const me = state.me.user;
  const box = h("div", { class: "wordle" });

  // сетка попыток
  const len = v.wordLength || 5;
  const grid = h("div", { class: "w-grid", style: `--cols:${len}` });
  for (let r = 0; r < v.maxTries; r++) {
    const gs = v.guesses[r];
    for (let c = 0; c < len; c++) {
      const cls = gs ? " " + gs.marks[c] : "";
      grid.appendChild(h("div", { class: "w-cell" + cls }, gs ? gs.text[c] : ""));
    }
  }
  box.appendChild(grid);

  if (v.phase === "setting") {
    if (me === v.setter) {
      const inp = h("input", {
        class: "field",
        placeholder: "Загадай слово, 4-8 букв",
        maxlength: "8",
        autocomplete: "off",
        autocapitalize: "characters",
      });
      const send = async () => {
        const ok = await doMove({ kind: "setWord", word: inp.value });
        if (ok) toast("Загадано, теперь ход партнёра", "ok");
      };
      box.appendChild(
        h(
          "div",
          { class: "w-input" },
          inp,
          h("button", { class: "btn btn-primary", onclick: send }, "Загадать")
        )
      );
      inp.addEventListener("keydown", (e) => e.key === "Enter" && send());
      box.appendChild(h("p", { class: "hint" }, "Слово увидит только партнёр по буквам. Можно загадывать имена и свои словечки."));
    } else {
      box.appendChild(h("p", { class: "hint center" }, nameOf(v.setter) + " загадывает слово…"));
    }
    return box;
  }

  if (v.status === "finished") {
    box.appendChild(
      h("p", { class: "hint center big" }, "Слово было: ", h("b", {}, v.word))
    );
    return box;
  }

  if (me === v.guesser) {
    const inp = h("input", {
      class: "field",
      placeholder: len + " букв",
      maxlength: String(len),
      autocomplete: "off",
      autocapitalize: "characters",
    });
    const send = async () => {
      const val = inp.value;
      if (!val) return;
      inp.value = "";
      await doMove({ kind: "guess", word: val });
    };
    box.appendChild(
      h(
        "div",
        { class: "w-input" },
        inp,
        h("button", { class: "btn btn-primary", onclick: send }, "Ответ")
      )
    );
    inp.addEventListener("keydown", (e) => e.key === "Enter" && send());
    box.appendChild(
      h("p", { class: "hint" }, "Осталось попыток: " + (v.maxTries - v.guesses.length))
    );
  } else {
    box.appendChild(
      h("p", { class: "hint center" }, nameOf(v.guesser) + " отгадывает. Слово: ", h("b", {}, v.word || ""))
    );
  }
  return box;
}

// ============================================================
//  КОДОВЫЕ ИМЕНА
// ============================================================
function codenamesBoard(g) {
  const v = g.view;
  const me = state.me.user;
  const box = h("div", { class: "cn" });

  box.appendChild(
    h(
      "div",
      { class: "cn-bar" },
      h("span", { class: "cn-stat" }, "Найдено ", h("b", {}, v.found + " / " + v.total)),
      h("span", { class: "cn-stat" }, v.levelLabel || ""),
      h("span", { class: "cn-stat" }, "Ходов ", h("b", {}, String(v.turnsLeft)))
    )
  );

  const iAmGiver = v.giver === me;
  const active = v.status === "active";

  if (active && v.phase === "guess" && v.clue) {
    box.appendChild(
      h(
        "div",
        { class: "cn-clue" },
        h("span", { class: "cn-clue-word" }, v.clue.word),
        h("span", { class: "cn-clue-num" }, String(v.clue.count)),
        h("span", { class: "cn-clue-by" }, "от " + nameGen(v.giver))
      )
    );
  }

  // сетка слов
  const grid = h("div", { class: "cn-grid" });
  v.words.forEach((w, i) => {
    const rev = v.revealed[i];
    const mine = v.myKey ? v.myKey[i] : null;
    let cls = "cn-word";
    if (rev) cls += " rev rev-" + rev;
    else if (mine) cls += " my-" + mine;

    const canGuess = active && v.phase === "guess" && !iAmGiver && !rev;
    const cell = h(
      "button",
      {
        class: cls + (canGuess ? " tapable" : ""),
        disabled: !canGuess,
        onclick: canGuess ? () => doMove({ kind: "guess", index: i }) : null,
      },
      h("span", { class: "cn-word-text" }, w)
    );
    grid.appendChild(cell);
  });
  box.appendChild(grid);

  if (!active) {
    box.appendChild(h("p", { class: "hint center" }, "Партия окончена. Подсветка - как было на двух картах."));
    return box;
  }

  // действия
  if (v.phase === "clue") {
    if (iAmGiver) {
      const wIn = h("input", { class: "field", placeholder: "Слово-подсказка", autocomplete: "off" });
      const nIn = h("input", {
        class: "field cn-num",
        type: "number",
        min: "1",
        max: "9",
        value: "1",
        inputmode: "numeric",
      });
      const send = async () => {
        await doMove({ kind: "clue", word: wIn.value, count: Number(nIn.value) });
      };
      box.appendChild(
        h(
          "div",
          { class: "cn-clue-form" },
          wIn,
          nIn,
          h("button", { class: "btn btn-primary", onclick: send }, "Дать")
        )
      );
      box.appendChild(
        h(
          "p",
          { class: "hint" },
          "Зелёным обведены слова для твоих подсказок - их будет угадывать ",
          nameOf(v.giver === "angelina" ? "kirill" : "angelina"),
          ". Красное - смерть."
        )
      );
    } else {
      box.appendChild(h("p", { class: "hint center" }, nameOf(v.giver) + " придумывает подсказку…"));
    }
    return box;
  }

  // фаза угадывания
  if (!iAmGiver) {
    box.appendChild(
      h(
        "div",
        { class: "cn-actions" },
        h("button", { class: "btn", onclick: () => doMove({ kind: "pass" }) }, "Хватит, дальше не угадываю")
      )
    );
    box.appendChild(
      h(
        "p",
        { class: "hint" },
        "Подсветка на словах - это ТВОЯ карта, она для подсказок партнёру. Сейчас угадывай по смыслу подсказки."
      )
    );
  } else {
    box.appendChild(h("p", { class: "hint center" }, nameOf(v.giver === "angelina" ? "kirill" : "angelina") + " угадывает…"));
  }
  return box;
}

// ============================================================
//  МОРСКОЙ БОЙ
// ============================================================
const LETTERS = "АБВГДЕЖЗИК".split("");

function bsGrid(opts) {
  const { cells, onTap, cls } = opts;
  const wrap = h("div", { class: "bs-wrap " + (cls || "") });
  const grid = h("div", { class: "bs-grid" });
  // угол + буквы
  grid.appendChild(h("div", { class: "bs-lbl" }));
  for (let x = 0; x < 10; x++) grid.appendChild(h("div", { class: "bs-lbl" }, LETTERS[x]));
  for (let y = 0; y < 10; y++) {
    grid.appendChild(h("div", { class: "bs-lbl" }, String(y + 1)));
    for (let x = 0; x < 10; x++) {
      const i = y * 10 + x;
      const c = cells(i);
      grid.appendChild(
        h(
          "button",
          {
            class: "bs-cell " + (c.cls || ""),
            disabled: !c.tapable,
            onclick: c.tapable && onTap ? () => onTap(i) : null,
          },
          c.mark || ""
        )
      );
    }
  }
  wrap.appendChild(grid);
  return wrap;
}

function battleshipBoard(g) {
  const v = g.view;
  const me = state.me.user;
  const box = h("div", { class: "bs" });
  const abil = v.variant === "abilities";

  // ----- расстановка -----
  if (v.phase === "placing") {
    const ready = v.ready[me];
    const myCells = new Set(v.myShips.flatMap((s) => s.cells));
    const rem = v.remaining || {};
    const complete = v.complete;

    // если выбранные корабли кончились, переключаемся на следующий доступный
    if (!ready && (!bsShip || (rem[bsShip] || 0) < 1)) {
      bsShip = [4, 3, 2, 1].find((sz) => (rem[sz] || 0) > 0) || null;
    }

    const grid = bsGrid({
      cls: "own" + (ready ? "" : " placing"),
      cells: (i) => ({
        cls: (myCells.has(i) ? "ship " : "") + (v.myMine === i ? "mine " : ""),
        mark: v.myMine === i ? "*" : "",
        tapable: !ready,
      }),
      onTap: (i) => onPlaceTap(i, v),
    });
    box.appendChild(grid);
    if (!ready) attachPlacePreview(grid, v);

    if (ready) {
      box.appendChild(h("p", { class: "hint center" }, "Ждём, пока соперник расставит корабли…"));
      return box;
    }

    if (!complete) {
      const picker = h("div", { class: "bs-picker" });
      for (const size of [4, 3, 2, 1]) {
        const left = rem[size] || 0;
        picker.appendChild(
          h(
            "button",
            {
              class: "bs-ship" + (bsShip === size ? " on" : "") + (left < 1 ? " spent" : ""),
              disabled: left < 1,
              onclick: () => {
                bsShip = size;
                renderGame();
              },
            },
            h(
              "span",
              { class: "bs-ship-cells" },
              ...Array.from({ length: size }, () => h("i", {}))
            ),
            h("span", { class: "bs-ship-left" }, "осталось " + left)
          )
        );
      }
      box.appendChild(picker);
      box.appendChild(
        h(
          "div",
          { class: "bs-actions" },
          h(
            "button",
            {
              class: "btn btn-sm",
              onclick: () => {
                bsHoriz = !bsHoriz;
                renderGame();
              },
            },
            bsHoriz ? "Повернуть: вниз" : "Повернуть: вправо"
          ),
          h("button", { class: "btn btn-sm", onclick: () => doMove({ kind: "auto" }) }, "Случайно"),
          h("button", { class: "btn btn-sm", onclick: () => doMove({ kind: "clear" }) }, "Очистить")
        )
      );
      box.appendChild(
        h(
          "p",
          { class: "hint" },
          "Выбери корабль и нажми на клетку - он ляжет " +
            (bsHoriz ? "вправо" : "вниз") +
            " от неё. Касаться другие корабли нельзя, даже углами. Чтобы убрать - нажми на поставленный корабль."
        )
      );
    } else {
      box.appendChild(
        h(
          "div",
          { class: "bs-actions" },
          h("button", { class: "btn btn-sm", onclick: () => doMove({ kind: "clear" }) }, "Переставить"),
          h("button", { class: "btn btn-primary", onclick: () => doMove({ kind: "ready" }) }, "Готово")
        )
      );
      box.appendChild(
        h(
          "p",
          { class: "hint" },
          abil
            ? "Флот на месте. Можешь поставить мину - нажми на пустую клетку. Потом жми «Готово»."
            : "Флот на месте, жми «Готово»."
        )
      );
    }
    return box;
  }

  // ----- бой -----
  const myTurn = g.yourTurn && g.status === "active";
  const sunk = new Set(v.enemySunkCells);
  const radarMarks = new Map();
  for (const r of v.radarLog) radarMarks.set(r.center, r.count);

  box.appendChild(h("div", { class: "bs-cap" }, "Поле соперника"));
  box.appendChild(
    bsGrid({
      cls: "enemy",
      cells: (i) => {
        const shot = v.myShots[i];
        let cls = "";
        let mark = "";
        if (shot === "hit") {
          cls = sunk.has(i) ? "hit sunk" : "hit";
          mark = "×";
        } else if (shot === "miss") {
          cls = "miss";
          mark = "•";
        }
        if (bsMode === "salvo" && bsPicks.includes(i)) cls += " picked";
        if (radarMarks.has(i)) {
          cls += " radar";
          if (!shot) mark = String(radarMarks.get(i));
        }
        return {
          cls,
          mark,
          tapable: myTurn && !shot,
        };
      },
      onTap: (i) => onEnemyTap(i),
    })
  );

  if (g.status === "active") {
    if (abil) {
      const a = v.abilities;
      const modeBtn = (id, label, ic, left) =>
        h(
          "button",
          {
            class: "btn btn-sm" + (bsMode === id ? " on" : "") + (left < 1 ? " spent" : ""),
            disabled: !myTurn || left < 1,
            onclick: () => {
              bsMode = bsMode === id ? "shot" : id;
              bsPicks = [];
              renderGame();
            },
          },
          icon(ic, "ic"),
          label
        );
      box.appendChild(
        h(
          "div",
          { class: "bs-actions" },
          modeBtn("radar", "Радар", "target", a.radar),
          modeBtn("salvo", "Залп", "burst", a.salvo)
        )
      );
      if (bsMode === "salvo") {
        box.appendChild(
          h(
            "p",
            { class: "hint" },
            "Выбрано " + bsPicks.length + " из 3. После залпа пропускаешь следующий ход."
          )
        );
      } else if (bsMode === "radar") {
        box.appendChild(h("p", { class: "hint" }, "Нажми на клетку - покажу, сколько палуб вокруг неё в квадрате 3 на 3. Тратит ход."));
      }
      if (v.skipMe) {
        box.appendChild(h("p", { class: "hint warn" }, "Следующий ход ты пропускаешь."));
      }
    }

    box.appendChild(
      h(
        "div",
        { class: "bs-fleet" },
        h("span", {}, "У соперника: "),
        ...fleetChips(v.enemyAlive)
      )
    );
  }

  box.appendChild(h("div", { class: "bs-cap" }, "Твоё поле"));
  const myCells = new Map();
  for (const s of v.myShips) for (const c of s.cells) myCells.set(c, s);
  box.appendChild(
    bsGrid({
      cls: "own",
      cells: (i) => {
        const inc = v.incoming[i];
        const ship = myCells.get(i);
        let cls = ship ? "ship" : "";
        let mark = "";
        if (inc === "hit") {
          cls += " hit";
          mark = "×";
        } else if (inc === "miss") {
          cls += " miss";
          mark = "•";
        }
        if (v.myMine === i) {
          cls += " mine";
          mark = mark || "*";
        }
        return { cls, mark, tapable: false };
      },
    })
  );
  box.appendChild(h("div", { class: "bs-fleet" }, h("span", {}, "У тебя: "), ...fleetChips(v.myAlive)));

  if (v.log && v.log.length) {
    box.appendChild(h("div", { class: "section-label" }, "Последние ходы"));
    box.appendChild(
      h(
        "div",
        { class: "bs-log" },
        ...v.log
          .slice()
          .reverse()
          .map((e) => h("div", { class: "bs-log-row" }, logLine(e)))
      )
    );
  }
  return box;
}

function fleetChips(alive) {
  const out = [];
  for (const size of [4, 3, 2, 1]) {
    const n = alive[size] || 0;
    out.push(
      h("span", { class: "fleet-chip" + (n ? "" : " dead") }, "×".repeat(size) + " " + n)
    );
  }
  return out;
}

function logLine(e) {
  const who = nameOf(e.by);
  const cell = LETTERS[e.cell % 10] + (Math.floor(e.cell / 10) + 1);
  if (e.result === "radar") return `${who}: радар ${cell} - палуб рядом ${e.count}`;
  if (e.result === "sunk") return `${who}: ${cell} - убил`;
  if (e.result === "hit") return `${who}: ${cell} - ранил`;
  if (e.result === "mine") return `${who}: ${cell} - попал на мину, пропускает ход`;
  return `${who}: ${cell} - мимо`;
}

// Клетки, которые займёт корабль, если поставить его от anchor. null - вылезает за поле
function previewCells(anchor, size, horiz) {
  const x = anchor % 10,
    y = Math.floor(anchor / 10);
  const cells = [];
  for (let k = 0; k < size; k++) {
    const cx = horiz ? x + k : x;
    const cy = horiz ? y : y + k;
    if (cx > 9 || cy > 9) return null;
    cells.push(cy * 10 + cx);
  }
  return cells;
}

// Та же проверка касания, что и на сервере, но чтобы подсветить заранее
function placeValid(cells, v) {
  const occ = new Set(v.myShips.flatMap((s) => s.cells));
  for (const c of cells) {
    const x = c % 10,
      y = Math.floor(c / 10);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx,
          ny = y + dy;
        if (nx < 0 || nx > 9 || ny < 0 || ny > 9) continue;
        if (occ.has(ny * 10 + nx)) return false;
      }
    }
  }
  return true;
}

// Подсветка будущего корабля: ведёшь пальцем по полю и видишь, куда он ляжет
function attachPlacePreview(wrap, v) {
  const cells = [...wrap.querySelectorAll(".bs-cell")];
  const clear = () => cells.forEach((c) => c.classList.remove("preview", "preview-bad"));
  const show = (i) => {
    clear();
    if (v.complete || !bsShip) return;
    const cs = previewCells(i, bsShip, bsHoriz);
    if (!cs) {
      cells[i].classList.add("preview-bad");
      return;
    }
    const good = placeValid(cs, v);
    cs.forEach((c) => cells[c].classList.add(good ? "preview" : "preview-bad"));
  };
  const at = (e) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const i = cells.indexOf(el);
    if (i >= 0) show(i);
    else clear();
  };
  wrap.addEventListener("pointermove", at);
  wrap.addEventListener("pointerdown", at);
  wrap.addEventListener("pointerleave", clear);
  wrap.addEventListener("pointercancel", clear);
  wrap.addEventListener("pointerup", clear);
}

async function onPlaceTap(i, v) {
  // по своему кораблю - убрать его
  if (v.myShips.some((s) => s.cells.includes(i))) {
    await doMove({ kind: "remove", cell: i });
    return;
  }
  // когда флот расставлен, свободные клетки идут под мину
  if (v.complete) {
    if (v.variant === "abilities") await doMove({ kind: "mine", cell: i });
    return;
  }
  if (!bsShip) return;
  await doMove({
    kind: "place",
    size: bsShip,
    x: i % 10,
    y: Math.floor(i / 10),
    horiz: bsHoriz,
  });
}

async function onEnemyTap(i) {
  if (bsMode === "radar") {
    bsMode = "shot";
    await doMove({ kind: "radar", cell: i });
    return;
  }
  if (bsMode === "salvo") {
    if (bsPicks.includes(i)) bsPicks = bsPicks.filter((x) => x !== i);
    else if (bsPicks.length < 3) bsPicks.push(i);
    if (bsPicks.length === 3) {
      const cells = bsPicks.slice();
      bsPicks = [];
      bsMode = "shot";
      await doMove({ kind: "salvo", cells });
    } else {
      renderGame();
    }
    return;
  }
  await doMove({ kind: "shot", cell: i });
}

// ============================================================
//  ШАШКИ
// ============================================================
function checkersBoard(g) {
  const v = g.view;
  const box = h("div", { class: "ch" });
  const myTurn = g.yourTurn && g.status === "active";
  const moves = v.moves || [];

  // если идёт серия взятий, шашка зафиксирована
  if (v.chain && myTurn) chSel = v.chain.from;

  const targets = new Set(moves.filter((m) => m.from === chSel).map((m) => m.to));
  const movable = new Set(moves.map((m) => m.from));

  const board = h("div", { class: "ch-board" });
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const i = y * 8 + x;
      const dark = (x + y) % 2 === 1;
      const p = v.board[i];
      let cls = "ch-sq " + (dark ? "dark" : "light");
      if (chSel === i) cls += " sel";
      if (targets.has(i)) cls += " target";
      if (myTurn && movable.has(i) && chSel === null) cls += " movable";

      const kids = [];
      if (p !== ".") {
        const color = p.toLowerCase() === "w" ? "w" : "b";
        const king = p === p.toUpperCase();
        kids.push(h("span", { class: "ch-piece " + color + (king ? " king" : "") }));
      }
      if (targets.has(i)) kids.push(h("span", { class: "ch-dot" }));

      board.appendChild(
        h(
          "button",
          {
            class: cls,
            disabled: !myTurn,
            onclick: myTurn ? () => onCheckersTap(i, v, moves) : null,
          },
          ...kids
        )
      );
    }
  }
  box.appendChild(board);

  const mustCapture = moves.length > 0 && moves[0].cap != null;
  if (g.status === "active") {
    box.appendChild(
      h(
        "p",
        { class: "hint center" },
        myTurn
          ? mustCapture
            ? "Есть бой - бить обязательно."
            : "Выбери шашку, потом клетку."
          : "Ждём ход соперника."
      )
    );
    box.appendChild(
      h(
        "p",
        { class: "hint center" },
        "Ты играешь " + (v.myColor === "w" ? "светлыми" : "тёмными")
      )
    );
  }
  return box;
}

async function onCheckersTap(i, v, moves) {
  const mine = v.board[i] !== "." && v.board[i].toLowerCase() === v.myColor;
  if (mine && !v.chain) {
    chSel = chSel === i ? null : i;
    renderGame();
    return;
  }
  if (chSel === null) return;
  const mv = moves.find((m) => m.from === chSel && m.to === i);
  if (!mv) return;
  const ok = await doMove({ kind: "move", from: chSel, to: i });
  if (ok && current && !(current.view.chain)) chSel = null;
  renderGame();
}

// ============================================================
//  ШАХМАТЫ
// ============================================================
function chessBoard(g) {
  const v = g.view;
  const box = h("div", { class: "cs" });
  const myTurn = g.yourTurn && g.status === "active";
  const moves = v.moves || [];
  const flip = v.myColor === "b"; // свои фигуры всегда снизу

  const targets = new Set(moves.filter((m) => m.from === csSel).map((m) => m.to));
  const movable = new Set(moves.map((m) => m.from));
  const checkSq = v.check ? v.board.indexOf(v.colors[v.turn] === "w" ? "K" : "k") : -1;

  const order = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) order.push(r * 8 + c);
  if (flip) order.reverse();

  const board = h("div", { class: "cs-board" });
  for (const i of order) {
    const x = i % 8,
      y = Math.floor(i / 8);
    const p = v.board[i];
    let cls = "cs-sq " + ((x + y) % 2 === 1 ? "dark" : "light");
    if (csSel === i) cls += " sel";
    if (targets.has(i)) cls += " target";
    if (v.lastMove && (v.lastMove.from === i || v.lastMove.to === i)) cls += " last";
    if (i === checkSq) cls += " check";
    if (myTurn && csSel === null && movable.has(i)) cls += " movable";

    const kids = [];
    if (p !== ".") {
      kids.push(
        h("span", { class: "cs-piece " + (p === p.toUpperCase() ? "w" : "b") }, CHESS_GLYPH[p] || "")
      );
    }
    if (targets.has(i)) kids.push(h("span", { class: p !== "." ? "cs-cap" : "cs-dot" }));

    board.appendChild(
      h(
        "button",
        {
          class: cls,
          disabled: !myTurn,
          onclick: myTurn ? () => onChessTap(i, v, moves) : null,
        },
        ...kids
      )
    );
  }
  box.appendChild(board);

  if (g.status === "active") {
    box.appendChild(
      h(
        "p",
        { class: "hint center" },
        v.check ? "Шах!" : myTurn ? "Выбери фигуру, потом клетку." : "Ждём ход соперника."
      )
    );
    box.appendChild(
      h("p", { class: "hint center" }, "Ты играешь " + (v.myColor === "w" ? "белыми" : "чёрными"))
    );
  }
  return box;
}

async function onChessTap(i, v, moves) {
  const p = v.board[i];
  const mine = p !== "." && (p === p.toUpperCase() ? "w" : "b") === v.myColor;
  if (mine) {
    csSel = csSel === i ? null : i;
    renderGame();
    return;
  }
  if (csSel === null) return;
  const cands = moves.filter((m) => m.from === csSel && m.to === i);
  if (!cands.length) {
    csSel = null;
    renderGame();
    return;
  }
  const from = csSel;
  csSel = null;
  // на одну клетку может вести несколько ходов - это превращение пешки
  if (cands.length > 1 && cands.every((m) => m.promo)) {
    choosePromo(v.myColor, (promo) => doMove({ kind: "move", from, to: i, promo }));
    return;
  }
  await doMove({ kind: "move", from, to: i, promo: cands[0].promo || undefined });
}

const PROMO_LIST = [
  { id: "q", name: "Ферзь" },
  { id: "r", name: "Ладья" },
  { id: "b", name: "Слон" },
  { id: "n", name: "Конь" },
];

function choosePromo(color, onPick) {
  const scrim = h(
    "div",
    { class: "modal-scrim" },
    h(
      "div",
      { class: "modal glass" },
      h("h3", {}, "Во что превращаем?"),
      h("p", {}, "Пешка дошла до конца доски."),
      h(
        "div",
        { class: "promo-row" },
        ...PROMO_LIST.map((it) =>
          h(
            "button",
            {
              class: "promo-opt",
              onclick: () => {
                scrim.remove();
                onPick(it.id);
              },
            },
            h(
              "span",
              { class: "promo-glyph " + color },
              CHESS_GLYPH[color === "w" ? it.id.toUpperCase() : it.id]
            ),
            h("span", { class: "promo-name" }, it.name)
          )
        )
      )
    )
  );
  document.body.appendChild(scrim);
}

// ============================================================
//  ВИСЕЛИЦА
// ============================================================
function gallows(wrong) {
  const part = (n, el) => (wrong >= n ? el : "");
  const svg = `<svg viewBox="0 0 120 140" fill="none" stroke="currentColor" stroke-width="4"
      stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 132h60M26 132V12h50M76 12v18" opacity="0.55"/>
    ${part(1, '<circle cx="76" cy="42" r="12"/>')}
    ${part(2, '<path d="M76 54v34"/>')}
    ${part(3, '<path d="M76 62 60 78"/>')}
    ${part(4, '<path d="M76 62l16 16"/>')}
    ${part(5, '<path d="M76 88 62 112"/>')}
    ${part(6, '<path d="M76 88l14 24"/>')}
  </svg>`;
  return h("div", { class: "hm-gallows" + (wrong >= 6 ? " dead" : ""), html: svg });
}

function hangmanBoard(g) {
  const v = g.view;
  const me = state.me.user;
  const box = h("div", { class: "hm" });

  box.appendChild(gallows(v.wrong));

  if (v.phase === "setting") {
    if (me === v.setter) {
      const inp = h("input", {
        class: "field",
        placeholder: "Слово или фраза",
        maxlength: "40",
        autocomplete: "off",
      });
      const hintIn = h("input", {
        class: "field",
        placeholder: "Подсказка, если хочешь",
        maxlength: "60",
        autocomplete: "off",
      });
      const send = async () => {
        const okDone = await doMove({ kind: "setWord", word: inp.value, hint: hintIn.value });
        if (okDone) toast("Загадано", "ok");
      };
      box.appendChild(h("div", { class: "hm-set" }, inp, hintIn));
      box.appendChild(
        h(
          "div",
          { class: "bs-actions" },
          h("button", { class: "btn btn-primary", onclick: send }, "Загадать")
        )
      );
      box.appendChild(
        h("p", { class: "hint" }, "Можно с пробелами и дефисом. Буква ё считается за е.")
      );
    } else {
      box.appendChild(h("p", { class: "hint center" }, nameOf(v.setter) + " загадывает…"));
    }
    return box;
  }

  box.appendChild(
    h(
      "div",
      { class: "hm-word" },
      ...v.masked.split("").map((ch) =>
        ch === " "
          ? h("span", { class: "hm-ch space" })
          : h("span", { class: "hm-ch" + (ch === "_" ? " blank" : "") }, ch === "_" ? "" : ch)
      )
    )
  );
  if (v.hint) box.appendChild(h("p", { class: "hint center" }, "Подсказка: " + v.hint));

  if (v.status !== "active") {
    box.appendChild(h("p", { class: "hint center big" }, "Слово было: ", h("b", {}, v.word || "")));
    return box;
  }

  if (me === v.guesser) {
    const kb = h("div", { class: "hm-kb" });
    for (const ch of ALPHABET) {
      const used = v.guessed.includes(ch);
      const miss = v.misses.includes(ch);
      kb.appendChild(
        h(
          "button",
          {
            class: "hm-key" + (used ? (miss ? " miss" : " hit") : ""),
            disabled: used,
            onclick: () => doMove({ kind: "letter", letter: ch }),
          },
          ch
        )
      );
    }
    box.appendChild(kb);

    const inp = h("input", { class: "field", placeholder: "Или назови целиком", autocomplete: "off" });
    const send = async () => {
      const val = inp.value;
      if (!val) return;
      inp.value = "";
      await doMove({ kind: "word", word: val });
    };
    inp.addEventListener("keydown", (e) => e.key === "Enter" && send());
    box.appendChild(
      h("div", { class: "w-input" }, inp, h("button", { class: "btn btn-primary", onclick: send }, "Ответ"))
    );
    box.appendChild(
      h("p", { class: "hint" }, "Осталось промахов: " + (v.maxWrong - v.wrong))
    );
  } else {
    box.appendChild(h("p", { class: "hint center" }, nameOf(v.guesser) + " отгадывает…"));
  }
  return box;
}

// ============================================================
//  СТАТИСТИКА
// ============================================================
async function openStats() {
  mode = "stats";
  const box = inner();
  if (box)
    box.replaceChildren(
      head("Статистика", { onBack: backToList }),
      h("div", { class: "editor-scroll" }, h("div", { class: "skeleton", style: "height:140px" }))
    );
  try {
    const data = await api("/api/games/stats");
    lastStats = data;
    renderStats(data);
  } catch (e) {
    if (e.status !== 401) toast("Не удалось загрузить статистику", "err");
    backToList();
  }
}

function backToList() {
  mode = "list";
  current = null;
  renderList(true);
}

function renderStats(data) {
  if (mode !== "stats") return;
  const box = inner();
  if (!box) return;
  const t = data.totals;
  const scroll = h("div", { class: "editor-scroll" });

  // общие показатели, без счёта "кто кого"
  const tiles = [
    { big: String(t.played), sub: plural(t.played, ["партия сыграна", "партии сыграно", "партий сыграно"]) },
    { big: String(t.active), sub: plural(t.active, ["игра идёт", "игры идут", "игр идёт"]) },
  ];
  if (t.coopWon) {
    tiles.push({ big: String(t.coopWon), sub: "раз прошли вместе", tone: "gold" });
  }
  if (t.favorite) {
    tiles.push({ big: t.favorite.title, sub: "чаще всего играете", wide: true });
  }

  scroll.appendChild(
    h(
      "div",
      { class: "st-tiles" },
      ...tiles.map((x) =>
        h(
          "div",
          { class: "st-tile glass" + (x.wide ? " wide" : "") + (x.tone ? " " + x.tone : "") },
          h("div", { class: "st-tile-big" }, x.big),
          h("div", { class: "st-tile-sub" }, x.sub)
        )
      )
    )
  );

  // порядок задаёт сервер: сначала соперничество, потом совместные
  for (const row of data.byType) {
    if (!row.played && !row.active) continue;
    scroll.appendChild(statRow(row));
  }
  if (!data.byType.some((r) => r.played || r.active)) {
    scroll.appendChild(
      h(
        "div",
        { class: "empty" },
        h("div", { class: "empty-mark", html: I.gamepad }),
        h("h3", {}, "Ещё не играли"),
        h("p", {}, "Сыграйте партию, и здесь появится счёт.")
      )
    );
  }

  box.replaceChildren(head("Статистика", { onBack: backToList }), scroll);
}

function statRow(row) {
  const bits = [];
  if (row.coop) {
    bits.push(h("span", { class: "st-chip win" }, "побед: " + row.coopWon));
    bits.push(h("span", { class: "st-chip" }, "поражений: " + row.coopLost));
    if (row.bestFound) bits.push(h("span", { class: "st-chip" }, "рекорд: " + row.bestFound + " агентов"));
  } else {
    bits.push(
      h("span", { class: "st-chip a" }, nameOf("angelina") + ": " + row.wins.angelina)
    );
    bits.push(h("span", { class: "st-chip k" }, nameOf("kirill") + ": " + row.wins.kirill));
  }
  if (row.active) bits.push(h("span", { class: "st-chip live" }, "идёт: " + row.active));

  return h(
    "div",
    { class: "st-game glass" },
    h(
      "div",
      { class: "st-game-head" },
      h("span", { class: "game-row-ic", html: I[TYPE_ICON[row.type]] || I.gamepad }),
      h("span", { class: "st-game-title" }, row.title),
      h("span", { class: "st-game-count" }, row.played + " " + plural(row.played, ["партия", "партии", "партий"]))
    ),
    h("div", { class: "st-chips" }, ...bits),
    row.extra && row.extra.kind === "wordle" ? wordleStats(row.extra) : null,
    row.extra && row.extra.kind === "codenames" ? codenamesStats(row.extra) : null
  );
}

// Подробности по Wordle с переключателем: партнёр / я / общая
function wordleStats(e) {
  const me = state.me.user;
  const foe = me === "angelina" ? "kirill" : "angelina";
  const box = h("div", { class: "st-wordle" });

  const tabBtn = (id, label) =>
    h(
      "button",
      {
        class: "st-tab" + (wStatTab === id ? " on" : ""),
        onclick: () => {
          wStatTab = id;
          if (lastStats) renderStats(lastStats);
        },
      },
      label
    );
  box.appendChild(
    h("div", { class: "st-tabs" }, tabBtn(foe, nameOf(foe)), tabBtn(me, "Моя"), tabBtn("all", "Общая"))
  );

  const set = e[wStatTab] || e.all;
  box.appendChild(
    h(
      "div",
      { class: "st-wordle-nums" },
      h("div", { class: "st-num" }, h("b", {}, String(set.solved)), h("span", {}, "отгадано")),
      h("div", { class: "st-num" }, h("b", {}, String(set.failed)), h("span", {}, "проиграно")),
      set.best ? h("div", { class: "st-num" }, h("b", {}, String(set.best)), h("span", {}, "лучший результат")) : null,
      set.avg ? h("div", { class: "st-num" }, h("b", {}, String(set.avg)), h("span", {}, "в среднем попыток")) : null
    )
  );

  if (set.solved) {
    const max = Math.max(...set.dist, 1);
    const chart = h("div", { class: "st-dist" });
    set.dist.forEach((n, i) => {
      chart.appendChild(
        h(
          "div",
          { class: "st-dist-row" },
          h("span", { class: "st-dist-lbl" }, String(i + 1)),
          h(
            "span",
            { class: "st-dist-bar" },
            h("span", {
              class: "st-dist-fill" + (n ? "" : " zero"),
              style: `width:${n ? Math.max((n / max) * 100, 8) : 0}%`,
            })
          ),
          h("span", { class: "st-dist-n" }, String(n))
        )
      );
    });
    box.appendChild(h("div", { class: "st-dist-cap" }, "За сколько попыток отгадывали"));
    box.appendChild(chart);
  } else {
    box.appendChild(h("p", { class: "hint" }, "Пока нет отгаданных слов."));
  }
  return box;
}

// Кодовые имена: разбивка по сложностям
function codenamesStats(e) {
  const labels = { easy: "Полегче", normal: "Обычная", hard: "Сложная" };
  const box = h("div", { class: "st-levels" });
  for (const k of ["easy", "normal", "hard"]) {
    const l = e.levels[k];
    if (!l || (!l.won && !l.lost)) continue;
    box.appendChild(
      h(
        "div",
        { class: "st-level" },
        h("span", { class: "st-level-name" }, labels[k]),
        h("span", { class: "st-chip win" }, "побед: " + l.won),
        h("span", { class: "st-chip" }, "поражений: " + l.lost),
        l.best ? h("span", { class: "st-chip" }, "рекорд: " + l.best) : null
      )
    );
  }
  return box;
}
