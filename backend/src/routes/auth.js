const router = require("express").Router();
const { login, me, changePassword } = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");
const ah = require("../middleware/asyncHandler");

router.post("/login", ah(login));
router.get("/me", requireAuth, ah(me));
router.put("/password", requireAuth, ah(changePassword));

module.exports = router;
