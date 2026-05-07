import {Router} from "express";
import {AuthorizationCode} from "simple-oauth2";
import {createAuthToken} from "@/helpers/auth-tokens";
import {generateOAuthState, oAuthStateCookieName} from "@/helpers/auth";
import {getEntityManager} from "@/helpers/db";
import {User} from "@/helpers/models/user";

const router = Router();
const ID = "discord";

const client = new AuthorizationCode({
    client: {
        id: process.env.DISCORD_CLIENT_ID!,
        secret: process.env.DISCORD_CLIENT_SECRET!,
    },
    auth: {
        tokenHost: "https://discord.com",
        authorizePath: "/api/oauth2/authorize",
        tokenPath: "/api/oauth2/token",
        revokePath: "/api/oauth2/token/revoke",
    },
});

router.get("/login", (req, res) => {
    const state = generateOAuthState();
    res.cookie(oAuthStateCookieName(ID), state, {
        signed: true,
        httpOnly: true,
        // secure: true,
        sameSite: "lax" as const,
        path: "/",
        maxAge: 1000 * 60 * 10, // 10 minutes
    });
    res.redirect(client.authorizeURL({
        redirect_uri: `${process.env.ORIGIN}/auth/discord/callback`,
        scope: ["identify", "guilds.members.read"],
        state,
    }));
});

router.get("/callback", async (req, res) => {
    // state check
    const returnedState = req.query.state;
    console.log(req.signedCookies, req.query.state,);
    const storedState = req.signedCookies[oAuthStateCookieName(ID)];
    res.clearCookie(oAuthStateCookieName(ID), {
        signed: true,
        httpOnly: true,
        // secure: true,
        sameSite: "lax",
        path: "/",
    });
    if (!returnedState || returnedState !== storedState) {
        console.error("State mismatch:", {returnedState, storedState});
        return res.status(400).json({success: false});
    }

    const {code} = req.query;
    if (!code) {
        console.error("No code returned from Discord");
        return res.status(400).json({success: false});
    }

    // exchange code for access token
    const accessToken = await client.getToken({
        code: code as string,
        redirect_uri: `${process.env.ORIGIN}/auth/discord/callback`,
    });

    // check for discord server membership
    const resp = await fetch(`https://discord.com/api/users/@me/guilds/${process.env.DISCORD_SERVER_ID}/member`, {
        headers: {
            "Authorization": `${accessToken.token.token_type} ${accessToken.token.access_token}`,
        }
    })
    if (resp.status !== 200) return res.status(400).json({success: false, code: "NOT_IN_SERVER"});

    // issue auth token identifying the discord user
    const data = await resp.json();
    const em = getEntityManager();
    let user;
    try {
        user = await em.findOneOrFail(User, data.user.id);
    } catch (e) {
        console.log(e);
        user = new User();
        em.persist(user);
        user.id = data.user.id;
    }
    user.username = data.user.username;
    await em.flush();
    const token = await createAuthToken({sub: data.user.id});

    res.json({success: true, token});
});

export default router;