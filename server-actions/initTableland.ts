"use server";

import { getTablelandDatabase, TRANSACTIONS_TABLE_SCHEMA } from "@/lib/tableland";

export async function initTransactionsTable() {
  try {
    const db = await getTablelandDatabase();

    // Create table (only needs to be run once)
    const { meta: create } = await db.prepare(TRANSACTIONS_TABLE_SCHEMA).run();

    await create.txn?.wait();

    const tableName = create.txn?.names[0] || "";
    console.log(`Created table: ${tableName}`);

    // Store table name in env or return it
    return tableName;
  } catch (error) {
    console.error("Error creating table:", error);
    throw error;
  }
}
