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
    if (!text) return { yearOfStudy: null, keywords: [], cgpaCriteria: null, placementWillingness: null };

    // 1. Normalize input
    let normalized = text.toLowerCase().trim();
    let yearOfStudy = null;
    let cgpaCriteria = null;
    let placementWillingness = null;

    // 2. GREEDY CGPA Detection (Covers 'above 8', '8.1 cgpa', '> 7.5', 'cgpa 8.2', etc.)
    // IMPROVEMENT: Handle 'cgpaabove8.0' without spaces.
    const aboveCgpaRegex = /(?:above|more than|greater than|>|>=|above c\.?g\.?p\.?a\.?|cgpa\s*above|cgpaabove)\s*(\d+(\.\d+)?)|(\d+(\.\d+)?)\s*(?:c\.?g\.?p\.?a\.?|grade|score)/i;
    const belowCgpaRegex = /(?:below|less than|smaller than|<|<=|cgpabelow|cgpa\s*below)\s*(\d+(\.\d+)?)/i;
    
    const aboveMatch = normalized.match(aboveCgpaRegex);
    const belowMatch = normalized.match(belowCgpaRegex);

    if (aboveMatch) {
        const val = parseFloat(aboveMatch[1] || aboveMatch[3]);
        if (!isNaN(val)) {
            cgpaCriteria = { $gte: val };
            normalized = normalized.replace(aboveMatch[0], ' ');
        }
    } else if (belowMatch) {
        const val = parseFloat(belowMatch[1]);
        if (!isNaN(val)) {
            cgpaCriteria = { $lte: val };
            normalized = normalized.replace(belowMatch[0], ' ');
        }
    } else {
        // Standalone number detection for CGPA candidates (e.g., "with 8.5")
        const plainNumberMatch = normalized.match(/\b([56789](\.\d+)?)\b/);
        if (plainNumberMatch) {
            const val = parseFloat(plainNumberMatch[1]);
            cgpaCriteria = { $gte: val };
            normalized = normalized.replace(plainNumberMatch[0], ' ');
        }
    }

    // 3. Year Detection
    const yearMatch = normalized.match(/(\d)(?:st|nd|rd|th)?\s*year/i);
    if (yearMatch) {
        yearOfStudy = parseInt(yearMatch[1]);
        normalized = normalized.replace(yearMatch[0], ' ');
    } else {
        const yearMappers = {
            'first year': 1, 'second year': 2, 'third year': 3, 'fourth year': 4, 'final year': 4
        };
        for (const [phrase, year] of Object.entries(yearMappers)) {
            if (normalized.includes(phrase)) {
                yearOfStudy = year;
                normalized = normalized.replace(phrase, ' ');
                break;
            }
        }
    }

    // 4. Placement Intent
    if (normalized.match(/placement ready|placed|ready for placement|willing for placement/i)) {
        placementWillingness = 'yes';
        normalized = normalized.replace(/placement ready|placed|ready for placement|willing for placement/i, ' ');
    }

    // 5. Keyword Extraction (Remaining words)
    const fillerWords = [
        "students", "student", "who", "with", "and", "the", "in", "like", "for", 
        "matching", "having", "is", "are", "cgpa", "year", "placement", "willing", 
        "ready", "skill", "skills", "knowing", "above", "below", "more", "than", "greater", "less", "of", "all"
    ];
    
    const keywords = normalized.split(/[\s,]+/)
        .map(word => word.trim())
        .filter(word => word.length > 1 && !fillerWords.includes(word));

    return { 
        yearOfStudy, 
        keywords, 
        cgpaCriteria,
        placementWillingness
    };
};

// Variable to track migration status
let migrationRun = false;

// --- DATA CORRECTION HELPER ---
const runCgpaMigration = async () => {
    try {
        console.log('[MIGRATION] Checking for student records with string-based CGPA...');
        // Standardize all CGPA records to Numbers. 
        // This uses parseFloat-style behavior for migration.
        const students = await Student.find({ cgpa: { $exists: true } });
        let count = 0;
        for (const student of students) {
            // Only update if it's not already a pure number type or needs cleaning
            if (typeof student.cgpa !== 'number') {
                const val = parseFloat(student.cgpa);
                if (!isNaN(val)) {
                    await Student.updateOne({ _id: student._id }, { $set: { cgpa: val } });
                    count++;
                }
            }
        }
        if (count > 0) console.log(`[MIGRATION] Updated ${count} records to numeric CGPA.`);
    } catch (err) {
        console.error('[MIGRATION ERROR] Failed to convert CGPA to numbers:', err.message);
    }
};

