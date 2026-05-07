import {createHmac, timingSafeEqual} from "crypto";

export function generateOAuthState() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function oAuthStateCookieName(provider: string) {
    // return `__Host-oauth-state-${provider}`;
    return `oauth-state-${provider}`;
}

export function encryptCookie(cleartext: string) {
    return createHmac("sha256", process.env.COOKIE_SECRET!).update(cleartext, "utf8").digest("hex");
}

export function verifyCookie(ciphertext: string, cleartext: string) {
    return timingSafeEqual(Buffer.from(ciphertext), Buffer.from(encryptCookie(cleartext)));
}