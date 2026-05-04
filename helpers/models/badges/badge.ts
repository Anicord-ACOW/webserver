import {Model} from "@/helpers/model";

/**
 * Represents a badge that a user can earn. Usually represents an achievement.
 */
class Badge extends Model {
  name: string = "";
  // this could be the id of an image within the repo or a url to a cdn
  imageId: string = "";
  description: string = "";
  objective: string = "";
}