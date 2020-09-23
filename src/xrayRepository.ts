import * as vscode from "vscode";
import * as xb from "xray-beams";
import { CustomFields } from "./customFields";
import { XrayTestRepository, JiraIssue } from "./xrayClient";
import * as path from "path";
import { Gherkin } from "./gherkin";
import { File } from "./xrayFileSystemProvider";
import { io } from "cucumber-messages/dist/src/cucumber-messages";

export class XrayRepository {
    private xrayClient: xb.XrayClient;
    private initialized: boolean = false;
    private gherkin: Gherkin;

    constructor() {
        this.gherkin = new Gherkin();
    }

    async init(cfg: xb.Config): Promise<void> {
        const cf = new CustomFields();
        await cf.init(cfg);
        this.xrayClient = {
            customFields: cf,
            jiraIssue: new JiraIssue(cfg, cf),
            xrayTestRepository: new XrayTestRepository(cfg)
        };
        this.initialized = true;
    }

    async getEntries(): Promise<Map<string, xb.Folder>> {
        const entries = new Map<string, xb.Folder>();
        const createEntries = (f: xb.Folder) => {
            const path = `${f.testRepositoryPath}/${f.name}`;
            entries.set(path, f);
            f.folders.forEach(cf => {
                cf.testRepositoryPath = `${cf.testRepositoryPath}`;
                createEntries(cf);
            });
        };

        const folders = await this.xrayClient.xrayTestRepository.getFolders();
        folders.forEach(f => createEntries(f));
        return entries;
    }

    async getOrphans(): Promise<xb.Test[]> {
        if (!this.initialized) { return []; }
        return await this.xrayClient.xrayTestRepository.getOrphans();
    }

    async getPreConditions(): Promise<xb.Issue[]> {
        if (!this.initialized) { return []; }
        return await this.xrayClient.jiraIssue.getPreConditions();
    }

    async getFeature(folder: xb.Folder): Promise<string> {
        const preConditions = await this.xrayClient.jiraIssue.getPreConditions();
        const preCondition = preConditions.find(c => c.fields.labels.includes(`folderId:${folder.id}`));
        let background = "";
        if (preCondition && preCondition.fields[this.xrayClient.customFields.conditions]) {
            background = `\n${this.getPreConditionContent(preCondition)}`;
        }

        const tests = await this.xrayClient.xrayTestRepository.getTests(folder.id);
        let scenarios = [];
        if (tests.length > 0) {
            const keys = tests.map(t => t.key);
            const issues = await this.xrayClient.jiraIssue.getIssues(keys) || [];
            issues.sort((a, b) => keys.indexOf(a.key) - keys.indexOf(b.key));
            scenarios = issues.map(i => this.getScenarioContent(i));
        }
        return `Feature: ${folder.name}\n${background}\n${scenarios.join("\n")}`;
    }

    async getScenario(key: string): Promise<string> {
        const tests = await this.xrayClient.jiraIssue.getIssues([key]);
        return this.getScenarioContent(tests[0]);
    }

    async getPreCondition(key: string): Promise<string> {
        const preConditions = await this.xrayClient.jiraIssue.getIssues([key]);
        return this.getPreConditionContent(preConditions[0]);
    }

    async createFolder(name: string, parentFolder: xb.Folder): Promise<xb.Folder> {
        const newFolder = await this.xrayClient.xrayTestRepository.createFolder(parentFolder.id, name);
        vscode.window.setStatusBarMessage(`Successfully created "${newFolder.testRepositoryPath ?? ''}/${newFolder.name}"`, 2000);
        return newFolder;
    }

    async updateFolder(folder: xb.Folder): Promise<void> {
        await this.xrayClient.xrayTestRepository.updateFolder(folder.id, folder.name, folder.rank);
        vscode.window.setStatusBarMessage(`Successfully renamed "${folder.testRepositoryPath}/${folder.name}"`, 2000);
    }

    async moveFolder(folder: xb.Folder, destinationFolderId: number): Promise<void> {
        await this.xrayClient.xrayTestRepository.moveFolder(folder.id, destinationFolderId);
        vscode.window.setStatusBarMessage(`Successfully moved "${folder.testRepositoryPath}/${folder.name}"`, 2000);
    }

