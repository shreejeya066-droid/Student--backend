const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/systemSettingsController');

router.get('/:key', getSettings);
router.put('/:key', updateSettings);

module.exports = router;
