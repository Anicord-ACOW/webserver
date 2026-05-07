import {Router} from "express";
import {getEntityManager} from "@/helpers/db";
import {SignupForm} from "@/helpers/models/signup";
import {requireAuth} from "@/middleware/auth";

const router = Router();

router.get("/template/me", requireAuth, async (req, res) => {
    const em = getEntityManager();
    const form = await em.findOne(SignupForm, req.auth!.sub!).then(async (form) => {
        if (!form) {
            const form = new SignupForm();
            form.user = BigInt(req.auth!.sub!);
            em.persist(form);
            await em.flush();
            return form;
        }
        return form;
    });
    res.json({
        success: true,
        form,
    });
});

export default router;