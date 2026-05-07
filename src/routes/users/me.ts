import {Router} from "express";
import {requireAuth} from "@/middleware/auth";
import {User} from "@/helpers/models/user";
import {getEntityManager} from "@/helpers/db";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
    const em = getEntityManager();
    const user = await em.findOneOrFail(User, req.auth!.sub!);
    res.json({
        success: true,
        user: user,
    });
});

export default router;