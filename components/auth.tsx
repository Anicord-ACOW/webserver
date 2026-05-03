import { auth } from "@/auth";
import { AuthButtonClient } from "./auth-button-client";

export async function AuthButton() {
  const session = await auth();

  return <AuthButtonClient isSignedIn={Boolean(session?.user)} />;
}
