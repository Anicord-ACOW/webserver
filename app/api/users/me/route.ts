import { auth } from "@/auth";
import {User} from "@/helpers/models/user";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await User.ensureDiscordUser(session.user.id!);

  return Response.json({ user });
}
