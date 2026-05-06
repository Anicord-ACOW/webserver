import {Router} from "express";
import {AuthorizationCode} from "simple-oauth2";
import {createAuthToken} from "@/helpers/auth";

const router = Router();

// todo: this route should issue the auth url with state
router.get("/discord", async (req, res) => {
    const {code} = req.query;
    if (!code) {
        return res.status(400).json({success: false});
    }

    // exchange code for access token
    const client = new AuthorizationCode({
        client: {
            id: process.env.DISCORD_CLIENT_ID!,
            secret: process.env.DISCORD_CLIENT_SECRET!,
        },
        auth: {
            tokenHost: "https://discord.com",
            tokenPath: "/api/oauth2/token",
            revokePath: "/api/oauth2/token/revoke",
        },
    });
    const accessToken = await client.getToken({
        code: code as string,
        redirect_uri: `${process.env.ORIGIN}/auth/callback/discord`,
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
    const token = await createAuthToken({sub: data.user.id});

    res.json({success: true, token});
});

export default router;