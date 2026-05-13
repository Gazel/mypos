import { pool } from "../db/pool.js";

const validBaseUnits = new Set(["gram", "ml", "pcs"]);

function mapIngredient(row) {
  return {
    id: String(row.id),
    name: row.name,
    baseUnit: row.base_unit,
    displayUnit: row.display_unit,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeIngredientPayload(body) {
  const name = String(body?.name || "").trim();
  const baseUnit = String(body?.baseUnit || "").trim();
  const displayUnit = String(body?.displayUnit || "").trim();
  const isActive =
    typeof body?.isActive === "boolean" ? body.isActive : Boolean(body?.isActive ?? true);

  if (!name) {
    const err = new Error("Nama bahan wajib diisi.");
    err.statusCode = 400;
    throw err;
  }

  if (!validBaseUnits.has(baseUnit)) {
    const err = new Error("Base unit harus gram, ml, atau pcs.");
    err.statusCode = 400;
    throw err;
  }

  if (!displayUnit) {
    const err = new Error("Display unit wajib diisi.");
    err.statusCode = 400;
    throw err;
  }

  return { name, baseUnit, displayUnit, isActive };
}

export async function listIngredients(req, res) {
  const [rows] = await pool.query(
    `
    SELECT id, name, base_unit, display_unit, is_active, created_at, updated_at
      FROM ingredients
     ORDER BY name ASC
    `
  );

  res.json(rows.map(mapIngredient));
}

export async function createIngredient(req, res) {
  const payload = normalizeIngredientPayload(req.body);

  try {
    const [result] = await pool.query(
      `
      INSERT INTO ingredients (name, base_unit, display_unit, is_active)
      VALUES (?, ?, ?, ?)
      `,
      [
        payload.name,
        payload.baseUnit,
        payload.displayUnit,
        payload.isActive ? 1 : 0,
      ]
    );

    const [[row]] = await pool.query(
      "SELECT * FROM ingredients WHERE id=? LIMIT 1",
      [result.insertId]
    );
    res.json(mapIngredient(row));
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      res.status(409).json({ message: "Nama bahan sudah ada." });
      return;
    }

    throw err;
  }
}

export async function updateIngredient(req, res) {
  const { id } = req.params;
  const payload = normalizeIngredientPayload(req.body);

  try {
    await pool.query(
      `
      UPDATE ingredients
         SET name=?,
             base_unit=?,
             display_unit=?,
             is_active=?
       WHERE id=?
      `,
      [
        payload.name,
        payload.baseUnit,
        payload.displayUnit,
        payload.isActive ? 1 : 0,
        id,
      ]
    );
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      res.status(409).json({ message: "Nama bahan sudah ada." });
      return;
    }

    throw err;
  }

  const [[row]] = await pool.query("SELECT * FROM ingredients WHERE id=? LIMIT 1", [
    id,
  ]);
  if (!row) return res.status(404).json({ message: "Bahan tidak ditemukan." });

  res.json(mapIngredient(row));
}

export async function deleteIngredient(req, res) {
  const { id } = req.params;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM product_recipes WHERE ingredient_id=?", [id]);
    await conn.query("DELETE FROM ingredient_prices WHERE ingredient_id=?", [id]);
    const [result] = await conn.query("DELETE FROM ingredients WHERE id=?", [id]);

    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ message: "Bahan tidak ditemukan." });
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  res.json({ success: true });
}
