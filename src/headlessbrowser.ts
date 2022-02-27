import { Browser, BrowserContext, chromium, firefox, Page } from "playwright";
import { getOTP } from "./otp";

const DISBOARD_URL = process.env.DISBOARD_URL || "";
const HEADLESS_MODE = !process.env.HEADLESS_MODE;
const DISCORD_USERNAME = process.env.DISCORD_USERNAME || "";
const DISCORD_PASSWORD = process.env.DISCORD_PASSWORD || "";

const STORAGE_SAVE_LOCATION = "state.json";
const DISCORD_LOGIN_URL = "discord.com/login";
const DISCORD_OTP_URL = `${DISCORD_LOGIN_URL}?redirect_to`;
const DISCORD_AUTHORIZE_URL = `discord.com/oauth2/authorize`;
const DISCORD_OAUTH_URL_REGEXP = /.*oauth2\/authorize/;

let currentContext: BrowserContext;

export async function main() {
	const currentBrowser = await firefox.launch({ headless: HEADLESS_MODE });
	currentContext = await currentBrowser.newContext({
		baseURL: DISBOARD_URL,
		storageState: STORAGE_SAVE_LOCATION,
	});
	const page = await currentContext.newPage();
	await login(page);
	await disboardMainPage(page);
}

async function login(page: Page) {
	await page.goto("/login");
	//#region Username Password
	if (page.url().includes(DISCORD_LOGIN_URL)) {
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
	const otp = getOTP();
	if (otp && page.url().includes(DISCORD_OTP_URL)) {
		await page.fill("input", getOTP());
		await page.click('button[type="submit"]');
		await page.waitForNavigation({ url: DISCORD_OAUTH_URL_REGEXP });
	}
	//TODO: If OTP is invalid, you should try again
	//#endregion

	//#region Authorize Disboard
	if (page.url().includes(DISCORD_AUTHORIZE_URL)) {
		await page.locator("button").last().click();
		await page.waitForNavigation({ url: new RegExp(`${DISBOARD_URL}`) });
	}
	//#endregion

	//#region Save cookies
	await currentContext.storageState({ path: STORAGE_SAVE_LOCATION });
	//#endregion
}

async function disboardMainPage(page: Page) {
	await page.goto("/dashboard/servers");
}
