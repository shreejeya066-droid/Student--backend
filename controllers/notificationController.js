const Notification = require('../modules/notificationModel');
const Student = require('../modules/studentModel');

// @desc Create a new notification (For Students)
// @route POST /api/notifications
const createNotification = async (req, res) => {
    try {
        const { studentId, studentName, type, message, details } = req.body;

        if (!studentId || !studentName || !message) {
            return res.status(400).json({ message: 'Roll number, student name, and message are required' });
        }

        const notification = await Notification.create({
            studentId,
            studentName,
            type: type || 'Profile Edit Request',
            message,
            details,
            status: 'pending'
        });

        res.status(201).json(notification);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc Get all notifications (For Teachers/Admins)
// @route GET /api/notifications
const getNotifications = async (req, res) => {
    try {
        // Sort by newest first
        const notifications = await Notification.find({}).sort({ createdAt: -1 });
        res.status(200).json(notifications);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc Update notification status (For Admins)
// @route PUT /api/notifications/:id
const updateNotificationStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const { id } = req.params;

        if (!['approved', 'rejected', 'pending'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const notification = await Notification.findByIdAndUpdate(id, { status }, { new: true });

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        // If it's a profile update request and it's approved, unlock the student's profile
        if (notification.type === 'Profile Edit Request' && status === 'approved') {
            await Student.findOneAndUpdate(
                { rollNumber: notification.studentId },
                { isLocked: false }
            );
        }

        res.status(200).json(notification);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc Get student's current request status
// @route GET /api/notifications/student/:rollNumber
const getStudentRequestStatus = async (req, res) => {
    try {
        const { rollNumber } = req.params;
        const latestRequest = await Notification.findOne({ studentId: rollNumber })
            .sort({ createdAt: -1 });
        
        res.status(200).json(latestRequest || { status: 'none' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createNotification,
    getNotifications,
    updateNotificationStatus,
    getStudentRequestStatus
};
