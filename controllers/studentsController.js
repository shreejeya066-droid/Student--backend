const Student = require('../modules/studentModel');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

// Login Student
const loginStudent = async (req, res) => {
    try {
        const { rollNumber, password } = req.body;

        // Find by roll number
        const student = await Student.findOne({ rollNumber });

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Support both plain text (legacy) and bcrypt hashed passwords
        const isMatch = student.password === password || await bcrypt.compare(password, student.password);
        console.log(`[DEBUG] Login Attempt: ${rollNumber} | Match: ${isMatch} | Stored Hash: ${student.password}`);

        if (isMatch) {
            res.json({
                _id: student._id,
                rollNumber: student.rollNumber,
                username: student.rollNumber,
                name: student.firstName ? `${student.firstName} ${student.lastName}` : student.rollNumber,
                isFirstLogin: student.isFirstLogin,
                role: 'student'
            });
        } else {
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Check Student Status (New/Existing/NoPassword)
const checkStudentStatus = async (req, res) => {
    try {
        const { rollNumber } = req.body;
        const student = await Student.findOne({ rollNumber });

        if (!student) {
            // New User (doesn't exist in DB at all)
            return res.json({ exists: false, hasPassword: false });
        }

        // Exists - check password
        // Assuming empty string or null means no password
        const hasPassword = !!student.password && student.password.length > 0;

        res.json({ exists: true, hasPassword });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Register Student / Create Password
const registerStudent = async (req, res) => {
    try {
        const { rollNumber, password, firstName, lastName, email, phone, mobile, altMobile, department, yearOfStudy } = req.body;

        // Password Validation (8+ chars, 1 uppercase, 1 special, 1 digit)
        const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({ 
                message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one digit, and one special character.' 
            });
        }

        const student = await Student.findOne({ rollNumber });

        // Case 1: Student exists
        if (student) {
            // SECURITY CHECK: If student already has a password, DO NOT allow overwrite via this public endpoint
            if (student.password && student.password.length > 0) {
                return res.status(400).json({ message: 'Account already active. Please login with your password.' });
            }

            // If student exists but has NO password (pre-seeded), we activate them
            const salt = await bcrypt.genSalt(10);
            student.password = await bcrypt.hash(password, salt);
            student.isFirstLogin = false; // Mark as activated

            // Update other fields if provided (e.g. self-registration data for pre-seeded user)
            if (firstName) student.firstName = firstName;
            if (lastName) student.lastName = lastName;
            if (email) student.email = email;
            if (phone) student.phone = phone;
            if (mobile) student.mobile = mobile;
            if (altMobile) student.altMobile = altMobile;
            if (department) student.department = department;
            if (yearOfStudy) student.yearOfStudy = yearOfStudy;

            await student.save();

            return res.status(200).json({
                message: 'Password set successfully',
                _id: student._id,
                rollNumber: student.rollNumber,
                username: student.rollNumber,
                role: 'student'
            });
        }

        // Case 2: New Student (Create from scratch)
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        const newStudent = await Student.create({
            rollNumber,
            password: hashedPassword,
            isFirstLogin: false, // They just created their password, so they are active
            firstName,
            lastName,
            email,
            phone,
            mobile,
            altMobile,
            department,
            yearOfStudy
        });

        if (newStudent) {
            res.status(201).json({
                _id: newStudent._id,
                rollNumber: newStudent.rollNumber,
                username: newStudent.rollNumber,
                role: 'student'
            });
        } else {
            res.status(400).json({ message: 'Invalid student data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update Student Profile
const updateStudentProfile = async (req, res) => {
    try {
        const { rollNumber } = req.params;
        const updates = req.body;

        const student = await Student.findOneAndUpdate({ rollNumber }, updates, { new: true });

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        res.json(student);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get Single Student (Profile)
const getStudentProfile = async (req, res) => {
    try {
        const { rollNumber } = req.params;
        const student = await Student.findOne({ rollNumber });

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        res.json(student);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get all students (Full data for Admin/Teachers)
const getAllStudents = async (req, res) => {
    try {
        // Returning all fields as per user request to maintain 'old system' behavior
        const students = await Student.find({});
        res.status(200).json(students);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Delete Student
const deleteStudent = async (req, res) => {
    try {
        const { rollNumber } = req.params;
        const student = await Student.findOneAndDelete({ rollNumber });

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        res.json({ message: 'Student removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Optimized Dynamic Intent Extractor (Single Input Version)
// Lightweight NLP: Extracts keywords, year, and CGPA from free-text input
const extractQueryIntent = (text) => {
    if (!text) return { yearOfStudy: null, keywords: [], cgpaFilter: null };

    // 1. Normalize input
    let normalized = text.toLowerCase().trim();
    let yearOfStudy = null;
    let cgpaFilter = null;

    // 2. CGPA Detection (above/below)
    const aboveMatch = normalized.match(/(?:above|more than|greater than|>)\s*(\d+(\.\d+)?)/i);
    const belowMatch = normalized.match(/(?:below|less than|smaller than|<)\s*(\d+(\.\d+)?)/i);
    
    if (aboveMatch) {
        cgpaFilter = { $gte: Number(aboveMatch[1]) };
        normalized = normalized.replace(aboveMatch[0], '');
    } else if (belowMatch) {
        cgpaFilter = { $lte: Number(belowMatch[1]) };
        normalized = normalized.replace(belowMatch[0], '');
    }

    // 3. Smart Detection: Detect year phrases (1st year, 2nd year, etc.)
    const yearMappers = {
        '1st year': 1, 'first year': 1,
        '2nd year': 2, 'second year': 2,
        '3rd year': 3, 'third year': 3,
        '4th year': 4, 'fourth year': 4
    };

    for (const [phrase, year] of Object.entries(yearMappers)) {
        if (normalized.includes(phrase)) {
            yearOfStudy = year;
            normalized = normalized.replace(phrase, '').trim();
            break;
        }
    }

    // 4. Keyword Extraction: Filter out common noise words
    const fillerWords = ["students", "student", "who", "with", "and", "the", "in", "like", "for", "matching", "having", "is", "are"];
    const keywords = normalized.split(/[\s,]+/)
        .filter(word => word.length > 1 && !fillerWords.includes(word));

    return { yearOfStudy, keywords, cgpaFilter };
};

// Redesigned NLP Search: Flexible human-like search logic with Hybrid Support
const naturalLanguageQuery = async (req, res) => {
    try {
        const { query, year, cgpa, placement, skill } = req.body;

        // 1. No input and no filters -> return all students
        if ((!query || query.trim() === '') && !year && !cgpa && !placement && !skill) {
            const allStudents = await Student.find({});
            return res.status(200).json({
                meta: { 
                    count: allStudents.length, 
                    extracted_keyword: "All Students",
                    dbStatus: "Connected",
                    extracted_intent: {}
                },
                data: allStudents
            });
        }

        // 2. Extract Intent from Text
        const intent = extractQueryIntent(query || '');
        const { yearOfStudy: textYear, keywords, cgpaFilter: textCgpa } = intent;

        // 3. Define target search fields (Inclusive list based on schema)
        const searchFields = [
            'firstName', 'lastName', 'rollNumber', 'skills', 'technicalSkills', 'technicalSkill',
            'hobbies', 'hobby', 'sports', 'clubs', 'interests', 'interest', 'achievements', 
            'certifications', 'programmingLanguages', 'address', 'events', 'tools', 
            'interestedDomain', 'prefLocation'
        ];

        let andConditions = [];

        // 4. Manual Dropdown Filters (Override/Add to text intent)
        const finalYear = year || textYear;
        const finalCgpaMin = cgpa || (textCgpa && textCgpa.$gte);
        
        if (finalYear && finalYear !== 'All') {
            andConditions.push({ yearOfStudy: Number(finalYear) });
        }

        if (finalCgpaMin && finalCgpaMin !== 'All') {
            const minVal = parseFloat(finalCgpaMin);
            andConditions.push({ cgpa: { $gte: minVal } });
        }

        if (placement && placement !== 'All') {
            const isWilling = placement === 'Interested';
            andConditions.push({ placementWillingness: { $regex: new RegExp(isWilling ? 'yes' : 'no', 'i') } });
        }

        if (skill && skill !== 'All') {
            const skillRegex = new RegExp(skill, 'i');
            andConditions.push({
                $or: [
                    { skills: { $regex: skillRegex } },
                    { programmingLanguages: { $regex: skillRegex } },
                    { tools: { $regex: skillRegex } },
                    { interestedDomain: { $regex: skillRegex } }
                ]
            });
        }

        // 5. Keyword Regex Filters (Broad Match across all fields)
        const queryWords = keywords.length > 0 ? keywords : [query.trim()];
        if (queryWords.length > 0 && queryWords[0] !== '') {
            // IMPROVEMENT: Use AND logic for multi-word queries to increase precision
            // Each word must be present in at least one field, but all words are required.
            queryWords.forEach(word => {
                if (word.length < 2) return; 
                const regex = new RegExp(word, 'i');
                const fieldMatches = searchFields.map(field => ({
                    [field]: { $regex: regex }
                }));
                andConditions.push({ $or: fieldMatches });
            });
        }

        // 6. Construct Final Query
        let mongoQuery = {};
        if (andConditions.length > 0) {
            mongoQuery = andConditions.length > 1 ? { $and: andConditions } : andConditions[0];
        }

        // 7. Execute Search
        console.log('Executing Mongo Query:', JSON.stringify(mongoQuery));
        const students = await Student.find(mongoQuery);

        console.log(`Search result for "${query || 'Filters'}": ${students.length} found`);

        res.status(200).json({
            meta: {
                original_query: query,
                extracted_keyword: queryWords.join(', ') || "Full Match",
                extracted_keywords: queryWords,
                detected_year: finalYear,
                count: students.length,
                dbStatus: "Active",
                extracted_intent: {
                    minCgpa: finalCgpaMin,
                    year: finalYear
                }
            },
            data: students
        });

    } catch (error) {
        console.error('NLP Search Error:', error);
        res.status(500).json({ 
            message: 'Search system encountered an error. Please try a simpler keyword.',
            error: error.message 
        });
    }
};

// Analytics Data Aggregation
const getAnalytics = async (req, res) => {
    try {
        const students = await Student.find({}, 'department attendance cgpa');

        // 1. Performance by Department (Average CGPA)
        const perfMap = {};
        students.forEach(s => {
            if (!s.department || !s.cgpa) return;
            if (!perfMap[s.department]) perfMap[s.department] = { sum: 0, count: 0 };
            perfMap[s.department].sum += s.cgpa;
            perfMap[s.department].count++;
        });

        const performanceData = Object.keys(perfMap).map(dept => ({
            name: dept,
            avgCGPA: (perfMap[dept].sum / perfMap[dept].count).toFixed(2) * 10 // scale to 100 for chart if needed, or keep as is. Let's assume 10 point scale. Chart expects marks? The mock data had "Math", "Physics" etc. We will switch to "Department Avg".
        }));

        // 2. Attendance Distribution
        let distribution = [
            { name: '> 90%', value: 0 },
            { name: '75-90%', value: 0 },
            { name: '< 75%', value: 0 }
        ];

        students.forEach(s => {
            const att = s.attendance || 0;
            if (att > 90) distribution[0].value++;
            else if (att >= 75) distribution[1].value++;
            else distribution[2].value++;
        });

        // 3. Mock Trend (harder to get from snapshot data, so maybe randomization or just static for now if no historical data)
        // We will return what we have.

        res.json({
            performance: performanceData,
            attendanceDistribution: distribution
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get RAW Data for Power BI (Flattened)
const getPowerBIData = async (req, res) => {
    try {
        const students = await Student.find({});
        const flatData = students.map(s => ({
            RollNumber: s.rollNumber,
            Name: s.firstName ? `${s.firstName} ${s.lastName}` : s.rollNumber,
            Department: s.department || 'Unknown',
            Year: s.yearOfStudy || 1,
            CGPA: parseFloat(s.cgpa) || 0,
            Attendance: s.attendance || 0,
            PlacementWillingness: s.placementWillingness || 'No',
            HigherStudies: s.higherStudies || 'No',
            Skills: s.skills || 'None',
            Gender: s.gender || 'Not Specified'
        }));
        res.status(200).json(flatData);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- OTP Password Reset Flow ---

// 1. Send OTP to Email
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        // Check if student exists
        const student = await Student.findOne({ email });
        console.log(`[AUTH] Forgot Password requested for: ${email}`);

        // Generic response for security
        const genericMessage = "If the email is registered, OTP has been sent.";

        if (!student) {
            console.log(`[AUTH] Email NOT found in database: ${email}`);
            return res.json({ message: genericMessage });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        console.log(`[DEBUG] Generated OTP for ${email}: ${otp}`);

        // Set OTP and Expiry (5 minutes)
        student.otp = otp;
        student.otpExpiry = Date.now() + 5 * 60 * 1000;

        await student.save();

        // Send Email
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: student.email,
            subject: 'Your OTP for Password Reset',
            text: `Your OTP for password reset is: ${otp}`
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`Password reset OTP sent to: ${student.email}`);
        } catch (mailError) {
            console.error("Email send failed:", mailError.message);
        }

        res.json({ message: genericMessage });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 2. Verify OTP
const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ message: 'Email and OTP are required' });
        }

        const student = await Student.findOne({
            email,
            otp,
            otpExpiry: { $gt: Date.now() }
        });

        if (!student) {
            return res.status(400).json({ message: 'Invalid OTP or expired' });
        }

        res.json({ message: 'OTP verified successfully', success: true });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 3. Reset Password
const resetPassword = async (req, res) => {
    try {
        const { email, otp, password } = req.body;

        if (!email || !otp || !password) {
            return res.status(400).json({ message: 'Email, OTP, and new password are required' });
        }

        // Password Validation (8+ chars, 1 uppercase, 1 special, 1 digit)
        const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({ 
                message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one digit, and one special character.' 
            });
        }

        // Find student and verify OTP again to be sure
        const student = await Student.findOne({
            email,
            otp,
            otpExpiry: { $gt: Date.now() }
        });

        if (!student) {
            return res.status(400).json({ message: 'Action unauthorized or session expired' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        student.password = await bcrypt.hash(password, salt);

        // Clear OTP fields
        student.otp = undefined;
        student.otpExpiry = undefined;

        await student.save();

        res.json({ message: 'Password reset successful. You can now login with your new password.', success: true });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    loginStudent,
    registerStudent,
    updateStudentProfile,
    getStudentProfile,
    getAllStudents,
    deleteStudent,
    naturalLanguageQuery,
    getAnalytics,
    getPowerBIData,
    checkStudentStatus,
    forgotPassword,
    verifyOTP,
    resetPassword
};
