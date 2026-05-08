import type {EntityProperty, EntitySchema} from "@mikro-orm/core";
import {z} from "zod";

type ModelPatchOptions = {
    exclude?: readonly string[];
    excludeManagedFields?: boolean;
};

export type ModelPatchResult<TEntity extends object> =
    | {success: true, patch: Partial<TEntity>}
    | {success: false, error: string};

function propertyMatchesName(prop: EntityProperty, names: Set<string>) {
    return [
        prop.name,
        ...(prop.fieldNames ?? []),
        ...(prop.joinColumns ?? []),
    ].some(name => names.has(String(name)));
}

function shouldSkipProperty(prop: EntityProperty, excluded: Set<string>, excludeManagedFields: boolean) {
    if (propertyMatchesName(prop, excluded)) return true;
    if (excludeManagedFields && (prop.primary || prop.onCreate || prop.onUpdate)) return true;
    return false;
}

function inferRuntimeType(prop: EntityProperty) {
    if (prop.runtimeType) return prop.runtimeType;
    const type = prop.type as unknown;
    if (typeof type === "string") return type;
    if (typeof type === "function") return type.name;
    if (typeof type === "object" && type !== null) return type.constructor.name;
    return undefined;
}

function zodForEnumProperty(prop: EntityProperty) {
    if (!Array.isArray(prop.items)) return null;

    const itemSchema = z.custom(value => prop.items!.includes(value as never));
    return prop.array ? z.array(itemSchema) : itemSchema;
}

function zodForProperty(prop: EntityProperty) {
    let schema: z.ZodType;

    if (prop.kind !== undefined && prop.kind !== "scalar" && !prop.mapToPk) {
        return null;
    }

    if (prop.enum) {
        const enumSchema = zodForEnumProperty(prop);
        if (!enumSchema) return null;
        return prop.nullable ? enumSchema.nullable() : enumSchema;
    }

    switch (inferRuntimeType(prop)) {
        case "string":
        case "String":
        case "StringType":
        case "TextType":
        case "UuidType":
        case "CharacterType":
            schema = z.string();
            break;
        case "boolean":
        case "Boolean":
        case "BooleanType":
            schema = z.boolean();
            break;
        case "number":
        case "Number":
        case "IntegerType":
        case "SmallIntType":
        case "TinyIntType":
        case "MediumIntType":
        case "FloatType":
        case "DoubleType":
            schema = z.number();
            break;
        case "bigint":
        case "BigInt":
        case "BigIntType":
            schema = z.union([
                z.bigint(),
                z.string().regex(/^-?\d+$/).transform(value => BigInt(value)),
                z.number().int().transform(value => BigInt(value)),
            ]);
            break;
        case "Date":
        case "DateType":
        case "DateTimeType":
            schema = z.coerce.date();
            break;
        default:
            return null;
    }

    return prop.nullable ? schema.nullable() : schema;
}

function firstIssueMessage(error: z.ZodError) {
    const issue = error.issues[0];
    if (!issue) return "Invalid request body";

    const field = issue.path[0] === undefined ? undefined : String(issue.path[0]);
    return field ? `Invalid value for ${field}` : issue.message;
}

export function parseModelPatch<TEntity extends object>(
    body: unknown,
    schema: EntitySchema<TEntity>,
    options: ModelPatchOptions = {},
): ModelPatchResult<TEntity> {
    const excluded = new Set(options.exclude ?? []);
    excluded.add("id");
    excluded.add("createdAt");
    excluded.add("updatedAt");
    const excludeManagedFields = options.excludeManagedFields ?? true;
    const shape: Record<string, z.ZodType> = {};

    for (const [propertyName, rawProp] of Object.entries(schema.meta.properties) as [string, EntityProperty][]) {
        const prop = {
            ...rawProp,
            name: rawProp.name ?? propertyName,
        };
        if (shouldSkipProperty(prop, excluded, excludeManagedFields)) continue;

        const propSchema = zodForProperty(prop);
        if (propSchema) shape[prop.name] = propSchema;
    }

    const patchSchema = z.object(shape).partial().strict();
    const result = patchSchema.safeParse(body);
    if (!result.success) return {success: false, error: firstIssueMessage(result.error)};

    return {success: true, patch: result.data as Partial<TEntity>};
}
