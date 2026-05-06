export function generateOAuthState() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function oAuthStateCookieName(provider: string) {
    // return `__Host-oauth-state-${provider}`;
    return `oauth-state-${provider}`;
}