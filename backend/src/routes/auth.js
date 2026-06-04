const router = require("express").Router();
const { login, me, changePassword } = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

router.post("/login", login);
router.get("/me", requireAuth, me);
router.put("/password", requireAuth, changePassword);

module.exports = router;
