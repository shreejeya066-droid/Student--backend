const mongoose = require('mongoose');

const teacherSchema = mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name']
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true
    },
    password: {
        type: String,
        // required: [true, 'Please add a password'] // Optional for initial admin creation
    },
    department: {
        type: String,
        required: [true, 'Please add a department']
    },
    subject: {
        type: String,
        required: false
    },
    subjects: [String],
    username: { type: String, unique: true },
    mobile: { type: String },
    qualification: { type: String },
    experience: { type: String },
    isFirstLogin: { type: Boolean, default: true },
    isApproved: {
        type: Boolean,
        default: false
    },
    isProfileUnlocked: {
        type: Boolean,
        default: false
    },
    profileUpdateRequestDate: {
        type: Date
    },
    role: {
        type: String,
        default: 'teacher'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Teacher', teacherSchema);
