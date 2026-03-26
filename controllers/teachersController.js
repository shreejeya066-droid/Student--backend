const Teacher = require('../modules/teacherModel');

// Register a new teacher
const registerTeacher = async (req, res) => {
    try {
        const { name, email, password, department, subjects, mobile, staffId } = req.body;

        // Check if teacher already exists
        const teacherExists = await Teacher.findOne({ email });
        if (teacherExists) {
            return res.status(400).json({ message: 'Teacher already exists' });
        }

        // Create teacher
        const teacher = await Teacher.create({
            name,
            email,
            password,
            department,
            subject: subjects ? subjects[0] : '', // Legacy field 
            subjects, // New array field
            mobile,
            username: staffId, // Map staffId to username
            role: 'teacher',
            isFirstLogin: true
        });

        if (teacher) {
            res.status(201).json({
                _id: teacher.id,
                name: teacher.name,
                email: teacher.email,
                role: teacher.role,
                token: 'mock_token_for_now' // We can add JWT later
            });
        } else {
            res.status(400).json({ message: 'Invalid teacher data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Check Teacher Status
const checkTeacherStatus = async (req, res) => {
    try {
        const { email } = req.body; // Can be email or username
        const teacher = await Teacher.findOne({
            $or: [{ email: email }, { username: email }]
        });

        if (!teacher) {
            return res.json({ exists: false, hasPassword: false });
        }

        // If it's first login, we return hasPassword: false to trigger the setup flow in frontend
        const hasPassword = !teacher.isFirstLogin && !!teacher.password && teacher.password.length > 0;
        res.json({ exists: true, hasPassword, isFirstLogin: teacher.isFirstLogin });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Setup Password (First Time)
const setupTeacherPassword = async (req, res) => {
    try {
        const { email, password } = req.body;
        const teacher = await Teacher.findOne({
            $or: [{ email: email }, { username: email }]
        });

        if (!teacher) {
            return res.status(404).json({ message: 'Teacher not found' });
        }

        // Allow setup if password is empty OR if it's first login
        if (teacher.password && teacher.password.length > 0 && !teacher.isFirstLogin) {
            return res.status(400).json({ message: 'Account already active. Please login.' });
        }

        teacher.password = password;
        teacher.isFirstLogin = false;
        await teacher.save();

        res.json({ message: 'Password set successfully', success: true });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Login teacher
const loginTeacher = async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(`[AUTH] Teacher login attempt: ${email}`);

        // Check for teacher email or username
        const teacher = await Teacher.findOne({
            $or: [{ email: email }, { username: email }]
        });

        if (!teacher) {
            console.warn(`[AUTH] Login failed: Teacher not found (${email})`);
            return res.status(401).json({ message: 'Teacher account not found' });
        }

        // Support both plain text (legacy/admin creation) and hashed password 
        // (Just like the Student controller does for flexibility)
        const bcrypt = require('bcryptjs');
        const isMatch = teacher.password === password || (teacher.password.startsWith('$2') && await bcrypt.compare(password, teacher.password));

        if (isMatch) {
            console.log(`[AUTH] Login successful for: ${teacher.name}`);
            const isProfileComplete = !!teacher.mobile && teacher.mobile.length > 0;

            res.json({
                _id: teacher.id,
                name: teacher.name,
                email: teacher.email,
                role: teacher.role,
                isProfileComplete,
                isFirstLogin: teacher.isFirstLogin, // Added this field so frontend can navigate correctly
                token: 'mock_token_for_now'
            });
        } else {
            console.warn(`[AUTH] Login failed: Invalid password for ${email}`);
            res.status(401).json({ message: 'Invalid ID or Password.' });
        }
    } catch (error) {
        console.error(`[AUTH] Critical Login Error:`, error);
        res.status(500).json({ message: 'Server error during login. Please try again.' });
    }
};

// Get all teachers
const getAllTeachers = async (req, res) => {
    try {
        const teachers = await Teacher.find().select('-password');
        res.status(200).json(teachers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Delete Teacher
const deleteTeacher = async (req, res) => {
    try {
        const { id } = req.params;
        const teacher = await Teacher.findByIdAndDelete(id);

        if (!teacher) {
            return res.status(404).json({ message: 'Teacher not found' });
        }

        res.json({ message: 'Teacher removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update Teacher Profile
const updateTeacher = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const teacher = await Teacher.findByIdAndUpdate(id, updates, {
            new: true,
            runValidators: true
        });

        if (!teacher) {
            return res.status(404).json({ message: 'Teacher not found' });
        }

        // Return simplified user object
        const isProfileComplete = !!teacher.mobile && teacher.mobile.length > 0;

        res.json({
            _id: teacher.id,
            name: teacher.name,
            email: teacher.email,
            role: teacher.role,
            mobile: teacher.mobile,
            qualification: teacher.qualification,
            experience: teacher.experience,
            isProfileComplete,
            token: 'mock_token_for_now' // Or keep existing token logic if handled in frontend
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    registerTeacher,
    loginTeacher,
    getAllTeachers,
    deleteTeacher,
    checkTeacherStatus,
    setupTeacherPassword,
    updateTeacher
};
