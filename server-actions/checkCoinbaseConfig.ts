"use server";

export async function checkCoinbaseConfig() {
  try {
    const hasKeyId = !!process.env.COINBASE_API_KEY_ID;
    const hasKeySecret = !!process.env.COINBASE_API_KEY_SECRET;
    const isConfigured = hasKeyId && hasKeySecret;
    const isProduction = process.env.NODE_ENV === "production";

    console.log("Coinbase configuration check:", {
      hasKeyId,
      hasKeySecret,
      isConfigured,
      isProduction,
      nodeEnv: process.env.NODE_ENV,
    });

    return {
      isConfigured,
      isProduction,
      hasKeyId,
      hasKeySecret,
    };
  } catch (error) {
    console.error("Error in checkCoinbaseConfig:", error);
    throw new Error("Failed to check Coinbase configuration");
  }
}
