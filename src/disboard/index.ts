import { Browser, BrowserContext, Locator, Page, firefox } from "playwright";
import { login } from "../discordlogin";
import DisboardBumpController from "./disboardbump";
import fs from "fs/promises";
import path from "path";

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
	await initStorageSaveLocation();
	console.log("[Disboard] Opening a new browser window...");
	currentBrowser = await firefox.launch({ headless: HEADLESS_MODE, timeout: BROWSER_TIMEOUT, handleSIGHUP: false, handleSIGINT: false, handleSIGTERM: false, slowMo: 100  });
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

	// Anti cloudflare
	await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9'
  });
	await page.evaluate('navigator.userAgent');

	await page.waitForTimeout(1000);
	await page.goto(DISBOARD_LOGIN_URL);
	await page.waitForTimeout(1000);
	await login(context, page);
	console.info("[Disboard] Discord login is successful, going to disboard dashboard...");
	await page.waitForTimeout(1000);
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
		await page.goto(DISBOARD_DASHBOARD_URL, { waitUntil: 'domcontentloaded' });
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

async function initStorageSaveLocation() {
	const saveLocationAbsolutePath = path.join(process.cwd(), STORAGE_SAVE_LOCATION); //One directory
	console.info(saveLocationAbsolutePath);
	const LOG_INDICATOR = "[CookieSaver]";
	try {
		console.log(`${LOG_INDICATOR} Checking if a file in ${STORAGE_SAVE_LOCATION} exists with correct format`);
		await fs.access(STORAGE_SAVE_LOCATION, fs.constants.R_OK | fs.constants.W_OK);
		// File exists if promise passes
		const file = await fs.open(saveLocationAbsolutePath);
		const fileContentAsBuffer = await file.readFile();
		const fileContent = fileContentAsBuffer.toString();
		JSON.parse(fileContent); // Try to parse it, if it doesn't contain an object, it will throw an error
		console.log(`${LOG_INDICATOR} File check in ${STORAGE_SAVE_LOCATION} is correct, proceeding...`);
		await file.close();
		return;
	} catch (e) {
		console.log(`${LOG_INDICATOR} File either doesn't exist or has gibberish data in: ${STORAGE_SAVE_LOCATION}, create/rewrite the content...`);
		// File either doesn't exist or have gibberish data.
		// delete&create one and add {} in it
		const emptyObjectAsBuffer = new Uint8Array(Buffer.from("{}"));
		await fs.writeFile(saveLocationAbsolutePath, emptyObjectAsBuffer);
	}
}
