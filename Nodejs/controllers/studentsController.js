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

        if (student && student.password === password) {
            res.json({
                _id: student._id,
                rollNumber: student.rollNumber,
                username: student.rollNumber,
                name: student.firstName ? `${student.firstName} ${student.lastName}` : student.rollNumber,
                isFirstLogin: student.isFirstLogin,
                role: 'student'
            });
        } else {
            // Check if user exists but wrong password, or user doesn't exist
            // For now specific message
            if (!student) return res.status(404).json({ message: 'Student not found' });
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
            student.password = password;
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
        const newStudent = await Student.create({
            rollNumber,
            password,
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

// Get all students (for Admin/Teachers)
const getAllStudents = async (req, res) => {
    try {
        const students = await Student.find();
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

// Helper function to extract multiple intents for compound queries (STRICT VERSION)
const extractQueryIntent = (text) => {
    if (!text) return { filters: {}, searchField: 'None' };

    const lowerText = text.toLowerCase();
    const filters = {};
    const intentDescriptions = [];

    // --- 1. NEGATIVE CONDITIONS CHECK (Placement Interest) ---
    // Rule: Check "not" condition FIRST
    if (lowerText.match(/not\s+(?:interested|willing)\s+(?:in\s+)?placement/i) || 
        lowerText.match(/placement\s+(?:is\s+)?not\s+(?:preferred|interested)/i)) {
        filters.placementInterest = false;
        intentDescriptions.push('Not interested in placement');
    } else if (lowerText.match(/(?:interested|willing)\s+(?:in\s+)?placement/i)) {
        filters.placementInterest = true;
        intentDescriptions.push('Interested in placement');
    }

    // --- 2. YEAR FILTER ---
    const yearMappers = {
        '1st': 1, 'first': 1, '1': 1,
        '2nd': 2, 'second': 2, '2': 2,
        '3rd': 3, 'third': 3, '3': 3,
        '4th': 4, 'fourth': 4, '4': 4
    };

    for (const [key, val] of Object.entries(yearMappers)) {
        // Match "1st year", "1 year", "year 1", etc.
        const yearRegex = new RegExp(`\\b${key}\\b\\s*year|year\\s*\\b${key}\\b`, 'i');
        if (yearRegex.test(lowerText)) {
            filters.year = val;
            intentDescriptions.push(`Year: ${val}`);
            break;
        }
    }

    // --- 3. CGPA FILTER (Strict Above, Below, Between) ---
    const betweenCgpa = lowerText.match(/between\s*(\d+(\.\d+)?)\s*and\s*(\d+(\.\d+)?)/i);
    if (betweenCgpa) {
        filters.cgpa = { $gte: parseFloat(betweenCgpa[1]), $lte: parseFloat(betweenCgpa[3]) };
        intentDescriptions.push(`CGPA: ${betweenCgpa[1]} to ${betweenCgpa[3]}`);
    } else {
        const aboveMatch = lowerText.match(/(?:above|more than|greater than|>)\s*(\d+(\.\d+)?)/i);
        const belowMatch = lowerText.match(/(?:below|less than|smaller than|<)\s*(\d+(\.\d+)?)/i);
        
        if (aboveMatch || belowMatch) {
            filters.cgpa = {};
            if (aboveMatch) {
                filters.cgpa.$gte = parseFloat(aboveMatch[1]);
                intentDescriptions.push(`CGPA >= ${aboveMatch[1]}`);
            }
            if (belowMatch) {
                filters.cgpa.$lt = parseFloat(belowMatch[1]);
                intentDescriptions.push(`CGPA < ${belowMatch[1]}`);
            }
        }
    }

    // --- 4. SKILLS FILTER ---
    const skillsToDetect = ['coding', 'python', 'java', 'quiz', 'web development', 'javascript'];
    const detectedSkills = [];
    
    for (const skill of skillsToDetect) {
        // Check for negative skill condition first (e.g. "not in coding")
        const negativeRegex = new RegExp(`not\\s+(?:in|interested\\s+in|using)\\s+${skill}`, 'i');
        if (lowerText.match(negativeRegex)) {
            // If negative, we might want to exclude it, but for now we prioritize positive hits 
            // as per user requirement "not in coding" check.
            continue; 
        }

        if (lowerText.match(new RegExp(`\\b${skill}\\b`, 'i'))) {
            detectedSkills.push(skill);
        }
    }

    if (detectedSkills.length > 0) {
        filters.skills = { $in: detectedSkills };
        intentDescriptions.push(`Skills: [${detectedSkills.join(', ')}]`);
    }

    // --- 5. DEPARTMENT (Legacy but maintained) ---
    const departments = ['cs', 'it', 'languages', 'cse', 'ece', 'eee', 'mech'];
    for (const dept of departments) {
        if (lowerText.match(new RegExp(`\\b${dept}\\b`, 'i'))) {
            filters.department = dept.toUpperCase();
            intentDescriptions.push(`Dept: ${dept.toUpperCase()}`);
            break;
        }
    }

    return {
        filters,
        searchField: intentDescriptions.length > 0 ? intentDescriptions.join(' + ') : 'Strict Filter',
        raw: text
    };
};

// Natural Language Query for Students
const naturalLanguageQuery = async (req, res) => {
    try {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({ message: 'Query text is required' });
        }

        const intent = extractQueryIntent(query);
        const { filters, searchField } = intent;

        // Build MongoDB Query Object strictly based on requirements
        const mongoQuery = {};

        // 1. Strict Year Filter
        if (filters.year !== undefined) {
            mongoQuery.year = filters.year;
        }

        // 2. Strict CGPA Filter
        if (filters.cgpa) {
            mongoQuery.cgpa = filters.cgpa;
        }

        // 3. Strict Placement Interest Filter
        if (filters.placementInterest !== undefined) {
            mongoQuery.placementInterest = filters.placementInterest;
        }

        // 4. Strict Skills Filter ($in)
        if (filters.skills) {
            mongoQuery.skills = filters.skills;
        }

        // 5. Department Filter (Legacy support)
        if (filters.department) {
            mongoQuery.department = { $regex: new RegExp(`^${filters.department}$`, 'i') };
        }

        console.log("Final Filter:", mongoQuery);

        // Handle case where NO filters are matched
        if (Object.keys(mongoQuery).length === 0) {
            return res.status(200).json({
                meta: { original_query: query, count: 0 },
                data: [],
                message: "No specific filters detected. Try '3rd year students with cgpa above 8.5'"
            });
        }

        const students = await Student.find(mongoQuery);

        res.status(200).json({
            meta: {
                original_query: query,
                extracted_intent: searchField,
                count: students.length
            },
            data: students
        });

    } catch (error) {
        console.error('NLP Query Error:', error);
        res.status(500).json({ message: 'Internal Server Error processing query' });
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

// --- Forgot Password Flow ---

// 1. Send Reset Email Link
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        // Check if student exists with this email
        const student = await Student.findOne({ email });

        // Generic response to avoid revealing email existence for security
        const genericMessage = "If this email is registered, a reset link has been sent.";

        if (!student) {
            return res.json({ message: genericMessage });
        }

        // Generate Token
        const resetToken = crypto.randomBytes(20).toString('hex');

        // Set Token and Expiry (15 minutes)
        student.resetPasswordToken = resetToken;
        student.resetPasswordExpire = Date.now() + 15 * 60 * 1000;

        await student.save();

        // Send Email (Placeholder Configuration)
        // For production, the user needs to provide REAL SMTP credentials in .env
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER || 'placeholder@gmail.com',
                pass: process.env.EMAIL_PASS || 'placeholder_pass'
            }
        });

        const resetUrl = `${req.get('origin') || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

        const mailOptions = {
            from: process.env.EMAIL_USER || '"Support" <placeholder@gmail.com>',
            to: student.email,
            subject: 'Password Reset Request',
            text: `Click the link below to reset your password. This link expires in 15 minutes.\n\n${resetUrl}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-top: 4px solid #4f46e5; border-radius: 8px;">
                    <h2 style="color: #4f46e5;">Password Reset Request</h2>
                    <p>We received a request to reset the password for your student account associated with this email address.</p>
                    <p>Click the button below to set a new password. If you didn't request this, you can ignore this email.</p>
                    <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0;">Reset Password</a>
                    <p style="color: #666; font-size: 14px;">This link will expire in 15 minutes.</p>
                </div>
            `
        };

        // In development/mock mode, we might not actually send but we log it
        try {
            await transporter.sendMail(mailOptions);
        } catch (mailError) {
            console.warn("Email send failed (likely placeholder credentials):", mailError.message);
            // We don't fail the request here so the user gets the message, but in production this should be handled.
            // For now, return the token in response for EASY TESTING if no email is set up
            if (!process.env.EMAIL_USER) {
                 return res.json({ 
                    message: genericMessage + " (DEBUG: Email not configured. Token is in response)", 
                    debugToken: resetToken 
                 });
            }
        }

        res.json({ message: genericMessage });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 2. Validate Token and Reset Password
const resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ message: 'Token and new password are required' });
        }

        // Find student by valid token and non-expired time
        const student = await Student.findOne({
            resetPasswordToken: token,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!student) {
            return res.status(400).json({ message: 'Invalid or expired link' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        student.password = await bcrypt.hash(password, salt);

        // Clear reset fields
        student.resetPasswordToken = undefined;
        student.resetPasswordExpire = undefined;

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
    resetPassword
};
