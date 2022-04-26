import dayjs from "dayjs";
import RelativeTime from "dayjs/plugin/relativeTime";
import CustomParseFormat from "dayjs/plugin/customParseFormat";
import { Locator, Page } from "playwright";

dayjs.extend(RelativeTime);
dayjs.extend(CustomParseFormat);

const BUMP_TIMEOUT = 6; // in Hours
/**
 * In Minutes. If a server is soon enough to bump, keep the program running and wait for them to bump.
 */
const BUMP_MAX_WAIT_TIME = 20;

const MAX_RANDOM_MINUTE = 30;
const MIN_RANDOM_MINUTE = 10;

export default class DiscordListBumpController {
	private bumpInstances: DiscordListBump[] = [];
	constructor(private locators: Locator[], private page: Page) {
		console.info("[Discordlist] Successfully landed on discordlist and ready to bump.");
		this.bumpInstances = locators.map((locator) => new DiscordListBump(locator, this.page));
	}

	// async serversCloseToBump() {
	// 	const now = dayjs();
	// 	for (let i = 0; i < this.bumpInstances.length; ++i) {
	// 		await this.bumpInstances[i].invalidateBump();
	// 	}
	// 	const bumpTimesDiffInMinute = this.bumpInstances.map((instance) => Math.abs(now.diff(instance.nextBumpAvailable, "minute")));
	// 	return bumpTimesDiffInMinute.some((minute) => minute <= BUMP_MAX_WAIT_TIME);
	// }
}

class DiscordListBump {
	bumpAvailable = false;
	private bumpElement: Locator;

	/**
	 * It is not that easy to get server ID and bump time on discordlist.
	 * It also isn't relevant outside of logging.
	 */
	private serverID = "1234";
	constructor(private locator: Locator, private page: Page) {
		this.bumpElement = locator;
		this.invalidateBump();
	}
	async bump() {
		console.log("[Discordlist] Starting Bumper");
		if (!this.bumpAvailable) {
			console.log(`[Discordlist] Tried to bump the server but it wasn't available to bump`);
			return; //Additional Guard
		}
		console.log(`[Discordlist] Bumping the server with ID: ${this.serverID}...`);
		await this.bumpElement.click();
		// await this.page.goto(this.bumpURL); // Instead of clicking, navigate to the URL
		await this.page.waitForTimeout(2000); //Let's wait for a little while for good measure.
		console.log(`[Discordlist] Successfully bumped the server with ID: ${this.serverID}.`);
		console.log(`[Discordlist] Closing the page after bump is successful.`);
		this.page.close();
		this.bumpAvailable = false;
		// After this, page will refresh
	}
	async invalidateBump() {
		this.bumpAvailable = await this.isBumpAvailable();
		// If we come across that we can already bump, bump it here as well.
		if (this.bumpAvailable) {
			await this.bump();
			this.bumpAvailable = false;
		}
	}

	async getInnerTextOfBumpElement() {
		return await this.bumpElement.innerHTML();
	}

	async isBumpAvailable() {
		console.log(`[Discordlist] getting bump status of server id: ${this.serverID}...`);
		const bumpText = await this.getInnerTextOfBumpElement();
		const bumpAvailable = bumpText.toLowerCase().includes("bump");
		console.log(`[Discordlist] The server ${this.serverID} is ${bumpAvailable ? "" : "not"} available for bump.`);
		return bumpAvailable;
	}

	randomizeMinuteAndSecond() {
		const randomMinute = Math.max(MIN_RANDOM_MINUTE, Math.random() * MAX_RANDOM_MINUTE);
		const randomSecond = Math.random() * 59; // To the last second
		return {
			minute: Math.floor(randomMinute),
			second: Math.floor(randomSecond),
		};
	}
}
