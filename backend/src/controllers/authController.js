const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User } = require("../models");

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  const user = await User.findOne({ where: { email, isActive: true } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  res.json({
    token: signToken(user),
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}

async function me(req, res) {
  res.json({ id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const valid = await bcrypt.compare(currentPassword, req.user.passwordHash);
  if (!valid) return res.status(400).json({ error: "Current password incorrect" });

  req.user.passwordHash = await bcrypt.hash(newPassword, 12);
  await req.user.save();
  res.json({ message: "Password updated" });
}

module.exports = { login, me, changePassword };
