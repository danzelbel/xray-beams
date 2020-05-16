import * as vscode from "vscode";
import { IsInvalidConfig, Config } from "./config";
import { XrayBeams } from "./xrayBeams";
import { XrayTestRepository } from "./xrayTestRepository";

export async function activate(context: vscode.ExtensionContext) {
	vscode.commands.executeCommand("setContext", "xrayBeamsHasInvalidSettings", IsInvalidConfig);
	vscode.commands.registerCommand("xrayBeams.configureSettings", () => vscode.commands.executeCommand("workbench.action.openSettings", "xrayBeams"));
	
	const xrayTestRepository = new XrayTestRepository(new Config());
	new XrayBeams(context, xrayTestRepository);
}