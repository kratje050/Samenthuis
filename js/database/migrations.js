import { createSchema } from './database-schema.js';

export function runMigrations(event) {
  const database = event.target.result;
  const transaction = event.target.transaction;
  if (event.oldVersion < 1) createSchema(database, transaction);
  if (event.oldVersion >= 1 && event.oldVersion < 2) createSchema(database, transaction);
  if (event.oldVersion >= 2 && event.oldVersion < 3) createSchema(database, transaction);
}
