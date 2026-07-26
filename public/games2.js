// Экраны домино, дурака, уно и кроссворда.
// doMove передаётся аргументом, чтобы не было кольцевого импорта с games.js.
import { I, h, nameOf } from "./core.js";

// ============================================================
//  ДОМИНО
// ============================================================
// точки на половинке камня: какие из девяти позиций закрашены
const PIPS = {
  0: [],
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function half(n) {
  const box = h("span", { class: "dm-half" });
  const on = PIPS[n] || [];
  for (let i = 0; i < 9; i++) {
    box.appendChild(h("span", { class: "dm-pip" + (on.includes(i) ? " on" : "") }));
  }
  return box;
}

function tile(t, opts = {}) {
  return h(
    "button",
    {
      class: "dm-tile" + (opts.cls || ""),
      disabled: opts.disabled ? true : false,
      onclick: opts.onclick || null,
      type: "button",
    },
    half(t[0]),
    h("span", { class: "dm-bar" }),
    half(t[1])
  );
}

let dmSel = null; // выбранный камень, когда его можно приложить с двух сторон

export function dominoBoard(g, doMove) {
  const v = g.view;
  const box = h("div", { class: "dm" });

  // счётчики: базар и рука соперника
  box.appendChild(
    h(
      "div",
      { class: "dm-meta" },
      h("span", { class: "dm-count" }, "Базар: ", h("b", {}, String(v.stock))),
      h("span", { class: "dm-count" }, "У соперника: ", h("b", {}, String(v.foeCount)))
    )
  );

  // выложенная линия
  const line = h("div", { class: "dm-line" });
  if (!v.line.length) {
    line.appendChild(h("span", { class: "dm-empty" }, "Пусто, ходи любым"));
  } else {
    v.line.forEach((t) => line.appendChild(tile(t, { cls: " small", disabled: true })));
  }
  box.appendChild(h("div", { class: "dm-line-wrap" }, line));
  // линия длинная - держим правый край в поле зрения
  requestAnimationFrame(() => {
    line.parentElement && (line.parentElement.scrollLeft = line.parentElement.scrollWidth);
  });

  if (v.status !== "active") {
    if (v.last && v.last.kind === "fish") {
      box.appendChild(
        h(
          "p",
          { class: "hint center" },
          "Рыба. Очки: " + nameOf("angelina") + " " + v.last.angelina + ", " +
            nameOf("kirill") + " " + v.last.kirill
        )
      );
    }
    if (v.foeHand && v.foeHand.length) {
      box.appendChild(h("div", { class: "section-label" }, "Осталось у соперника"));
      const row = h("div", { class: "dm-hand" });
      v.foeHand.forEach((t) => row.appendChild(tile(t, { cls: " small", disabled: true })));
      box.appendChild(row);
    }
    return box;
  }

  // подпись под линией: что делать сейчас
  if (v.myTurn && !v.canPlay) {
    box.appendChild(
      h(
        "p",
        { class: "hint center" },
        v.stock ? "Нечем ходить, бери из базара" : "Ходить нечем и базар пуст"
      )
    );
  }

  // выбор стороны, когда камень подходит и слева, и справа
  if (dmSel !== null && v.myTurn && v.playable[dmSel] && v.playable[dmSel].length === 2) {
    box.appendChild(
      h(
        "div",
        { class: "dm-sides" },
        h(
          "button",
          {
            class: "btn btn-sm",
            onclick: async () => {
              const i = dmSel;
              dmSel = null;
              await doMove({ kind: "play", tile: i, side: "left" });
            },
          },
          "Слева"
        ),
        h("span", { class: "dm-sides-txt" }, "Куда приложить?"),
        h(
          "button",
          {
            class: "btn btn-sm",
            onclick: async () => {
              const i = dmSel;
              dmSel = null;
              await doMove({ kind: "play", tile: i, side: "right" });
            },
          },
          "Справа"
        )
      )
    );
  }

  // своя рука
  const hand = h("div", { class: "dm-hand" });
  v.hand.forEach((t, i) => {
    const sides = v.playable[i] || [];
    const can = v.myTurn && sides.length > 0;
    hand.appendChild(
      tile(t, {
        cls: (can ? " can" : "") + (dmSel === i ? " sel" : ""),
        disabled: !can,
        onclick: async () => {
          if (sides.length === 2) {
            dmSel = dmSel === i ? null : i;
            renderAgain();
            return;
          }
          dmSel = null;
          await doMove({ kind: "play", tile: i, side: sides[0] });
        },
      })
    );
  });
  box.appendChild(hand);

  if (v.myTurn && !v.canPlay) {
    box.appendChild(
      h(
        "div",
        { class: "bs-actions" },
        v.stock
          ? h(
              "button",
              { class: "btn btn-primary", onclick: () => doMove({ kind: "draw" }) },
              "Взять из базара"
            )
          : h(
              "button",
              { class: "btn btn-primary", onclick: () => doMove({ kind: "pass" }) },
              "Пропустить ход"
            )
      )
    );
  }
  return box;
}

// перерисовка без запроса к серверу - для локального выбора
let rerender = null;
export function setRerender(fn) {
  rerender = fn;
}
function renderAgain() {
  if (rerender) rerender();
}

// ============================================================
//  КАРТЫ (дурак и уно)
// ============================================================
const SUIT_CH = { s: "♠", h: "♥", d: "♦", c: "♣" };
const RANK_CH = { 11: "В", 12: "Д", 13: "К", 14: "Т" };

function rankText(r) {
  return RANK_CH[r] || String(r);
}

function playCard(c, opts = {}) {
  const red = c.s === "h" || c.s === "d";
  return h(
    "button",
    {
      class: "pc" + (red ? " red" : "") + (opts.cls || ""),
      disabled: opts.disabled ? true : false,
      type: "button",
      onclick: opts.onclick || null,
    },
    h("span", { class: "pc-r" }, rankText(c.r)),
    h("span", { class: "pc-s" }, SUIT_CH[c.s])
  );
}

function cardBack() {
  return h("span", { class: "pc back" });
}

let duSel = null; // выбранная карта защитника

export function durakBoard(g, doMove) {
  const v = g.view;
  const box = h("div", { class: "du" });

  // козырь, колода, рука соперника
  box.appendChild(
    h(
      "div",
      { class: "du-top" },
      h(
        "div",
        { class: "du-deck" },
        v.trumpCard ? playCard(v.trumpCard, { cls: " trump", disabled: true }) : null,
        v.deck ? h("span", { class: "du-deck-n" }, String(v.deck)) : h("span", { class: "du-deck-n" }, "0")
      ),
      h(
        "div",
        { class: "du-info" },
        h("div", {}, "Козырь ", h("b", { class: "du-suit" }, SUIT_CH[v.trump])),
        h("div", { class: "hint" }, "В колоде: " + v.deck),
        h("div", { class: "hint" }, "У соперника: " + v.foeCount)
      )
    )
  );

  // стол
  const table = h("div", { class: "du-table" });
  if (!v.table.length) {
    table.appendChild(h("span", { class: "dm-empty" }, v.iAttack ? "Твой заход" : "Ждём захода"));
  }
  v.table.forEach((p, si) => {
    const canHere = duSel !== null && v.canBeat[duSel] && v.canBeat[duSel][si];
    table.appendChild(
      h(
        "div",
        {
          class: "du-pair" + (canHere ? " target" : ""),
          onclick: canHere
            ? async () => {
                const ci = duSel;
                duSel = null;
                await doMove({ kind: "defend", card: ci, slot: si });
              }
            : null,
        },
        playCard(p.a, { cls: " on-table", disabled: true }),
        p.d ? playCard(p.d, { cls: " on-table beat", disabled: true }) : null
      )
    );
  });
  box.appendChild(table);

  if (v.status !== "active") {
    if (v.foeHand && v.foeHand.length) {
      box.appendChild(h("div", { class: "section-label" }, "Осталось у соперника"));
      const row = h("div", { class: "du-hand" });
      v.foeHand.forEach((c) => row.appendChild(playCard(c, { disabled: true })));
      box.appendChild(row);
    }
    return box;
  }

  // подсказка по текущей роли
  let tip = "";
  if (v.taking && v.iAttack) tip = "Соперник забирает. Можешь подкинуть по рангу";
  else if (v.taking) tip = "Ты забираешь карты, ждём соперника";
  else if (v.myTurn && v.iAttack) tip = v.table.length ? "Подкидывай или говори бито" : "Заходи любой картой";
  else if (v.myTurn) tip = duSel === null ? "Выбери карту, чтобы отбиться" : "Теперь ткни, что бьёшь";
  if (tip) box.appendChild(h("p", { class: "hint center" }, tip));

  // рука
  const hand = h("div", { class: "du-hand" });
  v.hand.forEach((c, i) => {
    let can = false;
    if (v.myTurn && v.iAttack) can = v.canAdd[i] && v.table.length < 6;
    else if (v.myTurn && !v.iAttack) can = v.canBeat[i].some(Boolean);
    hand.appendChild(
      playCard(c, {
        cls: (can ? " can" : "") + (duSel === i ? " sel" : ""),
        disabled: !can,
        onclick: async () => {
          if (v.iAttack) {
            await doMove({ kind: "attack", card: i });
            return;
          }
          // защитнику может подойти несколько карт на столе
          const slots = v.canBeat[i].map((ok, si) => (ok ? si : -1)).filter((x) => x >= 0);
          if (slots.length === 1) {
            duSel = null;
            await doMove({ kind: "defend", card: i, slot: slots[0] });
          } else {
            duSel = duSel === i ? null : i;
            renderAgain();
          }
        },
      })
    );
  });
  box.appendChild(hand);

  // кнопки
  const acts = [];
  if (v.canFinish) {
    acts.push(
      h(
        "button",
        { class: "btn btn-primary", onclick: () => doMove({ kind: "done" }) },
        v.taking ? "Всё, забирай" : "Бито"
      )
    );
  }
  if (v.myTurn && !v.iAttack && !v.taking) {
    acts.push(
      h(
        "button",
        {
          class: "btn",
          onclick: async () => {
            duSel = null;
            await doMove({ kind: "take" });
          },
        },
        "Беру"
      )
    );
  }
  if (acts.length) box.appendChild(h("div", { class: "bs-actions" }, ...acts));
  return box;
}

// ============================================================
//  УНО
// ============================================================
const UNO_LABEL = { skip: "⦸", rev: "⇄", d2: "+2", wild: "★", wd4: "+4" };
const UNO_COLOR_NAME = { r: "красный", y: "жёлтый", g: "зелёный", b: "синий" };

function unoCard(c, opts = {}) {
  const black = c.v === "wild" || c.v === "wd4";
  return h(
    "button",
    {
      class: "uc " + (black ? "uc-w" : "uc-" + c.c) + (opts.cls || ""),
      disabled: opts.disabled ? true : false,
      type: "button",
      onclick: opts.onclick || null,
    },
    h("span", { class: "uc-v" }, UNO_LABEL[c.v] || c.v)
  );
}

function pickColor(onPick) {
  const scrim = h("div", { class: "modal-scrim", onclick: (e) => e.target === scrim && scrim.remove() });
  const body = h(
    "div",
    { class: "modal glass" },
    h("h3", {}, "Какой цвет?"),
    h(
      "div",
      { class: "uno-colors" },
      ...["r", "y", "g", "b"].map((c) =>
        h("button", {
          class: "uno-color uc-" + c,
          "aria-label": UNO_COLOR_NAME[c],
          title: UNO_COLOR_NAME[c],
          onclick: () => {
            scrim.remove();
            onPick(c);
          },
        })
      )
    ),
    h("div", { class: "modal-actions" }, h("button", { class: "btn", onclick: () => scrim.remove() }, "Отмена"))
  );
  scrim.appendChild(body);
  document.body.appendChild(scrim);
}

export function unoBoard(g, doMove) {
  const v = g.view;
  const box = h("div", { class: "un" });

  box.appendChild(
    h(
      "div",
      { class: "un-top" },
      h(
        "div",
        { class: "un-pile" },
        unoCard(v.top, { cls: " big", disabled: true }),
        h("span", { class: "un-color uc-" + v.color, title: "Сейчас " + UNO_COLOR_NAME[v.color] })
      ),
      h(
        "div",
        { class: "du-info" },
        h("div", {}, "Цвет: ", h("b", {}, UNO_COLOR_NAME[v.color])),
        h("div", { class: "hint" }, "В колоде: " + v.deck),
        h(
          "div",
          { class: "hint" },
          "У соперника: " + v.foeCount,
          v.foeUno ? h("span", { class: "un-uno" }, "УНО!") : null
        )
      )
    )
  );

  if (v.status !== "active") {
    if (v.foeHand && v.foeHand.length) {
      box.appendChild(h("div", { class: "section-label" }, "Осталось у соперника"));
      const row = h("div", { class: "un-hand" });
      v.foeHand.forEach((c) => row.appendChild(unoCard(c, { disabled: true })));
      box.appendChild(row);
    }
    return box;
  }

  if (v.myTurn) {
    box.appendChild(
      h(
        "p",
        { class: "hint center" },
        v.drawn
          ? "Взятой картой можно сходить или спасовать"
          : v.canPlayAny
          ? "Твой ход"
          : "Подходящей карты нет, бери из колоды"
      )
    );
  }
  if (v.myUno) box.appendChild(h("p", { class: "un-uno-big" }, "У тебя одна карта - УНО!"));

  const hand = h("div", { class: "un-hand" });
  v.hand.forEach((c, i) => {
    const can = v.myTurn && v.playable[i];
    hand.appendChild(
      unoCard(c, {
        cls: can ? " can" : "",
        disabled: !can,
        onclick: async () => {
          if (c.v === "wild" || c.v === "wd4") {
            pickColor((color) => doMove({ kind: "play", card: i, color }));
            return;
          }
          await doMove({ kind: "play", card: i });
        },
      })
    );
  });
  box.appendChild(hand);

  if (v.myTurn) {
    const acts = [];
    if (!v.canPlayAny && !v.drawn) {
      acts.push(
        h("button", { class: "btn btn-primary", onclick: () => doMove({ kind: "draw" }) }, "Взять карту")
      );
    }
    if (v.drawn) {
      acts.push(h("button", { class: "btn", onclick: () => doMove({ kind: "pass" }) }, "Пропустить"));
    }
    if (acts.length) box.appendChild(h("div", { class: "bs-actions" }, ...acts));
  }
  return box;
}

// ============================================================
//  КРОССВОРД
// ============================================================
const CW_ABC = "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ".split("");
let cwSel = null; // {r, c, dir}

function cwSlotAt(v, r, c, dir) {
  return v.slots.find((sl) => {
    if (sl.dir !== dir) return false;
    if (dir === "across") return sl.r === r && c >= sl.c && c < sl.c + sl.len;
    return sl.c === c && r >= sl.r && r < sl.r + sl.len;
  });
}

function cwCells(sl) {
  const out = [];
  for (let i = 0; i < sl.len; i++) {
    out.push(sl.dir === "down" ? [sl.r + i, sl.c] : [sl.r, sl.c + i]);
  }
  return out;
}

// первый номер, который начинается в этой клетке
function cwNum(v, r, c) {
  const sl = v.slots.find((x) => x.r === r && x.c === c);
  return sl ? sl.n : null;
}

function cwEnsureSel(v) {
  if (cwSel) {
    const still = cwSlotAt(v, cwSel.r, cwSel.c, cwSel.dir);
    if (still && !still.done) return;
  }
  const open = v.slots.find((sl) => !sl.done) || v.slots[0];
  if (open) cwSel = { r: open.r, c: open.c, dir: open.dir };
}

function cwStep(v, back) {
  if (!cwSel) return;
  const sl = cwSlotAt(v, cwSel.r, cwSel.c, cwSel.dir);
  if (!sl) return;
  const cells = cwCells(sl);
  const i = cells.findIndex(([r, c]) => r === cwSel.r && c === cwSel.c);
  const next = i + (back ? -1 : 1);
  if (next >= 0 && next < cells.length) {
    cwSel = { r: cells[next][0], c: cells[next][1], dir: cwSel.dir };
  }
}

export function crosswordBoard(g, doMove) {
  const v = g.view;
  const box = h("div", { class: "cw" });
  cwEnsureSel(v);

  const done = v.status !== "active";
  const sel = cwSel && cwSlotAt(v, cwSel.r, cwSel.c, cwSel.dir);
  const hi = new Set(sel ? cwCells(sel).map(([r, c]) => r + "," + c) : []);

  box.appendChild(
    h(
      "div",
      { class: "cw-meta" },
      h("span", { class: "dm-count" }, "Слов: ", h("b", {}, v.found + " / " + v.total)),
      v.hints ? h("span", { class: "dm-count" }, "Подсказок: ", h("b", {}, String(v.hints))) : null,
      v.checks ? h("span", { class: "dm-count" }, "Проверок: ", h("b", {}, String(v.checks))) : null
    )
  );

  // сетка
  // клетка не уже 26px: если не влезает, обёртка прокручивается вбок
  const grid = h("div", {
    class: "cw-grid",
    style:
      "grid-template-columns:repeat(" + v.w + ",minmax(26px,1fr));max-width:" + v.w * 40 + "px",
  });
  for (let r = 0; r < v.h; r++) {
    for (let c = 0; c < v.w; c++) {
      const cell = v.cells[r + "," + c];
      if (!cell) {
        grid.appendChild(h("span", { class: "cw-cell blank" }));
        continue;
      }
      const n = cwNum(v, r, c);
      const cls =
        " " +
        (cell.ok ? "ok " : "") +
        (cell.wrong ? "bad " : "") +
        (hi.has(r + "," + c) ? "hi " : "") +
        (cwSel && cwSel.r === r && cwSel.c === c ? "cur " : "") +
        (cell.by === "hint" ? "hint-by " : cell.by ? "by-" + cell.by + " " : "");
      grid.appendChild(
        h(
          "button",
          {
            class: "cw-cell" + cls,
            type: "button",
            disabled: done,
            onclick: () => {
              // повторный тап по той же клетке разворачивает слово
              if (cwSel && cwSel.r === r && cwSel.c === c) {
                const alt = cwSel.dir === "across" ? "down" : "across";
                if (cwSlotAt(v, r, c, alt)) cwSel = { r, c, dir: alt };
              } else {
                const dir = cwSlotAt(v, r, c, cwSel ? cwSel.dir : "across")
                  ? cwSel
                    ? cwSel.dir
                    : "across"
                  : cwSlotAt(v, r, c, "across")
                  ? "across"
                  : "down";
                cwSel = { r, c, dir };
              }
              renderAgain();
            },
          },
          n ? h("span", { class: "cw-n" }, String(n)) : null,
          h("span", { class: "cw-ch" }, cell.ch || "")
        )
      );
    }
  }
  box.appendChild(h("div", { class: "cw-grid-wrap" }, grid));

  if (done) {
    box.appendChild(h("div", { class: "section-label" }, "Ответы"));
    const list = h("div", { class: "cw-clues" });
    for (const sl of v.slots) {
      list.appendChild(
        h(
          "div",
          { class: "cw-clue done" },
          h("span", { class: "cw-clue-n" }, sl.n + (sl.dir === "across" ? " →" : " ↓")),
          h("span", { class: "cw-clue-t" }, sl.clue, h("b", {}, " " + (sl.answer || "")))
        )
      );
    }
    box.appendChild(list);
    return box;
  }

  // текущее определение
  if (sel) {
    box.appendChild(
      h(
        "div",
        { class: "cw-current glass" },
        h("span", { class: "cw-clue-n" }, sel.n + (sel.dir === "across" ? " →" : " ↓")),
        h("span", { class: "cw-clue-t" }, sel.clue),
        h("span", { class: "cw-len" }, sel.len + " букв")
      )
    );
  }

  // клавиатура
  const kb = h("div", { class: "cw-kb" });
  for (const ch of CW_ABC) {
    kb.appendChild(
      h(
        "button",
        {
          class: "cw-key",
          type: "button",
          onclick: async () => {
            if (!cwSel) return;
            const at = cwSel;
            cwStep(v, false);
            renderAgain();
            await doMove({ kind: "set", r: at.r, c: at.c, ch });
          },
        },
        ch
      )
    );
  }
  kb.appendChild(
    h(
      "button",
      {
        class: "cw-key wide",
        type: "button",
        onclick: async () => {
          if (!cwSel) return;
          const cell = v.cells[cwSel.r + "," + cwSel.c];
          if (cell && cell.ch && !cell.ok) {
            await doMove({ kind: "set", r: cwSel.r, c: cwSel.c, ch: "" });
          } else {
            cwStep(v, true);
            renderAgain();
          }
        },
      },
      "←"
    )
  );
  box.appendChild(kb);

  box.appendChild(
    h(
      "div",
      { class: "bs-actions" },
      h("button", { class: "btn", onclick: () => doMove({ kind: "check" }) }, "Проверить"),
      h(
        "button",
        {
          class: "btn",
          onclick: () => {
            if (!sel) return;
            doMove({ kind: "hint", slot: sel.i });
          },
        },
        "Подсказать букву"
      )
    )
  );

  // все определения
  const list = h("div", { class: "cw-clues" });
  for (const grp of ["across", "down"]) {
    const items = v.slots.filter((sl) => sl.dir === grp);
    if (!items.length) continue;
    list.appendChild(
      h("div", { class: "section-label" }, grp === "across" ? "По горизонтали" : "По вертикали")
    );
    for (const sl of items) {
      list.appendChild(
        h(
          "button",
          {
            class:
              "cw-clue" + (sl.done ? " done" : "") + (sel && sel.i === sl.i ? " cur" : ""),
            type: "button",
            onclick: () => {
              cwSel = { r: sl.r, c: sl.c, dir: sl.dir };
              renderAgain();
            },
          },
          h("span", { class: "cw-clue-n" }, String(sl.n)),
          h("span", { class: "cw-clue-t" }, sl.clue),
          sl.done ? h("span", { class: "cw-clue-ok", html: I.check }) : null
        )
      );
    }
  }
  box.appendChild(list);
  return box;
}

// Сбрасываем локальный выбор при открытии другой партии
export function resetBoards() {
  dmSel = null;
  duSel = null;
  cwSel = null;
}
