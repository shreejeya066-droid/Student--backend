const twilio = require('twilio');
const Student = require('../modules/studentModel');

// Storage for OTPs (In-memory for now)
const otpStore = new Map();

const sendOTP = async (req, res) => {
    const { rollNumber } = req.body;
    try {
        const student = await Student.findOne({ rollNumber });
        if (!student) {
            return res.status(404).json({ message: 'Roll Number not found' });
        }

        // Use the mobile number from the profile, fallback to 'mobile' field
        const phoneNumber = student.mobile || student.phone;
        if (!phoneNumber) {
            return res.status(400).json({ message: 'No mobile number registered for this student. Please contact admin.' });
        }

        const otp = Math.floor(1000 + Math.random() * 9000); // 4-digit OTP
        otpStore.set(rollNumber, { otp, expires: Date.now() + 300000 }); // 5 minutes expiry

        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        
        // Ensure phone number has international format
        let targetPhone = phoneNumber.toString().trim();
        if (!targetPhone.startsWith('+')) {
            // Assume India (+91) if digits only and length is standard (10)
            if (targetPhone.length === 10) {
                targetPhone = `+91${targetPhone}`;
            }
        }

        await client.messages.create({
            body: `Your EduManage verification code is: ${otp}`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: targetPhone
        });

        console.log(`OTP ${otp} sent to ${targetPhone} for ${rollNumber}`);
        res.status(200).json({ success: true, message: 'OTP sent successfully' });
    } catch (error) {
        console.error('Twilio SMS Error:', error);
        res.status(500).json({ message: 'Failed to send SMS: ' + error.message });
    }
};

const verifyOTP = async (req, res) => {
    const { rollNumber, otp } = req.body;
    const record = otpStore.get(rollNumber);

    if (!record) {
        return res.status(400).json({ message: 'No OTP requested for this roll number' });
    }

    if (Date.now() > record.expires) {
        otpStore.delete(rollNumber);
        return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    if (parseInt(otp) === record.otp) {
        otpStore.delete(rollNumber); // Single use
        res.status(200).json({ success: true });
    } else {
        res.status(400).json({ message: 'Invalid OTP code' });
    }
};

module.exports = {
    sendOTP,
    verifyOTP
};
