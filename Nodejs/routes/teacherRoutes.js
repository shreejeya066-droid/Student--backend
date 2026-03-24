const express = require('express');
const router = express.Router();
const teachersController = require('../controllers/teachersController');

router.post('/register', teachersController.registerTeacher);
router.post('/login', teachersController.loginTeacher);
router.post('/check-status', teachersController.checkTeacherStatus);
router.post('/setup-password', teachersController.setupTeacherPassword);
router.delete('/:id', teachersController.deleteTeacher);
router.put('/:id', teachersController.updateTeacher);
router.get('/', teachersController.getAllTeachers);

module.exports = router;
