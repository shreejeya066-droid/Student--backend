const express = require('express');
const router = express.Router();
const studentsController = require('../controllers/studentsController');

// Password Recovery Routes (OTP Based)
router.post('/forgot-password', studentsController.forgotPassword);
router.post('/verify-otp', studentsController.verifyOTP);
router.post('/reset-password', studentsController.resetPassword);

module.exports = router;
