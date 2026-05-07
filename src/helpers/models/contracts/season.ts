import {defineEntity, p} from "@mikro-orm/core";

/**
 * Represents a season of the contracts event.
 */
export const SeasonSchema = defineEntity({
    name: "Season",
    tableName: "seasons",
    properties: {
        id: p.bigint().primary(),
        name: p.string().default(""),
    },
});

export class Season extends SeasonSchema.class {}

SeasonSchema.setClass(Season);
