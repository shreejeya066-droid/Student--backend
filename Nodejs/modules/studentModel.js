const mongoose = require('mongoose');

const studentSchema = mongoose.Schema({
    // Store 'id' (Roll Number e.g. 23BIT01) as the primary identifier if needed, or just as a field
    rollNumber: {
        type: String,
        required: [true, 'Please add a Roll Number'],
        unique: true
    },
    password: {
        type: String,
        required: [true, 'Please add a password']
    },
    isFirstLogin: {
        type: Boolean,
        default: true
    },
    isProfileComplete: { type: Boolean, default: false },
    isLocked: { type: Boolean, default: false }, // For profile locking after completion

    // Personal
    firstName: { type: String },
    lastName: { type: String },
    dob: { type: String },
    gender: { type: String },
    bloodGroup: { type: String },
    nationality: { type: String },
    religion: { type: String },

    // Contact
    email: { type: String },
    phone: { type: String },
    mobile: { type: String },
    altMobile: { type: String },
    address: { type: String },
    fatherName: { type: String },
    motherName: { type: String },

    // Academic
    course: { type: String },
    department: { type: String },
    yearOfStudy: { type: Number }, // 1, 2, 3, 4
    semester: { type: Number },
    rollNumber: { type: String, required: true, unique: true }, // Already above but fine
    yearOfJoining: { type: String },
    tenthPercent: { type: String },
    twelfthPercent: { type: String },
    diplomaPercent: { type: String },
    cgpa: { type: String }, // Can be string if formatted
    backlogs: { type: String, default: '0' },

    // Sem Wise
    sem1_cgpa: { type: String }, sem1_file: { type: String },
    sem2_cgpa: { type: String }, sem2_file: { type: String },
    sem3_cgpa: { type: String }, sem3_file: { type: String },
    sem4_cgpa: { type: String }, sem4_file: { type: String },
    sem5_cgpa: { type: String }, sem5_file: { type: String },
    sem6_cgpa: { type: String }, sem6_file: { type: String },

    // Skills
    programmingLanguages: { type: String },
    technicalSkills: { type: String },
    tools: { type: String },
    certifications: { type: String },

    // Internship
    internshipCompany: { type: String },
    internshipType: { type: String },
    internshipDuration: { type: String },
    internshipDomain: { type: String },

    // Extras
    sports: { type: String },
    clubs: { type: String },
    achievements: { type: String },
    events: { type: String },
    hobbies: { type: [String] }, // Array of strings? Or just string as per formData

    // Career
    higherStudies: { type: String },
    higherStudiesDetails: { type: String },
    placementWillingness: { type: String },
    interestedDomain: { type: String },
    prefLocation: { type: String },

    attendance: { type: Number },
    interest: { type: String }, // Field for natural language search
}, {
    timestamps: true
});

module.exports = mongoose.model('Student', studentSchema);
