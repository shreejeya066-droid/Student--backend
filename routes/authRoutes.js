const express = require('express');
const router = express.Router();
const studentsController = require('../controllers/studentsController');

// Password Recovery Routes (Matching strict requirements)
router.post('/forgot-password', studentsController.forgotPassword);
router.post('/reset-password/:token', (req, res) => {
    // Adapter to pass token from params to body as expected by the controller
    req.body.token = req.params.token;
    studentsController.resetPassword(req, res);
});

module.exports = router;
