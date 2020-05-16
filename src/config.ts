import * as vscode from "vscode";
import * as xb from "xray-beams";

const cfg = vscode.workspace.getConfiguration("xrayBeams");
export const IsInvalidConfig = !cfg.jira.baseUrl || !cfg.jira.port || !cfg.jira.user.name || !cfg.jira.user.password || !cfg.jira.projectKey;

export class Config implements xb.Config {
    baseUrl: string = `${cfg.jira.baseUrl}:${cfg.jira.port}`;
    username: string = cfg.jira.user.name;
    password: string = cfg.jira.user.password;
    projectKey: string = cfg.jira.projectKey;
}