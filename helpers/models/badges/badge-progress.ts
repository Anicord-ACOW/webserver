import {Model} from "@/helpers/model";

/**
 * Represents a user's progress towards earning a badge. The user possesses the badge only after progress is >=100%.
 */
class Badge extends Model {
  userId: string = "";
  badgeId: string = "";
  progress: number = 0;
}