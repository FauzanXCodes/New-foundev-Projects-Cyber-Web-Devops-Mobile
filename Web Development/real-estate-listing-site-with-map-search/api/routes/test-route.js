import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
const testRouter=express.Router();

testRouter.get("/valid",verifyToken,(req,res)=>{
    console.log(req.userId);
})

export default testRouter;  