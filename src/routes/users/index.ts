import {Router} from "express";
import me from "@/routes/users/me";
import signup from "@/routes/users/signup";

const router = Router();

router.use("/me", me);
router.use("/signup", signup);

export default router;