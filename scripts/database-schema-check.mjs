function identifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

// Resolve every generated-client column without reading any application rows.
// This catches schema drift even when a table currently has no data.
export async function checkDatabaseSchema(prisma, datamodel, schema = "public") {
  const expectedColumns = [];
  for (const model of datamodel.models) {
    const fields = model.fields.filter((field) => field.kind !== "object");
    const columns = fields.map((field) => identifier(field.dbName ?? field.name));
    await prisma.$queryRawUnsafe(
      `SELECT ${columns.join(", ")} FROM ${identifier(schema)}.${identifier(model.dbName ?? model.name)} LIMIT 0`,
    );
    for (const field of fields) {
      expectedColumns.push({
        table: model.dbName ?? model.name,
        column: field.dbName ?? field.name,
        required: field.isRequired === true,
      });
    }
  }
  const columnRows = await prisma.$queryRawUnsafe(
    `SELECT table_name AS "tableName", column_name AS "columnName", is_nullable AS "isNullable"
     FROM information_schema.columns WHERE table_schema = $1`,
    schema,
  );
  for (const expected of expectedColumns) {
    const actual = columnRows.find(
      (row) => row.tableName === expected.table && row.columnName === expected.column,
    );
    if (!actual) {
      throw new Error(`Missing column: ${expected.table}.${expected.column}`);
    }
    const isNullable = actual.isNullable === "YES";
    if (isNullable === expected.required) {
      throw new Error(
        `Column nullability mismatch: ${expected.table}.${expected.column} is ${
          isNullable ? "nullable" : "required"
        } but the application expects it to be ${expected.required ? "required" : "nullable"}.`,
      );
    }
  }
  const enumRows = await prisma.$queryRawUnsafe(
    `SELECT t.typname AS name, e.enumlabel AS value
     FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
     JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = $1`,
    schema,
  );
  for (const type of datamodel.enums) {
    const name = type.dbName ?? type.name;
    for (const value of type.values) {
      if (!enumRows.some((row) => row.name === name && row.value === (value.dbName ?? value.name))) {
        throw new Error(`Missing enum value: ${name}.${value.name}`);
      }
    }
  }
}

export function shouldCheckDatabase(env) {
  if (env.DATABASE_URL?.trim()) return true;
  if (env.VERCEL === "1") throw new Error("DATABASE_URL is required for Vercel deployments.");
  return false;
}
