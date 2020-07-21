import * as vscode from "vscode";
import * as xb from "xray-beams";
import { XrayRepository } from "./xrayRepository";
import * as path from "path";
import { Gherkin } from "./gherkin";
import { outputChannel } from "./panels";

export class File implements vscode.FileStat {
    type: vscode.FileType;
    ctime: number;
    mtime: number;
    size: number;
    data?: Uint8Array;
    pullData: boolean = true;

    constructor(public name: string, public folder?: xb.Folder) {
        this.type = vscode.FileType.File;
        this.ctime = Date.now();
        this.mtime = Date.now();
        this.size = 0;
    }
}

export class Directory implements vscode.FileStat {
    type: vscode.FileType;
    ctime: number;
    mtime: number;
    size: number;
    entries: Map<string, File | Directory> = new Map();

    constructor(public name: string, public folder?: xb.Folder) {
        this.type = vscode.FileType.Directory;
        this.ctime = Date.now();
        this.mtime = Date.now();
        this.size = 0;
    }
}

export type Entry = File | Directory;

export class XrayTextDocumentProvider implements vscode.TextDocumentContentProvider {
    constructor(private lookup: EntryLookup, private xrayRepository: XrayRepository) { }

    async provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): Promise<string> {
        if (token.isCancellationRequested) return "Canceled";
        var entry = this.lookup.lookupAsFile(uri, false);
        return await this.xrayRepository.getFeature(entry.folder);
    }
}

class XrayQuickDiffProvider implements vscode.QuickDiffProvider {
    provideOriginalResource(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Uri> {
        return uri.with({ scheme: "xbfs-scm" });
    }
}

export class EntryLookup {
    root = new Directory('');

    lookup(uri: vscode.Uri, silent: false): Entry;
    lookup(uri: vscode.Uri, silent: boolean): Entry | undefined;
    lookup(uri: vscode.Uri, silent: boolean): Entry | undefined {
        let parts = uri.path.split('/');
        let entry: Entry = this.root;
        for (const part of parts) {
            if (!part) {
                continue;
            }
            let child: Entry | undefined;
            if (entry instanceof Directory) {
                child = entry.entries.get(part);
            }
            if (!child) {
                if (!silent) {
                    throw vscode.FileSystemError.FileNotFound(uri);
                } else {
                    return undefined;
                }
            }
            entry = child;
        }
        return entry;
    }

    lookupAsDirectory(uri: vscode.Uri, silent: boolean): Directory {
        let entry = this.lookup(uri, silent);
        if (entry instanceof Directory) {
            return entry;
        }
        throw vscode.FileSystemError.FileNotADirectory(uri);
    }

    lookupAsFile(uri: vscode.Uri, silent: boolean): File {
        let entry = this.lookup(uri, silent);
        if (entry instanceof File) {
            return entry;
        }
        throw vscode.FileSystemError.FileIsADirectory(uri);
    }

    lookupParentDirectory(uri: vscode.Uri): Directory {
        const dirname = uri.with({ path: path.posix.dirname(uri.path) });
        return this.lookupAsDirectory(dirname, false);
    }
}

export class XraySourceControl implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    private scm: vscode.SourceControl;
    changedResources: vscode.SourceControlResourceGroup;
    origEntries: Map<string, xb.Folder>;
    private gherkin: Gherkin;

    constructor(context: vscode.ExtensionContext, private lookup: EntryLookup, private xrayRepository: XrayRepository, private xbfs: XrayBeamsFS) {
        this.scm = vscode.scm.createSourceControl("xray", "Xray", vscode.Uri.parse("xbfs:/"));
        this.disposables.push(this.scm);
        this.changedResources = this.scm.createResourceGroup("workingTree", "CHANGES");
        this.disposables.push(this.changedResources);
        this.scm.quickDiffProvider = new XrayQuickDiffProvider();
        this.scm.inputBox.placeholder = "Comment";
        context.subscriptions.push(this.scm);
        this.gherkin = new Gherkin();
        // scm/title
        context.subscriptions.push(vscode.commands.registerCommand("xrayBeams.scm.commit", this.commit, this));
        context.subscriptions.push(vscode.commands.registerCommand("xrayBeams.scm.cleanAll", this.cleanAll, this));
        // scm/resourceState/context
        context.subscriptions.push(vscode.commands.registerCommand("xrayBeams.scm.openFile", this.openFile, this));
        context.subscriptions.push(vscode.commands.registerCommand("xrayBeams.scm.clean", this.clean, this));
    }

