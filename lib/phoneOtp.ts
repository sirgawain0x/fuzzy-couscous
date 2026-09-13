import { createHash, randomInt } from "crypto";

const OTP_LENGTH = 6;
const OTP_TTL_MS = 10 * 60 * 1000;

export const normalizeE164Phone = (phoneNumber: string): string | null => {
  const normalized = phoneNumber.trim();
  if (!/^\+[1-9]\d{6,14}$/.test(normalized)) return null;
  return normalized;
};

export const generateOtpCode = (): string => {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
};

export const hashOtpCode = (phoneNumber: string, code: string): string => {
  return createHash("sha256").update(`${phoneNumber}:${code}`).digest("hex");
};

export const getOtpExpiry = (): Date => new Date(Date.now() + OTP_TTL_MS);

export const isOtpExpired = (expiresAt: Date | string): boolean => {
  return new Date(expiresAt).getTime() < Date.now();
};

type TwilioConfig = {
  accountSid: string;
  authToken: string;
  fromNumber: string;
};

export const getTwilioConfig = (): TwilioConfig | null => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) return null;
  return { accountSid, authToken, fromNumber };
};

export const sendSmsOtp = async (phoneNumber: string, code: string): Promise<void> => {
  const twilio = getTwilioConfig();
  if (!twilio) {
    throw new Error("SMS verification is not configured");
  }

  const body = `Your CREATIVE Finance verification code is: ${code}`;
  const params = new URLSearchParams({
    To: phoneNumber,
    From: twilio.fromNumber,
    Body: body,
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${twilio.accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${twilio.accountSid}:${twilio.authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send SMS: ${errorText}`);
  }
};
