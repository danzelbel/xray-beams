import * as vscode from "vscode";
import { Readable } from "stream";
import { messages } from "cucumber-messages";
import makeSourceEnvelope from "gherkin/./dist/src/stream/makeSourceEnvelope";
import { File } from "./xrayFileSystemProvider";
const gherkin = require("gherkin").default;
import { diagnosticCollection } from "./panels";

export class Gherkin {
    hasErrors: boolean;
    private options = {
        includeSource: false,
        includeGherkinDocument: true,
        includePickles: false
    };

    async parse(features: Map<string, File>): Promise<messages.IEnvelope[]> {
        this.hasErrors = false;
        diagnosticCollection.clear();
        if(features.size === 0) return [];

        const sources: messages.IEnvelope[] = [];
        features.forEach((v, k) => sources.push(makeSourceEnvelope(v.data.toString(), k)));
        const envelopes = await this.streamToArray(gherkin.fromSources(sources, this.options));
        envelopes.forEach(e => {
            if (!e.gherkinDocument) {
                const uri = vscode.Uri.parse(`xbfs:${e.attachment.source.uri}`);
                const diagnostics = diagnosticCollection.get(uri).slice(0) ?? [];
                const loc = e.attachment.source.location;
                const endCol = e.attachment.data.substring(e.attachment.data.indexOf("got '") + 5, e.attachment.data.lastIndexOf("'")).length;
                const range = new vscode.Range(loc.line - 1, loc.column - 1, loc.line - 1, loc.column - 1 + endCol);
                diagnostics.push(new vscode.Diagnostic(range, e.attachment.data, vscode.DiagnosticSeverity.Error));
                diagnosticCollection.set(uri, diagnostics);
                this.hasErrors = true;
            }
        });

        return envelopes;
    }

    private async streamToArray(readableStream: Readable): Promise<messages.IEnvelope[]> {
        return new Promise<messages.IEnvelope[]>((resolve: (wrappers: messages.IEnvelope[]) => void, reject: (err: Error) => void) => {
            const items: messages.IEnvelope[] = [];
            readableStream.on('data', items.push.bind(items));
            readableStream.on('error', (err: Error) => reject(err));
            readableStream.on('end', () => resolve(items));
        });
    }
}