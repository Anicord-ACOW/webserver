import {defineConfig} from "@mikro-orm/mariadb";
import {UserSchema} from "@/helpers/models/user";
import {SignUpFormSchema} from "@/helpers/models/signup";
import {BadgeSchema} from "@/helpers/models/badges/badge";
import {BadgeProgressSchema} from "@/helpers/models/badges/badge-progress";
import {ContractSchema} from "@/helpers/models/contracts/contract";
import {ContractTypeSchema} from "@/helpers/models/contracts/contract-type";
import {SeasonSchema} from "@/helpers/models/contracts/season";

try {
    process.loadEnvFile(".env");
} catch {}

function connectionString() {
    if (process.env.MYSQL) {
        return process.env.MYSQL;
    } else {
        return `mysql://${process.env.MYSQL_USERNAME}:${process.env.MYSQL_PASSWORD}@${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT ?? 3306}/${process.env.MYSQL_DATABASE}`;
    }
}

export default defineConfig({
    clientUrl: connectionString(),
    // explicitly list your entities - we'll create the User entity next
    entities: [
        UserSchema,
        SignUpFormSchema,
        BadgeSchema,
        BadgeProgressSchema,
        ContractSchema,
        ContractTypeSchema,
        SeasonSchema,
    ],
    // enable debug mode to log SQL queries and discovery information
    debug: true,
});