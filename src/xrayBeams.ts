import * as vscode from "vscode";
import * as xb from "xray-beams";
import * as path from "path";

export class XrayFolder extends vscode.TreeItem {
	rank: number;
	folderId: number;
	totalTestCount: number;
	folders: XrayFolder[];

	constructor(folder: xb.Folder) {
		super(folder.name);
		this.id = `${folder.id}`;
		this.tooltip = folder.testRepositoryPath;
		this.description = `${folder.testCount} (${folder.totalTestCount})`;
		this.rank = folder.rank;
		this.folderId = folder.id;
		this.totalTestCount = folder.totalTestCount;
		this.folders = folder.folders.map(f => new XrayFolder(f));
		this.collapsibleState = folder.folders.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
	}

	iconPath = {
		light: path.join(__filename, "..", "..", "resources", "light", "folder.svg"),
		dark: path.join(__filename, "..", "..", "resources", "dark", "folder.svg")
	};

	contextValue = "folder";
}

export class XrayTreeDataProvider implements vscode.TreeDataProvider<XrayFolder> {
	private _onDidChangeTreeData: vscode.EventEmitter<XrayFolder | undefined> = new vscode.EventEmitter<XrayFolder | undefined>();
	readonly onDidChangeTreeData: vscode.Event<XrayFolder | undefined> = this._onDidChangeTreeData.event;

	constructor(private readonly xrayTestRepository: xb.XrayTestRepository) { }

	refresh(): void {
		this._onDidChangeTreeData.fire(undefined);
	}

	getTreeItem(folder: XrayFolder): vscode.TreeItem {
		return folder;
	}

	getChildren(folder?: XrayFolder): XrayFolder[] | Thenable<XrayFolder[]> {
		return folder ? folder.folders : this.xrayTestRepository.getFolders().then(f => f.map(f => new XrayFolder(f)));
	}
}

export class XrayBeams {
	private treeView: vscode.TreeView<XrayFolder>;
	private treeDataProvider: XrayTreeDataProvider;

	constructor(context: vscode.ExtensionContext, private xrayTestRepository: xb.XrayTestRepository) {
		this.treeDataProvider = new XrayTreeDataProvider(xrayTestRepository);
		this.treeView = vscode.window.createTreeView('xrayBeams', { treeDataProvider: this.treeDataProvider });

		vscode.window.registerTreeDataProvider("xrayBeams", this.treeDataProvider);
		vscode.commands.registerCommand("xrayBeams.refresh", () => this.treeDataProvider.refresh());
		vscode.commands.registerCommand("xrayBeams.newRootFolder", async () => this.newFolder(-1));
		vscode.commands.registerCommand("xrayBeams.newFolder", async folder => this.newFolder(folder.folderId));
		vscode.commands.registerCommand("xrayBeams.renameFolder", async folder => this.updateFolder(folder));
		vscode.commands.registerCommand("xrayBeams.deleteFolder", async folder => this.deleteFolder(folder.folderId));
	}

	private async newFolder(folderId: number): Promise<xb.Folder> {
		const name = await vscode.window.showInputBox({ placeHolder: "XrayBeams: Folder name" });
		if (!name || !name.trim()) return;
		const newFolder = await this.xrayTestRepository.createFolder(folderId, name);
		this.treeDataProvider.refresh();
		return newFolder;
	}

	private async updateFolder(folder: XrayFolder): Promise<void> {
		const name = await vscode.window.showInputBox({ placeHolder: "XrayBeams: Folder name", value: folder.label });
		if (!name || !name.trim()) return;
		await this.xrayTestRepository.updateFolder(folder.folderId, name, folder.rank);
		this.treeDataProvider.refresh();
	}

	private async deleteFolder(folderId: number): Promise<void> {
		const res = await vscode.window.showWarningMessage("Are you sure you want to delete this folder?", { modal: true }, "Proceed");
		if (res !== "Proceed") return;
		await this.xrayTestRepository.deleteFolder(folderId);
		this.treeDataProvider.refresh();
	}
}