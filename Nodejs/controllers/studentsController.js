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

// Helper function to extract multiple intents for compound queries
const extractQueryIntent = (text) => {
    if (!text) return { filters: {}, searchField: 'None' };

    const lowerText = text.toLowerCase();
    const filters = {};
    const intentDescriptions = [];

    // 1. Department Extractor
    const departments = ['cs', 'it', 'languages', 'cse', 'ece', 'eee', 'mech', 'civil', 'aids', 'aiml'];
    for (const dept of departments) {
        if (lowerText.match(new RegExp(`\\b${dept}\\b`, 'i'))) {
            filters.department = dept.toUpperCase();
            intentDescriptions.push(`Dept: ${dept.toUpperCase()}`);
            break;
        }
    }

    // 2. Year Filter
    const yearMatch = lowerText.match(/(\d+)(?:st|nd|rd|th)?\s*year/);
    if (yearMatch) {
        filters.yearOfStudy = parseInt(yearMatch[1]);
        intentDescriptions.push(`Year: ${filters.yearOfStudy}`);
    }

    // 3. CGPA Extractor (Enhanced: Above, Below, Between)
    const betweenCgpaMatch = lowerText.match(/between\s*(\d+(\.\d+)?)\s*and\s*(\d+(\.\d+)?)/i);
    if (betweenCgpaMatch) {
        filters.minCgpa = parseFloat(betweenCgpaMatch[1]);
        filters.maxCgpa = parseFloat(betweenCgpaMatch[3]);
        intentDescriptions.push(`CGPA: ${filters.minCgpa}-${filters.maxCgpa}`);
    } else {
        const aboveCgpaMatch = lowerText.match(/(?:above|more than|greater than|>)\s*(\d+(\.\d+)?)/i);
        const belowCgpaMatch = lowerText.match(/(?:below|less than|smaller than|<)\s*(\d+(\.\d+)?)/i);
        
        if (aboveCgpaMatch) {
            filters.minCgpa = parseFloat(aboveCgpaMatch[1]);
            intentDescriptions.push(`CGPA > ${filters.minCgpa}`);
        }
        if (belowCgpaMatch) {
            filters.maxCgpa = parseFloat(belowCgpaMatch[1]);
            intentDescriptions.push(`CGPA < ${filters.maxCgpa}`);
        }
    }

    // 4. Placement Status Filter
    if (lowerText.includes('not placed')) {
        filters.placement = 'notPlaced';
        intentDescriptions.push('Status: Not Placed');
    } else if (lowerText.match(/\bplaced\b/i)) {
        filters.placement = 'placed';
        intentDescriptions.push('Status: Placed');
    }

    // 5. Skills Extractor ($in support)
    const skillsToDetect = ['coding', 'python', 'java', 'quiz', 'javascript', 'react', 'node'];
    const detectedSkills = [];
    for (const skill of skillsToDetect) {
        if (lowerText.match(new RegExp(`\\b${skill}\\b`, 'i'))) {
            detectedSkills.push(skill);
        }
    }
    if (detectedSkills.length > 0) {
        filters.skills = detectedSkills;
        intentDescriptions.push(`Skills: [${detectedSkills.join(', ')}]`);
    }

    // 6. Legacy / Other
    if (/(placement|job)\s*(ready|willing)/i.test(lowerText)) {
        filters.placementWillingness = 'Yes';
    }
    if (/higher\s*(studies|education)/i.test(lowerText)) {
        filters.higherStudies = 'Yes';
    }

    let keywordText = lowerText
        .replace(/(\d+)(?:st|nd|rd|th)?\s*year/g, '')
        .replace(/between\s*\d+(\.\d+)?\s*and\s*\d+(\.\d+)?/gi, '')
        .replace(/(?:above|more than|greater than|below|less than|smaller than|>|<)\s*\d+(\.\d+)?/gi, '')
        .replace(/not\s*placed/gi, '')
        .replace(/\bplaced\b/gi, '')
        .replace(/\b(show|me|students|who|are|is|in|from|with|have|has|know|knows|interested|interest|expert|proficient|good at|using|developer|and|the)\b/gi, ' ')
        .trim();

    return {
        filters,
        searchField: intentDescriptions.length > 0 ? intentDescriptions.join(' + ') : 'General Search',
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

        console.log(`Debug: Query="${query}", Extracted=`, filters);

        if (Object.keys(filters).length === 0) {
            return res.status(200).json({
                meta: { original_query: query, count: 0 },
                data: [],
                message: "Could not understand query. Try 'java experts in CSE', 'placement ready', 'higher studies', or 'cgpa above 8.0'"
            });
        }

        // Build MongoDB Query Object based on extracted filters
        const mongoQuery = {};

        // Apply filters
        if (filters.department) {
            mongoQuery.department = { $regex: new RegExp(`^${filters.department}$`, 'i') };
        }

        if (filters.yearOfStudy) {
            mongoQuery.yearOfStudy = filters.yearOfStudy;
        }

        if (filters.placement) {
            // Mapping placement intent to a field 'placement' in DB
            mongoQuery.placement = filters.placement;
        }

        if (filters.skills) {
            // Using $in as requested for skill filters across technical fields
            const skillRegexes = filters.skills.map(s => new RegExp(s, 'i'));
            mongoQuery.$or = mongoQuery.$or || [];
            mongoQuery.$or.push(
                { technicalSkills: { $in: skillRegexes } },
                { programmingLanguages: { $in: skillRegexes } },
                { interestedDomain: { $in: skillRegexes } }
            );
        }

        if (filters.placementWillingness) {
            mongoQuery.$or = mongoQuery.$or || [];
            mongoQuery.$or.push(
                { placementWillingness: { $regex: /yes|ready|willing/i } }
            );
        }

        if (filters.higherStudies) {
            const hsCondition = {
                $or: [
                    { higherStudies: { $regex: /yes|plan|aspir/i } },
                    { higherStudiesDetails: { $exists: true, $ne: '' } }
                ]
            };
            if (mongoQuery.$and) mongoQuery.$and.push(hsCondition);
            else if (mongoQuery.$or) {
                mongoQuery.$and = [{ $or: mongoQuery.$or }, hsCondition];
                delete mongoQuery.$or;
            } else mongoQuery.$or = hsCondition.$or;
        }

        let students = await Student.find(mongoQuery);

        // Secondary Post-filter for CGPA (Safe for String-based CGPA)
        if (filters.minCgpa !== undefined || filters.maxCgpa !== undefined) {
            students = students.filter(s => {
                if (!s.cgpa) return false;
                const sCgpa = parseFloat(s.cgpa);
                if (isNaN(sCgpa)) return false;
                
                let matches = true;
                if (filters.minCgpa !== undefined) matches = matches && sCgpa >= filters.minCgpa;
                if (filters.maxCgpa !== undefined) matches = matches && sCgpa <= filters.maxCgpa;
                return matches;
            });
        }

        res.status(200).json({
            meta: {
                original_query: query,
                extracted_keyword: searchField,
                extracted_intent: filters,
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
    checkStudentStatus
};
