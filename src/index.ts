import dotenv from "dotenv";
dotenv.config();

import { disboardMain, disposeDisboardBrowser } from "./disboard";
import { discordlistMain, disposeDiscordListBrowser } from "./discordlist";

const RELAUNCH_TIMEOUT = Number(process.env.RELAUNCH_TIMEOUT) || 30; // In Minutes
const RELAUNCH_INTERVAL = RELAUNCH_TIMEOUT * 1000 * 60;
const MAXIMUM_ERROR_COUNT = 5;

let errorCount = 0; // This is to prevent the browsers to be in infinite loop if the error repeatedly occurs..

console.log("Starting Bumper Services");

async function main() {
	await discordlistMain();
	await disboardMain();
}

main();

setInterval(() => {
	console.log("Interval reached, re-executing the bumper...");
	main();
	errorCount = 0; //Re-try again
}, RELAUNCH_INTERVAL);

process.on("uncaughtException", (err) => {
	console.error("There was an uncaught error", err);
	if (errorCount < MAXIMUM_ERROR_COUNT) {
		console.log("Restarting the browsers...");
		// These will also dispose the current one if necessary.
		main();
		errorCount++;
	} else {
		console.log(`Maximum of ${MAXIMUM_ERROR_COUNT} have been reached, will not execute until ${RELAUNCH_INTERVAL} elapsed...`);
		disposeDisboardBrowser();
		disposeDiscordListBrowser();
	}
});
