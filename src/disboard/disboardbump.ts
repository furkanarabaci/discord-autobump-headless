import dayjs from "dayjs";
import RelativeTime from "dayjs/plugin/relativeTime";
import CustomParseFormat from "dayjs/plugin/customParseFormat";
import { Locator } from "playwright";

dayjs.extend(RelativeTime);
dayjs.extend(CustomParseFormat);

const BUMP_TIMEOUT = 2; // in Hours
const DISBOARD_SERVER_BUMP_PATTERN = "/server/bump/";
const DISBOARD_TIME_LEFT_PATTERN = /[0][0-1]:[0-5][0-9]:[0-5][0-9]/;
const DISBOARD_TIME_LEFT_FORMAT = "HH:mm:ss";

const MAX_RANDOM_MINUTE = 30;
const MIN_RANDOM_MINUTE = 10;

export default class DisboardBumpController {
	private bumpInstances: DisboardBump[] = [];
	constructor(private locators: Locator[]) {
		console.info("[Disboard] Successfully landed on disboard and ready to bump.");
		this.bumpInstances = locators.map((locator) => new DisboardBump(locator));
	}
}

class DisboardBump {
	private bumpAvailable = false;
	private bumpTextElement: Locator;
	private bumpElement: Locator;
	private previousBumpTime: dayjs.Dayjs | undefined;
	private nextBumpAvailable: dayjs.Dayjs | undefined;
	private nextBumpTime: dayjs.Dayjs | undefined;
	private serverID = "";
	constructor(private locator: Locator) {
		this.bumpElement = locator;
		this.bumpTextElement = locator.last(); //Currently, disboard holds the bump text on the second span in the bump <a> element.
		this.getServerID();
		this.invalidateBump();
	}

	async getServerID() {
		const locatorHref = await this.locator.getAttribute("href");
		this.serverID = locatorHref?.split(DISBOARD_SERVER_BUMP_PATTERN)[1] || "";
	}

	async bump() {
		if (!this.bumpAvailable) {
			const previousBumpTimeText = this.previousBumpTime ? dayjs().from(this.previousBumpTime) : "unknown";
			console.log(`[Disboard] Tried to bump the server was already recently bumped. Last bumped at ${previousBumpTimeText}`);
			return; //Additional Guard
		}
		console.log(`[Disboard] Bumping the server: ${this.serverID} ...`);
		await this.bumpElement.click();
		this.bumpAvailable = false;
		this.previousBumpTime = dayjs();
		this.generateNewBumpTime();
		// After this, page will refresh
	}
	async invalidateBump() {
		this.bumpAvailable = await this.isBumpAvailable();
		// If we come across that we can already bump, bump it here as well.
		if (this.bumpAvailable) {
			this.bump();
			this.bumpAvailable = false;
		} else {
			this.setRemainingTime();
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
		console.log(`[Disboard] getting bump status of server id: ${this.serverID}...`);
		const bumpAvailable = (await this.getInnerTextOfBumpElement()).toLowerCase() === "bump";
		if (bumpAvailable) {
			console.log(`[Disboard] The server ${this.serverID} is available for bump.`);
		} else {
			console.log(`[Disboard] The server ${this.serverID} is not available for bump.`);
		}
		return bumpAvailable;
	}

	async setRemainingTime() {
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
