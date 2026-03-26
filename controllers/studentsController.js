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

// Helper function to extract multiple intents for compound queries (Hybrid Version)
const extractQueryIntent = (text) => {
    if (!text) return { filters: {}, keywords: [], intentDescriptions: [] };

    const lowerText = text.toLowerCase();
    const filters = {};
    const intentDescriptions = [];
    let remainingText = lowerText;

    // --- 1. PLACEMENT INTEREST ---
    if (lowerText.match(/not\s+(?:interested|willing)\s+(?:in\s+)?placement/i) || 
        lowerText.match(/placement\s+(?:is\s+)?not\s+(?:preferred|interested)/i)) {
        filters.placementInterest = false;
        intentDescriptions.push('Not interested in placement');
        remainingText = remainingText.replace(/not\s+(?:interested|willing)\s+(?:in\s+)?placement/i, '');
        remainingText = remainingText.replace(/placement\s+(?:is\s+)?not\s+(?:preferred|interested)/i, '');
    } else if (lowerText.match(/(?:interested|willing)\s+(?:in\s+)?placement/i)) {
        filters.placementInterest = true;
        intentDescriptions.push('Interested in placement');
        remainingText = remainingText.replace(/(?:interested|willing)\s+(?:in\s+)?placement/i, '');
    }

    // --- 2. YEAR FILTER ---
    const yearMappers = {
        '1st': 1, 'first': 1, '1': 1,
        '2nd': 2, 'second': 2, '2': 2,
        '3rd': 3, 'third': 3, '3': 3,
        '4th': 4, 'fourth': 4, '4': 4
    };

    for (const [key, val] of Object.entries(yearMappers)) {
        const yearRegex = new RegExp(`\\b${key}\\b\\s*year|year\\s*\\b${key}\\b`, 'i');
        if (yearRegex.test(lowerText)) {
            filters.year = val;
            intentDescriptions.push(`NLP Year: ${val}`);
            remainingText = remainingText.replace(yearRegex, '');
            break;
        }
    }

    // --- 3. CGPA FILTER ---
    const betweenCgpa = lowerText.match(/between\s*(\d+(\.\d+)?)\s*and\s*(\d+(\.\d+)?)/i);
    if (betweenCgpa) {
        filters.cgpa = { $gte: betweenCgpa[1], $lte: betweenCgpa[3] };
        intentDescriptions.push(`NLP CGPA: ${betweenCgpa[1]} to ${betweenCgpa[3]}`);
        remainingText = remainingText.replace(betweenCgpa[0], '');
    } else {
        const aboveMatch = lowerText.match(/(?:above|more than|greater than|>)\s*(\d+(\.\d+)?)/i);
        const belowMatch = lowerText.match(/(?:below|less than|smaller than|<)\s*(\d+(\.\d+)?)/i);
        
        if (aboveMatch || belowMatch) {
            filters.cgpa = {};
            if (aboveMatch) {
                filters.cgpa.$gte = aboveMatch[1];
                intentDescriptions.push(`NLP CGPA >= ${aboveMatch[1]}`);
                remainingText = remainingText.replace(aboveMatch[0], '');
            }
            if (belowMatch) {
                filters.cgpa.$lt = belowMatch[1];
                intentDescriptions.push(`NLP CGPA < ${belowMatch[1]}`);
                remainingText = remainingText.replace(belowMatch[0], '');
            }
        }
    }

    // --- 4. SKILLS DETECTION ---
    const skillsToDetect = ['coding', 'python', 'java', 'javascript', 'react', 'node', 'web development', 'sql', 'cpp', 'c++'];
    const detectedSkills = [];
    for (const skill of skillsToDetect) {
        if (lowerText.match(new RegExp(`\\b${skill.replace('+', '\\+')}\\b`, 'i'))) {
            detectedSkills.push(skill);
            // Don't remove from remainingText yet, let keyword search catch it too for broad matching
        }
    }
    if (detectedSkills.length > 0) {
        filters.skills = detectedSkills;
        intentDescriptions.push(`NLP Skills: [${detectedSkills.join(', ')}]`);
    }

    // --- 5. KEYWORD EXTRACTION (Remaining Words) ---
    const commonStopWords = ['students', 'student', 'who', 'with', 'like', 'know', 'having', 'search', 'for', 'find', 'all', 'of', 'the', 'a', 'in', 'at', 'year', 'cgpa', 'above', 'below', 'between', 'interested', 'willing', 'placement', 'not', 'and', 'only'];
    const keywords = remainingText.split(/[\s,]+/)
        .filter(w => w.length > 0 && !commonStopWords.includes(w.toLowerCase()));

    return {
        filters,
        keywords,
        intentDescriptions
    };
};