    async commit(): Promise<void> {
        const resourceStates = this.changedResources.resourceStates;
        if (resourceStates.length === 0) return;

        vscode.window.setStatusBarMessage("committing changes", 2000);
        const features = new Map<string, File>();
        resourceStates.forEach(r => {
            const file = this.lookup.lookupAsFile(r.resourceUri, false);
            features.set(r.resourceUri.path, file);
        });
        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Commit changes`);
        await this.xrayRepository.udpateFeatures(features);
        this.changedResources.resourceStates = [];
        vscode.window.setStatusBarMessage("Successfully committed changes", 2000);
        this.xbfs.refresh();
        vscode.commands.executeCommand("xrayBeams.orphansView.refresh");
    }

    async cleanAll(): Promise<void> {
        if (this.changedResources.resourceStates.length === 0) return;
        await this.clean(...this.changedResources.resourceStates);
    }

    async clean(...selection: vscode.SourceControlResourceState[]): Promise<void> {
        const affectedFiles = selection.length > 1 ? `${selection.length} files` : path.posix.basename(selection[0].resourceUri.path);
        const action = await vscode.window.showWarningMessage(`Are you sure you want to discard changes in ${affectedFiles}?`, { modal: true }, "Discard Changes");
        if (action === "Cancel") return;
        const clean = async (uri: vscode.Uri) => {
            const file = this.lookup.lookupAsFile(uri, false);
            const content = Buffer.from(await this.xrayRepository.getFeature(file.folder));
            this.xbfs.writeFile(uri, content, { create: true, overwrite: true }, file.folder);
        };
        await Promise.all(selection.map(r => clean(r.resourceUri)));
        this.changedResources.resourceStates = this.changedResources.resourceStates.filter(r => !selection.includes(r));
    }

    openFile(resourceState: vscode.SourceControlResourceState): void {
        vscode.window.showTextDocument(resourceState.resourceUri);
    }

    async fileChanged(uri: vscode.Uri): Promise<void> {
        if (this.origEntries.get(path.posix.dirname(uri.path))) {
            const file = this.lookup.lookupAsFile(uri, false);
            const origContent = await this.xrayRepository.getFeature(file.folder);
            const content = file.data.toString();
            const isDirty = origContent !== content;
            const resourceStates = this.changedResources.resourceStates;
            if (isDirty) {
                if (!resourceStates.find(r => r.resourceUri.path === uri.path))
                    this.changedResources.resourceStates = [...resourceStates, await this.getResourceState(uri)];
            } else {
                const pristine = resourceStates.filter(r => r.resourceUri.path !== uri.path);
                this.changedResources.resourceStates = [...pristine];
            }

            const features = new Map<string, File>();
            this.changedResources.resourceStates.forEach(r => {
                const file = this.lookup.lookupAsFile(r.resourceUri, false);
                features.set(r.resourceUri.path, file);
            });
            this.gherkin.parse(features);
        }
    }

    async dirRenamed(oldUri: vscode.Uri, newUri: vscode.Uri): Promise<void> {
        const resourceStates = this.changedResources.resourceStates;
        const oldPath = `${oldUri.path}/${path.posix.basename(oldUri.path)}.feature`;
        const oldResourceState = resourceStates.find(r => r.resourceUri.path === oldPath);
        if (oldResourceState) {
            const pristine = resourceStates.filter(r => !r.resourceUri.path.startsWith(oldUri.path));
            // Replace sub directories with new uri
            const updated = [];
            const oldResourceStates = resourceStates.filter(r => r.resourceUri.path.startsWith(oldUri.path) && r.resourceUri.path !== oldPath);
            oldResourceStates.forEach(async r => {
                const uri = r.resourceUri.with({ path: r.resourceUri.path.replace(oldUri.path, newUri.path) });
                updated.push(await this.getResourceState(uri));
            });
            // Replace this directory
            const newPath = `${newUri.path}/${path.posix.basename(newUri.path)}.feature`;
            updated.push(await this.getResourceState(newUri.with({ path: newPath })));
            this.changedResources.resourceStates = [...pristine, ...updated];
        }
    }

    dispose(): void {
        this.disposables.forEach(d => d.dispose());
    }

    private async getResourceState(uri: vscode.Uri): Promise<vscode.SourceControlResourceState> {
        let left: vscode.Uri = await this.scm.quickDiffProvider.provideOriginalResource(uri, null);
        let right: vscode.Uri = uri;
        const name = path.posix.basename(uri.path);
        const resourceState: vscode.SourceControlResourceState = {
            resourceUri: uri,
            command: {
                title: "Modified",
                command: "vscode.diff",
                arguments: [left, right, `${name} (Working Tree)`]
            }
        };
        return resourceState;
    }
}

export class XrayBeamsFS implements vscode.FileSystemProvider, vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    initialized = false;
    private scm: XraySourceControl;

    constructor(context: vscode.ExtensionContext, private lookup: EntryLookup, private xrayRepository: XrayRepository) {
        this.scm = new XraySourceControl(context, lookup, xrayRepository, this);
        this.disposables.push(this.scm);
    }

    async refresh(): Promise<void> {
        vscode.window.setStatusBarMessage("Refresh workspace...", 2000);
        this.initialized = false;

        // Hold on to the pending changes
        const pendingChangesUris = this.scm.changedResources.resourceStates.map(r => r.resourceUri);
        const pendingChanges = new Map<vscode.Uri, Uint8Array>();
        pendingChangesUris.forEach(uri => {
            const file = this.lookup.lookupAsFile(uri, false);
            pendingChanges.set(uri, file.data);
        });

        // Reset the directory
        this.lookup.root = new Directory('');
        this.scm.origEntries = await this.xrayRepository.getEntries();
        const promises = [];
        this.scm.origEntries.forEach((f, path) => {
            promises.push(this.createDirectory(vscode.Uri.parse(`xbfs:${path}`), f));
        });
        await Promise.all(promises);

        // Now let's add the pending changes again
        await Promise.all(pendingChangesUris.map(async uri => {
            const file = this.lookup.lookupAsFile(uri, false);
            file.data = pendingChanges.get(uri);
            file.pullData = false;
            await this.scm.fileChanged(uri);
            // TODO: MUST REFRESH THE SCM CACHED CONTENT
        }));

        this.initialized = true;
        vscode.commands.executeCommand("workbench.files.action.refreshFilesExplorer");
        vscode.window.setStatusBarMessage("Refresh workspace done", 2000);
    }

    // --- manage file metadata

    stat(uri: vscode.Uri): vscode.FileStat {
        return this.lookup.lookup(uri, false);
    }

    async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        const entry = this.lookup.lookupAsDirectory(uri, false);
        let result: [string, vscode.FileType][] = [];
        for (const [name, child] of entry.entries) {
            result.push([name, child.type]);
        }
        return result;
    }

    // --- manage file contents

    async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        const entry = this.lookup.lookupAsFile(uri, false);
        if (!entry)
            throw vscode.FileSystemError.FileNotFound();

        if (entry.pullData && entry.folder) {
            const content = await this.xrayRepository.getFeature(entry.folder);
            entry.data = Buffer.from(content);
            entry.size = entry.data.byteLength;
            entry.pullData = false;
        }
        return entry.data;
    }

    async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean, overwrite: boolean }, folder?: xb.Folder): Promise<void> {
        let basename = path.posix.basename(uri.path);
        let parent = this.lookup.lookupParentDirectory(uri);
        let entry = parent.entries.get(basename);

        if (!entry && !folder)
            throw vscode.window.showErrorMessage("Only folders are allowed to be created in Xray Beams.");

        if (entry instanceof Directory) {
            throw vscode.FileSystemError.FileIsADirectory(uri);
        }
        if (!entry && !options.create) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        if (entry && options.create && !options.overwrite) {
            throw vscode.FileSystemError.FileExists(uri);
        }
        if (!entry && folder) {
            entry = new File(basename, folder);
            parent.entries.set(basename, entry);
            this._fireSoon({ type: vscode.FileChangeType.Created, uri });
        }
        entry.mtime = Date.now();
        entry.size = content.byteLength;
        entry.data = content;
        this._fireSoon({ type: vscode.FileChangeType.Changed, uri });

        if (!this.initialized) return;

        this.scm.fileChanged(uri);
    }

    // --- manage files/folders

    async rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }, internal?: boolean): Promise<void> {
        const entry = this.lookup.lookup(oldUri, false);
        if (entry instanceof File && !internal)
            throw vscode.window.showErrorMessage("Only folders are allowed to be moved/renamed in Xray Beams.");

        if (!options.overwrite && this.lookup.lookup(newUri, true)) {
            throw vscode.FileSystemError.FileExists(newUri);
        }

        const newParent = this.lookup.lookupParentDirectory(newUri);
        const newName = path.posix.basename(newUri.path);

        const oldParent = this.lookup.lookupParentDirectory(oldUri);
        oldParent.entries.delete(entry.name);
        entry.name = newName;
        newParent.entries.set(newName, entry);
        this._fireSoon({ type: vscode.FileChangeType.Deleted, uri: oldUri }, { type: vscode.FileChangeType.Created, uri: newUri });

        if (entry instanceof File) return;

        this.scm.dirRenamed(oldUri, newUri);

        // Update remote
        if (path.posix.dirname(oldUri.path) === path.posix.dirname(newUri.path)) {
            entry.folder.name = newName;
            await this.xrayRepository.updateFolder(entry.folder);
        } else {
            await this.xrayRepository.moveFolder(entry.folder, newParent.folder.id);
        }
        await this.refresh();
        vscode.commands.executeCommand("xrayBeams.orphansView.refresh");
    }

    async delete(uri: vscode.Uri): Promise<void> {
        let entry = this.lookup.lookup(uri, false);
        if (entry instanceof File)
            throw vscode.window.showErrorMessage("Only folders are allowed to be deleted in Xray Beams.");

        let dirname = uri.with({ path: path.posix.dirname(uri.path) });
        let basename = path.posix.basename(uri.path);
        let parent = this.lookup.lookupAsDirectory(dirname, false);
        if (!parent.entries.has(basename)) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        parent.entries.delete(basename);
        parent.mtime = Date.now();
        parent.size -= 1;
        this._fireSoon({ type: vscode.FileChangeType.Changed, uri: dirname }, { uri, type: vscode.FileChangeType.Deleted });

        // Update remote
        await this.xrayRepository.deleteFolder(entry.folder);
        await this.refresh();
        vscode.commands.executeCommand("xrayBeams.orphansView.refresh");
    }

    async createDirectory(uri: vscode.Uri, folder?: xb.Folder): Promise<void> {
        let basename = path.posix.basename(uri.path);
        let dirname = uri.with({ path: path.posix.dirname(uri.path) });
        let parent = this.lookup.lookupAsDirectory(dirname, false);

        if (dirname.path === "/") parent.folder = { id: -1, name: "Test Repository", rank: undefined, testCount: undefined, totalTestCount: undefined, testRepositoryPath: "", folders: undefined };

        let entry = new Directory(basename, folder);
        parent.entries.set(entry.name, entry);
        parent.mtime = Date.now();
        parent.size += 1;
        this._fireSoon({ type: vscode.FileChangeType.Changed, uri: dirname }, { type: vscode.FileChangeType.Created, uri });

        if (this.initialized) {
            // Update remote
            await this.xrayRepository.createFolder(basename, parent.folder);
            await this.refresh();
            vscode.commands.executeCommand("xrayBeams.orphansView.refresh");
        } else {
            // Let's create the arbitrary feature file for this directory too
            this.writeFile(vscode.Uri.joinPath(uri, `${entry.name}.feature`), Buffer.from(`Feature: ${entry.name}`), { create: true, overwrite: true }, folder);
        }
    }

    // --- manage file events

    private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    private _bufferedEvents: vscode.FileChangeEvent[] = [];
    private _fireSoonHandle?: NodeJS.Timer;

    readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

    watch(uri: vscode.Uri, options: { recursive: boolean; excludes: string[] }): vscode.Disposable {
        // ignore, fires for all changes...
        return new vscode.Disposable(() => { });
    }

    private _fireSoon(...events: vscode.FileChangeEvent[]): void {
        this._bufferedEvents.push(...events);

        if (this._fireSoonHandle) {
            clearTimeout(this._fireSoonHandle);
        }

        this._fireSoonHandle = setTimeout(() => {
            this._emitter.fire(this._bufferedEvents);
            this._bufferedEvents.length = 0;
        }, 5);
    }

    dispose() {
        this.disposables.forEach(d => d.dispose());
    }
}