import {defineEntity, p} from "@mikro-orm/core";

/**
 * Represents a type of contract. Decides the type's icon and which channels do reviews go.
 */
export const ContractTypeSchema = defineEntity({
    name: "ContractType",
    tableName: "contract_types",
    properties: {
        id: p.bigint().primary(),
        name: p.string().default(""),
        icon: p.string().default(""),
        discordChannelId: p.string().default(""),
    },
});

export class ContractType extends ContractTypeSchema.class {}

ContractTypeSchema.setClass(ContractType);
