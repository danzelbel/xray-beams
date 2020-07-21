import * as vscode from "vscode";
import * as xb from "xray-beams";
import { CustomFields } from "./customFields";
import { JiraIssue, XrayTestRepository, XrayTest } from "./xrayClient";
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
            if (f.folders.length > 0) f.folders.forEach(cf => {
                cf.testRepositoryPath = `${cf.testRepositoryPath}`;
                createEntries(cf);
            });
        };

        const folders = await this.xrayClient.xrayTestRepository.getFolders();
        folders.forEach(f => createEntries(f));
        return entries;
    }

    async getOrphans(): Promise<xb.Test[]> {
        if (!this.initialized) return [];
        return await this.xrayClient.xrayTestRepository.getOrphans();
    }

    async getFeature(folder: xb.Folder): Promise<string> {
        const tests = await this.xrayClient.xrayTestRepository.getTests(folder.id);
        let scenarios = [];
        if (tests.length > 0) {
            const keys = tests.map(t => t.key);
            const issues = await this.xrayClient.jiraIssue.getIssues(keys) || [];
            issues.sort((a, b) => keys.indexOf(a.key) - keys.indexOf(b.key));
            scenarios = await Promise.all(issues.map(i => this.getScenarioContent(i)));
        }
        return `Feature: ${folder.name}\n\n${scenarios.join("\n")}`;
    }

    async getScenario(key: string): Promise<string> {
        const issues = await this.xrayClient.jiraIssue.getIssues([key]);
        return await this.getScenarioContent(issues[0]);
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

            const addOrUpdateScenario = async (c: io.cucumber.messages.GherkinDocument.Feature.IFeatureChild) => {
                const rank = i++;
                let key = c.scenario.tags.find(t => t.name.startsWith("@EESQA-"))?.name.slice(1);
                const labels = c.scenario.tags.filter(t => !t.name.startsWith("@EESQA-")).map(t => t.name.slice(1));
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
                    start = c.scenario.location.line
                        + lines.slice(c.scenario.location.line, end).indexOf(c.scenario.description) // since there's no location property for description
                        + c.scenario.description.split("\n").length;
                } else {
                    start = c.scenario.location.line;
                }

                const steps = lines.slice(start, end).map(l => l.startsWith("\t") ? l.slice(1) : l).join("\n");

                if (key)
                    await this.xrayClient.jiraIssue.updateIssue(key, c.scenario.name, c.scenario.description.trim(), labels, testRepositoryPath, steps, isScenarioOutline);
                else
                    key = await this.xrayClient.jiraIssue.createIssue(c.scenario.name, c.scenario.description.trim(), labels, testRepositoryPath, steps, isScenarioOutline);

                keys.push({ rank, key });
            }

            await Promise.all(e.gherkinDocument.feature.children.map(c => addOrUpdateScenario(c)));

            // Remove orphaned scenarios
            const sortedKeys = keys.sort((a, b) => a.rank - b.rank).map(k => k.key);
            const tests = await this.xrayClient.xrayTestRepository.getTests(feature.folder.id);
            const removedKeys = tests.map(t => t.key).filter(r => !sortedKeys.includes(r));
            if (removedKeys.length > 0)
                await this.xrayClient.xrayTestRepository.updateFolderTests(feature.folder.id, [], removedKeys);

            // Sort scenarios
            const testsMap = new Map<string, number>(tests.map(t => [t.key, t.id]));
            const testIds = sortedKeys.map(k => testsMap.get(k));
            for (let i = 0; i < testIds.length; i++)
                await this.xrayClient.xrayTestRepository.sortTests(feature.folder.id, -1, [testIds[i]]);
        };

        await Promise.all(envelopes.map(e => updateFeature(e)));
    }

    private async getScenarioContent(issue: xb.Issue): Promise<string> {
        const t = new XrayTest(issue, this.xrayClient.customFields);
        let content: string;

        /* labels */
        t.issue.fields.labels.push(`${t.issue.key}`);
        if (t.issue.fields.labels.length > 0)
            content = `${t.issue.fields.labels.map(l => `@${l}`).join(" ")}\n`;

        /* scenario name */
        const scenarioType = t.cucumberTestType ?? "Scenario";
        content += `${scenarioType}: ${t.issue.fields.summary}\n`;

        /* description */
        if (t.issue.fields.description)
            content += `\t${t.issue.fields.description}\n`;

        /* steps */
        if (t.cucumberScenario)
            content += `\t${t.cucumberScenario.replace(/\n/g, "\n\t")}\n`;

        return content;
    }
}