import { BrowserContext, Page } from "playwright";
import speakeasy, { Encoding } from "speakeasy";

const DISCORD_USERNAME = process.env.DISCORD_USERNAME || "";
const DISCORD_PASSWORD = process.env.DISCORD_PASSWORD || "";
/**
 * If you change the save path, do not ever forget to put the new file to .gitignore
 */
const STORAGE_SAVE_LOCATION = process.env.STORAGE_SAVE_LOCATION || "state.json";
const DISCORD_LOGIN_URL = "https://discord.com/login";
const DISCORD_OTP_URL = `${DISCORD_LOGIN_URL}?redirect_to=%2Foauth2%2Fauthorize`;
const DISCORD_AUTHORIZE_URL = `https://discord.com/oauth2/authorize`;
const DISCORD_OAUTH_URL_REGEXP = /.*oauth2\/authorize/;

const DISCORD_2FA_SECRET = process.env.DISCORD_2FA_SECRET || "";
const DISCORD_2FA_ENCODING = (process.env.DISCORD_2FA_ENCODING as Encoding) || "base32"; //base32 is used as default on OTP

const OTP_TIMEOUT = 30 * 1000; // 30 seconds

/**
 *
 * @param context Uses the context of the open instance (e.g. disboard)
 * @param page Uses the the previous page(e.g. disboard) which the login is requested
 */
export async function login(context: BrowserContext, page: Page) {
	if (!page.url().includes("/login")) {
		await page.goto("/login");
	}
	//#region Username Password
	if (page.url().includes(DISCORD_LOGIN_URL) || page.url().includes(DISCORD_AUTHORIZE_URL)) {
		console.log("[Discord] on Login page, filling info related to env...");
		try {
			await page.fill('input[name="email"]', DISCORD_USERNAME, { timeout: 3000 });
			await page.fill('input[name="password"]', DISCORD_PASSWORD);
			await page.click('button[type="submit"]');
			/**
			 * TODO: Figure out the action if OTP does not exist on the server.
			 * Lately, discord doesn't allow admins and moderators to not have OTP,
			 * therefore this might be ignored. Check it out if somebody complains about it.
			 */
			await page.waitForResponse(/.*login.*/);
		} catch (e) {
			console.log("[Discord] we are on login url but auth screen shows up, didnt understand this weird url handling. Just continue.");
		}
	}
	//#endregion
	//#region OTP
	const otp = getDiscordOTP();
	if (otp && page.url().includes(DISCORD_OTP_URL)) {
		console.log("[Discord] on 2FA page, filling OTP relevant to the secret given in environment...");
		await page.waitForLoadState();
		try {
			await page.fill("input", otp);
			await page.click('button[type="submit"]');
			await page.waitForNavigation({ url: DISCORD_OAUTH_URL_REGEXP, timeout: OTP_TIMEOUT });
		} catch (e) {
			console.log("[Discord] OTP probably failed, re-try....");
			const newOTP = getDiscordOTP();
			await page.fill("input", newOTP);
			await page.click('button[type="submit"]');
			await page.waitForNavigation({ url: DISCORD_OAUTH_URL_REGEXP });
		}
	}
	//TODO: If OTP is invalid, you should try again
	//#endregion

	//#region Authorize Disboard
	if (page.url().includes(DISCORD_AUTHORIZE_URL)) {
		console.log("[Discord] on authorize page");
		await page.locator("button").last().click();
		await page.waitForNavigation(); //TODO: Find a better way to wait for authorization to be finished
	}
	//#endregion

	//#region Save cookies
	console.log(`[Discord] Authorization is successful, Saving the login information to ${STORAGE_SAVE_LOCATION} file...`);
	await context.storageState({ path: STORAGE_SAVE_LOCATION });
	//#endregion
}

export function getDiscordOTP(secret?: string, encoding?: Encoding) {
	if (!DISCORD_2FA_SECRET) {
		console.error("[Discord] Tried to get OTP but secret doesn't exist. Make sure you fill the value on .env file");
		return "";
	}
	console.info("[Discord] Getting OTP information...");
	return speakeasy.totp({
		secret: secret || DISCORD_2FA_SECRET,
		encoding: encoding || DISCORD_2FA_ENCODING,
	});
}
