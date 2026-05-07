import {MikroORM} from "@mikro-orm/core";
import config from "@/mikro-orm.config";

process.loadEnvFile(".env");

async function main() {
    const orm = await MikroORM.init(config);
}
void import("@/app").then(({default: app}) => {
    app.listen(3000, (err) => {
        if (err) throw err;
        console.log("Server is running on port 3000");
    });
});

main();