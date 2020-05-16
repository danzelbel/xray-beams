import * as xb from "xray-beams";
import fetch from "node-fetch";
import { encode } from "base-64";

export class XrayTestRepository implements xb.XrayTestRepository {
    constructor(private cfg: xb.Config) { }

    async getFolders(): Promise<xb.Folder[]> {
        const url = `${this.cfg.baseUrl}/rest/raven/1.0/api/testrepository/${this.cfg.projectKey}/folders`;
        const headers = {
            Authorization: `Basic ${encode(this.cfg.username + ":" + this.cfg.password)}`
        };

        try {
            const res = await fetch(url, { method: "GET", headers: headers });
            if (res.status !== 200) throw new Error(res.statusText);
            const data: xb.Folder = await res.json();
            return Promise.resolve([...data.folders]);
        } catch (err) {
            console.error(err);
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
            const res = await fetch(url, { method: "POST", headers: headers, body: body })
            if (res.status !== 200) throw new Error(res.statusText);
            const data: xb.Folder = await res.json();
            return Promise.resolve(data);
        } catch (err) {
            throw new Error(err);
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
            const res = await fetch(url, { method: "PUT", headers: headers, body: body })
            if (res.status !== 200) throw new Error(res.statusText);
            return Promise.resolve();
        } catch (err) {
            throw new Error(err);
        }
    }

    async deleteFolder(folderId: number): Promise<void> {
        const url = `${this.cfg.baseUrl}/rest/raven/1.0/api/testrepository/${this.cfg.projectKey}/folders/${folderId}`;
        const headers = {
            Authorization: `Basic ${encode(this.cfg.username + ":" + this.cfg.password)}`,
            "Content-Type": "application/json"
        };

        try {
            const res = await fetch(url, { method: "DELETE", headers: headers })
            if (res.status !== 200) throw new Error(res.statusText);
            return Promise.resolve();
        } catch (err) {
            throw new Error(err);
        }
    }
}