import {Request, Router} from "express";
import {getEntityManager} from "@/helpers/db";
import {SignUpFormSchema, SignupForm} from "@/helpers/models/signup";
import {parseModelPatch} from "@/helpers/patch";
import {requireAuth} from "@/middleware/auth";

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

async function getOrCreateSignupForm(userId: bigint) {
    const em = getEntityManager();
    const existingForm = await em.findOne(SignupForm, {user: userId});
    if (existingForm) return {em, form: existingForm};

    const createdForm = new SignupForm();
    createdForm.user = userId;
    em.persist(createdForm);
    await em.flush();
    return {em, form: createdForm};
}

router.get("/template/me", requireAuth, async (req, res) => {
    const userId = authUserId(req);
    if (userId === null) return res.status(401).json({success: false});

    const {form} = await getOrCreateSignupForm(userId);
    res.json({
        success: true,
        form,
    });
});

router.patch("/template/me", requireAuth, async (req, res) => {
    const userId = authUserId(req);
    if (userId === null) return res.status(401).json({success: false});

    const result = parseModelPatch(req.body, SignUpFormSchema, {
        exclude: ["id", "user", "userId"],
    });
    if (!result.success) return res.status(400).json({success: false, error: result.error});

    const {em, form} = await getOrCreateSignupForm(userId);
    Object.assign(form, result.patch);
    await em.flush();

    res.json({
        success: true,
        form,
    });
});

export default router;
