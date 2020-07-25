import * as xb from "xray-beams";
import fetch from "node-fetch";
import { encode } from "base-64";
import { URL, URLSearchParams } from "url";
import { outputChannel } from "./panels";

export class XrayTestRepository implements xb.XrayTestRepository {
    constructor(private cfg: xb.Config) { }

    async getTests(folderId: number): Promise<xb.Test[]> {
        const url = `${this.cfg.baseUrl}/rest/raven/1.0/api/testrepository/${this.cfg.projectKey}/folders/${folderId}/tests`;
        const headers = {
            Authorization: `Basic ${encode(this.cfg.username + ":" + this.cfg.password)}`
        };

        try {
            const res = await fetch(url, { method: "GET", headers: headers });
            if (res.status !== 200) { throw new Error(await res.text()); }
            const data = await res.json();
            const tests = data.tests.filter((d: xb.Test) => d.testType === "Cucumber");
            return Promise.resolve(tests);
        } catch (err) {
            console.error(err);
            outputChannel.appendLine(`[get] list of tests in folder id: ${folderId}\n${err}`);
            outputChannel.show(true);
            throw err;
        }
    }

    async getOrphans(): Promise<xb.Test[]> {
        const get = async (pageSize: number) => {
            const url = `${this.cfg.baseUrl}/rest/raven/1.0/folderStructure/allOrphanTests?entityKey=${this.cfg.projectKey}&pageStart=0&pageSize=${pageSize}&jql=${this.cfg.jqlOrphans}`;
            const headers = {
                Authorization: `Basic ${encode(this.cfg.username + ":" + this.cfg.password)}`
            };

            try {
                const res = await fetch(url, { method: "GET", headers: headers });
                if (res.status !== 200) { throw new Error(await res.text()); }
                const data = await res.json();
                return Promise.resolve(data);
            } catch (err) {
                console.error(err);
                outputChannel.appendLine(`[get] all orphaned tests\n${err}`);
                outputChannel.show(true);
                throw err;
            }
        };

        const total = (await get(0)).total;
        const res = await get(total);
        const tests = res.testIssues.map(t => <xb.Test>{
            id: t.id,
            key: t.key,
            summary: t.summary,
            assignee: t.assignee,
            workflowStatus: t.workflowStatusName,
            labels: t.labels,
            components: t.components,
            testType: t.testType
        });
        return Promise.resolve(tests);
    }

    async getFolders(): Promise<xb.Folder[]> {
        const url = `${this.cfg.baseUrl}/rest/raven/1.0/api/testrepository/${this.cfg.projectKey}/folders`;
        const headers = {
            Authorization: `Basic ${encode(this.cfg.username + ":" + this.cfg.password)}`
        };

        try {
            const res = await fetch(url, { method: "GET", headers: headers });
            if (res.status !== 200) { throw new Error(await res.text()); }
            const data: xb.Folder = await res.json();
            return Promise.resolve([...data.folders]);
        } catch (err) {
            console.error(err);
            outputChannel.appendLine(`[get] list of the folders of the test repository\n${err}`);
            outputChannel.show(true);
            throw err;
        }
    }

    async createFolder(folderId: number, name: string): Promise<xb.Folder> {
        const url = `${this.cfg.baseUrl}/rest/raven/1.0/api/testrepository/${this.cfg.projectKey}/folders/${folderId}`;
        const headers = {
            Authorization: `Basic ${encode(this.cfg.username + ":" + this.cfg.password)}`,
            "Content-Type": "application/json"
        };
        const body = JSON.stringify({ name: name });

        try {
            const res = await fetch(url, { method: "POST", headers: headers, body: body });
            if (res.status !== 200) { throw new Error(await res.text()); }
            const data: xb.Folder = await res.json();
            outputChannel.appendLine(`[created] folder "${name}" (folderId:${data.id})`);
            return Promise.resolve(data);
        } catch (err) {
            console.error(err);
            outputChannel.appendLine(`[create] folder "${name}"\n${err}`);
            outputChannel.show(true);
            throw err;
        }
    }

    async updateFolder(folderId: number, name: string, rank: number): Promise<void> {
        const url = `${this.cfg.baseUrl}/rest/raven/1.0/api/testrepository/${this.cfg.projectKey}/folders/${folderId}`;
        const headers = {
            Authorization: `Basic ${encode(this.cfg.username + ":" + this.cfg.password)}`,
            "Content-Type": "application/json"
        };
        const body = JSON.stringify({ name: name, rank: rank });

        try {
            const res = await fetch(url, { method: "PUT", headers: headers, body: body });
            if (res.status !== 200) { throw new Error(await res.text()); }
            outputChannel.appendLine(`[renamed] folder to "${name}" (folderId:${folderId})`);
            return Promise.resolve();
        } catch (err) {
            console.error(err);
            outputChannel.appendLine(`[rename] folder to "${name}" (folderId:${folderId})\n${err}`);
            outputChannel.show(true);
            throw err;
        }
    }

