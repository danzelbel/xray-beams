import * as vscode from "vscode";
import * as xb from "xray-beams";
import { encode } from "base-64";
import fetch from "node-fetch";

export class CustomFields implements xb.CustomFields {
    testType: string;
    testRepositoryPath: string;
    cucumberTestType: string;
    cucumberScenario: string;
    preConditionType: string;
    conditions: string;

    async init(cfg: xb.Config) {
        const url = `${cfg.baseUrl}/rest/api/2/field`;
        const headers = {
            Authorization: `Basic ${encode(cfg.username + ":" + cfg.password)}`
        };

        try {
            const res = await fetch(url, { method: "GET", headers: headers });
            if (res.status !== 200) { throw Error(res.statusText); }

            const json = await res.json();
            this.testRepositoryPath = json.find(f => f.name === "Test Repository Path").id;
            this.testType = json.find(f => f.name === "Test Type").id;
            this.cucumberTestType = json.find(f => f.name === "Cucumber Test Type").id;
            this.cucumberScenario = json.find(f => f.name === "Cucumber Scenario").id;
            this.preConditionType = json.find(f => f.name === "Pre-Condition Type").id;
            this.conditions = json.find(f => f.name === "Conditions").id;
        } catch (err) {
            console.error(err);
            throw vscode.window.showErrorMessage(err.message);
        }
    }
}