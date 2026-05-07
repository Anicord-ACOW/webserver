import {timingSafeEqual} from "crypto";
import {createAuthToken, verifyAuthToken} from "@/helpers/auth-tokens";

export function generateOAuthState() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function oAuthStateCookieName(provider: string) {
    // return `__Host-oauth-state-${provider}`;
    return `oauth-state-${provider}`;
}

export function encryptCookie(cleartext: string) {
    return createAuthToken({state: cleartext}, {expiresIn: "10m"})
}

export function verifyCookie(ciphertext: string, cleartext: string) {
    try {
        const payload = verifyAuthToken(ciphertext);
        return timingSafeEqual(Buffer.from(payload.state), Buffer.from(cleartext));
    } catch (e) {
        return false;
    }
}