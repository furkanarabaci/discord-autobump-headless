import speakeasy, { Encoding } from "speakeasy";

const DISCORD_2FA_SECRET = process.env.DISCORD_2FA_SECRET || "";
const DISCORD_2FA_ENCODING = (process.env.DISCORD_2FA_ENCODING as Encoding) || "base32"; //base32 is used as default on OTP

export function getOTP(secret?: string, encoding?: Encoding) {
	if (!DISCORD_2FA_SECRET) {
		return "";
	}
	return speakeasy.totp({
		secret: secret || DISCORD_2FA_SECRET,
		encoding: encoding || DISCORD_2FA_ENCODING,
	});
}
