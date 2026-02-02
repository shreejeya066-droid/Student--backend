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
    const cgpaPattern = /(?:above|more than|greater than|scored|cgpa)\s*(\d+(\.\d+)?)\s*(?:cgpa|%|percent)?/i;
    const cgpaMatch = lowerText.match(cgpaPattern);

    const scorePattern = /score(?:d)?\s+(?:above|more than)\s+(\d+(\.\d+)?)/i;
    const scoreMatch = lowerText.match(scorePattern);

    const cgpaValue = cgpaMatch ? cgpaMatch[1] : (scoreMatch ? scoreMatch[1] : null);

    if (cgpaValue) {
        return { type: 'cgpa', value: parseFloat(cgpaValue) };
    }

    // 2. PLACEMENT Readiness
    if (lowerText.includes('placement') || lowerText.includes('ready for job') || lowerText.includes('hired') || lowerText.includes('placed')) {
        let value = 'Yes'; // Default to "Yes" / "Ready"

        // Check for specific placement statuses if schema supports enum
        if (lowerText.includes('not')) value = 'No';

        return { type: 'placement', value: value };
    }

    // 3. HIGHER STUDIES
    if (lowerText.includes('higher stud') || lowerText.includes('masters') || lowerText.includes('phd') || lowerText.includes('ms')) {
        return { type: 'higherStudies', value: 'Yes' };
    }

    // 4. TECH LANGUAGES / SKILLS (Explicit "knows X" or "expert in X")
    // Or just checking if known languages appear
    const skillIndicators = ['knows', 'expert', 'proficient', 'using', 'developer'];
    const knownLangs = ['java', 'python', 'c++', 'javascript', 'react', 'node', 'sql', 'html', 'css', 'aws', 'docker'];

    // Check if query contains a known language directly
    for (const lang of knownLangs) {
        if (lowerText.split(/[\s,]+/).includes(lang)) {
            return { type: 'skill', value: lang };
        }
    }

    // 5. Check for Interest / Hobbies / General Patterns
    const interestPatterns = [
        /interested in\s+([a-zA-Z0-9\s,\-]+)/,
        /likes?\s+([a-zA-Z0-9\s,\-]+)/,
        /enjoys?\s+([a-zA-Z0-9\s,\-]+)/,
        /loves?\s+([a-zA-Z0-9\s,\-]+)/,
        /who know(?:s)?\s+([a-zA-Z0-9\s,\-]+)/,
        /students who\s+([a-zA-Z0-9\s,\-]+)/,
        /showing\s+([a-zA-Z0-9\s,\-]+)/
    ];

    let keyword = '';
    for (const pattern of interestPatterns) {
        const match = lowerText.match(pattern);
        if (match && match[1]) {
            keyword = match[1].trim();
            keyword = keyword.replace(/^(are|is)\s+/, '').trim();
            break;
        }
    }

    if (!keyword) {
        // Fallback for simple queries
        if (lowerText.split(' ').length <= 3) {
            // Remove common stopwords
            const stopWords = ['show', 'me', 'students', 'who', 'are', 'is', 'ready', 'for'];
            const words = lowerText.split(' ').filter(w => !stopWords.includes(w));
            if (words.length > 0) keyword = words.join(' ');
        }
    }

    if (keyword) {
        return { type: 'general_search', value: keyword };
    }

    return { type: 'unknown' };
};

// Natural Language Query for Students
const naturalLanguageQuery = async (req, res) => {
    try {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({ message: 'Query text is required' });
        }

        const intent = extractQueryIntent(query);
        console.log(`Debug: Query="${query}", Intent=`, intent);

        let students = [];
        let searchField = 'General Search';

        if (intent.type === 'cgpa') {
            searchField = `CGPA > ${intent.value}`;
            const minVal = intent.value;
            const allStudents = await Student.find({
                cgpa: { $exists: true, $ne: '' }
            });
            students = allStudents.filter(s => {
                const sCgpa = parseFloat(s.cgpa);
                return !isNaN(sCgpa) && sCgpa >= minVal;
            });

        } else if (intent.type === 'placement') {
            searchField = 'Placement Readiness';
            // Search in placementWillingness or just checking who filled career details
            students = await Student.find({
                $or: [
                    { placementWillingness: { $regex: /yes|ready|willing/i } },
                    { interestedDomain: { $exists: true, $ne: '' } } // Broad check for career active students
                ]
            });

        } else if (intent.type === 'higherStudies') {
            searchField = 'Higher Studies Aspirants';
            students = await Student.find({
                $or: [
                    { higherStudies: { $regex: /yes|plan|aspir/i } },
                    { higherStudiesDetails: { $exists: true, $ne: '' } }
                ]
            });

        } else if (intent.type === 'skill') {
            searchField = `Skill: ${intent.value}`;
            const regex = new RegExp(intent.value, 'i');
            students = await Student.find({
                $or: [
                    { programmingLanguages: regex },
                    { technicalSkills: regex },
                    { tools: regex },
                    { certifications: regex },
                    { interest: regex } // Fallback
                ]
            });

        } else if (intent.type === 'general_search' || intent.type === 'interest') {
            const keyword = intent.value;
            searchField = `Keyword: ${keyword}`;

            const terms = keyword.split(/,| and | or /).map(t => t.trim()).filter(t => t);
            const orConditions = [];

            terms.forEach(term => {
                const regex = new RegExp(term, 'i');
                orConditions.push(
                    { interest: regex },
                    { hobbies: regex },
                    { interestedDomain: regex },
                    { programmingLanguages: regex },
                    { technicalSkills: regex },
                    { higherStudiesDetails: regex },
                    { sports: regex },
                    { prefLocation: regex },
                    { department: regex } // Adding Dept search too
                );
            });

            if (orConditions.length > 0) {
                students = await Student.find({ $or: orConditions });
            }
        } else {
            return res.status(200).json({
                meta: { original_query: query, count: 0 },
                data: [],
                message: "Could not understand query. Try 'java experts', 'placement ready', 'higher studies', or 'cgpa above 8.0'"
            });
        }

        res.status(200).json({
            meta: {
                original_query: query,
                extracted_keyword: searchField, // Frontend expects this key
                extracted_intent: intent, // Send full intent object for UI logic
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
