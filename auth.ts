import Discord from "next-auth/providers/discord";
import { getServerSession, type NextAuthOptions } from "next-auth";

export const authOptions = {
    providers: [
        Discord({
            clientId: process.env.DISCORD_CLIENT_ID!,
            clientSecret: process.env.DISCORD_CLIENT_SECRET!,
        }),
    ],
} satisfies NextAuthOptions;

export function auth() {
    return getServerSession(authOptions);
}
