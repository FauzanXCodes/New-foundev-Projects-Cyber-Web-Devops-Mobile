import { OTP } from '../models/OTP.js'
import bcrypt from "bcrypt";
import otpGenerator from 'otp-generator';
import uniqid from 'uniqid';
import jwt from "jsonwebtoken";
import dotenv from "dotenv"
dotenv.config()
import { respond } from '../utils/respond.js';
import { Freelancer } from '../models/Freelancer.js';
import { ForgotPassword } from '../models/ForgotPassword.js';
import { Client } from '../models/Client.js';
import { forgototpTemplate } from '../mail/forgotVerificationTemplate.js';
import { otpTemplate } from '../mail/emailVerificationTemplate.js';
import { sendUserUpdater } from '../middlewares/ServerSentUpdates.js';
import mailSender from '../utils/mailSender.js';
const tokenGenerator = async (email, sessionId) => {
    const payload = {
        email,
        sessionId
    };
    const newtoken = jwt.sign(payload, process.env.JWT_SECRET);
    return newtoken;
}

const sendOtp = async (email) => {
    try {
        const checkUserPresent = await Freelancer.findOne({ email }) || await Client.findOne({ email });
        if (checkUserPresent) {
            await OTP.deleteMany({ email });
            const otpConfig = {
                upperCaseAlphabets: false,
                lowerCaseAlphabets: false,
                specialChars: false,
                digits: true
            };
            let otp = otpGenerator.generate(6, otpConfig);
            const otpPayload = { email, otp };
            const otpBody = await OTP.create(otpPayload);
            console.log(otpBody)
            if (otpBody) {
                await mailSender(email, "Verification email send by ServiceHive", otpTemplate(otp));
            }
            return otp;
        } else {
            return 'Error Occured'
        }

    } catch (error) {
        console.log("ERROR IN AUTH : ", error);
        return error.message
    }

}

export const signup = async (req, res) => {
    try {
        const { username, email, phoneNumber, gender, password, usertype } = req.body;
        const allowedFields = ['username', 'email', 'phoneNumber', 'gender', 'password', 'usertype'];
        const receivedFields = Object.keys(req.body);
        const unknownFields = receivedFields.filter(field => !allowedFields.includes(field));

        if (unknownFields.length > 0) {
            return respond(res, "Denied", 400, false);
        }
        if (!username || !phoneNumber || !email || !gender || !password || !usertype) {
            return res.status(400).json({
                success: false,
                message: "All fields are required",
            })
        }

        if (password.length < 8) {
            return respond(res, "Password must be at least 8 characters long", 400, false);
        }

        const mail = email.trim().toLowerCase()
        const existingUsers = await Freelancer.findOne({ email: mail }).select("email") || await Client.findOne({ email: mail }).select("email");
        if (existingUsers) {
            return respond(res, "User already exists. Try to login.", 400, false);
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const uid = uniqid()
        const freshtoken = await tokenGenerator(mail, uid)
        const phone = parseInt(phoneNumber)
        if (usertype === "freelancer") {
            await Freelancer.create({
                token: freshtoken, sessionId: uid, username, email: mail, phoneNumber: phone, password: hashedPassword, gender, verified: false
            })
        } else if (usertype === "client") {
            await Client.create({
                token: freshtoken, sessionId: uid, username, email: mail, phoneNumber: phone, password: hashedPassword, gender, verified: false
            })
        } else {
            return respond(res, "User cannot be registered. Please try again", 500, false);
        }
        const recentOtp = await OTP.find({ email: mail }).sort({ createdAt: -1 }).limit(1);

        if (recentOtp.length == 0) {
            const otp = await sendOtp(mail);
            if (!otp || typeof otp !== 'string' || otp.includes("Error")) {
                return respond(res, "Error Occured", 500, false);
            }
        }

        return res.status(200).json({
            success: true,
            message: "user_registered",
        });

    } catch (error) {
        console.log(error)
        return respond(res, "User cannot be registered. Please try again", 500, false);
    }
}

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return respond(res, "All fields are required", 400, false);
        }
        const lowerdemail = email.trim().toLowerCase()
        const UserSchema = await Freelancer.findOne({ email: lowerdemail }).select("email token password verified") || await Client.findOne({ email: lowerdemail }).select("email token password verified")
        if (!UserSchema) {
            return respond(res, "Invalid User Details!", 400, false);
        } else if (UserSchema?.verified !== true) {
            const recentOtp = await OTP.find({ email: lowerdemail }).sort({ createdAt: -1 }).limit(1);
            //validate otp
            if (recentOtp.length == 0) {
                const otp = await sendOtp(lowerdemail);
                if (!otp || typeof otp !== 'string' || otp.includes("Error")) {
                    return respond(res, "Error Occured", 500, false);
                }
            }
            return respond(res, "verificationrequired", 200, false);
        } else {
            if (await bcrypt.compare(password, UserSchema.password)) {
                res.cookie("token", UserSchema.token, {
                    httpOnly: true,
                    secure: true,
                    sameSite: 'none',
                    maxAge: 7 * 24 * 60 * 60 * 1000
                });

                return res.status(200).json({
                    success: true,
                    message: "userlogin",
                    UserSchema: UserSchema.email
                });

            } else {
                return respond(res, "Email or Password Incorrect!", 400, false);
            }
        }
    } catch (error) {
        console.log(error)
        return respond(res, "Error Occured", 500, false);
    }
}

