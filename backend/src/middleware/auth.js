const jwt = require("jsonwebtoken");
const { User } = require("../models");
const line = require("@line/bot-sdk");

// ── Staff JWT auth ─────────────────────────────────────────────────────────
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id);
    if (!user || !user.isActive) return res.status(401).json({ error: "Unauthorized" });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    const userRole = req.user?.role;
    // finance = super admin (has all admin perms + finance perms)
    const hasAccess = roles.includes(userRole) ||
      (userRole === "both" && (roles.includes("admin") || roles.includes("driver"))) ||
      (userRole === "finance" && (roles.includes("finance") || roles.includes("admin")));
    if (!hasAccess) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

// ── Customer LINE LIFF auth ────────────────────────────────────────────────
async function requireLiff(req, res, next) {
  const token = req.headers["x-line-access-token"] || req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No LIFF token" });
  try {
    const profile = await line.validateSignature
      ? null // skip — use getProfile
      : null;
    // Verify access token with LINE API
    const axios = require("axios");
    const resp = await axios.get("https://api.line.me/oauth2/v2.1/verify", {
      params: { access_token: token },
    });
    if (resp.data.client_id !== process.env.LINE_LIFF_CLIENT_ID) {
      return res.status(401).json({ error: "Invalid LIFF token" });
    }
    const profileResp = await axios.get("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    req.lineProfile = profileResp.data;
    next();
  } catch {
    res.status(401).json({ error: "LIFF auth failed" });
  }
}

module.exports = { requireAuth, requireRole, requireLiff };
