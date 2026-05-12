import { formatYYYYMMDD } from "./date.js";

export async function generateDailyId(conn, dateISO) {
  const d = dateISO ? new Date(dateISO) : new Date();
  const yyyymmdd = formatYYYYMMDD(d);

  const [rows] = await conn.query(
    "SELECT MAX(id) AS maxId FROM transactions WHERE id LIKE ?",
    [`${yyyymmdd}%`]
  );

  const maxId = rows?.[0]?.maxId;
  let nextSeq = 1;

  if (maxId) {
    const last3 = parseInt(String(maxId).slice(-3), 10);
    if (!Number.isNaN(last3)) nextSeq = last3 + 1;
  }

  return `${yyyymmdd}${String(nextSeq).padStart(3, "0")}`;
}