export const verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || email.trim() === '') {
            return res.status(400).json({
                success: false,
                message: "Mail is required"
            });
        }
        if (!otp || otp.trim() === '') {
            return res.status(400).json({
                success: false,
                message: "Otp is required"
            });
        }
        const lowerdemail = email.trim().toLowerCase();
        const checkUserPresent = await Freelancer.findOne({ email: lowerdemail }) || await Client.findOne({ email: lowerdemail });
        if (checkUserPresent) {
            const recentOtp = await OTP.find({ email: lowerdemail }).sort({ createdAt: -1 }).limit(1);
            if (recentOtp.length == 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid OTP"
                });
            } else if (recentOtp[0].otp == otp) {
                const user = await Freelancer.findOne({ email: lowerdemail }).select("email token verified") || await Client.findOne({ email: lowerdemail }).select("email token verified");
                if (user) {
                    user.verified = true;
                    await user.save();
                    await OTP.deleteOne({ email: lowerdemail });
                    res.cookie("token", user.token, {
                        httpOnly: true,
                        secure: true,
                        sameSite: 'none',
                        maxAge: 7 * 24 * 60 * 60 * 1000
                    });

                    return respond(res, "otpverified", 200, true, user.email);
                }
            } else {
                return res.status(400).json({
                    success: false,
                    message: "Invalid OTP"
                });
            }
        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid User"
            });
        }
    } catch (error) {
        return respond(res, "Error Occured", 500, false);
    }
}

export const resendOtp = async (req, res) => {
    try {
        const { email, type } = req.body;
        if (!email || email.trim() === '') {
            return res.status(400).json({
                success: false,
                message: "Mail is required"
            });
        }
        if (!type) {
            return res.status(400).json({
                success: false,
                message: "Error Occured"
            });
        }
        const lowerdemail = email.trim().toLowerCase();
        const checkUserPresent = await Freelancer.findOne({ email: lowerdemail }) || await Client.findOne({ email: lowerdemail });
        if (checkUserPresent) {
            if (type === "forgotpassword") {
                if (checkUserPresent.verified) {
                    const otpConfig = {
                        upperCaseAlphabets: false,
                        lowerCaseAlphabets: false,
                        specialChars: false,
                        digits: true
                    };
                    let otp = otpGenerator.generate(6, otpConfig);
                    let result = await ForgotPassword.findOne({ otp, email: lowerdemail });
                    while (result) {
                        otp = otpGenerator.generate(6, otpConfig);
                        result = await ForgotPassword.findOne({ otp, email: lowerdemail });
                    }
                    const otpBody = await ForgotPassword.create({ email: lowerdemail, otp });
                    console.log("OTP body : ", otpBody);
                    if (otpBody) {
                        await mailSender(lowerdemail, "Forgot Password verification email send by ServiceHive", forgototpTemplate(otp));
                    }
                    return res.status(200).json({
                        success: true,
                        message: "otpsent"
                    });

                } else {
                    return respond(res, "verificationrequired", 200, false);
                }
            }
            if (type === "verifysignup") {
                const otp = await sendOtp(lowerdemail);
                if (otp.includes("Error")) {
                    return res.status(400).json({
                        success: false,
                        message: "Error Occured"
                    });
                } else {
                    return res.status(200).json({
                        success: true,
                        message: "otpsent"
                    });
                }
            }
        } else {
            return respond(res, "Invalid User", 400, false);
        }
    } catch (error) {
        console.log(error)
        return respond(res, "Error Occured", 500, false);
    }
}


export const sendForgotPasswordOtp = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || email.trim() === '') {
            return res.status(400).json({
                success: false,
                message: "Mail is required"
            });
        }
        const lowerdemail = email.trim().toLowerCase();
        const checkUserPresent = await Freelancer.findOne({ email: lowerdemail }) || await Client.findOne({ email: lowerdemail });
        if (checkUserPresent) {
            if (!checkUserPresent.verified) {
                return respond(res, "verificationrequired", 200, false);
            }
            const otpConfig = {
                upperCaseAlphabets: false,
                lowerCaseAlphabets: false,
                specialChars: false,
                digits: true
            };
            let otp = otpGenerator.generate(6, otpConfig);
            let result = await ForgotPassword.findOne({ otp, email: lowerdemail });
            while (result) {
                otp = otpGenerator.generate(6, otpConfig);
                result = await ForgotPassword.findOne({ otp, email: lowerdemail });
            }
            const otpBody = await ForgotPassword.create({ email: lowerdemail, otp });
            console.log("OTP body : ", otpBody);
            if (otpBody) {
                await mailSender(lowerdemail, "Forgot Password verification email send by ServiceHive", forgototpTemplate(otp));
            }
            return res.status(200).json({
                success: true,
                message: "otpsent"
            });
        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid User"
            });
        }
    } catch (error) {
        console.log(error)
        return respond(res, "Error Occured", 500, false);
    }
}