    async moveFolder(folderId: number, destinationFolderId: number): Promise<void> {
        const url = `${this.cfg.baseUrl}/rest/raven/1.0/folderStructure/moveFolders?destination=${destinationFolderId}&entityKey=${this.cfg.projectKey}`;
        const headers = {
            Authorization: `Basic ${encode(this.cfg.username + ":" + this.cfg.password)}`,
            "Content-Type": "application/json"
        };
        const body = JSON.stringify([folderId]);

        try {
            const res = await fetch(url, { method: "PUT", headers: headers, body: body });
            if (res.status !== 200) { throw new Error(await res.text()); }
            outputChannel.appendLine(`[moved] folder to destination folder id: ${destinationFolderId} (folderId:${folderId})`);
            return Promise.resolve();
        } catch (err) {
            console.error(err);
            outputChannel.appendLine(`[move] folder to destination folder id: ${destinationFolderId} (folderId:${folderId})\n${err}`);
            outputChannel.show(true);
            throw err;
        }
    }

    async deleteFolder(folderId: number): Promise<void> {
        const url = `${this.cfg.baseUrl}/rest/raven/1.0/api/testrepository/${this.cfg.projectKey}/folders/${folderId}`;
        const headers = {
            Authorization: `Basic ${encode(this.cfg.username + ":" + this.cfg.password)}`,
            "Content-Type": "application/json"
        };

        try {
            const res = await fetch(url, { method: "DELETE", headers: headers });
            if (res.status !== 200) { throw new Error(await res.text()); }
            outputChannel.appendLine(`[deleted] folder (folderId:${folderId})`);
            return Promise.resolve();
        } catch (err) {
            console.error(err);
            outputChannel.appendLine(`[delete] folder (folderId:${folderId})\n${err}`);
            outputChannel.show(true);
            throw err;
        }
    }

    async updateFolderTests(folderId: number, add: string[], remove: string[]): Promise<void> {
        const url = `${this.cfg.baseUrl}/rest/raven/1.0/api/testrepository/${this.cfg.projectKey}/folders/${folderId}/tests`;
        const headers = {
            Authorization: `Basic ${encode(this.cfg.username + ":" + this.cfg.password)}`,
            "Content-Type": "application/json"
        };
        const body = JSON.stringify({ add: add, remove: remove });

        try {
            const res = await fetch(url, { method: "PUT", headers: headers, body: body });
            if (res.status !== 200) { throw new Error(await res.text()); }
            outputChannel.appendLine(`[updated] folder { added:[${add.join(",")}], removed:[${remove.join(",")}] } (folderId:${folderId})`);
            return Promise.resolve();
        } catch (err) {
            console.error(err);
            outputChannel.appendLine(`[update] folder { add:[${add.join(",")}], remove:[${remove.join(",")}] } (folderId:${folderId})\n${err}`);
            outputChannel.show(true);
            throw err;
        }
    }

    async sortTests(folderId: number, targetLeaf: number, testIds: number[]): Promise<void> {
        const url = `${this.cfg.baseUrl}/rest/raven/1.0/folderStructure/sortTests?folderId=${folderId}&targetLeaf=${targetLeaf}`;
        const headers = {
            Authorization: `Basic ${encode(this.cfg.username + ":" + this.cfg.password)}`,
            "Content-Type": "application/json"
        };
        const body = JSON.stringify(testIds);

        try {
            const res = await fetch(url, { method: "PUT", headers: headers, body: body });
            if (res.status !== 200) { throw new Error(await res.text()); }
            outputChannel.appendLine(`[sorted] tests: [${testIds.join(",")}] with target leaf: ${targetLeaf} (folderId:${folderId})`);
            return Promise.resolve();
        } catch (err) {
            console.error(err);
            outputChannel.appendLine(`[sort] tests: [${testIds.join(",")}] with target leaf: ${targetLeaf} (folderId:${folderId})\n${err}`);
            outputChannel.show(true);
            throw err;
        }
    }
}

export class JiraIssue implements xb.JiraIssue {
    constructor(private cfg: xb.Config, private cf: xb.CustomFields) { }

