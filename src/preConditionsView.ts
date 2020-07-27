import * as vscode from "vscode";
import * as xb from "xray-beams";
import { XrayRepository } from "./xrayRepository";
import * as path from "path";

export class ConditionItem extends vscode.TreeItem {
    contextValue = "condition";

    constructor(public issue: xb.Issue) {
        super(issue.fields.summary);
        this.id = issue.key;
        this.description = issue.key;
        this.tooltip = issue.fields.labels.join(' ');
        this.resourceUri = vscode.Uri.parse(`xbfs-c:/issue/${this.id}.feature`);
    }
}

export class PreConditionsTreeDataProvider implements vscode.TreeDataProvider<ConditionItem>, vscode.TextDocumentContentProvider {
    private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

    constructor(private xrayRepository: XrayRepository) { }

    refresh(): any {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: ConditionItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ConditionItem): Promise<ConditionItem[]> {
        const conditions = await this.xrayRepository.getPreConditions();
        const items = conditions.map(c => new ConditionItem(c));
        return items;
    }

    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        const key = path.basename(uri.path).replace('.feature', '');
        return await this.xrayRepository.getPreCondition(key);
    }
}

export class PreConditionsView implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    private treeData: PreConditionsTreeDataProvider;
    private view: vscode.TreeView<PreConditionsTreeDataProvider>;

    constructor(context: vscode.ExtensionContext, private xrayRepository: XrayRepository) {
        this.treeData = new PreConditionsTreeDataProvider(xrayRepository);
        context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider("xbfs-c", this.treeData));
        this.view = vscode.window.createTreeView("preConditionsView", { treeDataProvider: this.treeData });
        this.disposables.push(this.view);

        context.subscriptions.push(vscode.commands.registerCommand("xrayBeams.preConditionsView.refresh", this.refresh, this));
        context.subscriptions.push(vscode.commands.registerCommand("xrayBeams.preConditionsView.openFile", this.openFile, this));
        context.subscriptions.push(vscode.commands.registerCommand("xrayBeams.preConditionsView.addToFeature", this.addToFeature, this));
    }

    refresh(): void {
        this.treeData.refresh();
    }

    async openFile(item: ConditionItem): Promise<void> {
        await vscode.window.showTextDocument(item.resourceUri);
    }

    async addToFeature(item: ConditionItem): Promise<void> {
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