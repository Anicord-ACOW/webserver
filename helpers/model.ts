import {getDbConnection} from "@/helpers/db";
import {ResultSetHeader, RowDataPacket} from "mysql2";

const VALID_IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const RELATION_SUFFIX = "__id";

export type ModelClass<T extends Model = Model> = new () => T;
export type Nullable<T> = T | null;

interface X {field: string | null, obj: Model, alias: string}

export class ModelNotFoundError extends Error {
  constructor(table: string, id: string | number) {
    super(`Row not found in ${table} for id ${id}`);
    this.name = "ModelNotFoundError";
  }
}

export class TransientRelationError extends Error {
  constructor(relation: string) {
    super(`Related model ${relation} must be persisted first`);
    this.name = "TransientRelationError";
  }
}

function quote(str: string) {
  return `\`${str}\``;
}

/**
 * Represents a database model.
 * A model is an object with an immutable id that can optionally contain other models in some of its fields for up to
 * 1 layer of nesting.
 * Models must be sealed before use to prevent tampering. Models must also not include optional fields,
 * use Nullable<T> instead.
 * Attempts to set an optional field (that is, equivalent to adding a field to the object), will throw an error.
 *
 * Example:
 * ```ts
 * class User extends Model {
 *   name: string = "";
 *   age: number = 0;
 *   profile: Profile = new Profile();
 *
 *   constructor() {
 *     super("users");
 *     this.seal();
 *   }
 *
 *   protected relations(): Record<string, ModelClass> {
 *     return {
 *       profile: Profile,
 *     };
 *   }
 * }
 *
 * // Profile class omitted
 *
 * const user = new User();
 * user.name = "Ada";
 * user.age = 25;
 * user.profile.bio = "I travel distances";
 * user.profile.location = "Proxima Centauri";
 * await user.profile.persist();
 * await user.persist();
 * ```
 * Note that all relations must be defined in the relations() method.
 *
 * Different models referencing the same table are allowed. The model below will only have its `name` field populated.
 * Users may find this useful to restrict the fields exposed.
 *
 * ```ts
 * class ApiUser extends Model {
 *   name: string = "";
 *
 *   constructor() {
 *     super("users");
 *   }
 * }
 * ```
 *
 * Retrieving the user from the database will return a User object with the name and age fields populated,
 * and the profile field will be a Profile object. However, the profile's submodels will not be populated
 * due to being end 2nd layer.
 *
 * Call persist() to persist the model to the database. Child models must be persisted before the parent model.
 * Call delete() to delete the model from the database.
 *
 * Note that this class doesn't verify/enforce any database constraints nor create/alter any tables.
 * Constraint violations will be thrown by the database driver.
 *
 * In the eyes of this class, fields with `undefined` values are treated as nonexistent.
 *
 * Identifiers must contain only alphanumeric characters and underscores, cannot start with a digit,
 * and cannot contain double underscores. Field names with double underscores are reserved for internal use.
 *
 * @param table the name of the table this model is stored in
 */
export abstract class Model {
  readonly #table: string;

  #id?: string | number;
  #fields = new Set<string>();
  #isSealed = false;
  #relations: Record<string, ModelClass> = {};

  protected constructor(table: string) {
    if (!VALID_IDENTIFIER_REGEX.test(table)) throw new Error(`Invalid table name: ${table}`);
    if (table.indexOf("__") !== -1) throw new Error(`Table name cannot contain "__": ${table}`);
    this.#table = table;
  }

  protected seal() {
    this.#fields = new Set(Object.keys(this));
    this.#checkFieldNames();
    const relations = this.relations();
    for (const [key, value] of Object.entries(relations)) {
      if (value === undefined || !Object.hasOwn(this, key)) throw new Error(`Relation ${key} is not defined in ${this.#table}`);
    }
    this.#relations = relations;
    Object.seal(this);
    Object.freeze(Object.getPrototypeOf(this));
    this.#isSealed = true;
  }

