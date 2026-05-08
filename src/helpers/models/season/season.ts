import {defineEntity, p} from "@mikro-orm/core";
import {ContractTypeSchema} from "@/helpers/models/contracts/contract-type";

/**
 * Represents a season of the contracts event.
 */
export const SeasonSchema = defineEntity({
    name: "Season",
    tableName: "seasons",
    properties: {
        id: p.bigint().primary(),
        name: p.string().default(""),
        // signup period
        signupsStart: p.datetime().default(new Date()),
        signupsEnd: p.datetime().default(new Date()),

        contractTypes: () => p.oneToMany(ContractTypeSchema).mappedBy("season"),

        createdAt: p.datetime().onCreate(() => new Date()),
        updatedAt: p.datetime().onCreate(() => new Date()).onUpdate(() => new Date()),
    },
});

export class Season extends SeasonSchema.class {}

SeasonSchema.setClass(Season);
