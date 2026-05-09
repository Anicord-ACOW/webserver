import {Router} from "express";
import {readRateLimiter, writeRateLimiter} from "@/helpers/rate-limit";
import {requireAllRoles} from "@/middleware/auth";
import {Season, SeasonSchema} from "@/helpers/models/season/season";
import {parseModelPatch} from "@/helpers/patch";
import contracts from "@/routes/seasons/contracts";
import {APIError} from "@/helpers/api-error";

const router = Router();

router.put("/seasons", writeRateLimiter, requireAllRoles(["admin"]), async (req, res) => {
    // check if there's an active season
    const incompleteSeasons = await req.em.find(Season, {completed: false});
    if (incompleteSeasons.length > 0) {
        throw new APIError(400, "Cannot create a new season while there is an active season");
    }

    const result = parseModelPatch(req.body, SeasonSchema, {
        exclude: ["completed"],
    });

    const season = req.em.create(Season, result, {partial: true});
    await req.em.flush();
    res.json({success: true, season});
});

router.get("/seasons/current", readRateLimiter, async (req, res) => {
    const season = await req.em.findOne(Season, {completed: false});
    if (season === null) throw new APIError(404, "No active season");
    res.json({success: true, season});
});

router.get("/season/:id", readRateLimiter, async (req, res) => {
    const season = await req.em.findOne(Season, req.params.id);
    if (season === null) throw new APIError(404, "Season not found");
    res.json({success: true, season});
});

router.use("/", contracts);

export default router;