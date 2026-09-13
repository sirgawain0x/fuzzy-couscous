import { NextResponse } from "next/server";
import { checkBotId } from "botid/server";
import { initTransactionsTable } from "@/server-actions/initTableland";

export async function POST() {
  const verification = await checkBotId();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const tableName = await initTransactionsTable();
    return NextResponse.json({
      tableName,
      success: true,
      message: `Table created: ${tableName}. Add TABLELAND_TABLE_NAME=${tableName} to your .env.local`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
      },
      { status: 500 }
    );
  }
}
