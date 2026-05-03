"use client";

import { signIn, signOut } from "next-auth/react";

export function AuthButtonClient({ isSignedIn }: { isSignedIn: boolean }) {
  if (isSignedIn) {
    return (
      <button type="button" onClick={() => signOut()}>
        Sign out
      </button>
    );
  }

  return (
    <button type="button" onClick={() => signIn("discord")}>
      Sign in
    </button>
  );
}
