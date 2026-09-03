const nodemailer = require("nodemailer");

const hasEmailConfig = () =>
    process.env.EMAIL_HOST &&
    process.env.EMAIL_PORT &&
    process.env.EMAIL_USER &&
    process.env.EMAIL_PASS &&
    process.env.EMAIL_FROM;

const sendOtpEmail = async ({ to, otp }) => {
    if (!hasEmailConfig()) {
        console.log("OTP email skipped; email configuration is incomplete.");
        return { skipped: true };
    }

    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT),
        secure: Number(process.env.EMAIL_PORT) === 465,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to,
        subject: "Digital Health Record OTP Verification",
        text: `Your OTP code is ${otp}. It expires in 10 minutes.`,
    });

    return { skipped: false };
};

const sendEmail = async ({ to, subject, text }) => {
    if (!hasEmailConfig()) {
        console.log("Email skipped; email configuration is incomplete.");
        return { skipped: true };
    }

    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT),
        secure: Number(process.env.EMAIL_PORT) === 465,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to,
        subject,
        text,
    });

    return { skipped: false };
};

module.exports = { sendOtpEmail, sendEmail };
