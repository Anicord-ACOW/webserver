import {Request, Router} from "express";
import {findOneOrCreate, getEntityManager} from "@/helpers/db";
import {SignUpFormSchema, SignupForm} from "@/helpers/models/season/signup";
import {parseModelPatch} from "@/helpers/patch";
import {requireAuth} from "@/middleware/auth";
import {readRateLimiter, writeRateLimiter} from "@/helpers/rate-limit";

const router = Router();

router.get("/users/signup/template/me", readRateLimiter, requireAuth, async (req, res) => {
    const userId = req.auth!.id;

    const em = getEntityManager();
    const form = await findOneOrCreate(em, SignupForm, {user: userId});
    res.json({
        success: true,
        form,
    });
});

router.patch("/users/signup/template/me", writeRateLimiter, requireAuth, async (req, res) => {
    const userId = req.auth!.id;

    const result = parseModelPatch(req.body, SignUpFormSchema);

    const em = getEntityManager();
    const form = await findOneOrCreate(em, SignupForm, {user: userId});
    Object.assign(form, result);
    await em.flush();

    res.json({
        success: true,
        form,
    });
});

export default router;
