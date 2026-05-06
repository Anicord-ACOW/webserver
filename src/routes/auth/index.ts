import {Router} from "express";
import callback from "@/routes/auth/callback";

const router = Router();

router.use("/callback", callback);

export default router;