import {AsyncLocalStorage} from "node:async_hooks";
import {beforeAll, describe, expect, it} from "vitest";
import {parseModelPatch} from "@/helpers/patch";

const protectedSignupFields = ["id", "user", "userId"];
let signupSchema: typeof import("@/helpers/models/signup").SignUpFormSchema;

describe("parseModelPatch", () => {
    beforeAll(async () => {
        (globalThis as typeof globalThis & {AsyncLocalStorage?: typeof AsyncLocalStorage}).AsyncLocalStorage = AsyncLocalStorage;
        signupSchema = (await import("@/helpers/models/signup")).SignUpFormSchema;
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
            success: true,
            patch: {
                repServer: "Frieren",
                extremeSpecialParticipation: true,
                gameProfileUrl: null,
            },
        });
    });

    it("rejects non-object bodies", () => {
        expect(parseModelPatch(null, signupSchema)).toEqual({
            success: false,
            error: "Invalid input: expected object, received null",
        });
    });

    it("rejects unknown fields", () => {
        const result = parseModelPatch({admin: true}, signupSchema, {exclude: protectedSignupFields});

        expect(result.success).toBe(false);
    });

    it("rejects excluded property names and field names", () => {
        expect(parseModelPatch({id: 1}, signupSchema, {exclude: protectedSignupFields}).success).toBe(false);
        expect(parseModelPatch({userId: 1, repServer: "Frieren"}, signupSchema, {exclude: protectedSignupFields}).success).toBe(false);
    });

    it("rejects invalid field values", () => {
        expect(parseModelPatch(
            {extremeSpecialParticipation: "yes"},
            signupSchema,
            {exclude: protectedSignupFields},
        )).toEqual({
            success: false,
            error: "Invalid value for extremeSpecialParticipation",
        });
    });

    it("rejects null values on non nullable field", () => {
        expect(parseModelPatch(
            {extremeSpecialParticipation: null},
            signupSchema,
            {exclude: protectedSignupFields},
        )).toEqual({
            success: false,
            error: "Invalid value for extremeSpecialParticipation",
        });
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
            success: true,
            patch: {
                pcPower: "HIGH",
                preferredGameGenres: ["PLATFORMERS", "JRPGS"],
            },
        });
    });

    it("rejects invalid enum values", () => {
        expect(parseModelPatch(
            {pcPower: "TOASTER"},
            signupSchema,
            {exclude: protectedSignupFields},
        )).toEqual({
            success: false,
            error: "Invalid value for pcPower",
        });
    });

    it("rejects invalid enum array values", () => {
        expect(parseModelPatch(
            {preferredGameGenres: ["PLATFORMERS", "NOT_A_GENRE"]},
            signupSchema,
            {exclude: protectedSignupFields},
        )).toEqual({
            success: false,
            error: "Invalid value for preferredGameGenres",
        });
    });
});