// Dynamic Hybrid Search System
const naturalLanguageQuery = async (req, res) => {
    try {
        const { query, year, cgpa, placement, skill } = req.body;
        const andConditions = [];

        // 1. EXTRACT NLP INTENT
        const nlp = extractQueryIntent(query);

        // 2. INTEGRATE UI FILTERS (Always Respected)
        if (year) {
            andConditions.push({ yearOfStudy: parseInt(year) });
        }
        if (cgpa) {
            // CGPA is stored as string in schema, but we can search for >=
            // If it's a fixed value from dropdown, we use it directly or as base
            andConditions.push({ cgpa: { $gte: cgpa.toString() } });
        }
        if (placement) {
            // Dropdown might send 'Yes'/'No'
            andConditions.push({ placementWillingness: { $regex: new RegExp(`^${placement}$`, 'i') } });
        }
        if (skill) {
            andConditions.push({
                $or: [
                    { technicalSkills: { $regex: new RegExp(skill, 'i') } },
                    { programmingLanguages: { $regex: new RegExp(skill, 'i') } },
                    { tools: { $regex: new RegExp(skill, 'i') } }
                ]
            });
        }

        // 3. INTEGRATE NLP FILTERS (Merge with UI using $and)
        if (nlp.filters.year) {
            andConditions.push({ yearOfStudy: nlp.filters.year });
        }
        if (nlp.filters.cgpa) {
            andConditions.push({ cgpa: nlp.filters.cgpa });
        }
        if (nlp.filters.placementInterest !== undefined) {
            const pVal = nlp.filters.placementInterest ? 'yes' : 'no';
            andConditions.push({ placementWillingness: { $regex: new RegExp(`^${pVal}$`, 'i') } });
        }
        if (nlp.filters.skills) {
            const skillConditions = nlp.filters.skills.map(s => ({
                $or: [
                    { technicalSkills: { $regex: new RegExp(s, 'i') } },
                    { programmingLanguages: { $regex: new RegExp(s, 'i') } },
                    { tools: { $regex: new RegExp(s, 'i') } }
                ]
            }));
            andConditions.push({ $and: skillConditions });
        }

        // 4. KEYWORD SEARCH (Always Active Across Multiple Fields)
        // Combine raw query words and extracted keywords
        const searchWords = nlp.keywords.length > 0 ? nlp.keywords : (query ? query.split(/\s+/) : []);
        
        if (searchWords.length > 0) {
            const keywordRegex = new RegExp(searchWords.join('|'), 'i');
            andConditions.push({
                $or: [
                    { firstName: keywordRegex },
                    { lastName: keywordRegex },
                    { rollNumber: keywordRegex },
                    { technicalSkills: keywordRegex },
                    { programmingLanguages: keywordRegex },
                    { hobbies: keywordRegex },
                    { sports: keywordRegex },
                    { clubs: keywordRegex },
                    { interest: keywordRegex },
                    { achievements: keywordRegex }
                ]
            });
        }

        // 5. CONSTRUCT FINAL QUERY
        // Fail-safe: If no filters/keywords provided, return all students (best possible match for empty state)
        let mongoQuery = {};
        if (andConditions.length > 0) {
            mongoQuery = { $and: andConditions };
        }

        console.log("Constructed Hybrid Query:", JSON.stringify(mongoQuery, null, 2));

        const students = await Student.find(mongoQuery);

        res.status(200).json({
            meta: {
                original_query: query || "None",
                filters_applied: nlp.intentDescriptions.join(' + ') || "None",
                count: students.length
            },
            data: students
        });

    } catch (error) {
        console.error('Hybrid Search Error:', error);
        res.status(500).json({ 
            message: 'Error processing search system', 
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
            Skills: s.technicalSkills || 'None',
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
