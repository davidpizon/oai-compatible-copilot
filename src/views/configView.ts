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
 * extension exposes. It edits the flat `totallyhot.spark.*` settings — there is no
 * provider or multi-model management, and no API key to configure (requests are
 * sent without an auth header).
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
			"totallyhot.spark.config",
			"TotallyHot Spark Configuration",
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
					console.error("[totallyhot.spark] handleMessage failed", err);
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
		const baseUrl = config.get<string>("totallyhot.spark.baseUrl", "");
		const modelName = config.get<string>("totallyhot.spark.modelName", "");
		const apiMode = normalizeApiMode(config.get<string>("totallyhot.spark.apiMode", "openai"));
		const delay = config.get<number>("totallyhot.spark.delay", 0);
		const readFileLines = config.get<number>("totallyhot.spark.readFileLines", 0);
		const retry = config.get<RetryPayload>("totallyhot.spark.retry", {
			enabled: true,
			max_attempts: 3,
			interval_ms: 1000,
		});
		const commitLanguage = config.get<string>("totallyhot.spark.commitLanguage", "English");

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
		await config.update("totallyhot.spark.baseUrl", message.baseUrl.trim(), vscode.ConfigurationTarget.Global);
		await config.update("totallyhot.spark.modelName", message.modelName.trim(), vscode.ConfigurationTarget.Global);
		await config.update("totallyhot.spark.apiMode", normalizeApiMode(message.apiMode), vscode.ConfigurationTarget.Global);
		await config.update("totallyhot.spark.delay", message.delay, vscode.ConfigurationTarget.Global);
		await config.update("totallyhot.spark.readFileLines", message.readFileLines, vscode.ConfigurationTarget.Global);
		await config.update("totallyhot.spark.retry", message.retry, vscode.ConfigurationTarget.Global);
		await config.update("totallyhot.spark.commitLanguage", message.commitLanguage, vscode.ConfigurationTarget.Global);

		vscode.window.showInformationMessage("TotallyHot Spark configuration saved.");
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

