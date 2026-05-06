import {beforeEach, describe, expect, it, vi} from "vitest";

const query = vi.fn();
const release = vi.fn();

vi.mock("@/helpers/db", () => ({
  getDbConnection: async () => ({ query, release }),
}));

import {Model, ModelClass, Nullable} from "@/helpers/model";

class TestModel extends Model {
  name: string = "";
  age: Nullable<number> = null;

  constructor() {
    super("test_models");
    this.seal();
  }
}

class InvalidTableModel extends Model {
  "`q": string = "";

  constructor() {
    super("`invalid");
  }
}

class InvalidTableModel2 extends Model {
  name: string = "";

  constructor() {
    super("invalid__model");
    this.seal();
  }
}

class InvalidFieldModel extends Model {
  "`q": string = "";

  constructor() {
    super("looks_good");
    this.seal();
  }
}

class InvalidFieldModel2 extends Model {
  "q__q": string = "";

  constructor() {
    super("also_looks_good");
    this.seal();
  }
}

class ParentModel extends Model {
  name: string = "";
  age: Nullable<number> = null;
  child: ChildModel = new ChildModel();
  ignoredField?: string;

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

class InvalidParentModel extends Model {
  name: string = "";
  age: Nullable<number> = null;
  child: Nullable<ChildModel> = null;
  ignoredField?: string;

  constructor() {
    super("parent_model");
    this.seal();
  }

  protected relations(): Record<string, ModelClass> {
    return {
      child: ChildModel,
      age: ChildModel,
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
      expect.stringContaining("INSERT INTO `test_models` (`id`, `name`, `age`) VALUES"),
      ["123", "Ada", null],
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
    expect(() => new InvalidTableModel2()).toThrow("Table name cannot contain \"__\"");

    expect(() => new InvalidFieldModel()).toThrow("Invalid field name:");

    expect(() => new InvalidFieldModel2()).toThrow("Field name cannot contain \"__\"");

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

  it("relations must point to a valid model", async () => {
    const model = new InvalidParentModel();
    model.age = 2;
    await expect(() => model.persist("123")).rejects.toThrow("Relation age must be a");
  });

  it("wrong relation class throws", async () => {
    const model = new ParentModel();
    (model as unknown as {child: TestModel}).child = new TestModel();
    expect(() => model.persist()).rejects.toThrow("Relation child must be a ChildModel");
  });

  it("id as a field throws", async () => {
    class IdModel extends Model {
      name: string = "";
      age: Nullable<number> = null;

      constructor() {
        super("test_models");
        Object.defineProperty(this, "id", { value: "123", enumerable: true });
        this.seal();
      }
    }

    expect(() => new IdModel()).throw("Field name 'id' is reserved");
  });
});