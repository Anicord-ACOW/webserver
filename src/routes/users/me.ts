import {Router} from "express";
import {requireAuth} from "@/middleware/auth";
import {User} from "@/helpers/models/user";
import {getEntityManager} from "@/helpers/db";
import {readRateLimiter} from "@/helpers/rate-limit";

const router = Router();

router.get("/", readRateLimiter, requireAuth, async (req, res) => {
    const em = getEntityManager();
    res.json({
        success: true,
        user: req.auth,
    });
});

export default router;