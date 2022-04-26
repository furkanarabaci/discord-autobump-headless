import { Browser, BrowserContext, firefox, Locator, Page } from "playwright";
import { login } from "../discordlogin";
import DiscordListBumpController from "./discordlistbump";

const DISCORDLIST_URL = "https://discordlist.me";
const HEADLESS_MODE = process.env.HEADLESS_MODE === "true";

const DISCORDLIST_DASHBOARD_URL = "/manage/servers";
const DISCORDLIST_LOGIN_URL = "/manage/servers";
const DISCORDLIST_SERVER_BUMP_TEXT = "Bump"; // No link available on discordlist, search through text only.

const BROWSER_TIMEOUT = 2 * 1000 * 60; //2 minutes

/**
 * If you change the save path, do not ever forget to put the new file to .gitignore
 */
const STORAGE_SAVE_LOCATION = process.env.STORAGE_SAVE_LOCATION || "state.json";

let currentBrowser: Browser | undefined;
let currentContext: BrowserContext | undefined;

export async function discordlistMain() {
	if (currentBrowser) {
		console.log("[Discordlist] cleaning up after re-start...");
		disposeDiscordListBrowser();
	}
	console.log("[Discordlist] Opening a new browser window...");
	currentBrowser = await firefox.launch({ headless: HEADLESS_MODE, timeout: BROWSER_TIMEOUT, handleSIGHUP: false, handleSIGINT: false, handleSIGTERM: false });
	currentContext = await currentBrowser.newContext({
		baseURL: DISCORDLIST_URL,
		storageState: STORAGE_SAVE_LOCATION,
	});
	await openDiscordListPage(currentContext);
	return currentBrowser;
}

export function disposeDiscordListBrowser() {
	console.log("[Discordlist] Closing the browser window...");
	currentBrowser?.close();
	currentBrowser = undefined;
	currentContext = undefined;
}

async function openDiscordListPage(context: BrowserContext) {
	console.log("[Discordlist] Opening a new discordlist page...");
	const page = await context.newPage();
	await page.goto(DISCORDLIST_LOGIN_URL);
	await login(context, page);
	console.info("[Discordlist] Discord login is successful, going to discordlist dashboard...");
	await page.goto(DISCORDLIST_DASHBOARD_URL, { waitUntil: "networkidle" });
	await prepareDiscordListAndBumper(page);
}

async function prepareDiscordListAndBumper(page: Page) {
	const bumpElements = await getBumpElements(page);
	// const isThereAServerCloseToBump = await DiscordListBumpController.serversCloseToBump();
	if (bumpElements.length === 0) {
		console.log("[Discordlist] No server is available to bump, closing the browser...");
		// disposeDiscordListBrowser(); // It means there are no server close to bump. Close the browser.
	} else {
		console.log("[Discordlist] A server will be bumped soon, waiting...");
		new DiscordListBumpController(bumpElements, page);
	}
}

async function getBumpElements(page: Page) {
	console.info("[Discordlist] on dashboard, collecting server(s) information...");
	if (!page.url().includes(DISCORDLIST_DASHBOARD_URL)) {
		await page.goto(DISCORDLIST_DASHBOARD_URL);
	}
	const linkElements = page.locator(`a`, { hasText: DISCORDLIST_SERVER_BUMP_TEXT });
	const linkCount = await linkElements.count();
	const bumpElements: Locator[] = [];
	for (let i = 0; i < linkCount; ++i) {
		const currentElement = linkElements.nth(i);
		const currentText = await currentElement.innerHTML();
		console.info(currentText);
		if (currentText?.includes(DISCORDLIST_SERVER_BUMP_TEXT)) {
			bumpElements.push(currentElement);
		}
	}
	return bumpElements;
}
