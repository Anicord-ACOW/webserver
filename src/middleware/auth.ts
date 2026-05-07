import {NextFunction, Request, Response} from "express";
import {verifyAuthToken} from "@/helpers/auth-tokens";
import {User} from "@/helpers/models/user";

export async function auth(req: Request, res: Response, next: NextFunction) {
    const token = req.headers.authorization;
    if (token === undefined) return next();

    const payload = verifyAuthToken(token);
    const user = await req.em.findOne(User, BigInt(payload.sub!), {populate: ["roles"]});
    if (user) {
        req.auth = user;
    }
    next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    auth(req, res, () => {
        if (req.auth === undefined) return res.status(401).json({success: false});
        next();
    });
}
