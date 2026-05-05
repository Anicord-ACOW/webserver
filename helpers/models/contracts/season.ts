import {Model} from "@/helpers/model";

/**
 * Represents a season of the contracts event.
 */
export class Season extends Model {
  name: string = "";

  constructor() {
    super("seasons");
    this.seal();
  }
}
