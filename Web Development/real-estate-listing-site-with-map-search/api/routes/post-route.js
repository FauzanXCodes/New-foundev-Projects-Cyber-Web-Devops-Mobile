import express from "express";
import {verifyToken} from "../middleware/verifyToken.js"
import { getPosts,getPost,addPost,
updatePost,deletePost } from "../controllers/post-controllers.js";
const postRouter= express.Router();

postRouter.get("/",getPosts)
postRouter.get("/:id",getPost)
postRouter.post("/",verifyToken, addPost)
postRouter.put("/:id",verifyToken,updatePost)
postRouter.delete("/:id",verifyToken,deletePost)


export default postRouter;