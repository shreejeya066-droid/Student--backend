const express = require('express');
const router = express.Router();
const { getPowerBiData } = require('../controllers/powerbiController');

// GET /api/powerbi/students
router.get('/students', getPowerBiData);

module.exports = router;
