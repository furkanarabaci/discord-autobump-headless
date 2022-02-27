import { BrowserContext, firefox, Locator, Page } from "playwright";
import { login } from "../discordlogin";
import DisboardBumpController from "./disboardbump";

const DISBOARD_URL = "https://disboard.org";
const HEADLESS_MODE = !!process.env.HEADLESS_MODE;

const DISBOARD_DASHBOARD_URL = "/dashboard/servers";
const DISBOARD_LOGIN_URL = "/login";
const DISBOARD_SERVER_BUMP_PATTERN = "/server/bump/";

/**
 * If you change the save path, do not ever forget to put the new file to .gitignore
 */
const STORAGE_SAVE_LOCATION = process.env.STORAGE_SAVE_LOCATION || "state.json";

export async function main() {
	const currentBrowser = await firefox.launch({ headless: HEADLESS_MODE });
	const currentContext = await currentBrowser.newContext({
		baseURL: DISBOARD_URL,
		storageState: STORAGE_SAVE_LOCATION,
	});
	const page = await currentContext.newPage();
	await page.goto(DISBOARD_LOGIN_URL);
	await login(currentContext, page);
	await page.goto(DISBOARD_DASHBOARD_URL);
	const bumpElements = await getBumpElements(page);
	const disboardBumpController = new DisboardBumpController(bumpElements);
}

async function getBumpElements(page: Page) {
	if (!page.url().includes(DISBOARD_DASHBOARD_URL)) {
		await page.goto(DISBOARD_DASHBOARD_URL);
	}
	const linkElements = page.locator("a");
	const linkCount = await linkElements.count();
	const bumpElements: Locator[] = [];
	for (let i = 0; i < linkCount; ++i) {
		const currentElement = linkElements.nth(i);
		const currentHref = await currentElement.getAttribute("href");
		if (currentHref?.includes(DISBOARD_SERVER_BUMP_PATTERN)) {
			bumpElements.push(currentElement);
		}
	}
	return bumpElements;
}
