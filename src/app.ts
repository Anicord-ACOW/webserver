import express from "express";
import cookieParser from "cookie-parser";
import routes from "@/routes";
import {getEntityManager} from "@/helpers/db";

const app = express();

app.use(express.json({limit: "50kb"}));
app.use(express.urlencoded({ extended: true, limit: "50kb" }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use((req, res, next) => {
    req.em = getEntityManager();
    next();
})

app.use(routes);

export default app;