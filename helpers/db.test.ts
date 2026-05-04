import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {createPool, type Pool} from "mysql2/promise";

vi.mock("mysql2/promise", () => ({
  createPool: vi.fn(),
}));

const originalEnv = process.env;
const mockedCreatePool = vi.mocked(createPool);
let getConnection: ReturnType<typeof vi.fn>;

function clearMysqlEnv() {
  delete process.env.MYSQL;
  delete process.env.MYSQL_USERNAME;
  delete process.env.MYSQL_PASSWORD;
  delete process.env.MYSQL_HOST;
  delete process.env.MYSQL_PORT;
  delete process.env.MYSQL_DATABASE;
}

describe("db", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = {...originalEnv};
    clearMysqlEnv();

    getConnection = vi.fn().mockResolvedValue("connection");
    mockedCreatePool.mockReturnValue({getConnection} as unknown as Pool);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("uses MYSQL as the connection string when it is set", async () => {
    process.env.MYSQL = "mysql://user:password@db.example.test:3307/acow";

    await import("@/helpers/db");

    expect(mockedCreatePool).toHaveBeenCalledTimes(1);
    expect(mockedCreatePool).toHaveBeenCalledWith("mysql://user:password@db.example.test:3307/acow");
  });

  it("builds a connection string from MYSQL_* parts", async () => {
    process.env.MYSQL_USERNAME = "user";
    process.env.MYSQL_PASSWORD = "password";
    process.env.MYSQL_HOST = "db.example.test";
    process.env.MYSQL_PORT = "3307";
    process.env.MYSQL_DATABASE = "acow";

    await import("@/helpers/db");

    expect(mockedCreatePool).toHaveBeenCalledTimes(1);
    expect(mockedCreatePool).toHaveBeenCalledWith("mysql://user:password@db.example.test:3307/acow");
  });

  it("uses port 3306 when MYSQL_PORT is missing", async () => {
    process.env.MYSQL_USERNAME = "user";
    process.env.MYSQL_PASSWORD = "password";
    process.env.MYSQL_HOST = "db.example.test";
    process.env.MYSQL_DATABASE = "acow";

    await import("@/helpers/db");

    expect(mockedCreatePool).toHaveBeenCalledTimes(1);
    expect(mockedCreatePool).toHaveBeenCalledWith("mysql://user:password@db.example.test:3306/acow");
  });

  it("gets connections from the module-level pool", async () => {
    process.env.MYSQL = "mysql://user:password@db.example.test:3307/acow";

    const {getDbConnection} = await import("@/helpers/db");

    await expect(getDbConnection()).resolves.toBe("connection");
    expect(getConnection).toHaveBeenCalledTimes(1);
  });

  it("reuses the pool created when the module is imported", async () => {
    process.env.MYSQL = "mysql://user:password@db.example.test:3307/acow";

    const {getDbConnection} = await import("@/helpers/db");

    await getDbConnection();
    await getDbConnection();

    expect(mockedCreatePool).toHaveBeenCalledTimes(1);
    expect(getConnection).toHaveBeenCalledTimes(2);
  });
});
