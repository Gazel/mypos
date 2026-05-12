import { pool } from "../db/pool.js";

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
