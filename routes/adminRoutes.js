const express = require('express');
const router = express.Router();
const { loginAdmin, registerAdmin, updateAdminProfile } = require('../controllers/adminController');

router.post('/login', loginAdmin);
router.post('/register', registerAdmin);
router.put('/:id', updateAdminProfile);

module.exports = router;
