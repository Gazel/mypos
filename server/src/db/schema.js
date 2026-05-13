import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { pool } from "./pool.js";

function quoteDatabaseName(name) {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error("DB_NAME may only contain letters, numbers, and underscore.");
  }

  return `\`${name}\``;
}

async function ensureDatabaseExists() {
  const conn = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
  });

  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS ${quoteDatabaseName(
        env.db.database
      )} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await conn.end();
  }
}

async function ensureIndex(tableName, indexName, columnSql) {
  const [[row]] = await pool.query(
    `
    SELECT COUNT(1) AS count
      FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?
    `,
    [tableName, indexName]
  );

  if (Number(row.count) === 0) {
    await pool.query(`CREATE INDEX ${indexName} ON ${tableName} (${columnSql})`);
  }
}

export async function initDatabase() {
  console.log("Checking mypos database...");

  await ensureDatabaseExists();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      price INT NOT NULL,
      image VARCHAR(255) DEFAULT '',
      category VARCHAR(100) DEFAULT '',
      stock INT NOT NULL DEFAULT -1,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id VARCHAR(20) PRIMARY KEY,
      subtotal INT NOT NULL,
      discount INT NOT NULL,
      total INT NOT NULL,
      date DATETIME NOT NULL,
      payment_method VARCHAR(20) NOT NULL,
      cash_received INT,
      change_amount INT,
      customer_name VARCHAR(100),
      note TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS'
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS transaction_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      transaction_id VARCHAR(50),
      product_id INT,
      name VARCHAR(255),
      price INT NOT NULL,
      quantity INT NOT NULL,
      subtotal INT NOT NULL,
      FOREIGN KEY (transaction_id)
        REFERENCES transactions(id)
        ON DELETE CASCADE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS transaction_idempotency_keys (
      idempotency_key VARCHAR(120) PRIMARY KEY,
      transaction_id VARCHAR(50),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transaction_id)
        REFERENCES transactions(id)
        ON DELETE CASCADE
    );
  `);

  await ensureIndex("transactions", "idx_transactions_date", "date");
  await ensureIndex(
    "transaction_items",
    "idx_transaction_items_transaction_id",
    "transaction_id"
  );
  await ensureIndex(
    "transaction_idempotency_keys",
    "idx_transaction_idempotency_created_at",
    "created_at"
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ingredients (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      base_unit ENUM('gram','ml','pcs') NOT NULL,
      display_unit VARCHAR(20) NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ingredient_prices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ingredient_id INT NOT NULL,
      effective_date DATE NOT NULL,
      price_per_display_unit DECIMAL(14,2) NOT NULL,
      display_unit VARCHAR(20) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_ingredient_prices_effective_date (ingredient_id, effective_date),
      FOREIGN KEY (ingredient_id)
        REFERENCES ingredients(id)
        ON DELETE CASCADE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_recipes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id INT NOT NULL,
      ingredient_id INT NOT NULL,
      quantity_per_product DECIMAL(14,4) NOT NULL,
      unit ENUM('gram','ml','pcs') NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_product_recipe_ingredient (product_id, ingredient_id),
      FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE CASCADE,
      FOREIGN KEY (ingredient_id)
        REFERENCES ingredients(id)
        ON DELETE RESTRICT
    );
  `);

  await ensureIndex("ingredient_prices", "idx_ingredient_prices_date", "effective_date");
  await ensureIndex("product_recipes", "idx_product_recipes_product_id", "product_id");
  await ensureIndex(
    "product_recipes",
    "idx_product_recipes_ingredient_id",
    "ingredient_id"
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(100),
      role ENUM('superadmin','admin','cashier') NOT NULL DEFAULT 'cashier',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    ALTER TABLE users
    MODIFY role ENUM('superadmin','admin','cashier') NOT NULL DEFAULT 'cashier';
  `);

  const [userRows] = await pool.query("SELECT COUNT(*) AS c FROM users;");
  if (Number(userRows[0].c) === 0) {
    const hash = await bcrypt.hash(env.admin.password, 10);
    await pool.query(
      `INSERT INTO users (username, password_hash, full_name, role)
       VALUES (?, ?, ?, 'superadmin')`,
      [env.admin.username, hash, env.admin.fullName]
    );

    console.log(`Seeded default superadmin user: ${env.admin.username}`);
  }

  console.log("Database ready");
}
