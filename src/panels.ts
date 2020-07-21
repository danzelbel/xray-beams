import * as vscode from "vscode";

export const outputChannel = vscode.window.createOutputChannel("XrayBeams");
export const diagnosticCollection = vscode.languages.createDiagnosticCollection("XrayBeams");