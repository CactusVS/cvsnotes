// Общее для всех игр. В приложении ровно два игрока, поэтому "другой" однозначен.
export const PLAYERS = ["angelina", "kirill"];

export function other(id) {
  return id === "angelina" ? "kirill" : "angelina";
}

export function isPlayer(id) {
  return id === "angelina" || id === "kirill";
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
