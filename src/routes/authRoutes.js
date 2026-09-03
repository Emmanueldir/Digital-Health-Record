const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const { validateRequest } = require("../middleware/validationMiddleware");
const { registerValidator, loginValidator } = require("../validators/authValidators");
const { verifyOtpValidator, resendOtpValidator } = require("../validators/otpValidators");

router.post("/register", registerValidator, validateRequest, authController.register);
router.post("/login", loginValidator, validateRequest, authController.login);
router.post("/verify-otp", verifyOtpValidator, validateRequest, authController.verifyOtp);
router.post("/resend-otp", resendOtpValidator, validateRequest, authController.resendOtp);

module.exports = router;
