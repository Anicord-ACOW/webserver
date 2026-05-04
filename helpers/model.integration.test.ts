import { execFile, spawn, spawnSync, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { createConnection } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {ModelClass, Nullable} from "@/helpers/model";

const execFileAsync = promisify(execFile);

type MariaDbServer = {
  rootDir: string;
  socketPath: string;
  process: ChildProcess;
};

function findBinary(...names: string[]) {
  for (const name of names) {
    const result = spawnSync("which", [name], { encoding: "utf8" });

    if (result.status === 0) {
      return result.stdout.trim();
    }
  }
}

const mariadbd = findBinary("mariadbd", "mysqld");
const installDb = findBinary("mariadb-install-db", "mysql_install_db");
const describeWithMariaDb = mariadbd !== undefined && installDb !== undefined ? describe : describe.skip;

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// poll the temp db's status every 100ms for up to 20s
async function waitForMariaDb(socketPath: string, process: ChildProcess, errorLogPath: string) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (process.exitCode !== null) {
      const errorLog = await readFile(errorLogPath, "utf8").catch(() => "");
      throw new Error(`MariaDB exited before accepting connections.\n${errorLog}`);
    }

    try {
      const connection = await createConnection({ socketPath, user: "root" });
      await connection.ping();
      await connection.end();
      return;
    } catch {
      await delay(100);
    }
  }

  const errorLog = await readFile(errorLogPath, "utf8").catch(() => "");
  throw new Error(`Timed out waiting for MariaDB to start.\n${errorLog}`);
}

// starts a temp db for the test suite
async function startMariaDb() {
  if (mariadbd === undefined || installDb === undefined) {
    throw new Error("MariaDB binaries are not available");
  }

  const rootDir = await mkdtemp(path.join(tmpdir(), "acow-mariadb-"));
  const dataDir = path.join(rootDir, "data");
  const socketPath = path.join(rootDir, "mysql.sock");
  const errorLogPath = path.join(rootDir, "mariadb.err");

  await execFileAsync(installDb, [
    "--no-defaults",
    `--datadir=${dataDir}`,
    "--auth-root-authentication-method=normal",
    "--skip-test-db",
  ], { timeout: 30_000 });

  const process = spawn(mariadbd, [
    "--no-defaults",
    `--datadir=${dataDir}`,
    `--socket=${socketPath}`,
    "--skip-networking",
    `--pid-file=${path.join(rootDir, "mariadb.pid")}`,
    `--log-error=${errorLogPath}`,
  ], {
    stdio: "ignore",
  });

  await waitForMariaDb(socketPath, process, errorLogPath);

  const connection = await createConnection({ socketPath, user: "root" });
  await connection.query("CREATE DATABASE acow_test");
  await connection.end();

  return { rootDir, socketPath, process } satisfies MariaDbServer;
}

// cleanup the temp db
async function stopMariaDb(server: MariaDbServer | undefined) {
  if (server === undefined) {
    return;
  }

  try {
    const connection = await createConnection({ socketPath: server.socketPath, user: "root" });
    await connection.query("SHUTDOWN");
    await connection.end().catch(() => undefined);
  } catch {
    server.process.kill("SIGTERM");
  }

  if (server.process.exitCode === null) {
    await Promise.race([
      once(server.process, "exit"),
      delay(10_000).then(() => server.process.kill("SIGKILL")),
    ]);
  }

  await rm(server.rootDir, { recursive: true, force: true });
}

