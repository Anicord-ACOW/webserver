import Discord from "next-auth/providers/discord";
import { getServerSession, type NextAuthOptions } from "next-auth";
import { User } from "@/helpers/models/user";

export const authOptions = {
    providers: [
        Discord({
            clientId: process.env.DISCORD_CLIENT_ID!,
            clientSecret: process.env.DISCORD_CLIENT_SECRET!,
        }),
    ],
    callbacks: {
        async signIn({ user, account }) {
            if (account?.provider === "discord") {
                await User.ensureDiscordUser(account.providerAccountId, user.name);
            }

            return true;
        },
        async session({ session, token }) {
            // Send properties to the client, like an access_token from a provider.
            if (session.user) {
                session.user.id = token.sub;
            }
            return session;
        }
    },
} satisfies NextAuthOptions;

export function auth() {
    return getServerSession(authOptions);
}
