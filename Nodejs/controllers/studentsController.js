const Student = require('../modules/studentModel');

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

// Helper function to extract intention and keyword
const extractQueryIntent = (text) => {
    if (!text) return { type: 'unknown' };

    const lowerText = text.toLowerCase();

    // 1. Check for CGPA / Score queries
    // Patterns: "above 7.5 cgpa", "scored more than 8.0", "cgpa > 8"
    const cgpaPattern = /(?:above|more than|greater than|scored|cgpa)\s*(\d+(\.\d+)?)\s*(?:cgpa|%|percent)?/i;
    const cgpaMatch = lowerText.match(cgpaPattern);

    // Also pattern: "cgpa above 7" (order swapped in first regex but handling explicit "score X" cases)
    const scorePattern = /score(?:d)?\s+(?:above|more than)\s+(\d+(\.\d+)?)/i;
    const scoreMatch = lowerText.match(scorePattern);

    const cgpaValue = cgpaMatch ? cgpaMatch[1] : (scoreMatch ? scoreMatch[1] : null);

    if (cgpaValue) {
        return { type: 'cgpa', value: parseFloat(cgpaValue) };
    }

    // 2. Check for Interest / Skill queries
    // common patterns to look for
    const interestPatterns = [
        /interested in\s+([a-zA-Z0-9\s,\-]+)/,
        /likes?\s+([a-zA-Z0-9\s,\-]+)/,
        /enjoys?\s+([a-zA-Z0-9\s,\-]+)/,
        /loves?\s+([a-zA-Z0-9\s,\-]+)/,
        /who know(?:s)?\s+([a-zA-Z0-9\s,\-]+)/,
        /students who\s+([a-zA-Z0-9\s,\-]+)/,
        /showing\s+([a-zA-Z0-9\s,\-]+)/ // "how showing drawing"
    ];

    let keyword = '';
    for (const pattern of interestPatterns) {
        const match = lowerText.match(pattern);
        if (match && match[1]) {
            keyword = match[1].trim();
            // Remove common stop words if they appear at start (e.g. "students who are interested in...")
            keyword = keyword.replace(/^(are|is)\s+/, '').trim();
            break;
        }
    }

    if (!keyword) {
        // Fallback: assume the whole meaningful part is the keyword if short
        // or just take the last few words. 
        // For "drawing", it's just "drawing".
        // For "coding", it's "coding".
        // If simple one word query:
        if (lowerText.split(' ').length <= 2) {
            keyword = lowerText;
        }
    }

    if (keyword) {
        // Clean up: "drawing, coding" -> try to match any.
        // For now, let's return the raw cleaned keyword
        return { type: 'interest', value: keyword };
    }

    return { type: 'unknown' };
};

// Natural Language Query for Students
// Route: POST /api/students/query
const naturalLanguageQuery = async (req, res) => {
    try {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({ message: 'Query text is required' });
        }

        const intent = extractQueryIntent(query);
        console.log(`Debug: Query="${query}", Intent=`, intent);

        let students = [];

        if (intent.type === 'cgpa') {
            // Filter by CGPA (Assuming CGPA is stored as String in DB based on model)
            // We need to fetch and filter in JS if string format varies, or use regex if format is consistent.
            // Best approach given "String" type: fetch all where cgpa exists, then filter.
            // Or use $expr with $toDouble if Mongo 4.0+.

            // Allow string comparison for standard "X.Y" format.
            // We searched for "above X".
            const minVal = intent.value;

            // Find docs where cgpa is set
            const allStudents = await Student.find({
                cgpa: { $exists: true, $ne: '' }
            });

            students = allStudents.filter(s => {
                const sCgpa = parseFloat(s.cgpa);
                return !isNaN(sCgpa) && sCgpa >= minVal;
            });

        } else if (intent.type === 'interest') {
            const keyword = intent.value;
            // Split keyword by commas or 'and' to allow "drawing and coding" (search ANY)
            const terms = keyword.split(/,| and | or /).map(t => t.trim()).filter(t => t);

            // Build OR query for all terms against all interest fields
            const orConditions = [];

            terms.forEach(term => {
                const regex = new RegExp(term, 'i');
                orConditions.push(
                    { interest: regex },
                    { hobbies: regex }, // Arrays work with regex match on elements
                    { interestedDomain: regex },
                    { programmingLanguages: regex },
                    { technicalSkills: regex },
                    { higherStudiesDetails: regex },
                    { sports: regex }
                );
            });

            if (orConditions.length > 0) {
                students = await Student.find({ $or: orConditions });
            }
        } else {
            return res.status(200).json({
                meta: { original_query: query, count: 0 },
                data: [],
                message: "Could not understand query. Try 'interested in coding' or 'cgpa above 8.0'"
            });
        }

        // Return Response
        res.status(200).json({
            meta: {
                original_query: query,
                extracted_intent: intent,
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

module.exports = {
    loginStudent,
    registerStudent,
    updateStudentProfile,
    getStudentProfile,
    getAllStudents,
    deleteStudent,
    naturalLanguageQuery,
    getAnalytics,
    checkStudentStatus
};
