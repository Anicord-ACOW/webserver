import {Model} from "@/helpers/model";

/**
 * Represents a contract that a participant must complete to obtain a pass.
 */
export class Contract extends Model {
  seasonId: number = 0;

  contractorId: string = "";
  contracteeId: string = "";
  contractTypeId: number = 0;

  // the actual series/game/dish/etc to complete, eg "Shibouyugi (Anime)"
  name: string = "";
  progress: string = "";
  // normally scores should be a number but people like stuff such as "69/420", i shall oblige
  score: string = "";
  reviewContent: string = "";

  constructor() {
    super("contract_types");
  }
}