    async getIssues(keys: string[]): Promise<xb.Issue[]> {
        const url = new URL(`${this.cfg.baseUrl}/rest/api/2/search`);
        const customFields = [
            this.cf.testRepositoryPath,
            this.cf.cucumberTestType,
            this.cf.cucumberScenario
        ];
        const params = {
            fields: `issuetype,summary,description,labels,${customFields.join(",")}`,
            jql: `project=${this.cfg.projectKey} and id in (${keys.join(",")})`
        };
        url.search = new URLSearchParams(params).toString();
        const headers = {
            Authorization: `Basic ${encode(this.cfg.username + ":" + this.cfg.password)}`
        };

        try {
            const res = await fetch(url, { method: "GET", headers: headers });
            if (res.status !== 200) { throw new Error(await res.text()); }
            const data = await res.json();
            const tests = data.issues;
            return Promise.resolve(tests);
        } catch (err) {
            console.error(err);
            outputChannel.appendLine(`[get] issues [${keys.join(",")}]\n${err}`);
            outputChannel.show(true);
            throw err;
        }
    }

    async createTest(summary: string, desc: string, labels: string[], path: string, steps: string, isScenarioOutline?: boolean): Promise<string> {
        const url = new URL(`${this.cfg.baseUrl}/rest/api/2/issue`);
        const headers = {
            Authorization: `Basic ${encode(this.cfg.username + ":" + this.cfg.password)}`,
            "Content-Type": "application/json"
        };
        const body = {
            fields: {
                project: { key: this.cfg.projectKey },
                issuetype: { name: "Test" },
                summary: summary,
                description: desc,
                labels: labels
            }
        };
        body.fields[this.cf.testRepositoryPath] = path;
        body.fields[this.cf.testType] = { value: "Cucumber" };
        body.fields[this.cf.cucumberTestType] = { value: isScenarioOutline ? "Scenario Outline" : "Scenario" };
        body.fields[this.cf.cucumberScenario] = steps;

        try {
            const res = await fetch(url, { method: "POST", headers: headers, body: JSON.stringify(body) });
            if (res.status !== 201) { throw new Error(await res.text()); }
            const data = await res.json();
            outputChannel.appendLine(`[created] ${path}${path}.feature: ${summary} (key:${data.key})`);
            return Promise.resolve(data.key);
        } catch (err) {
            console.error(err);
            outputChannel.appendLine(`[create] ${path}${path}.feature: ${summary}\n${err}`);
            outputChannel.show(true);
            throw err;
        }
    }

    async updateTest(key: string, summary: string, desc: string, labels: string[], path: string, steps: string, isScenarioOutline?: boolean): Promise<void> {
        const url = new URL(`${this.cfg.baseUrl}/rest/api/2/issue/${key}`);
        const headers = {
            Authorization: `Basic ${encode(this.cfg.username + ":" + this.cfg.password)}`,
            "Content-Type": "application/json"
        };
        const body = {
            fields: {
                summary: summary,
                description: desc,
                labels: labels
            }
        };
        body.fields[this.cf.testRepositoryPath] = path;
        body.fields[this.cf.testType] = { value: "Cucumber" };
        body.fields[this.cf.cucumberTestType] = { value: isScenarioOutline ? "Scenario Outline" : "Scenario" };
        body.fields[this.cf.cucumberScenario] = steps;

        try {
            const res = await fetch(url, { method: "PUT", headers: headers, body: JSON.stringify(body) });
            if (res.status !== 204) { throw new Error(await res.text()); }
            outputChannel.appendLine(`[updated] ${path}${path}.feature: ${summary} (key:${key})`);
            return Promise.resolve();
        } catch (err) {
            console.error(err);
            outputChannel.appendLine(`[update] ${path}${path}.feature: ${summary}\n${err}`);
            outputChannel.show(true);
            throw err;
        }
    }
}

export class XrayTest {
    constructor(public issue: xb.Issue, private cf: xb.CustomFields) { }

	/**
	 * Test repository path
	 * Empty means it's orphaned
	 */
    get testRepositoryPath(): string {
        return this.issue.fields[this.cf.testRepositoryPath];
    }

	/**
	 * Cucumber test type [Scenario|Scenario Outline]
	 * Undefined if test type is not "Cucumber"
	 */
    get cucumberTestType(): string | undefined {
        return this.issue.fields[this.cf.cucumberTestType]?.value;
    }

	/**
	 * The gherkin steps
	 * Undefined if test type is not "Cucumber"
	 */
    get cucumberScenario(): string | undefined {
        return this.issue.fields[this.cf.cucumberScenario];
    }
}	