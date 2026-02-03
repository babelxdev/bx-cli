import axios, { type AxiosInstance } from "axios";
import { loadConfig } from "../config/index.js";

export class BabelXApi {
	private client: AxiosInstance;
	private apiKey: string;

	constructor() {
		const config = loadConfig();
		this.apiKey = config.apiUrl;
		this.client = axios.create({
			baseURL: config.apiUrl,
			headers: {
				"Content-Type": "application/json",
			},
		});
	}

	setApiKey(apiKey: string): void {
		this.apiKey = apiKey;
		this.client.defaults.headers.Authorization = `Bearer ${apiKey}`;
	}

	private getAuthHeader(): Record<string, string> {
		if (!this.apiKey) {
			throw new Error("API key not set. Please run `bx login` first.");
		}
		return { Authorization: `Bearer ${this.apiKey}` };
	}

	// Auth
	async validateApiKey(): Promise<boolean> {
		try {
			await this.client.get("/auth/validate", {
				headers: this.getAuthHeader(),
			});
			return true;
		} catch {
			return false;
		}
	}

	// Languages
	async getLanguages(): Promise<
		Array<{ code: string; name: string; nativeName?: string }>
	> {
		const response = await this.client.get("/languages", {
			headers: this.getAuthHeader(),
		});
		return response.data;
	}

	// Projects
	async getProjects(): Promise<Array<{ id: string; name: string }>> {
		const response = await this.client.get("/projects", {
			headers: this.getAuthHeader(),
		});
		return response.data;
	}

	async createProject(
		name: string,
		sourceLanguage: string,
		targetLanguages: string[],
	): Promise<{ id: string; name: string }> {
		const response = await this.client.post(
			"/projects",
			{ name, sourceLanguage, targetLanguages },
			{ headers: this.getAuthHeader() },
		);
		return response.data;
	}

	async deleteProject(projectId: string): Promise<void> {
		await this.client.delete(`/projects/${projectId}`, {
			headers: this.getAuthHeader(),
		});
	}

	// Translation
	async translate(
		text: string,
		targetLanguage: string,
		sourceLanguage?: string,
	): Promise<{ translatedText: string; detectedLanguage?: string }> {
		const response = await this.client.post(
			"/translate",
			{
				text,
				targetLanguage,
				sourceLanguage,
			},
			{ headers: this.getAuthHeader() },
		);
		return response.data;
	}

	async translateBatch(
		items: Array<{ key: string; text: string }>,
		targetLanguage: string,
		sourceLanguage?: string,
	): Promise<Array<{ key: string; translatedText: string }>> {
		const response = await this.client.post(
			"/translate/batch",
			{
				items,
				targetLanguage,
				sourceLanguage,
			},
			{ headers: this.getAuthHeader() },
		);
		return response.data;
	}

	// Credits
	async getBalance(): Promise<{ credits: number; currency: string }> {
		const response = await this.client.get("/credits/balance", {
			headers: this.getAuthHeader(),
		});
		return response.data;
	}
}
