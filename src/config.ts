import * as vscode from "vscode";
import * as xb from "xray-beams";

export class Config implements xb.Config {
    private get cfg(): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration("xrayBeams");
    }

    get baseUrl(): string { return this.cfg.jira.baseUrl; }
    get projectKey(): string { return this.cfg.jira.projectKey; }
    get username(): string { return this.cfg.jira.username; };
    get jqlOrphans(): string { return this.cfg.jira.jql.orphans; }
    get jqlPreConditions(): string { return this.cfg.jira.jql.preConditions; }

    private _password: string;
    get password(): string { return this._password; };

    async setConfig(): Promise<boolean> {
        if (!this.baseUrl) {
            const baseUrl = await vscode.window.showInputBox({ placeHolder: "XrayBeams: Base URL", "ignoreFocusOut": true });
            if (!baseUrl || !baseUrl.trim()) { return; }
            this.cfg.update("jira.baseUrl", baseUrl, true);
        }

        if (!this.projectKey) {
            const projectKey = await vscode.window.showInputBox({ placeHolder: "XrayBeams: Project Key", "ignoreFocusOut": true });
            if (!projectKey || !projectKey.trim()) { return; }
            this.cfg.update("jira.projectKey", projectKey, true);
        }

        if (!this.username) {
            const username = await vscode.window.showInputBox({ placeHolder: "XrayBeams: Jira Username", "ignoreFocusOut": true });
            if (!username || !username.trim()) { return; }
            this.cfg.update("jira.username", username, true);
        }

        if (!this.password) {
            const password = await vscode.window.showInputBox({ placeHolder: "XrayBeams: Jira Password", "ignoreFocusOut": true, "password": true });
            if (!password || !password.trim()) { return; }
            this._password = password;
        }

        // All properties should have a value
        return !(!this.baseUrl || !this.projectKey || !this.username || !this.password);
    }
}