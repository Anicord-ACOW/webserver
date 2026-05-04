import { describe, expect, it, vi } from "vitest";

const query = vi.fn();
const release = vi.fn();

vi.mock("@/helpers/db", () => ({
  getDbConnection: async () => ({ query, release }),
}));

import { Model } from "@/helpers/model";

class TestModel extends Model {
  name?: string;

  constructor() {
    super("test_models");
  }
}

class InvalidTableModel extends Model {
  "`q"?: string;

  constructor() {
    super("`invalid");
  }
}

class InvalidFieldModel extends Model {
  "`q"?: string;

  constructor() {
    super("looks_good");
  }
}

describe("Model", () => {
  it("persists with an explicit id", async () => {
    query.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const model = new TestModel();
    model.name = "Ada";

    await model.persist("123");

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO `test_models` (`id`, `name`) VALUES"),
      ["123", "Ada"],
    );
    expect(model.id).toBe("123");
    expect(JSON.stringify(model)).toContain('"id":"123"');
    expect(release).toHaveBeenCalled();
  });

  it("hydrates from retrieve", async () => {
    query.mockResolvedValueOnce([[{ id: "123", name: "Ada" }], []]);

    const model = new TestModel();
    await model.retrieve("123");

    expect(model.id).toBe("123");
    expect(model.name).toBe("Ada");
    expect(model.toJSON()).toEqual({ id: "123", name: "Ada" });
  });

  it("invalid identifiers throws", async () => {
    expect(() => new InvalidTableModel()).toThrow("Invalid table name:");

    const model = new InvalidFieldModel();
    model["`q"] = "Ada";
    await expect(() => model.persist()).rejects.toThrow("Invalid field name:");
  });
});