  #checkFieldNames(keys = this.#fields) {
    for (const key of keys) {
      if (key === "id") throw new Error("Field name 'id' is reserved");
      if (!VALID_IDENTIFIER_REGEX.test(key)) throw new Error(`Invalid field name: ${key}`);
      if (key.indexOf("__") !== -1) throw new Error(`Field name cannot contain "__": ${key}`);
    }
  }

  #checkSealed() {
    if (!this.#isSealed) throw new Error("Model must be sealed before use");
  }

  /**
   * Persists the model to the database. If the model has an id, it will be updated, otherwise it will be inserted.
   * @param id explicitly specify the row's id, otherwise use the db generated id
   */
  async persist(id?: string | number) {
    this.#checkFieldNames();
    this.#checkSealed();

    if (!Number.isInteger(id) && "string" !== typeof id && id !== undefined) throw new Error(
      `id must be a number or a string, got ${typeof id}`
    );

    // leave undefined columns out, but nulls will be persisted as is
    const relations = this.#relations;
    // first pass - raw field names
    const _cols = [...this.#fields]
      .filter(key => key != "id" && key !== "#id" && key !== "#table")
      .filter(key => this[key as keyof this] !== undefined);
    const vals = _cols.map(key => {
      if (relations[key]) {
        const field = this[key as keyof this];
        if (field === null) return null;
        if (!(field instanceof Model)) throw new Error(`Relation ${key} must be a Model`);
        const model = this[key as keyof this] as Model;
        if (model.#id === undefined) throw new TransientRelationError(key);
        return model.#id;
      } else {
        return this[key as keyof this];
      }
    });
    // second pass - actual column names
    const cols = _cols.map(key => relations[key] ? `${key}${RELATION_SUFFIX}` : key);
    // nothing to persist
    if (cols.length === 0 && this.#id !== undefined) return;

    const db = await getDbConnection();
    try {
      if (this.#id === undefined) {
        if (id !== undefined) {
          // insert with explicit id
          const columnSql = ["`id`", ...cols.map(x => `\`${x}\``)].join(", ");
          const valueSql = ["?", ...cols.map(() => "?")].join(", ");
          const sql = `INSERT INTO \`${this.#table}\` (${columnSql}) VALUES (${valueSql})`;
          await db.query<ResultSetHeader>(sql, [id, ...vals]);
          this.#id = id;
        } else {
          // let the db generate the id, this will throw if there's no mechanism to generate an id
          const sql = `INSERT INTO \`${this.#table}\` (${cols.map(x => `\`${x}\``).join(", ")})
                       VALUES (${cols.map(() => "?").join(", ")})`;
          const [result] = await db.query<ResultSetHeader>(sql, vals);
          this.#id = result.insertId;
        }
      } else {
        // update the existing row
        const sql = `UPDATE \`${this.#table}\` SET ${cols.map(x => `\`${x}\` = ?`).join(", ")} WHERE \`id\` = ?`;
        const [result] = await db.query<ResultSetHeader>(sql, [...vals, this.#id]);
        if (result.affectedRows === 0) throw new Error("0 rows affected");
      }
    } finally {
      db.release();
    }
  }

  /**
   * Retrieves the model from the database by id. Throws a ModelNotFoundError if the row is not found.
   * @param id the id of the row to retrieve
   */
  async retrieve(id: string | number) {
    this.#checkFieldNames();
    this.#checkSealed();
    const relationEntries = Object.entries(this.#relations);

    // each referenced model gets a table alias, with t0 being the current model
    const mappingEntries: [string, X][] = [
      ["t0", {field: null as string | null, obj: this as Model, alias: "t0"}],
      ...relationEntries.map(([field, cls], index) => [
        `t${index + 1}`,
        {field, obj: new cls(), alias: `t${index + 1}`},
      ] as [string, X]),
    ];

    // we loop through all referenced models...
    const select = mappingEntries.map(([alias, entry]) => {
      const modelRelations = entry.obj.#relations;
      // ... to look for fields we need to select
      return [
        // ... that includes the id
        "id",
        // ... as well as all the actual fields of the model
        ...[...entry.obj.#fields].filter(x => !Object.hasOwn(modelRelations, x) && !(x === "#id" || x === "#table")),
      ]
        // ... then bundle them into unique column aliases
        .map(field => `${alias}.\`${field}\` as ${quote(`${alias}__${field}`)}`)
        // ... make it sql-ish
        .join(", ");
    })
      // and combine everything into the column list
      .join(", ");

    // to hydrate the child models we need to join the tables
    const joins = mappingEntries.slice(1).map(([alias, entry]) => {
      const {field, obj} = entry;
      const rightTable = obj.#table;
      // left join the referenced model's table, using the alias as the join condition, on field=id
      return `LEFT JOIN ${quote(rightTable)} ${alias} ON t0.${quote(`${field}${RELATION_SUFFIX}`)} = ${alias}.${quote("id")}`;
    })
      .join(" ")

    const db = await getDbConnection();
    try {
      const sql = `SELECT ${select} FROM ${quote(this.#table)} t0 ${joins} WHERE t0.${quote("id")} = ? LIMIT 1`;
      const [rows] = await db.query<RowDataPacket[]>(
        sql,
        [id],
      );
      const row = rows[0];

      if (row === undefined) {
        throw new ModelNotFoundError(this.#table, id);
      }

      // group the returned columns by table alias, we'll then have objects that aligns with the models
      const groupedObjs: Record<string, Record<string, unknown>> = {};
      for (const [key, value] of Object.entries(row)) {
        const [alias, field] = key.split("__");
        groupedObjs[alias] ??= {};
        groupedObjs[alias][field] = value;
      }

      // deal with t0 (this)
      this.#hydrate(groupedObjs.t0);
      for (const [alias, entry] of mappingEntries.slice(1)) {
        if (groupedObjs[alias] === undefined) continue; // shouldn't happen
        if (entry.field === null) continue; // also shouldn't happen since this isn't t0
        if (groupedObjs[alias].id === null) {
          // @ts-expect-error controlled hydration. null id = null row
          this[entry.field as keyof this] = null;
        } else {
          // @ts-expect-error controlled hydration.
          this[entry.field as keyof this] = entry.obj.#hydrate(groupedObjs[alias]);
        }
      }
    } finally {
      db.release();
    }
  }

  /**
   * Deletes the model from the database.
   */
  async delete() {
    this.#checkSealed();
    if (this.#id === undefined) return;
    const db = await getDbConnection();
    try {
      const [result] = await db.query<ResultSetHeader>(`DELETE FROM \`${this.#table}\` WHERE \`id\` = ?`, [this.#id]);
      if (result.affectedRows === 0) throw new Error("0 rows affected");
      // reset the id to undefined since it doesn't exist in the database anymore'
      this.#id = undefined;
    } finally {
      db.release();
    }
  }

  get id() {
    return this.#id;
  }

  toJSON() {
    // @eslint-disable-next-line @typescript-eslint/no-explicit-any
    const o: Record<string, unknown> = {
      id: this.#id,
    };
    for (const key of this.#fields) {
      if (key === "id") continue;
      const v = this[key as keyof this];
      if (v instanceof Model) {
        o[key] = v.toJSON();
      } else {
        o[key] = v;
      }
    }
    return o;
  }

  #hydrate(obj: Record<string, unknown>) {
    for (const key in obj) {
      if (key === "id") {
        this.#id = obj[key] as string | number;
      } else {
        // @ts-expect-error controlled hydration
        this[key as keyof this] = obj[key];
      }
    }
    return this;
  }

  protected relations(): Record<string, ModelClass> {
    return {};
  }
}
