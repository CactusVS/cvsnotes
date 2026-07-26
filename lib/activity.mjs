// Огонёк: сколько дней подряд вы что-то делали в приложении.
import { getStore } from "@netlify/blobs";

const store = () => getStore({ name: "activity", consistency: "strong" });
const KEY = "days";
const KEEP = 400;

// Считаем дни по киевскому времени, иначе ночные заметки уезжали бы на вчера
const TZ = 3 * 60 * 60 * 1000;

function dayKey(ts = Date.now()) {
  return new Date(ts + TZ).toISOString().slice(0, 10);
}

async function readDays() {
  return (await store().get(KEY, { type: "json" })) || [];
}

// Отметить сегодняшнюю активность
export async function touch() {
  try {
    const days = await readDays();
    const k = dayKey();
    if (days.includes(k)) return;
    days.push(k);
    days.sort();
    if (days.length > KEEP) days.splice(0, days.length - KEEP);
    await store().setJSON(KEY, days);
  } catch {
    // огонёк не критичен, молчим
  }
}

export async function getStreak() {
  const days = await readDays();
  const set = new Set(days);
  const today = set.has(dayKey());

  // если сегодня ещё ничего не было, серия считается со вчера и не рвётся
  const d = new Date(Date.now() + TZ);
  if (!today) d.setUTCDate(d.getUTCDate() - 1);

  let streak = 0;
  while (set.has(d.toISOString().slice(0, 10))) {
    streak += 1;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return { streak, today, totalDays: days.length };
}
