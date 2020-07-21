import * as vscode from "vscode";
import * as xb from "xray-beams";
import { XrayRepository } from "./xrayRepository";
import * as path from "path";

export class TestItem extends vscode.TreeItem {
    contextValue = "scenario";

    constructor(public test: xb.Test) {
        super(test.summary);
        this.id = `${test.key}`;
        this.description = test.key;
        this.tooltip = test.labels.join(' ');
        this.resourceUri = vscode.Uri.parse(`xbfs-o:/issue/${this.id}.feature`);
    }
}

export class OrphansTreeDataProvider implements vscode.TreeDataProvider<TestItem>, vscode.TextDocumentContentProvider {
    private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

    constructor(private xrayRepository: XrayRepository) { }

    refresh(): any {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: TestItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: TestItem): Promise<TestItem[]> {
        const tests = await this.xrayRepository.getOrphans();
        const testItems = tests.map(t => new TestItem(t));
        return testItems;
    }

    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        const key = path.basename(uri.path).replace('.feature', '');
        return await this.xrayRepository.getScenario(key);
    }
}

export class OrphansView implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    private treeData: OrphansTreeDataProvider;
    private view: vscode.TreeView<OrphansTreeDataProvider>;

    constructor(context: vscode.ExtensionContext, xrayRepository: XrayRepository) {
        this.treeData = new OrphansTreeDataProvider(xrayRepository);
        context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider("xbfs-o", this.treeData));
        this.view = vscode.window.createTreeView("orphansView", { treeDataProvider: this.treeData });
        this.disposables.push(this.view);

        context.subscriptions.push(vscode.commands.registerCommand("xrayBeams.orphansView.refresh", this.refresh, this));
        context.subscriptions.push(vscode.commands.registerCommand("xrayBeams.orphansView.openFile", this.openFile, this));
        context.subscriptions.push(vscode.commands.registerCommand("xrayBeams.orphansView.addToFeature", this.addToFeature, this));
    }

    refresh(): void {
        this.treeData.refresh();
    }

    async openFile(item: TestItem): Promise<void> {
        await vscode.window.showTextDocument(item.resourceUri);
    }

    async addToFeature(item: TestItem): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.uri.scheme === "xbfs" && editor.document.languageId === "feature") {
            const content = await this.treeData.provideTextDocumentContent(item.resourceUri);
            const startPos = editor.selection.end;
            editor.edit(b => b.insert(startPos, content));
            const lines = content.split('\n');
            const endPos = new vscode.Position(startPos.line + lines.length, lines[lines.length - 1].length);
            editor.selection = new vscode.Selection(startPos, endPos);
        }
    }

    dispose(): void {
        this.disposables.forEach(d => d.dispose());
    }
}