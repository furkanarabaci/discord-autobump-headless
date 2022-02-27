import { BrowserContext, Page } from "playwright";
import speakeasy, { Encoding } from "speakeasy";

const DISCORD_USERNAME = process.env.DISCORD_USERNAME || "";
const DISCORD_PASSWORD = process.env.DISCORD_PASSWORD || "";
/**
 * If you change the save path, do not ever forget to put the new file to .gitignore
 */
const STORAGE_SAVE_LOCATION = process.env.STORAGE_SAVE_LOCATION || "state.json";
const DISCORD_LOGIN_URL = "https://discord.com/login";
const DISCORD_OTP_URL = `${DISCORD_LOGIN_URL}?redirect_to`;
const DISCORD_AUTHORIZE_URL = `https://discord.com/oauth2/authorize`;
const DISCORD_OAUTH_URL_REGEXP = /.*oauth2\/authorize/;

const DISCORD_2FA_SECRET = process.env.DISCORD_2FA_SECRET || "";
const DISCORD_2FA_ENCODING = (process.env.DISCORD_2FA_ENCODING as Encoding) || "base32"; //base32 is used as default on OTP

const DISBOARD_URL = process.env.DISBOARD_URL || "";

/**
 *
 * @param context Uses the context of the open instance (e.g. disboard)
 * @param page Uses the the previous page(e.g. disboard) which the login is requested
 */
export async function login(context: BrowserContext, page: Page) {
	await page.goto("/login");
	//#region Username Password
	if (page.url().includes(DISCORD_LOGIN_URL)) {
		console.log("[Discord] on Login page, filling info related to env...");
		await page.fill('input[name="email"]', DISCORD_USERNAME);
		await page.fill('input[name="password"]', DISCORD_PASSWORD);
		await page.click('button[type="submit"]');
		/**
		 * TODO: Figure out the action if OTP does not exist on the server.
		 * Lately, discord doesn't allow admins and moderators to not have OTP,
		 * therefore this might be ignored. Check it out if somebody complains about it.
		 */
		await page.waitForResponse(/.*login.*/, { timeout: 10000 });
	}
	//#endregion
	//#region OTP
	const otp = getDiscordOTP();
	if (otp && page.url().includes(DISCORD_OTP_URL)) {
		console.log("[Discord] on 2FA page, filling OTP relevant to the secret given in environment...");
		await page.fill("input", otp);
		await page.click('button[type="submit"]');
		await page.waitForNavigation({ url: DISCORD_OAUTH_URL_REGEXP });
	}
	//TODO: If OTP is invalid, you should try again
	//#endregion

	//#region Authorize Disboard
	if (page.url().includes(DISCORD_AUTHORIZE_URL)) {
		console.log("[Discord] on authorize page with Disboard...");
		await page.locator("button").last().click();
		await page.waitForNavigation({ url: new RegExp(`${DISBOARD_URL}`) }); //TODO: Find a better way to wait for authorization to be finished
	}
	//#endregion

	//#region Save cookies
	console.log(`Authorization is successful, Saving the login information to ${STORAGE_SAVE_LOCATION} file...`);
	await context.storageState({ path: STORAGE_SAVE_LOCATION });
	//#endregion
}

export function getDiscordOTP(secret?: string, encoding?: Encoding) {
	if (!DISCORD_2FA_SECRET) {
		console.error("Tried to get OTP but secret doesn't exist. Make sure you fill the value on .env file");
		return "";
	}
	console.info("Getting OTP information...");
	return speakeasy.totp({
		secret: secret || DISCORD_2FA_SECRET,
		encoding: encoding || DISCORD_2FA_ENCODING,
	});
}
