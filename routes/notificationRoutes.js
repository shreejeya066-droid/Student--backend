const express = require('express');
const router = express.Router();
const { 
    createNotification, 
    getNotifications, 
    updateNotificationStatus, 
    getStudentRequestStatus 
} = require('../controllers/notificationController');

// All routes are currently public as per user request to not disturb current system logic
router.post('/', createNotification);
router.get('/', getNotifications);
router.put('/:id', updateNotificationStatus);
router.get('/student/:rollNumber', getStudentRequestStatus);

module.exports = router;
