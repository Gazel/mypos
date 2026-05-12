import { pool } from "../db/pool.js";

export async function clearCategory(req, res) {
  const { name } = req.params;
  await pool.query("UPDATE products SET category='' WHERE category=?", [name]);
  res.json({ success: true });
}
