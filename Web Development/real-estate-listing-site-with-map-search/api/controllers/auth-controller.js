import bcrypt from "bcrypt";
import prisma from "../lib/prisma.js";
import jwt from "jsonwebtoken";
import 'dotenv/config';
// import process from "process";

export const register = async (req,res)=>{
    const {username,email,password} =req.body;
    try {
        const hashedPassword= await bcrypt.hash(password,10); //hash the password
        
        const newUser= await prisma.user.create({     // create new user
            data:{
                username,
                email,
                password:hashedPassword
            }
        })
        console.log(newUser)
        res.status(200).json({message: "user created succesfully"})
    } catch (error) {
        console.log(error)
        res.status(500).json({message: "failed to create user "})
    }
}

export const login = async (req,res)=>{
    const {username,password} = req.body;
    
    try 
    {
        const user = await prisma.user.findUnique({
            where:{username: username}
        })
       

        if(!user) return res.status(401).json({message: "Invalid Credentials"})
        const isPasswordValid = await bcrypt.compare(password,user.password)
        if(!isPasswordValid)  return res.status(401).json({message: "Invalid Credentials"})

        const age=1000*60*60*24*7;
        const token=jwt.sign({
            id: user.id 
        },process.env.JWT_SECURITY_KEY,
        {expiresIn:age}) 

        const {password: userPassword, ...userInfo}=user
 
        res
        .cookie("token",token,{
            httpOnly: true,
            // secure: true,
            maxAge: age, 
        })
        .status(200)
        .json(userInfo)

    } catch (err) {
        console.log(err);
        res.status(500).json({message: "failed to login"})
    }
}
export const logout = (req,res)=>{
    res.clearCookie("token").status(200).json({message: "Logout successful"})
}