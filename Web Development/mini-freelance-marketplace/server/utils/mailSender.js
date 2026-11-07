import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();
let transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: 465,
    secure: true,
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
    },
});
const mailSender = async (email, title, body) => {
    try {
        let info = await transporter.sendMail({
            from: '"ServiceHive" <mukeshbolisetty09@gmail.com>',
            to: email,
            subject: title,
            html: body,
        });

        console.log("Email sent:", info);
        return info;
    } catch (error) {
        console.error("Error in mailSender:", error.message);
    }
};

export default mailSender;