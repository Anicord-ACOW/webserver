import rateLimit from "express-rate-limit";

// both /login and /callback use this rate limiter, so technically 5 complete logins every 15 mins
// but even that is pretty generous
export const oauthRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 10, // limit each IP for auth initiation attempts
    standardHeaders: false,
    legacyHeaders: false,
});

export const readRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    limit: 50,
    standardHeaders: false,
    legacyHeaders: false,
});

export const writeRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    limit: 10,
    standardHeaders: false,
    legacyHeaders: false,
});