// Redesigned NLP Search: Flexible human-like search logic with Hybrid Support
const naturalLanguageQuery = async (req, res) => {
    try {
        const { query, year, cgpa, placement, skill } = req.body;

        // 1. Initial response if nothing is provided
        if ((!query || query.trim() === '') && (!year || year === 'All') && (!cgpa || cgpa === 'All') && (!placement || placement === 'All') && (!skill || skill === 'All')) {
            const allStudents = await Student.find({}).limit(50); // Added limit for performance
            return res.status(200).json({
                meta: { count: allStudents.length, extracted_keyword: "All Students", dbStatus: "Connected", extracted_intent: {} },
                data: allStudents
            });
        }

        // 2. Extract Intent from Query String
        const intent = extractQueryIntent(query || '');
        const { yearOfStudy: textYear, keywords, cgpaCriteria: textCgpaFilter, placementWillingness: textPlacement } = intent;

        const searchFields = [
            'firstName', 'lastName', 'rollNumber', 'skills', 'technicalSkills', 'technicalSkill',
            'hobbies', 'hobby', 'sports', 'clubs', 'interests', 'interest', 'achievements', 
            'certifications', 'programmingLanguages', 'address', 'events', 'tools', 
            'interestedDomain', 'prefLocation'
        ];

        let andConditions = [];

        // 3. Year Condition: Text overrides Dropdown
        const finalYear = textYear || (year && year !== 'All' ? year : null);
        if (finalYear) {
            const yearVal = Number(finalYear);
            andConditions.push({
                $or: [
                    { $expr: { $eq: [{ $convert: { input: "$yearOfStudy", to: "int", onError: null, onNull: null } }, yearVal] } },
                    { yearOfStudy: yearVal },
                    { yearOfStudy: String(yearVal) }
                ]
            });
        }

        // 4. CGPA Condition: Requirement 9 (Text overrides dropdown)
        let finalCgpaValue = (textCgpaFilter && textCgpaFilter.$gte) || (textCgpaFilter && textCgpaFilter.$lte) || null;
        let isGte = textCgpaFilter ? !!textCgpaFilter.$gte : true;

        if (!finalCgpaValue && cgpa && cgpa !== 'All') {
            finalCgpaValue = parseFloat(cgpa.toString().replace('>', '').replace('<', ''));
            isGte = cgpa.toString().includes('>') || !cgpa.toString().includes('<');
        }
        
        if (finalCgpaValue !== null && !isNaN(finalCgpaValue)) {
            const op = isGte ? '$gte' : '$lte';
            andConditions.push({
                $or: [
                    { $expr: { [op]: [{ $convert: { input: "$cgpa", to: "double", onError: null, onNull: null } }, finalCgpaValue] } },
                    { cgpa: { [op]: finalCgpaValue } }
                ]
            });
        }

        // 5. Placement Condition: Text overrides Dropdown
        const finalPlacement = textPlacement || (placement && placement !== 'All' ? (placement === 'Interested' ? 'yes' : 'no') : null);
        if (finalPlacement) {
            andConditions.push({ placementWillingness: { $regex: new RegExp(finalPlacement, 'i') } });
        }

        // 6. Keywords/Skills (Requirement 5: OR logic for split terms)
        let skillTerms = [...keywords];
        if (skill && skill !== 'All') skillTerms.push(skill);

        if (skillTerms.length > 0) {
            const pattern = skillTerms.join("|");
            const regex = new RegExp(pattern, 'i');
            const orSkillMatches = searchFields.map(field => ({ [field]: { $regex: regex } }));
            andConditions.push({ $or: orSkillMatches });
        }

        // 7. Combine conditions
        let mongoQuery = {};
        if (andConditions.length > 0) {
            mongoQuery = andConditions.length > 1 ? { $and: andConditions } : andConditions[0];
        }

        console.log(`[DEBUG] Executing Query: ${JSON.stringify(mongoQuery)}`);
        const students = await Student.find(mongoQuery).limit(100);

        let filterLabels = [...skillTerms];
        if (finalYear) filterLabels.push(`Year: ${finalYear}`);
        if (finalCgpaValue) filterLabels.push(`CGPA ${isGte ? '>' : '<'}= ${finalCgpaValue}`);
        if (finalPlacement) filterLabels.push(`Placement: ${finalPlacement}`);

        const displayKeyword = filterLabels.length > 0 ? filterLabels.join(' | ') : "Unified Search";

        res.status(200).json({
            meta: {
                original_query: query,
                extracted_keyword: displayKeyword,
                extracted_keywords: skillTerms,
                detected_year: finalYear,
                count: students.length,
                dbStatus: "Active",
                extracted_intent: {
                    cgpaFilter: finalCgpaValue !== null ? { [isGte ? '$gte' : '$lte']: finalCgpaValue } : null,
                    year: finalYear,
                    placement: finalPlacement
                }
            },
            data: students
        });

    } catch (error) {
        console.error('NLP Search Error:', error);
        res.status(500).json({ message: 'Search failure', error: error.message });
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
            Skills: [s.programmingLanguages, s.skills, s.technicalSkills, s.tools].filter(Boolean).join(', ') || 'None',
            Gender: s.gender || 'Not Specified',
            Sem1: parseFloat(s.sem1_cgpa) || 0,
            Sem2: parseFloat(s.sem2_cgpa) || 0,
            Sem3: parseFloat(s.sem3_cgpa) || 0,
            Sem4: parseFloat(s.sem4_cgpa) || 0,
            Sem5: parseFloat(s.sem5_cgpa) || 0,
            Sem6: parseFloat(s.sem6_cgpa) || 0
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
