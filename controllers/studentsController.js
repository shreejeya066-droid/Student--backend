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
const extractQueryIntent = (text) => {
    if (!text) return { filters: {}, keywords: [], intentDescriptions: [] };

    const lowerText = text.toLowerCase();
    const filters = {};
    const intentDescriptions = [];
    let remainingText = lowerText;

    // 1. CGPA Detection (above/below)
    const aboveMatch = lowerText.match(/(?:above|more than|greater than|>)\s*(\d+(\.\d+)?)/i);
    const belowMatch = lowerText.match(/(?:below|less than|smaller than|<)\s*(\d+(\.\d+)?)/i);
    
    if (aboveMatch) {
       filters.cgpa = filters.cgpa || {};
       filters.cgpa.$gte = Number(aboveMatch[1]);
       intentDescriptions.push(`CGPA >= ${aboveMatch[1]}`);
       remainingText = remainingText.replace(aboveMatch[0], '');
    }
    if (belowMatch) {
       filters.cgpa = filters.cgpa || {};
       filters.cgpa.$lte = Number(belowMatch[1]);
       intentDescriptions.push(`CGPA <= ${belowMatch[1]}`);
       remainingText = remainingText.replace(belowMatch[0], '');
    }

    // 2. Year Detection (1st, 2nd, 3rd year)
    const yearMappers = { '1st': 1, 'first': 1, '1': 1, '2nd': 2, 'second': 2, '2': 2, '3rd': 3, 'third': 3, '3': 3, '4th': 4, 'fourth': 4, '4': 4 };
    for (const [key, val] of Object.entries(yearMappers)) {
        const yearRegex = new RegExp(`\\b${key}\\b\\s*year|year\\s*\\b${key}\\b`, 'i');
        if (yearRegex.test(lowerText)) {
            filters.yearOfStudy = val;
            intentDescriptions.push(`Year: ${val}`);
            remainingText = remainingText.replace(yearRegex, '');
            break;
        }
    }

    // 3. Keyword Stabilization (Remaining Words)
    const connections = ['students', 'student', 'who', 'with', 'and', 'having', 'search', 'for', 'find', 'all', 'of', 'at', 'only', 'in', 'the', 'a'];
    const keywords = remainingText.split(/[\s,]+/)
        .filter(w => w.length > 0 && !connections.includes(w.toLowerCase()));

    return { filters, keywords, intentDescriptions };
};

// Optimized Search Logic (Hybrid UI + NLP + Keyword)
const naturalLanguageQuery = async (req, res) => {
    try {
        const { query, year, cgpa, placement, skill } = req.body;

        // 1. NLP EXTRACTION
        const nlp = extractQueryIntent(query);
        const { filters, keywords } = nlp;

        // DEBUG LOGS
        console.log("------------------- HYBRID SMART SEARCH -------------------");
        console.log("INPUT:", query || "None");
        console.log("UI FILTERS:", { year, cgpa, placement, skill });

        // helper for adding filters
        const buildAndArray = (uiFilters, nlpFilters, searchKeywords) => {
            const arr = [];
            
            // a. UI FILTERS (Priority)
            if (uiFilters.year && uiFilters.year !== 'All') arr.push({ yearOfStudy: parseInt(uiFilters.year) });
            if (uiFilters.cgpa && uiFilters.cgpa !== 'All') arr.push({ cgpa: { $gte: parseFloat(uiFilters.cgpa) } });
            if (uiFilters.placement && uiFilters.placement !== 'All') {
                const pVal = uiFilters.placement === 'Willing' || uiFilters.placement === 'Yes' || uiFilters.placement === 'Interested' ? /yes/i : /no/i;
                arr.push({ placementWillingness: { $regex: pVal } });
            }
            if (uiFilters.skill && uiFilters.skill !== 'All') {
                arr.push({
                    $or: [
                        { skills: { $regex: new RegExp(uiFilters.skill, 'i') } },
                        { technicalSkills: { $regex: new RegExp(uiFilters.skill, 'i') } },
                        { programmingLanguages: { $regex: new RegExp(uiFilters.skill, 'i') } }
                    ]
                });
            }

            // b. NLP FILTERS (Parsed Intents)
            if (nlpFilters.yearOfStudy) arr.push({ yearOfStudy: nlpFilters.yearOfStudy });
            if (nlpFilters.cgpa) arr.push({ cgpa: nlpFilters.cgpa });

            // c. COMPREHENSIVE KEYWORD SEARCH (Broad Fallback)
            if (query && query.trim()) {
                const words = query.trim().split(/\s+/);
                const keywordRegex = new RegExp(words.join('|'), 'i');
                const fullQueryRegex = new RegExp(query.trim(), 'i');

                arr.push({
                    $or: [
                        { firstName: keywordRegex }, { lastName: keywordRegex }, { rollNumber: keywordRegex },
                        { firstName: fullQueryRegex }, { lastName: fullQueryRegex }, // Whole phrase matches
                        { skills: keywordRegex }, { technicalSkills: keywordRegex }, { technicalSkill: keywordRegex },
                        { hobbies: keywordRegex }, { hobby: keywordRegex }, // Plural and singular
                        { interest: keywordRegex }, { interests: keywordRegex },
                        { achievements: keywordRegex }, { certifications: keywordRegex },
                        { programmingLanguages: keywordRegex }, { tools: keywordRegex },
                        { internshipCompany: keywordRegex }, { address: keywordRegex }
                    ]
                });
            }
            return arr;
        };

        const strictQuery = buildAndArray({ year, cgpa, placement, skill }, filters, keywords);
        let finalQueryObject = strictQuery.length > 0 ? { $and: strictQuery } : {};

        let students = await Student.find(finalQueryObject);

        // RELAXED FALLBACK (If Strict search returns 0 and we have UI filters active)
        if (students.length === 0 && (year !== 'All' || cgpa !== 'All' || placement !== 'All' || skill !== 'All') && query) {
            console.log("No strictly matching students. Retrying with keyword search ONLY...");
            const relaxedQuery = buildAndArray({ year: 'All', cgpa: 'All', placement: 'All', skill: 'All' }, filters, keywords);
            const fallbackQuery = relaxedQuery.length > 0 ? { $and: relaxedQuery } : {};
            students = await Student.find(fallbackQuery);
        }

        // Populate metadata for UI
        const extractedKeyword = keywords.length > 0 ? keywords.join(', ') : query;

        res.status(200).json({
            meta: {
                original_query: query || "None",
                extracted_keyword: extractedKeyword || "Smart Search",
                count: students.length
            },
            data: students
        });

    } catch (error) {
        console.error('NLP Search Error:', error);
        res.status(500).json({ message: 'Dynamic search update failed. Reverting to basic mode.' });
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

        // Generic response for security
        const genericMessage = "If the email is registered, OTP has been sent.";

        if (!student) {
            return res.json({ message: genericMessage });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

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
