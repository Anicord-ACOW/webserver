import {Model, ModelNotFoundError} from "@/helpers/model";

export class User extends Model {
  username: string = "";

  constructor() {
    super("users");
    this.seal();
  }

  static async ensureDiscordUser(discordUserId: string, username?: string | null) {
    const user = new User();

    try {
      await user.retrieve(discordUserId);
    } catch (error) {
      if (!(error instanceof ModelNotFoundError)) {
        throw error;
      }

      // should always have a username in 2026 discord
      user.username = username ?? "";
      await user.persist(discordUserId);
      return user;
    }

    if (username !== undefined && username !== null && user.username !== username) {
      user.username = username;
      await user.persist();
    }

    return user;
  }
}
