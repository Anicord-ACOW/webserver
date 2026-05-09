import express, {Request, Response, NextFunction} from "express";
import cookieParser from "cookie-parser";
import routes from "@/routes";
import {getEntityManager} from "@/helpers/db";
import {APIError} from "@/helpers/api-error";

const app = express();

app.use(express.json({limit: "50kb"}));
app.use(express.urlencoded({ extended: true, limit: "50kb" }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use((req, res, next) => {
    req.em = getEntityManager();
    next();
})

app.use(routes);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof APIError) {
        return res.status(err.status).json({success: false, error: err.message || undefined});
    }
    console.error(err);
    return res.status(500).json({success: false, error: "Internal server error"});
});
app.get("/", (req, res) => res.json({success: true, message: "Did you read the README?"}));
app.use((req, res) => res.status(404).json({success: false, error: "Not found"}));

export default app;