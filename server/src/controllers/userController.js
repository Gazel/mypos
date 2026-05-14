import bcrypt from "bcryptjs";
import { pool } from "../db/pool.js";

export async function listUsers(req, res) {
  const [rows] = await pool.query(
    `SELECT id, username, full_name, role, is_active, created_at
       FROM users
      WHERE is_active = 1
      ORDER BY id DESC`
  );
  res.json(rows);
}

export async function createUser(req, res) {
  const authUser = req.user;
  const { username, password, full_name, role } = req.body || {};

  if (!username || !password || !role) {
    return res
      .status(400)
      .json({ message: "username, password, role required" });
  }

  if (authUser.role === "admin" && role === "superadmin") {
    return res
      .status(403)
      .json({ message: "Admin tidak dapat membuat user superadmin." });
  }

  const [[existingUser]] = await pool.query(
    "SELECT id, is_active FROM users WHERE username=? LIMIT 1",
    [username]
  );

  const hash = await bcrypt.hash(password, 10);

  if (existingUser) {
    if (Number(existingUser.is_active) === 1) {
      return res.status(409).json({ message: "Username already exists." });
    }

    await pool.query(
      `UPDATE users
          SET password_hash = ?,
              full_name = ?,
              role = ?,
              is_active = 1
        WHERE id = ?`,
      [hash, full_name || null, role, existingUser.id]
    );

    const [rows] = await pool.query(
      `SELECT id, username, full_name, role, is_active, created_at
         FROM users WHERE id=? LIMIT 1`,
      [existingUser.id]
    );
    return res.json(rows[0]);
  }

  const [result] = await pool.query(
    `INSERT INTO users (username, password_hash, full_name, role)
       VALUES (?, ?, ?, ?)`,
    [username, hash, full_name || null, role]
  );

  const [rows] = await pool.query(
    `SELECT id, username, full_name, role, is_active, created_at
       FROM users WHERE id=? LIMIT 1`,
    [result.insertId]
  );
  res.json(rows[0]);
}

export async function updateUser(req, res) {
  const authUser = req.user;
  const { id } = req.params;
  const { username, password, full_name, role, is_active } = req.body || {};

  const [[target]] = await pool.query("SELECT * FROM users WHERE id=? LIMIT 1", [
    id,
  ]);
  if (!target) return res.status(404).json({ message: "User not found" });

  const isSelf = String(authUser.id) === String(id);

  if (authUser.role === "admin" && target.role === "superadmin") {
    return res
      .status(403)
      .json({ message: "Admin tidak dapat mengubah user superadmin." });
  }

  if (authUser.role === "admin" && role === "superadmin") {
    return res
      .status(403)
      .json({ message: "Admin tidak dapat menjadikan user sebagai superadmin." });
  }

  if (authUser.role === "admin" && password && !isSelf) {
    return res
      .status(403)
      .json({ message: "Admin tidak dapat mengubah password user lain." });
  }

  let sql;
  let params;

  if (password && (authUser.role === "superadmin" || isSelf)) {
    const hash = await bcrypt.hash(password, 10);
    sql = `
      UPDATE users
         SET username = COALESCE(?, username),
             password_hash = ?,
             full_name = ?,
             role = ?,
             is_active = ?
       WHERE id = ?
    `;
    params = [
      username || null,
      hash,
      full_name || null,
      role || target.role,
      is_active ?? target.is_active,
      id,
    ];
  } else {
    sql = `
      UPDATE users
         SET username = COALESCE(?, username),
             full_name = ?,
             role = ?,
             is_active = ?
       WHERE id = ?
    `;
    params = [
      username || null,
      full_name || null,
      role || target.role,
      is_active ?? target.is_active,
      id,
    ];
  }

  await pool.query(sql, params);

  const [rows] = await pool.query(
    `SELECT id, username, full_name, role, is_active, created_at
       FROM users WHERE id=? LIMIT 1`,
    [id]
  );
  res.json(rows[0]);
}

export async function deleteUser(req, res) {
  const authUser = req.user;
  const { id } = req.params;

  if (String(authUser.id) === String(id)) {
    return res.status(400).json({ message: "User cannot delete itself." });
  }

  const [[target]] = await pool.query(
    "SELECT id, username, role FROM users WHERE id=? LIMIT 1",
    [id]
  );
  if (!target) return res.status(404).json({ message: "User not found" });

  if (authUser.role === "admin" && target.role === "superadmin") {
    return res
      .status(403)
      .json({ message: "Admin tidak dapat menonaktifkan superadmin." });
  }

  await pool.query("DELETE FROM users WHERE id=?", [id]);
  res.json({ message: "User deleted" });
}
