import {MikroORM} from "@mikro-orm/core";

import config from "@/mikro-orm.config";

const orm = new MikroORM(config);

export function getEntityManager() {
    return orm.em.fork();
}