describeWithMariaDb("Model MariaDB integration", () => {
  let server: MariaDbServer | undefined;

  beforeAll(async () => {
    server = await startMariaDb();
    process.env.MYSQL = `mysql://root@localhost/acow_test?socketPath=${encodeURIComponent(server.socketPath)}`;

    const connection = await createConnection({
      socketPath: server.socketPath,
      user: "root",
      database: "acow_test",
    });
    await connection.query("CREATE TABLE test_models (id VARCHAR(32) PRIMARY KEY, name VARCHAR(255) NULL)");
    await connection.query("CREATE TABLE auto_models (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NULL)");

    await connection.query("CREATE TABLE parent_model (id VARCHAR(32) PRIMARY KEY, name VARCHAR(255) NULL, child__id INT NOT NULL, secondChild__id INT NOT NULL, thirdChild__id INT NULL)");
    await connection.query("CREATE TABLE child_model (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NULL)");
    await connection.end();
  }, 60_000);

  afterAll(async () => {
    delete process.env.MYSQL;
    await stopMariaDb(server);
  }, 30_000);

  it("persists, retrieves and deletes a model with an explicit string id", async () => {
    const { Model } = await import("@/helpers/model");

    class TestModel extends Model {
      name: string = "";

      constructor() {
        super("test_models");
      }
    }

    // persist "Ada"
    const model = new TestModel();
    model.name = "Ada";
    await model.persist("1500565799423840346");

    const loaded = new TestModel();
    await loaded.retrieve("1500565799423840346");

    expect(loaded.toJSON()).toEqual({
      id: "1500565799423840346",
      name: "Ada",
    });

    // update "Ada" to "Grace"
    loaded.name = "Grace";
    await loaded.persist();

    // load "Grace"
    const updated = new TestModel();
    await updated.retrieve("1500565799423840346");

    expect(updated.toJSON()).toEqual({
      id: "1500565799423840346",
      name: "Grace",
    });

    // delete "Grace"
    await updated.delete();

    const deleted = new TestModel();
    await expect(() => deleted.retrieve("1500565799423840346")).rejects.toThrow("Row not found in");
  }, 30_000);

  it("stores mysql insertId when persisting without an explicit id", async () => {
    const { Model } = await import("@/helpers/model");

    class AutoModel extends Model {
      name: string = "";

      constructor() {
        super("auto_models");
      }
    }

    // persist "Ada"
    const model = new AutoModel();
    model.name = "Ada";
    await model.persist();

    expect(model.id).toBe(1);

    // load "Ada"
    const loaded = new AutoModel();
    await loaded.retrieve(1);

    expect(loaded.toJSON()).toEqual({
      id: 1,
      name: "Ada",
    });

    // update "Ada" to "Grace"
    loaded.name = "Grace";
    await loaded.persist();

    // load "Grace"
    const updated = new AutoModel();
    await updated.retrieve(1);

    expect(updated.toJSON()).toEqual({
      id: 1,
      name: "Grace",
    });

    // delete "Grace"
    await updated.delete();

    const deleted = new AutoModel();
    await expect(() => deleted.retrieve("1500565799423840346")).rejects.toThrow("Row not found in");
  }, 30_000);

  it("requires child to be persisted before parent", async () => {
    const { Model } = await import("@/helpers/model");

    class ParentModel extends Model {
      name: string = "";
      child: ChildModel = new ChildModel();

      constructor() {
        super("parent_model");
      }

      protected relations(): Record<string, ModelClass> {
        return {
          child: ChildModel,
        };
      }
    }

    class ChildModel extends Model {
      name: string = "";

      constructor() {
        super("child_model");
      }
    }

    const parent = new ParentModel();
    parent.name = "Ada";
    parent.child.name = "Grace";
    expect(() => parent.persist("123")).rejects.toThrow("Related model child must be persisted first");
  }, 30_000);

  it("persists and retrieves a model with a relation", async () => {
    const { Model } = await import("@/helpers/model");

    class ParentModel extends Model {
      name: string = "";
      child: ChildModel = new ChildModel();
      secondChild: ChildModel = new ChildModel();
      thirdChild: Nullable<ChildModel> = null;

      constructor() {
        super("parent_model");
      }

      protected relations(): Record<string, ModelClass> {
        return {
          child: ChildModel,
          secondChild: ChildModel,
          thirdChild: ChildModel,
        };
      }
    }

    class ChildModel extends Model {
      name: string = "";

      constructor() {
        super("child_model");
      }
    }

    const parent = new ParentModel();
    parent.name = "Ada";
    parent.child.name = "Grace";
    parent.secondChild.name = "John";
    await parent.child.persist();
    await parent.secondChild.persist();
    await parent.persist("123");

    const retrievedParent = new ParentModel();
    await retrievedParent.retrieve("123");
    expect(retrievedParent.toJSON()).toEqual({
      id: "123",
      name: "Ada",
      child: {
        id: 1,
        name: "Grace",
      },
      secondChild: {
        id: 2,
        name: "John",
      },
      thirdChild: null,
    });
  });
});
