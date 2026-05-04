import {getDbConnection} from "@/helpers/db";
import {ResultSetHeader, RowDataPacket} from "mysql2";

export class ModelNotFoundError extends Error {
  constructor(table: string, id: string | number) {
    super(`Row not found in ${table} for id ${id}`);
    this.name = "ModelNotFoundError";
  }
}

export abstract class Model {
  readonly #table: string;

  #id?: string | number;

  protected constructor(table: string) {
    this.#table = table;
  }

  /**
   * Persists the model to the database. If the model has an id, it will be updated, otherwise it will be inserted.
   * @param id explicitly specify the row's id, otherwise use the db generated id
   */
  async persist(id?: string | number) {
    // leave undefined columns out, but nulls will be persisted as is
    const cols = Object.keys(this)
      .filter(key => key !== "#id" && key !== "#table")
      .filter(key => this[key as keyof this] !== undefined);
    const db = await getDbConnection();
    try {
      if (this.#id === undefined) {
        if (id !== undefined) {
          // insert with explicit id
          const columnSql = ["`id`", ...cols.map(x => `\`${x}\``)].join(", ");
          const valueSql = ["?", ...cols.map(() => "?")].join(", ");
          const sql = `INSERT INTO \`${this.#table}\` (${columnSql}) VALUES (${valueSql})`;
          await db.query<ResultSetHeader>(sql, [id, ...cols.map(x => this[x as keyof this])]);
          this.#id = id;
        } else {
          // let the db generate the id, this will throw if there's no mechanism to generate an id
          const sql = `INSERT INTO \`${this.#table}\` (${cols.map(x => `\`${x}\``).join(", ")})
                       VALUES (${cols.map(() => "?").join(", ")})`;
          const [result] = await db.query<ResultSetHeader>(sql, cols.map(x => this[x as keyof this]));
          this.#id = result.insertId;
        }
      } else {
        // update the existing row
        const sql = `UPDATE \`${this.#table}\` SET ${cols.map(x => `\`${x}\` = ?`).join(", ")} WHERE \`id\` = ?`;
        await db.query(sql, [...cols.map(x => this[x as keyof this]), this.#id]);
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
    const db = await getDbConnection();
    try {
      const [rows] = await db.query<RowDataPacket[]>(
        `SELECT * FROM \`${this.#table}\` WHERE \`id\` = ? LIMIT 1`,
        [id],
      );
      const row = rows[0];

      if (row === undefined) {
        throw new ModelNotFoundError(this.#table, id);
      }

      for (const [key, value] of Object.entries(row)) {
        if (key !== "id") {
          (this as Record<string, unknown>)[key] = value;
        }
      }
      this.#id = id;
    } finally {
      db.release();
    }
  }

  /**
   * Deletes the model from the database.
   */
  async delete() {
    if (this.#id === undefined) return;
    const db = await getDbConnection();
    try {
      await db.query(`DELETE FROM \`${this.#table}\` WHERE \`id\` = ?`, [this.#id]);
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
    return {
      ...Object.fromEntries(Object.entries(this)),
      id: this.#id,
    };
  }
}
