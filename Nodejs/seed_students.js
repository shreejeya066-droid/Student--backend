require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('./modules/studentModel');

const sampleStudents = [
    {
        rollNumber: '23BIT01',
        password: 'password123',
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'alice@example.com',
        department: 'Information Technology',
        yearOfStudy: 2,
        cgpa: '8.5',
        interest: 'Drawing and sketching',
        hobbies: ['Drawing', 'Reading'],
        technicalSkills: 'Python, Java',
        placementWillingness: 'Yes',
        isFirstLogin: false
    },
    {
        rollNumber: '23BIT02',
        password: 'password123',
        firstName: 'Bob',
        lastName: 'Smith',
        email: 'bob@example.com',
        department: 'Information Technology',
        yearOfStudy: 2,
        cgpa: '7.8',
        interest: 'Coding in C++',
        hobbies: ['Coding', 'Gaming'],
        technicalSkills: 'C++, DSA',
        placementWillingness: 'Yes',
        isFirstLogin: false
    },
    {
        rollNumber: '23BCS01',
        password: 'password123',
        firstName: 'Charlie',
        lastName: 'Brown',
        email: 'charlie@example.com',
        department: 'Computer Science',
        yearOfStudy: 3,
        cgpa: '9.2',
        interest: 'Web Development and React',
        hobbies: ['Cycling', 'Web Dev'],
        technicalSkills: 'JavaScript, React, Node.js',
        higherStudies: 'Yes',
        higherStudiesDetails: 'MS in Data Science',
        isFirstLogin: false
    },
    {
        rollNumber: '23BCS02',
        password: 'password123',
        firstName: 'David',
        lastName: 'Wilson',
        email: 'david@example.com',
        department: 'Computer Science',
        yearOfStudy: 3,
        cgpa: '6.5',
        interest: 'Playing Football',
        hobbies: ['Football', 'Music'],
        sports: 'Football',
        technicalSkills: 'Basics of Python',
        placementWillingness: 'No',
        isFirstLogin: false
    },
    {
        rollNumber: '23BEC01',
        password: 'password123',
        firstName: 'Eve',
        lastName: 'Davis',
        email: 'eve@example.com',
        department: 'Electronics',
        yearOfStudy: 4,
        cgpa: '8.9',
        interest: 'Embedded Systems and Robotics',
        hobbies: ['Robotics', 'Chess'],
        technicalSkills: 'C, Arduino, Raspberry Pi',
        placementWillingness: 'Yes',
        interestedDomain: 'Embedded Systems',
        isFirstLogin: false
    }
];

const seedStudents = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB for seeding students...');

        // Clear existing students
        await Student.deleteMany({ rollNumber: { $in: sampleStudents.map(s => s.rollNumber) } });
        console.log('Cleared existing sample students.');

        // Insert new students
        await Student.insertMany(sampleStudents);
        console.log('Sample students seeded successfully!');

        process.exit(0);
    } catch (error) {
        console.error('Error seeding students:', error);
        process.exit(1);
    }
};

seedStudents();
