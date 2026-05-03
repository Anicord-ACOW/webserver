import {Model} from "@/helpers/model";

export class Season extends Model {
  name?: string;

  constructor() {
    super("seasons");
  }
}
