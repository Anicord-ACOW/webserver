import {beforeEach, describe, expect, it, vi} from "vitest";

const query = vi.fn();
const release = vi.fn();

vi.mock("@/helpers/db", () => ({
  getDbConnection: async () => ({ query, release }),
}));

import {Model, ModelClass, Nullable} from "@/helpers/model";

class TestModel extends Model {
  name?: string;
  age: Nullable<number> = null;

  constructor() {
    super("test_models");
  }
}

class InvalidTableModel extends Model {
  "`q": string = "";

  constructor() {
    super("`invalid");
  }
}

class InvalidFieldModel extends Model {
  "`q": string = "";

  constructor() {
    super("looks_good");
  }
}

class ParentModel extends Model {
  name: string = "";
  age: Nullable<number> = null;
  child: ChildModel = new ChildModel();
  ignoredField?: string;

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

describe("Model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists with an explicit id", async () => {
    query.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const model = new TestModel();
    model.name = "Ada";

    await model.persist("123");

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO `test_models` (`id`, `age`, `name`) VALUES"),
      ["123", null, "Ada"],
    );
    expect(model.id).toBe("123");
    expect(JSON.stringify(model)).toContain('"id":"123"');
    expect(release).toHaveBeenCalled();
  });

  it("hydrates from retrieve", async () => {
    query.mockResolvedValueOnce([[{ t0__id: "123", t0__name: "Ada" }], []]);

    const model = new TestModel();
    await model.retrieve("123");

    expect(model.id).toBe("123");
    expect(model.name).toBe("Ada");
    expect(model.toJSON()).toEqual({ id: "123", name: "Ada", age: null });
  });

  it("invalid identifiers throws", async () => {
    expect(() => new InvalidTableModel()).toThrow("Invalid table name:");

    const model = new InvalidFieldModel();
    model["`q"] = "Ada";
    await expect(() => model.persist()).rejects.toThrow("Invalid field name:");
    await expect(() => model.retrieve(1)).rejects.toThrow("Invalid field name:");
  });

  it("correct join query", async () => {
    query.mockResolvedValueOnce([[{ t0__id: "123", t0__name: "Ada", t1__id: 1, t1__name: "Grace" }], []]);

    const parent = new ParentModel();
    await parent.retrieve("123");
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("SELECT t0.`id` as `t0__id`, t0.`name` as `t0__name`, t0.`age` as `t0__age`, t1.`id` as `t1__id`, t1.`name` as `t1__name` FROM `parent_model` t0 LEFT JOIN `child_model` t1 ON t0.`child__id` = t1.`id` WHERE t0.`id` = ? LIMIT 1"),
      ["123"],
    );
  });
});