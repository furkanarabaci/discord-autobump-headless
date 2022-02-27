import dayjs from "dayjs";
import RelativeTime from "dayjs/plugin/relativeTime";
import CustomParseFormat from "dayjs/plugin/customParseFormat";
import { Locator, Page } from "playwright";

dayjs.extend(RelativeTime);
dayjs.extend(CustomParseFormat);

const BUMP_TIMEOUT = 2; // in Hours
/**
 * In Minutes. If a server is soon enough to bump, keep the program running and wait for them to bump.
 */
const BUMP_MAX_WAIT_TIME = 20;
const DISBOARD_SERVER_BUMP_PATTERN = "/server/bump/";
const DISBOARD_TIME_LEFT_PATTERN = /[0][0-1]:[0-5][0-9]:[0-5][0-9]/;
const DISBOARD_TIME_LEFT_FORMAT = "HH:mm:ss";

const MAX_RANDOM_MINUTE = 30;
const MIN_RANDOM_MINUTE = 10;

export default class DisboardBumpController {
	private bumpInstances: DisboardBump[] = [];
	constructor(private locators: Locator[], private page: Page) {
		console.info("[Disboard] Successfully landed on disboard and ready to bump.");
		this.bumpInstances = locators.map((locator) => new DisboardBump(locator, this.page));
	}

	async serversCloseToBump() {
		const now = dayjs();
		for (let i = 0; i < this.bumpInstances.length; ++i) {
			await this.bumpInstances[i].invalidateBump();
		}
		const bumpTimesDiffInMinute = this.bumpInstances.map((instance) => Math.abs(now.diff(instance.nextBumpAvailable, "minute")));
		return bumpTimesDiffInMinute.some((minute) => minute <= BUMP_MAX_WAIT_TIME);
	}
}

class DisboardBump {
	bumpAvailable = false;
	private bumpTextElement: Locator;
	private bumpElement: Locator;
	previousBumpTime: dayjs.Dayjs | undefined;
	nextBumpAvailable: dayjs.Dayjs | undefined;
	nextBumpTime: dayjs.Dayjs | undefined;
	private serverID = "";
	private bumpURL = "";
	constructor(private locator: Locator, private page: Page) {
		this.bumpElement = locator;
		this.bumpTextElement = locator.last(); //Currently, disboard holds the bump text on the second span in the bump <a> element.
	}

	async getServerInformation() {
		const locatorHref = await this.locator.getAttribute("href");
		this.serverID = locatorHref?.split(DISBOARD_SERVER_BUMP_PATTERN)[1] || "";
		this.bumpURL = locatorHref || "";
	}

	async bump() {
		if (!this.bumpAvailable) {
			const previousBumpTimeText = this.previousBumpTime ? dayjs().from(this.previousBumpTime) : "unknown";
			console.log(`[Disboard] Tried to bump the server was already recently bumped. Last bumped at ${previousBumpTimeText}`);
			return; //Additional Guard
		}
		console.log(`[Disboard] Bumping the server with ID:${this.serverID}...`);
		// await this.bumpElement.click(); This doesn't work due to bug: https://github.com/microsoft/playwright/issues/12298
		await this.page.goto(this.bumpURL); // Instead of clicking, navigate to the URL
		await this.page.waitForTimeout(2000); //Let's wait for a little while for good measure.
		console.log(`[Disboard] Successfully bumped the server with ID:${this.serverID}.`);
		this.bumpAvailable = false;
		this.previousBumpTime = dayjs();
		this.generateNewBumpTime();
		// After this, page will refresh
	}
	async invalidateBump() {
		this.bumpAvailable = await this.isBumpAvailable();
		// If we come across that we can already bump, bump it here as well.
		if (this.bumpAvailable) {
			await this.bump();
			this.bumpAvailable = false;
		} else {
			await this.setBumpTimes();
		}
	}

	async getInnerTextOfBumpElement() {
		return await this.bumpTextElement.innerText();
	}
	generateNewBumpTime() {
		const randomNewTime = this.randomizeMinuteAndSecond();
		this.nextBumpAvailable = dayjs().add(BUMP_TIMEOUT, "hour");
		this.nextBumpTime = this.nextBumpAvailable.add(randomNewTime.minute, "minutes").add(randomNewTime.second, "second");
	}
	async isBumpAvailable() {
		await this.getServerInformation();
		console.log(`[Disboard] getting bump status of server id: ${this.serverID}...`);
		const bumpText = await this.getInnerTextOfBumpElement();
		const bumpAvailable = bumpText.toLowerCase().includes("bump");
		console.log(`[Disboard] The server ${this.serverID} is ${bumpAvailable ? "" : "not"} available for bump.`);
		return bumpAvailable;
	}

	async setBumpTimes() {
		const innerText = await this.getInnerTextOfBumpElement();
		const isValidTime = DISBOARD_TIME_LEFT_PATTERN.test(innerText);
		if (isValidTime) {
			const bumpTimeParsed = innerText.split(":");
			const bumpTimeFormatted = {
				hour: Number(bumpTimeParsed[0]),
				minute: Number(bumpTimeParsed[1]),
				second: Number(bumpTimeParsed[2]),
			};
			const hourSubtracted = dayjs().subtract(bumpTimeFormatted.hour, "hour");
			const minuteSubtracted = hourSubtracted.subtract(bumpTimeFormatted.minute, "minute");
			const secondSubtracted = minuteSubtracted.subtract(bumpTimeFormatted.second, "second");
			this.previousBumpTime = secondSubtracted;

			const bumpHourText = bumpTimeFormatted.hour ? `${bumpTimeFormatted.hour} hours ` : "";
			const bumpMinuteText = bumpTimeFormatted.minute ? `${bumpTimeFormatted.minute} minutes ` : "";
			const bumpSecondText = bumpTimeFormatted.second ? `${bumpTimeFormatted.second} seconds` : "";
			this.nextBumpAvailable = dayjs().add(bumpTimeFormatted.hour, "hour").add(bumpTimeFormatted.minute, "minutes").add(bumpTimeFormatted.second, "second");
			console.log(`[Disboard] time left to bump server ${this.serverID}: ${bumpHourText}${bumpMinuteText}${bumpSecondText}`);
		}
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
