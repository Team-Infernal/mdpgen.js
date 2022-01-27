#!/usr/bin/env node
import chalk from "chalk";
import inquirer from "inquirer";
import gradient from "gradient-string";
import figlet from "figlet";
import { createSpinner } from "nanospinner";
import { createRequire } from "module";
import * as fs from "fs";
const require = createRequire(import.meta.url);
const pkg = require("./package.json");
const config = require("./config.json");
let profiles = require("./profiles.json");

const sleep = (ms = 1000) => new Promise((r) => setTimeout(r, ms));

async function mdpgen() {
	const title = `mdpgen v${(pkg.version)}`;
	figlet(title, (err, data) => {
		console.log(gradient.pastel.multiline(data));
	});
	await sleep();
	return selectMode();
}

async function selectMode() {
	console.log();
	const answers = await inquirer.prompt({
		name: "mode",
		type: "list",
		message: "What do you want to do?\n",
		choices: [
			"Generate a new password (using profile)",
			"Generate a new password (on the fly)",
			"View available password profiles",
			"Create a new password profile",
			"Delete an existing password profile",
		],
	});

	switch (answers.mode) {
		case "Generate a new password (using profile)": return generatePasswordProfile();
		case "Generate a new password (on the fly)": return generatePassword();
		case "View available password profiles": return viewProfiles();
		case "Create a new password profile": return createProfile();
		case "Delete an existing password profile": return deleteProfile();
	}
}

async function backToModeSelect() {
	const answer = await inquirer.prompt({
		name: "continue",
		type: "confirm",
		message: "Go back to mode selection?",
	});

	if (answer.continue) return selectMode();
	else {
		console.log(chalk.cyan.bold("Thanks for using mdpgen!"));
		return process.exit(0);
	}
}

async function generatePasswordProfile() {
	const questions = [
		{
			name: "profile",
			type: "list",
			message: "Profile",
			choices: [
				...profiles.map(profile => profile.name),
				//...profiles.map(profile => `${profile.name} (length: ${profile.settings.length}, charset: ${profile.settings.characterSet.map(charset => charset[0].toUpperCase()).join("")})`),
			]
		},
		{
			name: "count",
			type: "number",
			message: "Number of passwords",
			default() {
				return 1;
			},
			validate(value) {
				if (value < 1) return "You need to generate at least 1 password."
				return true;
			}
		},
	];
	await inquirer.prompt(questions).then(answers => {
		const profile = profiles.filter(profile => profile.name === answers.profile)[0];
		const passwordLength = profile.settings.length;
		const passwordCharset = profile.settings.characterSet;
		const passwordCount = Math.round(answers.count);
		passgen(passwordLength, passwordCharset, passwordCount);
	});
	return backToModeSelect();
}

function passgen(length, charset, count) {
	const configCharsets = config.characterSets;
	console.log(chalk.cyan.bold("Passwords\n"));
	for (let i = 0; i < count; i++) {
		let password = "";
		for (let j = 0; j < length; j++) {
			const cs = configCharsets[charset[Math.floor(Math.random() * charset.length)]];
			password += cs[Math.floor(Math.floor(Math.random() * cs.length))];
		}
		console.log(chalk.green.bold(password));
	}
	console.log();
}

async function generatePassword() {
	const questions = [
		{
			name: "length",
			type: "number",
			message: "Password length",
			default() {
				return 1;
			},
			validate(value) {
				if (value < 1) return "Your password needs to be at least 1 character long.";
				return true;
			},
		},
		{
			name: "characterSet",
			type: "checkbox",
			message: "Character Sets",
			choices: [
				{
					name: "lowercase",
				},
				{
					name: "UPPERCASE",
				},
				{
					name: "Numbers",
				},
				{
					name: "Special",
				}
			],
			validate(answer) {
				if (answer.length < 1) return "You need to pick at least one character set.";
				return true;
			},
		},
		{
			name: "count",
			type: "number",
			message: "Number of passwords",
			default() {
				return 1;
			},
			validate(value) {
				if (value < 1) return "You need to generate at least 1 password."
				return true;
			}
		},
	];

	await inquirer.prompt(questions).then(answers => {
		const passwordLength = Math.round(answers.length);
		const passwordCharset = answers.characterSet;
		const passwordCount = Math.round(answers.count);
		passgen(passwordLength, passwordCharset, passwordCount);
	});

	return backToModeSelect();
}

async function viewProfiles() {
	console.log(chalk.cyan.bold("\nAvailable profiles:\n"));
	for (const profile of profiles) {
		console.log(`${chalk.blue.bold(profile.name)}\n - Length: ${chalk.blue(profile.settings.length)}\n - Character set: ${chalk.blue(profile.settings.characterSet.join(", "))}\n`)
	}
	return backToModeSelect();
}

async function createProfile() {
	const questions = [
		{
			name: "name",
			type: "input",
			message: "Profile name",
			validate(answer) {
				const check = profiles.some(profile => profile.name === answer);
				if (!check) return true;
				return "That profile name is already in use.";
			},
		},
		{
			name: "length",
			type: "number",
			message: "Password length",
			default() {
				return 16;
			},
			validate(value) {
				if (value < 4) return "Your password needs to be at least 4 characters long."
				return true;
			},
		},
		{
			name: "characterSet",
			type: "checkbox",
			message: "Character Sets",
			choices: [
				{
					name: "lowercase",
				},
				{
					name: "UPPERCASE",
				},
				{
					name: "Numbers",
				},
				{
					name: "Special",
				}
			],
			validate(answer) {
				if (answer.length < 1) return "You need to pick at least one character set.";
				return true;
			}
		}
	];

	await inquirer.prompt(questions).then(answers => {
		const profileData = {
			"name": answers.name.trim(),
			"settings": {
				"length": answers.length,
				"characterSet": answers.characterSet,
			},
		};
		profiles.push(profileData);
		const profilesJson = JSON.stringify(profiles, null, 4);
		fs.writeFileSync("profiles.json", profilesJson);
		console.log(chalk.green.bold(`Successfully added ${answers.name}!\n`));
	});
	return backToModeSelect();
}

async function deleteProfile() {
	await inquirer.prompt({
		name: "profiles",
		type: "checkbox",
		message: "Profile(s) to delete",
		choices: [
			...profiles.map(profile => profile.name),
		],
		validate(answers) {
			if (answers.length < 1) return "Please select at least 1 profile (CTRL+C to cancel)";
			return true;
		}
	}).then(answers => {
		profiles = profiles.filter(profile => !answers.profiles.includes(profile.name));
		const profilesJson = JSON.stringify(profiles, null, 4);
		fs.writeFileSync("profiles.json", profilesJson);
		console.log(chalk.green.bold(`Successfully deleted ${answers.profiles.join(", ")}!\n`));
	});
	return backToModeSelect();
}

await mdpgen();