const express = require('express');
const router = express.Router();
const studentsController = require('../controllers/studentsController');

// Search / Query Route
router.get('/analytics', studentsController.getAnalytics);
router.get('/powerbi', studentsController.getPowerBIData);
router.post('/query', studentsController.naturalLanguageQuery);
router.post('/login', studentsController.loginStudent);
router.post('/check-status', studentsController.checkStudentStatus);
router.post('/register', studentsController.registerStudent);
router.get('/:rollNumber', studentsController.getStudentProfile);
router.put('/:rollNumber', studentsController.updateStudentProfile);
router.delete('/:rollNumber', studentsController.deleteStudent);
router.get('/', studentsController.getAllStudents);

module.exports = router;
