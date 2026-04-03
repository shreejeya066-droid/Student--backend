const mongoose = require('mongoose');

const notificationSchema = mongoose.Schema({
    studentId: {
        type: String, // Roll Number
        required: true
    },
    studentName: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['Profile Edit Request', 'Academic Update', 'Other'],
        default: 'Profile Edit Request'
    },
    message: {
        type: String,
        required: true
    },
    details: {
        reason: String,
        fields: [String]
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Notification', notificationSchema);
