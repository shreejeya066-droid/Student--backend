const Student = require('../modules/studentModel');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

// Login Student
const loginStudent = async (req, res) => {
    try {
        const { rollNumber, password } = req.body;
        const student = await Student.findOne({ rollNumber });
        if (!student) return res.status(404).json({ message: 'Student not found' });
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

const checkStudentStatus = async (req, res) => {
    try {
        const { rollNumber } = req.body;
        const student = await Student.findOne({ rollNumber });
        if (!student) return res.json({ exists: false, hasPassword: false });
        const hasPassword = !!student.password && student.password.length > 0;
        res.json({ exists: true, hasPassword });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const registerStudent = async (req, res) => {
    try {
        const { rollNumber, password, firstName, lastName, email, phone, mobile, altMobile, department, yearOfStudy } = req.body;
        const student = await Student.findOne({ rollNumber });
        if (student) {
            if (student.password && student.password.length > 0) return res.status(400).json({ message: 'Account already active' });
            const salt = await bcrypt.genSalt(10);
            student.password = await bcrypt.hash(password, salt);
            student.isFirstLogin = false;
            Object.assign(student, { firstName, lastName, email, phone, mobile, altMobile, department, yearOfStudy });
            await student.save();
            return res.status(200).json({ message: 'Password set successfully', _id: student._id, rollNumber: student.rollNumber });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const newStudent = await Student.create({ rollNumber, password: hashedPassword, isFirstLogin: false, firstName, lastName, email, phone, mobile, altMobile, department, yearOfStudy });
        res.status(201).json({ _id: newStudent._id, rollNumber: newStudent.rollNumber });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateStudentProfile = async (req, res) => {
    try {
        const { rollNumber } = req.params;
        const student = await Student.findOneAndUpdate({ rollNumber }, req.body, { new: true });
        if (!student) return res.status(404).json({ message: 'Student not found' });
        res.json(student);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getStudentProfile = async (req, res) => {
    try {
        const { rollNumber } = req.params;
        const student = await Student.findOne({ rollNumber });
        if (!student) return res.status(404).json({ message: 'Student not found' });
        res.json(student);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getAllStudents = async (req, res) => {
    try {
        const students = await Student.find({});
        res.status(200).json(students);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteStudent = async (req, res) => {
    try {
        const student = await Student.findOneAndDelete({ rollNumber: req.params.rollNumber });
        if (!student) return res.status(404).json({ message: 'Student not found' });
        res.json({ message: 'Student removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Optimized Intent Extractor
const extractQueryIntent = (text) => {
    if (!text) return { yearOfStudy: null, keywords: [], cgpaFilter: null, placementWillingness: null };
    let normalized = text.toLowerCase().trim();
    let yearOfStudy = null;
    let cgpaFilter = null;
    let placementWillingness = null;

    const aboveMatch = normalized.match(/(?:above|more than|greater than|>|>=)\s*(\d+(\.\d+)?)/i);
    const belowMatch = normalized.match(/(?:below|less than|smaller than|<|<=)\s*(\d+(\.\d+)?)/i);
    if (aboveMatch) {
        cgpaFilter = { $gte: Number(aboveMatch[1]) };
        normalized = normalized.replace(aboveMatch[0], ' ');
    } else if (belowMatch) {
        cgpaFilter = { $lte: Number(belowMatch[1]) };
        normalized = normalized.replace(belowMatch[0], ' ');
    }

    const yearMatch = normalized.match(/(\d)(?:st|nd|rd|th)?\s*year/i);
    if (yearMatch) {
        yearOfStudy = parseInt(yearMatch[1]);
        normalized = normalized.replace(yearMatch[0], ' ');
    } else {
        const yearMappers = { 'first year': 1, 'second year': 2, 'third year': 3, 'fourth year': 4, 'final year': 4 };
        for (const [phrase, year] of Object.entries(yearMappers)) {
            if (normalized.includes(phrase)) {
                yearOfStudy = year;
                normalized = normalized.replace(phrase, ' ');
                break;
            }
        }
    }

    if (normalized.match(/placement ready|placed|ready for placement|willing for placement/i)) {
        placementWillingness = 'yes';
        normalized = normalized.replace(/placement ready|placed|ready for placement|willing for placement/i, ' ');
    }

    const fillerWords = ["students", "student", "who", "with", "and", "the", "in", "like", "for", "matching", "having", "is", "are", "cgpa", "year", "placement", "willing", "ready", "skill", "skills", "knowing", "above", "below", "more", "than", "greater", "less", "of", "all"];
    const keywords = normalized.split(/[\s,]+/).filter(word => word.trim().length > 1 && !fillerWords.includes(word.trim()));
    return { yearOfStudy, keywords, cgpaFilter, placementWillingness };
};

const naturalLanguageQuery = async (req, res) => {
    try {
        const { query, year, cgpa, placement, skill } = req.body;
        if ((!query || query.trim() === '') && !year && !cgpa && !placement && !skill) {
            const allStudents = await Student.find({});
            return res.status(200).json({
                meta: { count: allStudents.length, extracted_keyword: "All Students", dbStatus: "Connected", extracted_intent: {} },
                data: allStudents
            });
        }

        const intent = extractQueryIntent(query || '');
        const { yearOfStudy: textYear, keywords, cgpaFilter: textCgpa, placementWillingness: textPlacement } = intent;
        const searchFields = ['firstName', 'lastName', 'rollNumber', 'skills', 'technicalSkills', 'technicalSkill', 'hobbies', 'hobby', 'sports', 'clubs', 'interests', 'interest', 'achievements', 'certifications', 'programmingLanguages', 'address', 'events', 'tools'];
        let andConditions = [];

        // Priority logic: NLP text parsed data wins over dropdown if exists
        const finalYear = textYear || (year && year !== 'All' ? Number(year) : null);
        const finalCgpaMin = (textCgpa && textCgpa.$gte) || (cgpa && cgpa !== 'All' ? parseFloat(cgpa) : null);
        const finalPlacement = textPlacement || (placement && placement !== 'All' ? (placement === 'Interested' ? 'yes' : 'no') : null);

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
        if (finalCgpaMin) {
            andConditions.push({
                $or: [
                    { $expr: { $gte: [{ $convert: { input: "$cgpa", to: "double", onError: null, onNull: null } }, finalCgpaMin] } },
                    { cgpa: { $gte: finalCgpaMin } }
                ]
            });
        }
        if (finalPlacement) {
            andConditions.push({ placementWillingness: { $regex: new RegExp(finalPlacement, 'i') } });
        }
        if (skill && skill !== 'All') {
            const skillRegex = new RegExp(skill, 'i');
            andConditions.push({ $or: [{ skills: { $regex: skillRegex } }, { technicalSkills: { $regex: skillRegex } }, { programmingLanguages: { $regex: skillRegex } }, { tools: { $regex: skillRegex } }] });
        }

        // Only add keyword search if there are actual keywords left after parsing structured intents
        if (keywords.length > 0) {
            let keywordOr = [];
            keywords.forEach(word => {
                const regex = new RegExp(word, 'i');
                searchFields.forEach(field => {
                    keywordOr.push({ [field]: { $regex: regex } });
                });
            });
            if (keywordOr.length > 0) andConditions.push({ $or: keywordOr });
        }

        let mongoQuery = andConditions.length > 0 ? (andConditions.length > 1 ? { $and: andConditions } : andConditions[0]) : {};
        console.log("Executing Query:", JSON.stringify(mongoQuery));
        const students = await Student.find(mongoQuery);

        res.status(200).json({
            meta: {
                original_query: query,
                extracted_keyword: keywords.join(', ') || "Full Filter Match",
                extracted_keywords: keywords,
                detected_year: finalYear,
                count: students.length,
                dbStatus: "Active",
                extracted_intent: { minCgpa: finalCgpaMin, year: finalYear, placement: finalPlacement }
            },
            data: students
        });
    } catch (error) {
        console.error('NLP Search Error:', error);
        res.status(500).json({ message: 'Search system encountered an error.', error: error.message });
    }
};

const getAnalytics = async (req, res) => {
    try {
        const students = await Student.find({}, 'department attendance cgpa');
        const perfMap = {};
        students.forEach(s => {
            if (!s.department || !s.cgpa) return;
            const cgpa = parseFloat(s.cgpa) || 0;
            if (!perfMap[s.department]) perfMap[s.department] = { sum: 0, count: 0 };
            perfMap[s.department].sum += cgpa;
            perfMap[s.department].count++;
        });
        const performanceData = Object.keys(perfMap).map(dept => ({
            name: dept,
            avgCGPA: (perfMap[dept].sum / perfMap[dept].count).toFixed(2)
        }));
        let distribution = [{ name: '> 90%', value: 0 }, { name: '75-90%', value: 0 }, { name: '< 75%', value: 0 }];
        students.forEach(s => {
            const att = s.attendance || 0;
            if (att > 90) distribution[0].value++;
            else if (att >= 75) distribution[1].value++;
            else distribution[2].value++;
        });
        res.json({ performance: performanceData, attendanceDistribution: distribution });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getPowerBIData = async (req, res) => {
    try {
        const students = await Student.find({});
        res.status(200).json(students.map(s => ({
            RollNumber: s.rollNumber,
            Name: s.firstName ? `${s.firstName} ${s.lastName}` : s.rollNumber,
            Department: s.department || 'Unknown',
            Year: s.yearOfStudy || 1,
            CGPA: parseFloat(s.cgpa) || 0,
            Attendance: s.attendance || 0,
            PlacementWillingness: s.placementWillingness || 'No',
            HigherStudies: s.higherStudies || 'No',
            Skills: s.technicalSkills || s.skills || 'None',
            Gender: s.gender || 'Not Specified'
        })));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const student = await Student.findOne({ email });
        const genericMessage = "If the email is registered, OTP has been sent.";
        if (!student) return res.json({ message: genericMessage });
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        student.otp = otp;
        student.otpExpiry = Date.now() + 5 * 60 * 1000;
        await student.save();
        const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
        const mailOptions = { from: process.env.EMAIL_USER, to: student.email, subject: 'Your OTP for Password Reset', text: `Your OTP for password reset is: ${otp}` };
        try { await transporter.sendMail(mailOptions); } catch (e) { console.error("Email fail:", e.message); }
        res.json({ message: genericMessage });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const student = await Student.findOne({ email, otp, otpExpiry: { $gt: Date.now() } });
        if (!student) return res.status(400).json({ message: 'Invalid OTP or expired' });
        res.json({ message: 'OTP verified successfully', success: true });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { email, otp, password } = req.body;
        const student = await Student.findOne({ email, otp, otpExpiry: { $gt: Date.now() } });
        if (!student) return res.status(400).json({ message: 'Action unauthorized' });
        const salt = await bcrypt.genSalt(10);
        student.password = await bcrypt.hash(password, salt);
        student.otp = undefined;
        student.otpExpiry = undefined;
        await student.save();
        res.json({ message: 'Password reset successful.', success: true });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    loginStudent, registerStudent, updateStudentProfile, getStudentProfile, getAllStudents, deleteStudent,
    naturalLanguageQuery, getAnalytics, getPowerBIData, checkStudentStatus, forgotPassword, verifyOTP, resetPassword
};
