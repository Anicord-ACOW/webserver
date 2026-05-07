import {defineEntity, p} from "@mikro-orm/core";
import {User} from "./user";

export const SignUpFormSchema = defineEntity({
    name: "SignUpForm",
    properties: {
        id: p.bigint().primary(),
        user: () => p.manyToOne(User).mapToPk().joinColumn("userId").referenceColumnName("id"),

        // basic info
        // the server you represent, e.g. Frieren
        repServer: p.string().default(""),
        // link to the user's anilist/mal; better to split into (type, username)?
        anilistUrl: p.string().default(""),
        // preferred/accepting medium
        preferredMedium: p.string().default(""),
        acceptingMedium: p.string().default(""),
        // preferred/banned genre
        preferredGenres: p.string().default(""),
        bannedGenres: p.string().default(""),

        // specials
        extremeSpecialParticipation: p.boolean().default(false),
        sponsorParticipation: p.boolean().default(false),
        aidParadeParticipation: p.boolean().default(false),

        // video games related
        // steam/playstation/xbox
        gameProfileUrl: p.string().nullable(),
        // high/mid/low-end/potato
        pcPower: p.string().nullable(),
        hasXboxGamePass: p.boolean().nullable().default(false),
        preferredGameGenres: p.string().nullable(),
        // easy/medium/hard/very hard/surprise me
        challengeLevelPreference: p.string().nullable(),
        // short/average/long/anything
        gameLengthPreference: p.string().nullable(),

        // extras
        competitiveBlitzParticipation: p.boolean().default(false),
        casualBlitzParticipation: p.boolean().default(false),
        bookClubParticipation: p.boolean().default(false),
        gameClubParticipation: p.boolean().default(false),

        // final remarks
        notesForStaff: p.string().default(""),
        notesForContractor: p.string().default(""),

        createdAt: p.datetime().onCreate(() => new Date()),
        updatedAt: p.datetime().onCreate(() => new Date()).onUpdate(() => new Date()),
    },
});

export class SignupForm extends SignUpFormSchema.class {}

SignUpFormSchema.setClass(SignupForm);
