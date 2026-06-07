export function formatCents(value: number | string | null | undefined) {
  const cents = toInteger(value);
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const dollars = Math.floor(absolute / 100);
  const remainder = String(absolute % 100).padStart(2, "0");
  return `${sign}$${dollars.toLocaleString("en-US")}.${remainder}`;
}

export function formatDate(value: string | null | undefined) {
  const text = String(value || "");
  if (!text) return "No date";
  const dateOnly = text.slice(0, 10);
  const [year, month, day] = dateOnly.split("-");
  if (!year || !month || !day) return text;
  return `${month}/${day}/${year}`;
}

export function titleCase(value: string | null | undefined) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function toInteger(value: number | string | null | undefined) {
  if (Number.isInteger(value)) return value as number;
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
}
