import {Model} from "@/helpers/model";

/**
 * Represents a type of contract. Decides the type's icon and which channels do reviews go.
 */
export class ContractType extends Model {
  name: string = "";
  icon: string = "";
  discordChannelId: string = "";

  constructor() {
    super("contract_types");
    this.seal();
  }
}