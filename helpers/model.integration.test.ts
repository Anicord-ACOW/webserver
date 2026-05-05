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

    await connection.query("CREATE TABLE parent_model (id VARCHAR(32) PRIMARY KEY, name VARCHAR(255) NULL, child__id INT NULL, secondChild__id INT NULL, thirdChild__id INT NULL, friend__id INT NULL)");
    await connection.query("CREATE TABLE child_model (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NULL)");

    await connection.query("CREATE TABLE empty_models (id INT AUTO_INCREMENT PRIMARY KEY)");
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
        this.seal();
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
        this.seal();
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
    await expect(() => deleted.retrieve(1)).rejects.toThrow("Row not found in");
  }, 30_000);

  it("requires child to be persisted before parent", async () => {
    const { Model } = await import("@/helpers/model");

    class ParentModel extends Model {
      name: string = "";
      child: ChildModel = new ChildModel();

      constructor() {
        super("parent_model");
        this.seal();
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
        this.seal();
      }
    }

    const parent = new ParentModel();
    parent.name = "Ada";
    parent.child.name = "Grace";
    await expect(() => parent.persist("123")).rejects.toThrow("Related model child must be persisted first");
  }, 30_000);

  it("persists and retrieves a model with a relation without second layer hydration", async () => {
    const { Model } = await import("@/helpers/model");

    class ParentModel extends Model {
      name: string = "";
      child: Nullable<ChildModel> = null;
      secondChild: Nullable<ChildModel> = null;
      thirdChild: Nullable<ChildModel> = null;
      friend: Nullable<ParentModel> = null;

      constructor() {
        super("parent_model");
        this.seal();
      }

      protected relations(): Record<string, ModelClass> {
        return {
          child: ChildModel,
          secondChild: ChildModel,
          thirdChild: ChildModel,
          friend: ParentModel,
        };
      }
    }

    class ChildModel extends Model {
      name: string = "";

      constructor() {
        super("child_model");
        this.seal();
      }
    }

    const parent = new ParentModel();
    parent.name = "Ada";
    parent.child = new ChildModel();
    parent.child.name = "Grace";
    parent.secondChild = new ChildModel();
    parent.secondChild.name = "John";
    parent.friend = new ParentModel();
    parent.friend.name = "Bob";
    parent.friend.child = new ChildModel();
    parent.friend.child.name = "Solana";
    await parent.child.persist();
    await parent.secondChild.persist();
    await parent.friend.child.persist();
    await parent.friend.persist("999");
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
      friend: {
        id: "999",
        name: "Bob",
        child: null,
        secondChild: null,
        thirdChild: null,
        friend: null,
      },
    });

    const retrievedFriend = new ParentModel();
    await retrievedFriend.retrieve("999");
    expect(retrievedFriend.toJSON()).toEqual({
      id: "999",
      name: "Bob",
      child: {
        id: 3,
        name: "Solana",
      },
      secondChild: null,
      thirdChild: null,
      friend: null,
    });
  });

  it("models don't populate other fields when retrieving", async () => {
    const { Model } = await import("@/helpers/model");

    class ParentModel extends Model {
      name: string = "";
      child: Nullable<ChildModel> = null;
      secondChild: Nullable<ChildModel> = null;
      thirdChild: Nullable<ChildModel> = null;
      friend: Nullable<ParentModel> = null;

      constructor() {
        super("parent_model");
        this.seal();
      }

      protected relations(): Record<string, ModelClass> {
        return {
          child: ChildModel,
          secondChild: ChildModel,
          thirdChild: ChildModel,
          friend: ParentModel,
        };
      }
    }

    class ChildModel extends Model {
      name: string = "";

      constructor() {
        super("child_model");
        this.seal();
      }
    }

    class RestrictedParentModel extends Model {
      name: string = "";

      constructor() {
        super("parent_model");
        this.seal();
      }
    }

    const parent = new ParentModel();
    parent.name = "Ada";
    parent.child = new ChildModel();
    parent.child.name = "Grace";
    parent.secondChild = new ChildModel();
    parent.secondChild.name = "John";
    parent.friend = new ParentModel();
    parent.friend.name = "Bob";
    await parent.child.persist();
    await parent.secondChild.persist();
    await parent.friend.persist("999999");
    await parent.persist("123123");

    const retrievedParent = new RestrictedParentModel();
    await retrievedParent.retrieve("123123");
    expect(retrievedParent.toJSON()).toEqual({
      id: "123123",
      name: "Ada",
    });
  });

  it("persisting empty models don't throw", async () => {
    const { Model } = await import("@/helpers/model");

    class EmptyModel extends Model {
      constructor() {
        super("empty_models");
        this.seal();
      }
    }

    const emptyModel = new EmptyModel();
    await emptyModel.persist();
    expect(emptyModel.id).toBe(1);

    const retrievedEmptyModel = new EmptyModel();
    await retrievedEmptyModel.retrieve(1);
    expect(retrievedEmptyModel.id).toBe(1);
    await retrievedEmptyModel.persist();
  });

  it("invalid relations throw", async () => {
    const { Model } = await import("@/helpers/model");

    class ParentModel extends Model {
      name: string = "";
      child: ChildModel = new ChildModel();

      constructor() {
        super("parent_model");
        this.seal();
      }

      protected relations(): Record<string, ModelClass> {
        return {
          children: ChildModel,
        };
      }
    }

    class ChildModel extends Model {
      name: string = "";

      constructor() {
        super("child_model");
        this.seal();
      }
    }

    expect(() => new ParentModel()).throw("Relation children is not defined in");
  });

  it("zero rows affected throws", async () => {
    const { Model } = await import("@/helpers/model");
    class ParentModel extends Model {
      name: string = "";
      child: Nullable<ChildModel> = null;

      constructor() {
        super("parent_model");
        this.seal();
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
        this.seal();
      }
    }

    const parent = new ParentModel();
    await parent.persist("700");

    const retrievedParent = new ParentModel();
    await retrievedParent.retrieve("700");
    await retrievedParent.delete();

    parent.name = "Ada";
    await expect(() => parent.persist()).rejects.toThrow("0 rows affected");
  });

  it("deleted rows are really deleted, deleting again throws", async () => {
    const { Model } = await import("@/helpers/model");

    class EmptyModel extends Model {
      constructor() {
        super("empty_models");
        this.seal();
      }
    }

    const model = new EmptyModel();
    await model.persist(10);

    const retrievedModel = new EmptyModel();
    await retrievedModel.retrieve(10);

    const replica = new EmptyModel();
    await replica.retrieve(10);

    await retrievedModel.delete();

    const reRetrievedModel = new EmptyModel();
    await expect(() => reRetrievedModel.retrieve(10)).rejects.toThrow("Row not found in");
    await expect(() => replica.delete()).rejects.toThrow("0 rows affected");
  });

  it("deleting an unpersisted model does nothing", async () => {
    const { Model } = await import("@/helpers/model");

    class EmptyModel extends Model {
      constructor() {
        super("empty_models");
        this.seal();
      }
    }

    const model = new EmptyModel();
    await model.delete();
  });

  it("using non sealed models throw", async () => {
    const { Model } = await import("@/helpers/model");

    class EmptyModel extends Model {
      constructor() {
        super("empty_models");
      }
    }

    const model = new EmptyModel();
    await expect(() => model.persist()).rejects.toThrow("Model must be sealed before use");
  });

  it("persisting invalid ids throw", async () => {
    const { Model } = await import("@/helpers/model");

    class EmptyModel extends Model {
      constructor() {
        super("empty_models");
        this.seal();
      }
    }

    const model = new EmptyModel();
    await expect(() => model.persist({} as never)).rejects.toThrow("id must be a number or a string");
  });

  /*
  it("attempts to override an existing record's id has no effect", async () => {
    const { Model } = await import("@/helpers/model");

    class EmptyModel extends Model {
      constructor() {
        super("empty_models");
        this.seal();
      }
    }

    const model = new EmptyModel();
    await model.persist(10);

    // (model as {id: number}).id = 20;
    Object.defineProperty(Object.getPrototypeOf(model), "id", {value: 20});
    await model.persist();

    const retrievedModel = new EmptyModel();
    expect(() => retrievedModel.retrieve(20)).rejects.toThrow("Row not found in");
  });

  it("toJSON ignores forcibly set id", async () => {
    const { Model } = await import("@/helpers/model");

    class EmptyModel extends Model {
      constructor() {
        super("empty_models");
        this.seal();
      }
    }

    const model = new EmptyModel();
    await model.persist(11);

    // (model as {id: number}).id = 20;
    Object.defineProperty(Object.getPrototypeOf(model), "id", {value: 20});
    await model.persist();

    expect(model.toJSON()).toEqual({id: 11});
  });
   */
});
