import { pool } from "../db/pool.js";
import { isDateParam } from "../utils/date.js";

function mapIngredientPrice(row) {
  return {
    id: String(row.id),
    ingredientId: String(row.ingredient_id),
    ingredientName: row.ingredient_name,
    effectiveDate: row.effective_date,
    pricePerDisplayUnit: Number(row.price_per_display_unit),
    displayUnit: row.display_unit,
    createdAt: row.created_at,
  };
}

function normalizeIngredientPricePayload(body) {
  const ingredientId = Number(body?.ingredientId);
  const effectiveDate = String(body?.effectiveDate || "").trim();
  const pricePerDisplayUnit = Number(body?.pricePerDisplayUnit);

  if (!Number.isInteger(ingredientId) || ingredientId <= 0) {
    const err = new Error("Bahan wajib dipilih.");
    err.statusCode = 400;
    throw err;
  }

  if (!isDateParam(effectiveDate)) {
    const err = new Error("Tanggal berlaku harus format YYYY-MM-DD.");
    err.statusCode = 400;
    throw err;
  }

  if (!Number.isFinite(pricePerDisplayUnit) || pricePerDisplayUnit <= 0) {
    const err = new Error("Harga harus lebih dari 0.");
    err.statusCode = 400;
    throw err;
  }

  return { ingredientId, effectiveDate, pricePerDisplayUnit };
}

async function fetchIngredientPriceById(id) {
  const [[row]] = await pool.query(
    `
    SELECT
      ip.id,
      ip.ingredient_id,
      i.name AS ingredient_name,
      DATE_FORMAT(ip.effective_date, '%Y-%m-%d') AS effective_date,
      ip.price_per_display_unit,
      ip.display_unit,
      ip.created_at
    FROM ingredient_prices ip
    JOIN ingredients i ON i.id = ip.ingredient_id
    WHERE ip.id=?
    LIMIT 1
    `,
    [id]
  );

  return row ? mapIngredientPrice(row) : null;
}

export async function listIngredientPrices(req, res) {
  const [rows] = await pool.query(
    `
    SELECT
      ip.id,
      ip.ingredient_id,
      i.name AS ingredient_name,
      DATE_FORMAT(ip.effective_date, '%Y-%m-%d') AS effective_date,
      ip.price_per_display_unit,
      ip.display_unit,
      ip.created_at
    FROM ingredient_prices ip
    JOIN ingredients i ON i.id = ip.ingredient_id
    ORDER BY i.name ASC, ip.effective_date DESC, ip.id DESC
    `
  );

  res.json(rows.map(mapIngredientPrice));
}

export async function createIngredientPrice(req, res) {
  const { ingredientId, effectiveDate, pricePerDisplayUnit } =
    normalizeIngredientPricePayload(req.body);

  const [[ingredient]] = await pool.query(
    "SELECT id, display_unit FROM ingredients WHERE id=? LIMIT 1",
    [ingredientId]
  );

  if (!ingredient) {
    return res.status(404).json({ message: "Bahan tidak ditemukan." });
  }

  try {
    const [result] = await pool.query(
      `
      INSERT INTO ingredient_prices
        (ingredient_id, effective_date, price_per_display_unit, display_unit)
      VALUES (?, ?, ?, ?)
      `,
      [
        ingredientId,
        effectiveDate,
        pricePerDisplayUnit,
        ingredient.display_unit,
      ]
    );

    res.json(await fetchIngredientPriceById(result.insertId));
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      res
        .status(409)
        .json({ message: "Harga bahan untuk tanggal tersebut sudah ada." });
      return;
    }

    throw err;
  }
}

export async function updateIngredientPrice(req, res) {
  const { id } = req.params;
  const { ingredientId, effectiveDate, pricePerDisplayUnit } =
    normalizeIngredientPricePayload(req.body);

  const [[ingredient]] = await pool.query(
    "SELECT id, display_unit FROM ingredients WHERE id=? LIMIT 1",
    [ingredientId]
  );

  if (!ingredient) {
    return res.status(404).json({ message: "Bahan tidak ditemukan." });
  }

  try {
    const [result] = await pool.query(
      `
      UPDATE ingredient_prices
         SET ingredient_id=?,
             effective_date=?,
             price_per_display_unit=?,
             display_unit=?
       WHERE id=?
      `,
      [
        ingredientId,
        effectiveDate,
        pricePerDisplayUnit,
        ingredient.display_unit,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Harga bahan tidak ditemukan." });
    }

    res.json(await fetchIngredientPriceById(id));
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      res
        .status(409)
        .json({ message: "Harga bahan untuk tanggal tersebut sudah ada." });
      return;
    }

    throw err;
  }
}
