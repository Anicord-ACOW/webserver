import {Router} from "express";
import {requireAllRoles} from "@/middleware/auth";
import {Season} from "@/helpers/models/season/season";
import {APIError} from "@/helpers/api-error";
import {parseModelPatch} from "@/helpers/patch";
import {ContractTypeSchema} from "@/helpers/models/contracts/contract-type";
import {readRateLimiter, writeRateLimiter} from "@/helpers/rate-limit";

const router = Router();

router.put("/seasons/:id/contracts/contract-types", writeRateLimiter, requireAllRoles(["admin"]), async (req, res) => {
    // allow contract types to be added to a season as long as the season is not completed
    const season = await req.em.findOne(Season, req.params.id);
    if (season === null) throw new APIError(404, "Season not found");
    if (season.completed) throw new APIError(400, "Cannot add contract types to a completed season");
    const result = parseModelPatch(req.body, ContractTypeSchema);
    const contractType = req.em.create(ContractTypeSchema, result, {partial: true});
    contractType.season = season.id;

    if (contractType.assignmentStart < new Date()) throw new APIError(400, "Assignment start must be in the future");
    if (contractType.assignmentEnd < contractType.assignmentStart) throw new APIError(400, "Assignment end must be after assignment start");
    if (contractType.reviewDeadline < contractType.assignmentEnd) throw new APIError(400, "Review deadline must be after assignment end");
    if (contractType.discordChannelId === undefined) throw new APIError(400, "Discord channel ID is required");

    await req.em.flush();
    res.json({success: true, contractType});
});

router.get("/seasons/:id/contracts/contract-types", readRateLimiter, async (req, res) => {
    const contractTypes = await req.em.find(ContractTypeSchema, {season: req.params.id});
    res.json({success: true, contractTypes});
});

export default router;