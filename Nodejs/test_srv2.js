const mongoose = require('mongoose');
async function test() {
    try {
        await mongoose.connect('mongodb+srv://StudentAdmin:Student2026@cluster0.1ndlcni.mongodb.net/school_management', { serverSelectionTimeoutMS: 5000 });
        console.log('SUCCESS_SRV');
        process.exit(0);
    } catch (e) {
        console.log('ERROR_SRV: ' + e.message);
        process.exit(1);
    }
}
test();