    async deleteFolder(folder: xb.Folder): Promise<void> {
        await this.xrayClient.xrayTestRepository.deleteFolder(folder.id);
        // Remove associated background
        const preConditions = await this.xrayClient.jiraIssue.getPreConditions();
        const preCondition = preConditions.find(c => c.fields.labels.includes(`folderId:${folder.id}`));
        if (preCondition) {
            const f = preCondition.fields;
            const labels = f.labels.filter(l => l !== `folderId:${folder.id}`);
            this.xrayClient.jiraIssue.updatePreCondition(preCondition.key, f.summary, f.description, labels, f[this.xrayClient.customFields.conditions]);
        }
        vscode.window.setStatusBarMessage(`Successfully deleted "${folder.testRepositoryPath}/${folder.name}"`, 2000);
    }

    async udpateFeatures(features: Map<string, File>): Promise<void> {
        const envelopes = await this.gherkin.parse(features);
        if (this.gherkin.hasErrors) {
            vscode.commands.executeCommand("workbench.panel.markers.view.focus");
            throw vscode.window.showErrorMessage("Error parsing the feature files. See problems panel for details.");
        }

        // From this point all envelopes should have gherkin documents
        const updateFeature = async (e: io.cucumber.messages.IEnvelope) => {
            const feature = features.get(e.gherkinDocument.uri);
            const lines = feature.data.toString().split("\n");
            const testRepositoryPath = path.posix.dirname(e.gherkinDocument.uri);
            const keys: { rank: number, key: string }[] = [];
            let i = 1;

            const projectKey = vscode.workspace.getConfiguration("xrayBeams").jira.projectKey;
            const addOrUpdateScenario = async (c: io.cucumber.messages.GherkinDocument.Feature.IFeatureChild) => {
                const rank = i++;
                let key = c.scenario.tags.find(t => t.name.startsWith(`@${projectKey}-`))?.name.slice(1);
                const labels = c.scenario.tags.filter(t => !t.name.startsWith(`@${projectKey}-`)).map(t => t.name.slice(1));
                const isScenarioOutline = c.scenario.keyword !== "Scenario";

                let end: number;
                if (isScenarioOutline) {
                    const lastExample = c.scenario.examples[c.scenario.examples.length - 1];
                    const lastBody = lastExample.tableBody[lastExample.tableBody.length - 1];
                    end = lastBody.location.line;
                } else {
                    const lastStep = c.scenario.steps[c.scenario.steps.length - 1];
                    end = lastStep.dataTable?.rows[lastStep.dataTable.rows.length - 1].location.line ?? lastStep.location.line;
                }

                let start: number;
                if (c.scenario.description !== '') {
                    const descLines = c.scenario.description.split("\n");
                    start = c.scenario.location.line
                        + lines.slice(c.scenario.location.line, end).indexOf(descLines[0]) // since there's no location property for description
                        + descLines.length;
                } else {
                    start = c.scenario.location.line;
                }

                const steps = lines.slice(start, end).map(l => l.startsWith("\t") ? l.slice(1) : l).join("\n");
                const desc = this.unescapeKeywords(c.scenario.description.replace("\t", ""));

                if (key) {
                    await this.xrayClient.jiraIssue.updateTest(key, c.scenario.name, desc, labels, testRepositoryPath, steps, isScenarioOutline);
                } else {
                    key = await this.xrayClient.jiraIssue.createTest(c.scenario.name, desc, labels, testRepositoryPath, steps, isScenarioOutline);
                }

                keys.push({ rank, key });
            };

            await Promise.all(e.gherkinDocument.feature.children.filter(c => c.scenario).map(c => addOrUpdateScenario(c)));

            // Add/Update/Remove background
            const folderId = features.get(e.gherkinDocument.uri).folder.id;
            const bg = e.gherkinDocument.feature.children.find(c => c.background)?.background;
            if (bg) {
                const summary = bg.name !== '' ? bg.name : e.gherkinDocument.feature.name;
                const label = `folderId:${folderId}`;
                const lastStep = bg.steps[bg.steps.length - 1];
                const end = lastStep.dataTable?.rows[lastStep.dataTable.rows.length - 1].location.line ?? lastStep.location.line;

                let start: number;
                if (bg.description !== '') {
                    const descLines = bg.description.split("\n");
                    start = bg.location.line
                        + lines.slice(bg.location.line, end).indexOf(descLines[0]) // since there's no location property for description
                        + descLines.length;
                } else {
                    start = bg.location.line;
                }

                const steps = lines.slice(start, end).map(l => l.startsWith("\t") ? l.slice(1) : l).join("\n");
                const desc = this.unescapeKeywords(bg.description.replace("\t", ""));

                // Let's find a background key which should be between the feature and background names
                let key = e.gherkinDocument.comments
                    .filter(c => c.location.line > e.gherkinDocument.feature.location.line)
                    .find(c => c.text.startsWith(`#@${projectKey}-`))?.text.slice(2);
                if (key) {
                    // Update the labels to remap this pre-condition to this folder
                    const preCondition: xb.Issue = (await this.xrayClient.jiraIssue.getIssues([key]))[0];
                    const labels = preCondition.fields.labels.filter(l => !l.startsWith("folderId:"));
                    labels.push(label);

                    await this.xrayClient.jiraIssue.updatePreCondition(key, summary, desc, labels, steps);
                } else {
                    key = await this.xrayClient.jiraIssue.createPreCondition(summary, desc, [label], steps);
                }
            } else {
                // No background found for this feature, let's remove any associated pre-condition
                const preConditions = await this.xrayClient.jiraIssue.getPreConditions();
                const preCondition = preConditions.find(c => c.fields.labels.includes(`folderId:${folderId}`));
                if (preCondition) {
                    const labels = preCondition.fields.labels.filter(l => !l.startsWith("folderId:"));
                    const steps = preCondition.fields[this.xrayClient.customFields.conditions];
                    await this.xrayClient.jiraIssue.updatePreCondition(preCondition.key, preCondition.fields.summary, preCondition.fields.description, labels, steps);
                }
            }

            // Remove orphaned scenarios
            const sortedKeys = keys.sort((a, b) => a.rank - b.rank).map(k => k.key);
            const tests = await this.xrayClient.xrayTestRepository.getTests(feature.folder.id);
            const removedKeys = tests.map(t => t.key).filter(r => !sortedKeys.includes(r));
            if (removedKeys.length > 0) {
                await this.xrayClient.xrayTestRepository.updateFolderTests(feature.folder.id, [], removedKeys);
            }

            // Sort scenarios
            const testsMap = new Map<string, number>(tests.map(t => [t.key, t.id]));
            const testIds = sortedKeys.map(k => testsMap.get(k));
            for (let i = 0; i < testIds.length; i++) {
                await this.xrayClient.xrayTestRepository.sortTests(feature.folder.id, -1, [testIds[i]]);
            }
        };

        await Promise.all(envelopes.map(e => updateFeature(e)));
    }

