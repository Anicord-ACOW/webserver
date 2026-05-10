import {AsyncLocalStorage} from "node:async_hooks";
import {beforeAll, describe, expect, it} from "vitest";
import {parseModelPatch} from "@/helpers/patch";

const protectedSignupFields = ["id", "user", "userId"];
let signupSchema: typeof import("@/helpers/models/season/signup").SignUpFormSchema;

describe("parseModelPatch", () => {
    beforeAll(async () => {
        (globalThis as typeof globalThis & {AsyncLocalStorage?: typeof AsyncLocalStorage}).AsyncLocalStorage = AsyncLocalStorage;
        signupSchema = (await import("@/helpers/models/season/signup")).SignUpFormSchema;
    });

    it("accepts partial objects matching editable model fields", () => {
        const result = parseModelPatch(
            {
                repServer: "Frieren",
                extremeSpecialParticipation: true,
                gameProfileUrl: null,
            },
            signupSchema,
            {exclude: protectedSignupFields},
        );

        expect(result).toEqual({
            repServer: "Frieren",
            extremeSpecialParticipation: true,
            gameProfileUrl: null,
        });
    });

    it("rejects non-object bodies", () => {
        expect(() => parseModelPatch(null, signupSchema)).toThrow("Invalid input: expected object, received null");
    });

    it("rejects unknown fields", () => {

        expect(() => parseModelPatch({admin: true}, signupSchema, {exclude: protectedSignupFields}))
            .toThrow("Unrecognized key");
    });

    it("rejects excluded property names and field names", () => {
        expect(() => parseModelPatch({id: 1}, signupSchema, {exclude: protectedSignupFields}))
            .toThrow("Unrecognized key");
        expect(() => parseModelPatch({userId: 1, repServer: "Frieren"}, signupSchema, {exclude: protectedSignupFields}))
            .toThrow("Unrecognized key");
    });

    it("rejects foreign key fields by default", () => {
        expect(() => parseModelPatch({user: 1}, signupSchema).success)
            .toThrow("Unrecognized key");
        expect(() => parseModelPatch({userId: 1, repServer: "Frieren"}, signupSchema).success)
            .toThrow("Unrecognized key");
    });

    it("rejects invalid field values", () => {
        expect(() => parseModelPatch(
            {extremeSpecialParticipation: "yes"},
            signupSchema,
            {exclude: protectedSignupFields},
        ))
            .toThrow("Invalid value for extremeSpecialParticipation");
    });

    it("rejects null values on non nullable field", () => {
        expect(() => parseModelPatch(
            {extremeSpecialParticipation: null},
            signupSchema,
            {exclude: protectedSignupFields},
        ))
            .toThrow("Invalid value for extremeSpecialParticipation");
    });

    it("accepts enum and enum array fields", () => {
        expect(parseModelPatch(
            {
                pcPower: "HIGH",
                preferredGameGenres: ["PLATFORMERS", "JRPGS"],
            },
            signupSchema,
            {exclude: protectedSignupFields},
        )).toEqual({
            pcPower: "HIGH",
            preferredGameGenres: ["PLATFORMERS", "JRPGS"],
        });
    });

    it("rejects invalid enum values", () => {
        expect(() => parseModelPatch(
            {pcPower: "TOASTER"},
            signupSchema,
            {exclude: protectedSignupFields},
        ))
            .toThrow("Invalid value for pcPower");
    });

    it("rejects invalid enum array values", () => {
        expect(() => parseModelPatch(
            {preferredGameGenres: ["PLATFORMERS", "NOT_A_GENRE"]},
            signupSchema,
            {exclude: protectedSignupFields},
        ))
            .toThrow("Invalid value for preferredGameGenres");
    });
});
