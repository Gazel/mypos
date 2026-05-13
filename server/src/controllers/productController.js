import { pool } from "../db/pool.js";

const validBaseUnits = new Set(["gram", "ml", "pcs"]);

function mapProduct(row) {
  return {
    id: String(row.id),
    name: row.name,
    price: Number(row.price),
    image: row.image ?? "",
    category: row.category ?? "",
    stock: Number(row.stock ?? 0),
    sort_order: Number(row.sort_order ?? 0),
  };
}

export async function listProducts(req, res) {
  const [rows] = await pool.query(
    "SELECT * FROM products ORDER BY sort_order ASC, id ASC"
  );
  res.json(rows.map(mapProduct));
}

export async function createProduct(req, res) {
  const { name, price, image, category, stock } = req.body || {};

  const [[maxRow]] = await pool.query(
    "SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM products"
  );
  const nextOrder = Number(maxRow.maxOrder) + 1;

  const [result] = await pool.query(
    `
    INSERT INTO products (name, price, image, category, stock, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [name, price, image || "", category || "", stock ?? -1, nextOrder]
  );

  res.json({
    id: String(result.insertId),
    name,
    price: Number(price),
    image: image || "",
    category: category || "",
    stock: stock ?? -1,
    sort_order: nextOrder,
  });
}

export async function updateProduct(req, res) {
  const { id } = req.params;
  const { name, price, image, category, stock, sort_order } = req.body || {};

  await pool.query(
    `
    UPDATE products
       SET name=?,
           price=?,
           image=?,
           category=?,
           stock=?,
           sort_order=COALESCE(?, sort_order)
     WHERE id=?
    `,
    [name, price, image || "", category || "", stock ?? -1, sort_order, id]
  );

  const [[row]] = await pool.query("SELECT * FROM products WHERE id=?", [id]);
  if (!row) return res.status(404).json({ message: "Product not found" });

  res.json(mapProduct(row));
}

export async function deleteProduct(req, res) {
  const { id } = req.params;
  await pool.query("DELETE FROM products WHERE id=?", [id]);
  res.json({ success: true });
}

function mapRecipeItem(row) {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    ingredientId: String(row.ingredient_id),
    ingredientName: row.ingredient_name,
    baseUnit: row.base_unit,
    displayUnit: row.display_unit,
    isIngredientActive: Boolean(row.is_active),
    quantityPerProduct: Number(row.quantity_per_product),
    unit: row.unit,
  };
}

export async function getProductRecipe(req, res) {
  const { productId } = req.params;

  const [[product]] = await pool.query("SELECT id FROM products WHERE id=? LIMIT 1", [
    productId,
  ]);
  if (!product) return res.status(404).json({ message: "Product not found" });

  const [rows] = await pool.query(
    `
    SELECT
      pr.id,
      pr.product_id,
      pr.ingredient_id,
      pr.quantity_per_product,
      pr.unit,
      i.name AS ingredient_name,
      i.base_unit,
      i.display_unit,
      i.is_active
    FROM product_recipes pr
    JOIN ingredients i ON i.id = pr.ingredient_id
    WHERE pr.product_id = ?
    ORDER BY i.name ASC
    `,
    [productId]
  );

  res.json(rows.map(mapRecipeItem));
}

export async function replaceProductRecipe(req, res) {
  const { productId } = req.params;
  const items = Array.isArray(req.body?.items) ? req.body.items : [];

  const [[product]] = await pool.query("SELECT id FROM products WHERE id=? LIMIT 1", [
    productId,
  ]);
  if (!product) return res.status(404).json({ message: "Product not found" });

  const seenIngredients = new Set();
  const normalizedItems = [];

  for (const item of items) {
    const ingredientId = Number(item?.ingredientId);
    const quantityPerProduct = Number(item?.quantityPerProduct);
    const unit = String(item?.unit || "").trim();

    if (!Number.isInteger(ingredientId) || ingredientId <= 0) {
      return res.status(400).json({ message: "Bahan resep tidak valid." });
    }

    if (seenIngredients.has(ingredientId)) {
      return res
        .status(400)
        .json({ message: "Bahan tidak boleh duplikat dalam satu resep." });
    }

    if (!Number.isFinite(quantityPerProduct) || quantityPerProduct <= 0) {
      return res.status(400).json({ message: "Qty resep harus lebih dari 0." });
    }

    if (!validBaseUnits.has(unit)) {
      return res.status(400).json({ message: "Unit resep tidak valid." });
    }

    const [[ingredient]] = await pool.query(
      "SELECT id, base_unit FROM ingredients WHERE id=? LIMIT 1",
      [ingredientId]
    );

    if (!ingredient) {
      return res.status(404).json({ message: "Bahan resep tidak ditemukan." });
    }

    if (ingredient.base_unit !== unit) {
      return res.status(400).json({
        message: "Unit resep harus sama dengan base unit bahan.",
      });
    }

    seenIngredients.add(ingredientId);
    normalizedItems.push({
      ingredientId,
      quantityPerProduct,
      unit,
    });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM product_recipes WHERE product_id=?", [productId]);

    for (const item of normalizedItems) {
      await conn.query(
        `
        INSERT INTO product_recipes
          (product_id, ingredient_id, quantity_per_product, unit)
        VALUES (?, ?, ?, ?)
        `,
        [productId, item.ingredientId, item.quantityPerProduct, item.unit]
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const [rows] = await pool.query(
    `
    SELECT
      pr.id,
      pr.product_id,
      pr.ingredient_id,
      pr.quantity_per_product,
      pr.unit,
      i.name AS ingredient_name,
      i.base_unit,
      i.display_unit,
      i.is_active
    FROM product_recipes pr
    JOIN ingredients i ON i.id = pr.ingredient_id
    WHERE pr.product_id = ?
    ORDER BY i.name ASC
    `,
    [productId]
  );

  res.json(rows.map(mapRecipeItem));
}
