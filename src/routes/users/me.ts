import {Router} from "express";
import {requireAuth} from "@/middleware/auth";
import {User} from "@/helpers/models/user";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
    const user = new User();
    await user.retrieve(req.auth!.sub!);
    res.json({
        user: user.toJSON(),
    });
});

export default router;