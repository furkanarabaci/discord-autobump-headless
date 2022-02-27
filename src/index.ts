import dotenv from "dotenv";
dotenv.config();

import { main } from "./disboard/disboardmain";

const RELAUNCH_TIMEOUT = Number(process.env.RELAUNCH_TIMEOUT) || 30; // In Minutes
const RELAUNCH_INTERVAL = RELAUNCH_TIMEOUT * 1000 * 60;

console.log("Starting Disboard Bumper");
main();

setInterval(() => {
	console.log("Interval reached, re-executing the bumper...");
	main();
}, RELAUNCH_INTERVAL);
