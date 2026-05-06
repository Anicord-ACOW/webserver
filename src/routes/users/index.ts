import {Router} from "express";
import me from "@/routes/users/me";

const router = Router();

router.use("/me", me);

export default router;