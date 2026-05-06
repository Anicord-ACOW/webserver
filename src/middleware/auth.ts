import {NextFunction, Request, Response} from "express";
import {verifyAuthToken} from "@/helpers/auth-tokens";

export function auth(req: Request, res: Response, next: NextFunction) {
    const token = req.headers.authorization;
    if (token === undefined) return next();

    req.auth = verifyAuthToken(token);
    next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    auth(req, res, () => {
        if (req.auth === undefined) return res.status(401).json({success: false});
        next();
    });
}