export const verifyForgotPasswordOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || email.trim() === '') {
            return res.status(400).json({
                success: false,
                message: "Mail is required"
            });
        }
        if (!otp || otp.trim() === '') {
            return res.status(400).json({
                success: false,
                message: "Otp is required"
            });
        }
        const lowerdemail = email.trim().toLowerCase()
        const checkUserPresent = await Freelancer.findOne({ email: lowerdemail }) || await Client.findOne({ email: lowerdemail });
        if (checkUserPresent) {
            const recentOtp = await ForgotPassword.find({ email: lowerdemail }).sort({ createdAt: -1 }).limit(1);
            if (recentOtp.length == 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid OTP"
                });
            } else if (recentOtp[0].otp == otp) {
                const user = await Freelancer.findOne({ email: lowerdemail }) || await Client.findOne({ email: lowerdemail });
                const uniqueid = uniqid();
                if (user) {
                    user.forgottoken = uniqueid;
                    await user.save();
                }

                // Delete token after 3 minutes (180,000 milliseconds)
                setTimeout(async () => {
                    user.forgottoken = null;
                    await user.save();
                }, 180000);
                return res.status(200).json({
                    success: true,
                    message: "otpverified",
                    uniqueid
                });
            } else {
                return respond(res, "Invalid OTP", 400, false);

            }
        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid User"
            });
        }
    } catch (error) {
        return respond(res, "Error Occured", 500, false);
    }
}

export const resetPassword = async (req, res) => {
    try {
        const { forgotEmail, newPassword, token, confirmPassword } = req.body;
        if (!forgotEmail || forgotEmail.trim() === '') {
            return res.status(400).json({
                success: false,
                message: "Mail is required"
            });
        }
        const lowerdemail = forgotEmail.trim().toLowerCase();
        const user = await Freelancer.findOne({ email: lowerdemail }) || await Client.findOne({ email: lowerdemail });
        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid User"
            });
        }

        if (!token) {
            return res.status(400).json({
                success: false,
                message: "Something went wrong"
            });
        }
        if (!newPassword || newPassword.trim() === '' || !confirmPassword || confirmPassword.trim() === '') {
            return res.status(400).json({
                success: false,
                message: "Password is required"
            });
        }
        if (user.forgottoken !== token) {
            return res.status(401).json({
                success: false,
                message: "Invalid User"
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const uid = uniqid()
        const newtoken = await tokenGenerator(lowerdemail, uid)
        user.password = hashedPassword;
        user.token = newtoken;
        if (newtoken) user.forgottoken = null;
        user.sessionId = uid;
        await user.save();

        return res.status(200).json({
            success: true,
            message: "passwordchanged"
        });
    } catch (error) {
        return respond(res, "Error Occured", 500, false);
    }
}

export const getUserData = async (email) => {
    try {
        const user = await Freelancer.findOne({ email, verified: true }).select("-password -token -forgottoken").populate([
            { path: 'bids' },
            { path: 'portfolio' }
        ]).lean() || await Client.findOne({ email, verified: true }).select("-password -token -forgottoken").populate({ path: 'projects' }).lean();
        if (user?.verified !== true || !user) {
            throw new Error("User not found");
        } else {
            return user;
        }
    } catch (err) {
        console.log(err)
    }
}

export const getUserById = async (req, res) => {
    try {
        const { freelancerId } = req.params;
        if (req?.user.type !== "Client") {
            return respond(res, "Access denied.", 403, false);
        }
        const user = await Freelancer.findOne({ _id: freelancerId }).select("username email phoneNumber gender verified additionalDetails portfolio").lean();
        if (user?.verified !== true || !user) {
            return respond(res, "User Not Found.", 403, false);
        }
        return respond(res, "user_found", 200, true, user);
    } catch (err) {
        return respond(res, "Error Occured", 500, false);
    }
}

export const LogoutUser = async (req, res) => {
    try {
        res.cookie('token', '', {
            httpOnly: true,
            expires: new Date(0),
        });
        return respond(res, "Logged out", 200, true);
    } catch (err) {
        return respond(res, "Error Occured", 500, false);

    }
}

export const markNotificationAsRead = async (req, res) => {
    try {
        const { userId, notificationId } = req.body;
        const user = await Freelancer.findOneAndUpdate({ _id: userId, "notifications._id": notificationId }, { $set: { "notifications.$.read": true } }, { new: true }).lean() || await Client.findOneAndUpdate({ _id: userId, "notifications._id": notificationId }, { $set: { "notifications.$.read": true } }, { new: true }).lean();
        if (!user) {
            return respond(res, "User or Notification Not Found.", 404, false);
        }
        await sendUserUpdater(user.email);
        return respond(res, "notification_updated", 200, true);
    } catch (err) {
        return respond(res, "Error Occured", 500, false);
    }
}