import * as vscode from "vscode";
import { Config } from "./config";
import { XrayRepository } from "./xrayRepository";
import { XrayBeamsFS, EntryLookup, Directory } from "./xrayFileSystemProvider";
import { OrphansView } from "./orphansView";
import { PreConditionsView } from "./preConditionsView";
import * as path from "path";

export async function activate(context: vscode.ExtensionContext) {
	const cfg = new Config();
	const lookup = new EntryLookup();
	const xrayRepository = new XrayRepository();
	const orphansView = new OrphansView(context, xrayRepository);
	const preConditionsView = new PreConditionsView(context, xrayRepository);

	const xbfs = new XrayBeamsFS(lookup, xrayRepository);
	context.subscriptions.push(vscode.workspace.registerFileSystemProvider("xbfs", xbfs));
	context.subscriptions.push(vscode.commands.registerCommand("xrayBeams.refresh", async () => initWorkspace()));

	context.subscriptions.push(vscode.workspace.onDidRenameFiles(async e => {
		await Promise.all(e.files.map(async v => {
			if (v.newUri.scheme !== "xbfs" && lookup.lookup(v.newUri, false) instanceof Directory) { return; }
			const oldName = `${path.posix.basename(v.oldUri.path)}.feature`;
			const newName = `${path.posix.basename(v.newUri.path)}.feature`;
			await xbfs.rename(vscode.Uri.joinPath(v.newUri, oldName), vscode.Uri.joinPath(v.newUri, newName), { overwrite: true }, true);
		}));
		await xbfs.refresh();
		orphansView.refresh();
		preConditionsView.refresh();
	}));

	context.subscriptions.push(vscode.workspace.onDidDeleteFiles(async e => {
		await xbfs.refresh();
		orphansView.refresh();
		preConditionsView.refresh();
	}));

	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async e => {
		if (!e.affectsConfiguration("xrayBeams")) { return; }
		await xbfs.refresh();
		orphansView.refresh();
		preConditionsView.refresh();
	}));

	async function initWorkspace(): Promise<void> {
		const wsf = vscode.workspace.workspaceFolders;
		if (wsf && wsf.length === 1 && wsf[0].name === cfg.projectKey && wsf[0].uri.scheme === "xbfs") {
			vscode.commands.executeCommand("workbench.view.explorer");
			const isSet = await cfg.setConfig();
			if (!isSet) { return; }

			vscode.window.setStatusBarMessage("Loading folders...", 2000);
			await xrayRepository.init(cfg);
			await xbfs.refresh();
			orphansView.refresh();
			preConditionsView.refresh();
			vscode.window.setStatusBarMessage("Loading folders done", 2000);
		}
	}

	await initWorkspace();
}