import bcrypt from "bcryptjs";
import { pool } from "../db/pool.js";
import { generateToken } from "../middleware/auth.js";

export async function login(req, res) {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: "username & password required" });
  }

  const [rows] = await pool.query(
    "SELECT * FROM users WHERE username=? AND is_active=1 LIMIT 1",
    [username]
  );
  const user = rows[0];
  if (!user) return res.status(401).json({ message: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ message: "Invalid credentials" });

  const token = generateToken(user);
  res.json({
    token,
    user: {
      id: String(user.id),
      username: user.username,
      full_name: user.full_name,
      role: user.role,
    },
  });
}

export async function me(req, res) {
  const [rows] = await pool.query(
    "SELECT id, username, full_name, role FROM users WHERE id=? LIMIT 1",
    [req.user.id]
  );

  res.json(rows[0] || null);
}
