import {createPool} from "mysql2/promise";

const dbPool = createPool(process.env.MYSQL!);

export function getDbConnection() {
  return dbPool.getConnection();
}