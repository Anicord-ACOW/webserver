import {createPool} from "mysql2/promise";
import {MikroORM} from "@mikro-orm/core";

import config from "@/mikro-orm.config";

const orm = new MikroORM(config);

export function getEntityManager() {
    return orm.em.fork();
}

function connectionString() {
    if (process.env.MYSQL) {
        return process.env.MYSQL;
    } else {
        return `mysql://${process.env.MYSQL_USERNAME}:${process.env.MYSQL_PASSWORD}@${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT ?? 3306}/${process.env.MYSQL_DATABASE}`;
    }
}

const dbPool = createPool({
    uri: connectionString(),
    supportBigNumbers: true,
    bigNumberStrings: true,
});

export function getDbConnection() {
    return dbPool.getConnection();
}
