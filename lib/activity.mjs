// Огонёк: день засчитывается, только если ОБА зажгли его в этот день.
import { getStore } from "@netlify/blobs";

const store = () => getStore({ name: "activity", consistency: "strong" });
const KEY = "flame";
const KEEP = 400;

// Дни считаем по киевскому времени, иначе ночное нажатие уезжало бы на вчера
const TZ = 3 * 60 * 60 * 1000;

export function dayKey(ts = Date.now()) {
  return new Date(ts + TZ).toISOString().slice(0, 10);
}

async function read() {
  return (await store().get(KEY, { type: "json" })) || {};
}

// Зажечь огонёк за сегодня. Возвращает, стало ли их двое
export async function light(userId) {
  const map = await read();
  const k = dayKey();
  const day = map[k] || [];
  if (!day.includes(userId)) day.push(userId);
  map[k] = day;

  // старые дни не копим
  const keys = Object.keys(map).sort();
  if (keys.length > KEEP) {
    for (const old of keys.slice(0, keys.length - KEEP)) delete map[old];
  }
  await store().setJSON(KEY, map);
  return { both: day.length >= 2, day };
}

function bothOn(map, key) {
  const a = map[key] || [];
  return a.includes("angelina") && a.includes("kirill");
}

export async function getStreak() {
  const map = await read();
  const today = dayKey();

  // если сегодня ещё не оба, серия считается со вчера и не рвётся
  const d = new Date(Date.now() + TZ);
  if (!bothOn(map, today)) d.setUTCDate(d.getUTCDate() - 1);

  let streak = 0;
  while (bothOn(map, d.toISOString().slice(0, 10))) {
    streak += 1;
    d.setUTCDate(d.getUTCDate() - 1);
  }

  const t = map[today] || [];
  return {
    streak,
    burning: bothOn(map, today),
    today: { angelina: t.includes("angelina"), kirill: t.includes("kirill") },
  };
}
