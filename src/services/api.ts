import axios, { type AxiosInstance } from "axios";
import { loadConfig } from "../config/index.js";

export class BabelXApi {
	private client: AxiosInstance;

	constructor(config: { apiUrl: string }) {
		this.client = axios.create({
			baseURL: config.apiUrl,
			headers: {
				"Content-Type": "application/json",
			},
		});
	}

	static async create(): Promise<BabelXApi> {
		const config = await loadConfig();
		return new BabelXApi({ apiUrl: config.apiUrl });
	}

	setApiKey(apiKey: string): void {
		this.client.defaults.headers["X-API-Key"] = apiKey;
	}

	// Auth
	async validateApiKey(): Promise<boolean> {
		try {
			await this.client.get("/auth/validate");
			return true;
		} catch {
			return false;
		}
	}

	// Languages
	async getLanguages(): Promise<
		Array<{ code: string; name: string; nativeName?: string }>
	> {
		const response = await this.client.get("/languages");
		return response.data;
	}

	// Projects
	async getProjects(): Promise<Array<{ id: string; name: string }>> {
		const response = await this.client.get("/projects");
		return response.data;
	}

	async createProject(
		name: string,
		sourceLanguage: string,
		targetLanguages: string[],
	): Promise<{ id: string; name: string }> {
		const response = await this.client.post("/projects", {
			name,
			sourceLanguage,
			targetLanguages,
		});
		return response.data;
	}

	async deleteProject(projectId: string): Promise<void> {
		await this.client.delete(`/projects/${projectId}`);
	}

	// Translation
	async translate(
		text: string,
		targetLanguage: string,
		sourceLanguage?: string,
	): Promise<{ translatedText: string; detectedLanguage?: string }> {
		const response = await this.client.post("/translate", {
			text,
			target_code: targetLanguage,
			source_code: sourceLanguage,
		});
		return {
			translatedText: response.data.translated_text,
			detectedLanguage: response.data.source_lang,
		};
	}

	async translateBatch(
		items: Array<{ key: string; text: string }>,
		targetLanguage: string,
		sourceLanguage?: string,
	): Promise<Array<{ key: string; translatedText: string }>> {
		// Batch endpoint not available, translate one by one
		const results: Array<{ key: string; translatedText: string }> = [];
		for (const item of items) {
			const result = await this.translate(item.text, targetLanguage, sourceLanguage);
			results.push({
				key: item.key,
				translatedText: result.translatedText,
			});
		}
		return results;
	}

	// Credits
	async getBalance(): Promise<{ credits: number; currency: string }> {
		const response = await this.client.get("/credits/balance");
		return response.data;
	}
}
