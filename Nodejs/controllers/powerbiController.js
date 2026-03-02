const Student = require('../modules/studentModel');

// Fetch all student data for Power BI
exports.getPowerBiData = async (req, res) => {
    try {
        // Fetch all students. 
        // We select specific fields that are useful for visualization.
        // You can add or remove fields based on what you want to show in Power BI.
        const students = await Student.find({}, {
            name: 1,
            registerNumber: 1,
            department: 1,
            year: 1,
            section: 1,
            cgpa: 1,
            arrears: 1,
            placementStatus: 1,
            technicalSkills: 1,
            softSkills: 1,
            attendancePercentage: 1,
            createdAt: 1
        });

        res.status(200).json({
            success: true,
            count: students.length,
            data: students
        });
    } catch (error) {
        console.error('Error fetching data for Power BI:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching Power BI data'
        });
    }
};
