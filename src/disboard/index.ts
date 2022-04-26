import { Browser, BrowserContext, firefox, Locator, Page } from "playwright";
import { login } from "../discordlogin";
import DisboardBumpController from "./disboardbump";

const DISBOARD_URL = "https://disboard.org";
const HEADLESS_MODE = process.env.HEADLESS_MODE === "true";

const DISBOARD_DASHBOARD_URL = "/dashboard/servers";
const DISBOARD_LOGIN_URL = "/login";
const DISBOARD_SERVER_BUMP_PATTERN = "/server/bump/";

const BROWSER_TIMEOUT = 2 * 1000 * 60; //2 minutes

/**
 * If you change the save path, do not ever forget to put the new file to .gitignore
 */
const STORAGE_SAVE_LOCATION = process.env.STORAGE_SAVE_LOCATION || "state.json";

let currentBrowser: Browser | undefined;
let currentContext: BrowserContext | undefined;

export async function disboardMain() {
	if (currentBrowser) {
		console.log("[Disboard] cleaning up after re-start...");
		disposeDisboardBrowser();
	}
	console.log("[Disboard] Opening a new browser window...");
	currentBrowser = await firefox.launch({ headless: HEADLESS_MODE, timeout: BROWSER_TIMEOUT, handleSIGHUP: false, handleSIGINT: false, handleSIGTERM: false });
	currentContext = await currentBrowser.newContext({
		baseURL: DISBOARD_URL,
		storageState: STORAGE_SAVE_LOCATION,
	});
	await openDisboardPage(currentContext);
	return currentBrowser;
}

export function disposeDisboardBrowser() {
	console.log("[Disboard] Closing the browser window...");
	currentBrowser?.close();
	currentBrowser = undefined;
	currentContext = undefined;
}

async function openDisboardPage(context: BrowserContext) {
	console.log("[Disboard] Opening a new page...");
	const page = await context.newPage();
	await page.goto(DISBOARD_LOGIN_URL);
	await login(context, page);
	console.info("[Disboard] Discord login is successful, going to disboard dashboard...");
	await page.goto(DISBOARD_DASHBOARD_URL);
	await prepareDisboardAndBumper(page);
}

async function prepareDisboardAndBumper(page: Page) {
	const bumpElements = await getBumpElements(page);
	const disboardBumpController = new DisboardBumpController(bumpElements, page);
	const isThereAServerCloseToBump = await disboardBumpController.serversCloseToBump();
	if (!isThereAServerCloseToBump) {
		console.log("[Disboard] No server is available to bump soon, closing the browser...");
		disposeDisboardBrowser(); // It means there are no server close to bump. Close the browser.
	} else {
		console.log("[Disboard] A server will be available to bump soon, waiting...");
	}
}

async function getBumpElements(page: Page) {
	console.info("[Disboard] on dashboard, collecting server(s) information...");
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
