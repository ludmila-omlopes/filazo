function identifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

// Resolve every generated-client column without reading any application rows.
// This catches schema drift even when a table currently has no data.
export async function checkDatabaseSchema(prisma, datamodel, schema = "public") {
  for (const model of datamodel.models) {
    const columns = model.fields
      .filter((field) => field.kind !== "object")
      .map((field) => identifier(field.dbName ?? field.name));
    await prisma.$queryRawUnsafe(
      `SELECT ${columns.join(", ")} FROM ${identifier(schema)}.${identifier(model.dbName ?? model.name)} LIMIT 0`,
    );
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
