export function getDatabaseErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("Environment variable not found: DATABASE_URL")) {
    return "Database is not configured. Set DATABASE_URL to a PostgreSQL connection string.";
  }

  if (
    message.includes("the URL must start with the protocol") ||
    message.includes("the URL must start with protocol") ||
    message.includes("must start with `postgresql://`") ||
    message.includes("must start with `postgres://`") ||
    message.includes("Error validating datasource")
  ) {
    return "Database URL must use PostgreSQL. Set DATABASE_URL to a postgresql:// connection string and run npm run db:init.";
  }

  if (
    message.includes("no such table") ||
    message.includes("does not exist in the current database") ||
    message.includes("P2021") ||
    message.includes("P2022")
  ) {
    return "Database schema is not initialized. Run the database setup before using catalog features.";
  }

  if (
    message.includes("Can't reach database server") ||
    message.includes("Timed out fetching a new connection") ||
    message.includes("P1001") ||
    message.includes("P2024")
  ) {
    return "Database is unavailable. Check the PostgreSQL connection and retry.";
  }

  return "Database is unavailable. Check DATABASE_URL and the PostgreSQL database setup.";
}
