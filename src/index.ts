import {MikroORM} from "@mikro-orm/core";
import config from "@/mikro-orm.config";

process.loadEnvFile(".env");

void import("@/app").then(({default: app}) => {
    app.listen(3000, (err) => {
        if (err) throw err;
        console.log("Server is running on port 3000");
    });
});
