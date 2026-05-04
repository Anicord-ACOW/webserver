import {Model, ModelClass} from "@/helpers/model";
import {User} from "@/helpers/models/user";
import {Badge} from "@/helpers/models/badges/badge";

/**
 * Represents a user's progress towards earning a badge. The user possesses the badge only after progress is >=100%.
 */
export class BadgeProgress extends Model {
  user: User = new User();
  badge: Badge = new Badge();
  progress: number = 0;

  protected relations(): Record<string, ModelClass> {
    return {
      user: User,
      badge: Badge,
    };
  }
}