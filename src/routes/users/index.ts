import {Router} from "express";
import signup from "@/routes/users/signup";
import {readRateLimiter} from "@/helpers/rate-limit";
import {requireAllRoles, requireAuth} from "@/middleware/auth";
import {getEntityManager} from "@/helpers/db";
import {User} from "@/helpers/models/user";

const router = Router();

router.get("/me", readRateLimiter, requireAuth, async (req, res) => {
    const em = getEntityManager();
    res.json({
        success: true,
        user: req.auth,
    });
});

router.get("/:id", readRateLimiter, requireAllRoles(["admin"]), async (req, res) => {
    const em = getEntityManager();
    const user = em.findOne(User, req.params.id);
    if (user === null) return res.status(404).json({success: false});
    res.json({
        success: true,
        user: req.auth,
    });
});

router.use("/signup", signup);

export default router;