    private getScenarioContent(issue: xb.Issue): string {
        issue.fields.labels.push(`${issue.key}`);
        let content = `${issue.fields.labels.map(l => `@${l}`).join(" ")}\n`;

        const scenarioType = issue.fields[this.xrayClient.customFields.cucumberTestType].value;
        content += `${scenarioType}: ${issue.fields.summary}\n`;

        if (issue.fields.description) {
            const desc = this.escapeKeywords(issue.fields.description);
            content += `\t${desc}\n`;
        }

        let steps = issue.fields[this.xrayClient.customFields.cucumberScenario];
        if (steps) {
            content += `\t${steps.replace(/\n/g, "\n\t")}\n`;
        }

        return content;
    }

    private getPreConditionContent(issue: xb.Issue): string {
        let content = `#@${issue.key}\n`;
        content += `Background: ${issue.fields.summary}\n`;

        if (issue.fields.description) {
            const desc = this.escapeKeywords(issue.fields.description);
            content += `\t${desc}\n`;
        }

        let steps = issue.fields[this.xrayClient.customFields.conditions];
        if (steps) {
            content += `\t${steps.replace(/\n/g, "\n\t")}\n`;
        }

        return content;
    }

    private escapeKeywords(text: string) {
        text = text.replace(/(?<=^\s*)(#|@|\||Feature:|Rule:|Example:|Scenario:|Scenario Template:|Scenario Outline:|Examples:)(?=\s*)/gm, "\\$&");
        text = text.replace(/(?<=^\s*)(Given|When|Then|And|But|\*)(?=\s)/gm, "\\$&");
        return text;
    }

    private unescapeKeywords(text: string) {
        text = text.replace(/(?<=^\s*)(\\)(#|@|\||Feature:|Rule:|Example:|Scenario:|Scenario Template:|Scenario Outline:|Examples:)(?=\s*)/gm, "$2");
        text = text.replace(/(?<=^\s*)(\\)(Given|When|Then|And|But|\*)(?=\s)/gm, "$2");
        return text;
    }
}