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
    // E.g., CSE, IT, ECE, EEE, MECH, CIVIL, AIDS, AIML
    const departments = ['cse', 'it', 'ece', 'eee', 'mech', 'civil', 'aids', 'aiml'];
    for (const dept of departments) {
        if (lowerText.match(new RegExp(`\\b${dept}\\b`, 'i'))) {
            filters.department = dept.toUpperCase();
            intentDescriptions.push(`Dept: ${dept.toUpperCase()}`);
            break;
        }
    }

    // 2. CGPA Extractor
    const cgpaPattern = /(?:above|more than|greater than|>)\s*(\d+(\.\d+)?)\s*(?:cgpa|%|percent)?/i;
    const cgpaPatt2 = /cgpa\s*(?:above|more than|>|greater than)?\s*(\d+(\.\d+)?)/i;
    const cgpaMatch = lowerText.match(cgpaPattern) || lowerText.match(cgpaPatt2);
    if (cgpaMatch) {
        filters.minCgpa = parseFloat(cgpaMatch[1]);
        intentDescriptions.push(`CGPA > ${filters.minCgpa}`);
    }

    // 3. Placement Extractor
    if (/(placement|job)\s*(ready|willing)/i.test(lowerText) || /ready for (placement|job)/i.test(lowerText)) {
        filters.placementWillingness = 'Yes';
        intentDescriptions.push('Placement Ready');
    }

    // 4. Higher Studies
    if (/higher\s*(studies|education)/i.test(lowerText) || /(ms|phd|masters)/i.test(lowerText)) {
        filters.higherStudies = 'Yes';
        intentDescriptions.push('Higher Studies');
    }

    // 5. Skills/Keywords Extractor
    let keywordText = lowerText
        .replace(cgpaPattern, '')
        .replace(cgpaPatt2, '')
        .replace(/(placement|job)\s*(ready|willing)/i, '')
        .replace(/ready for (placement|job)/i, '')
        .replace(/higher\s*(studies|education)/i, '')
        .replace(/(ms|phd|masters)/i, '')
        // Remove common stopwords and preposition words
        .replace(/\b(show|me|students|who|are|is|in|from|with|have|has|know|knows|interested|interest|expert|proficient|good at|using|developer|and|the)\b/gi, ' ')
        .trim();

    for (const dept of departments) {
        keywordText = keywordText.replace(new RegExp(`\\b${dept}\\b`, 'i'), '');
    }

    // Clean up extra spaces
    keywordText = keywordText.replace(/\s+/g, ' ').trim();

    if (keywordText.length > 1) {
        filters.keyword = keywordText;
        intentDescriptions.push(`Keywords: "${keywordText}"`);
    }

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

        if (filters.placementWillingness) {
            mongoQuery.$or = mongoQuery.$or || [];
            mongoQuery.$or.push(
                { placementWillingness: { $regex: /yes|ready|willing/i } },
                { interestedDomain: { $exists: true, $ne: '' } }
            );
        }

        if (filters.higherStudies) {
            if (mongoQuery.$or) {
                // Move existing $or to an $and array to avoid overwrite
                mongoQuery.$and = [{ $or: mongoQuery.$or }];
                delete mongoQuery.$or;
                mongoQuery.$and.push({
                    $or: [
                        { higherStudies: { $regex: /yes|plan|aspir/i } },
                        { higherStudiesDetails: { $exists: true, $ne: '' } }
                    ]
                });
            } else {
                mongoQuery.$or = [
                    { higherStudies: { $regex: /yes|plan|aspir/i } },
                    { higherStudiesDetails: { $exists: true, $ne: '' } }
                ];
            }
        }

        if (filters.keyword) {
            const keywords = filters.keyword.split(' ').map(k => k.trim()).filter(k => k);
            if (keywords.length > 0) {
                const keywordRegexes = keywords.map(k => new RegExp(k, 'i'));
                const orConditions = keywordRegexes.flatMap(regex => [
                    { interest: regex },
                    { hobbies: regex },
                    { interestedDomain: regex },
                    { programmingLanguages: regex },
                    { technicalSkills: regex },
                    { tools: regex },
                    { certifications: regex },
                    { higherStudiesDetails: regex },
                    { sports: regex },
                    { prefLocation: regex }
                ]);

                if (mongoQuery.$and) {
                    mongoQuery.$and.push({ $or: orConditions });
                } else if (mongoQuery.$or) {
                    mongoQuery.$and = [{ $or: mongoQuery.$or }, { $or: orConditions }];
                    delete mongoQuery.$or;
                } else {
                    mongoQuery.$or = orConditions;
                }
            }
        }

        let students = await Student.find(mongoQuery);

        // Post-filter for CGPA
        if (filters.minCgpa !== undefined) {
            students = students.filter(s => {
                if (!s.cgpa) return false;
                const sCgpa = parseFloat(s.cgpa);
                return !isNaN(sCgpa) && sCgpa >= filters.minCgpa;
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
