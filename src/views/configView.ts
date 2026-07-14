import * as vscode from "vscode";
import type { HFApiMode } from "../types";
import { normalizeApiMode } from "../provideModel";

interface RetryPayload {
	enabled?: boolean;
	max_attempts?: number;
	interval_ms?: number;
	status_codes?: number[];
}

interface InitPayload {
	baseUrl: string;
	modelName: string;
	apiMode: HFApiMode;
	delay: number;
	readFileLines: number;
	retry: RetryPayload;
	commitLanguage: string;
}

type IncomingMessage =
	| { type: "requestInit" }
	| {
			type: "saveConfig";
			baseUrl: string;
			modelName: string;
			apiMode: string;
			delay: number;
			readFileLines: number;
			retry: RetryPayload;
			commitLanguage: string;
	  };

type OutgoingMessage = { type: "init"; payload: InitPayload };

/**
 * A minimal configuration webview for the single Agentic Router model this
 * extension exposes. It edits the flat `oaicopilot.*` settings — there is no
 * provider or multi-model management. The `oaicopilot.apiKey` secret is managed
 * separately via the "Set OAI Compatible Apikey" command.
 */
export class ConfigViewPanel {
	public static currentPanel: ConfigViewPanel | undefined;
	private readonly panel: vscode.WebviewPanel;
	private readonly extensionUri: vscode.Uri;
	private disposables: vscode.Disposable[] = [];

	public static openPanel(extensionUri: vscode.Uri) {
		const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

		if (ConfigViewPanel.currentPanel) {
			ConfigViewPanel.currentPanel.panel.reveal(column);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			"oaicopilot.config",
			"OAICopilot Configuration",
			column || vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, "out"), vscode.Uri.joinPath(extensionUri, "assets")],
			}
		);

		ConfigViewPanel.currentPanel = new ConfigViewPanel(panel, extensionUri);
	}

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		this.panel = panel;
		this.extensionUri = extensionUri;

		this.update();

		this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

		this.panel.webview.onDidReceiveMessage(
			async (message) => {
				this.handleMessage(message).catch((err) => {
					console.error("[oaicopilot] handleMessage failed", err);
					vscode.window.showErrorMessage(
						err instanceof Error
							? err.message
							: `Unexpected error while handling configuration message[${message.type}].`
					);
				});
			},
			null,
			this.disposables
		);

		// Send initialization data
		this.sendInit();
	}

	private async update() {
		const webview = this.panel.webview;
		this.panel.webview.html = await this.getHtml(webview);
	}

	public dispose() {
		ConfigViewPanel.currentPanel = undefined;

		this.panel.dispose();

		while (this.disposables.length) {
			const x = this.disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	async handleMessage(message: IncomingMessage) {
		switch (message.type) {
			case "requestInit":
				await this.sendInit();
				break;
			case "saveConfig":
				await this.saveConfig(message);
				break;
			default:
				break;
		}
	}

	private async sendInit() {
		const config = vscode.workspace.getConfiguration();
		const baseUrl = config.get<string>("oaicopilot.baseUrl", "");
		const modelName = config.get<string>("oaicopilot.modelName", "");
		const apiMode = normalizeApiMode(config.get<string>("oaicopilot.apiMode", "openai"));
		const delay = config.get<number>("oaicopilot.delay", 0);
		const readFileLines = config.get<number>("oaicopilot.readFileLines", 0);
		const retry = config.get<RetryPayload>("oaicopilot.retry", {
			enabled: true,
			max_attempts: 3,
			interval_ms: 1000,
		});
		const commitLanguage = config.get<string>("oaicopilot.commitLanguage", "English");

		const payload: InitPayload = {
			baseUrl,
			modelName,
			apiMode,
			delay,
			readFileLines,
			retry,
			commitLanguage,
		};
		this.panel.webview.postMessage({ type: "init", payload } as OutgoingMessage);
	}

	private async saveConfig(message: Extract<IncomingMessage, { type: "saveConfig" }>) {
		const config = vscode.workspace.getConfiguration();
		await config.update("oaicopilot.baseUrl", message.baseUrl.trim(), vscode.ConfigurationTarget.Global);
		await config.update("oaicopilot.modelName", message.modelName.trim(), vscode.ConfigurationTarget.Global);
		await config.update("oaicopilot.apiMode", normalizeApiMode(message.apiMode), vscode.ConfigurationTarget.Global);
		await config.update("oaicopilot.delay", message.delay, vscode.ConfigurationTarget.Global);
		await config.update("oaicopilot.readFileLines", message.readFileLines, vscode.ConfigurationTarget.Global);
		await config.update("oaicopilot.retry", message.retry, vscode.ConfigurationTarget.Global);
		await config.update("oaicopilot.commitLanguage", message.commitLanguage, vscode.ConfigurationTarget.Global);

		vscode.window.showInformationMessage("OAICopilot configuration saved.");
		await this.sendInit();
	}

	private async getHtml(webview: vscode.Webview) {
		const nonce = this.getNonce();
		const assetsRoot = vscode.Uri.joinPath(this.extensionUri, "assets", "configView");
		const templatePath = vscode.Uri.joinPath(assetsRoot, "configView.html");
		const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsRoot, "configView.css"));
		const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsRoot, "configView.js"));
		const csp = [
			`default-src 'none'`,
			`img-src ${webview.cspSource} https:`,
			`style-src ${webview.cspSource} 'unsafe-inline'`,
			`script-src ${webview.cspSource} 'nonce-${nonce}'`,
		].join("; ");

		const raw = await vscode.workspace.fs.readFile(templatePath);
		let html = new TextDecoder("utf-8").decode(raw);
		html = html
			.replaceAll("%CSP_SOURCE%", csp)
			.replaceAll("%NONCE%", nonce)
			.replace("%CSS_URI%", cssUri.toString())
			.replace("%SCRIPT_URI%", jsUri.toString());
		return html;
	}

	private getNonce() {
		return Array.from({ length: 16 }, () => Math.floor(Math.random() * 36).toString(36)).join("");
	}
}
