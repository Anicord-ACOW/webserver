import {Model, Nullable} from "@/helpers/model";

export class SignupForm extends Model {
    userId: string = "";

    // basic info
    // the server you represent, e.g. Frieren
    repServer: string = "";
    // link to the user's anilist/mal; better to split into (type, username)?
    anilistUrl: string = "";
    // preferred/accepting medium
    preferredMedium: string = "";
    acceptingMedium: string = "";
    // preferred/banned genre
    preferredGenres: string = "";
    bannedGenres: string = "";

    // specials
    extremeSpecialParticipation: boolean = false;
    sponsorParticipation: boolean = false;
    aidParadeParticipation: boolean = false;

    // video games related
    // steam/playstation/xbox
    gameProfileUrl: Nullable<string> = null;
    // high/mid/low-end/potato
    pcPower: Nullable<string> = null;
    hasXboxGamePass: Nullable<boolean> = false;
    preferredGameGenres: Nullable<string> = null;
    // easy/medium/hard/very hard/surprise me
    challengeLevelPreference: Nullable<string> = null;
    // short/average/long/anything
    gameLengthPreference: Nullable<string> = null;

    // extras
    competitiveBlitzParticipation: boolean = false;
    casualBlitzParticipation: boolean = false;
    bookClubParticipation: boolean = false;
    gameClubParticipation: boolean = false;

    // final remarks
    notesForStaff: string = "";
    notesForContractor: string = "";
}