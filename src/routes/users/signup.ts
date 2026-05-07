import {Request, Router} from "express";
import {findOneOrCreate, getEntityManager} from "@/helpers/db";
import {SignUpFormSchema, SignupForm} from "@/helpers/models/signup";
import {parseModelPatch} from "@/helpers/patch";
import {requireAuth} from "@/middleware/auth";
import {readRateLimiter, writeRateLimiter} from "@/helpers/rate-limit";

const router = Router();

function authUserId(req: Request) {
    const id = req.auth?.sub;
    if (id === undefined) return null;

    try {
        return BigInt(id);
    } catch {
        return null;
    }
}

router.get("/template/me", readRateLimiter, requireAuth, async (req, res) => {
    const userId = authUserId(req);
    if (userId === null) return res.status(401).json({success: false});

    const em = getEntityManager();
    const form = await findOneOrCreate(em, SignupForm, {user: userId});
    res.json({
        success: true,
        form,
    });
});

router.patch("/template/me", writeRateLimiter, requireAuth, async (req, res) => {
    const userId = authUserId(req);
    if (userId === null) return res.status(401).json({success: false});

    const result = parseModelPatch(req.body, SignUpFormSchema, {
        exclude: ["id", "user", "userId"],
    });
    if (!result.success) return res.status(400).json({success: false, error: result.error});

    const em = getEntityManager();
    const form = await findOneOrCreate(em, SignupForm, {user: userId});
    Object.assign(form, result.patch);
    await em.flush();

    res.json({
        success: true,
        form,
    });
});

export default router;
