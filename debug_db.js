require('dotenv').config();
const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Force Google DNS to bypass network restrictions

const studentSchema = mongoose.Schema({
    rollNumber: String,
    yearOfStudy: Number,
    cgpa: String,
    firstName: String,
    lastName: String
});

const Student = mongoose.model('Student', studentSchema);

const fs = require('fs');
const debug = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        let out = "Connected to MongoDB.\n";

        const total = await Student.countDocuments({});
        out += `Total Students: ${total}\n`;

        const thirdYear = await Student.countDocuments({ yearOfStudy: 3 });
        out += `3rd Year Students: ${thirdYear}\n`;

        const above8 = await Student.find({ }).then(docs => docs.filter(s => parseFloat(s.cgpa || 0) >= 8));
        out += `Students with CGPA >= 8: ${above8.length}\n`;

        const both = await Student.find({ yearOfStudy: 3 }).then(docs => docs.filter(s => parseFloat(s.cgpa || 0) >= 8));
        out += `3rd Year Students with CGPA >= 8: ${both.length}\n`;

        if (both.length > 0) {
            out += `Example Match: ${both[0].firstName} ${both[0].lastName} CGPA: ${both[0].cgpa} Year: ${both[0].yearOfStudy}\n`;
        } else {
            out += "NO MATCHES FOUND FOR BOTH.\n";
            const samples = await Student.find({ yearOfStudy: 3 }).limit(5);
            out += `Sample 3rd Year: ${JSON.stringify(samples.map(s => ({ name: s.firstName, cgpa: s.cgpa })), null, 2)}\n`;
        }

        fs.writeFileSync('d:\\Learn\\Nodejs\\debug_output.txt', out);
        console.log("Done. Results in debug_output.txt");
        process.exit(0);
    } catch (err) {
        fs.writeFileSync('d:\\Learn\\Nodejs\\debug_output.txt', "Error: " + err.message);
        console.error("Error:", err.message);
        process.exit(1);
    }
};

debug();
