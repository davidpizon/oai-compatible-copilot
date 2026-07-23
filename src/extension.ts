import * as vscode from "vscode";
import { HuggingFaceChatModelProvider } from "./provider";
import { initStatusBar } from "./statusBar";
import { ConfigViewPanel } from "./views/configView";
import { logger } from "./logger";
import { abortCommitGeneration, generateCommitMsg } from "./gitCommit/commitMessageGenerator";
import { TokenizerManager } from "./tokenizer/tokenizerManager";

export function activate(context: vscode.ExtensionContext) {
	// Initialize logger
	logger.init();

	// Initialize TokenizerManager with extension path
	TokenizerManager.initialize(context.extensionPath);

	const tokenCountStatusBarItem: vscode.StatusBarItem = initStatusBar(context);
	const provider = new HuggingFaceChatModelProvider(context.secrets, tokenCountStatusBarItem);
	// Register the Hugging Face provider under the vendor id used in package.json
	vscode.lm.registerLanguageModelChatProvider("totallyhot.spark", provider);

	// Management command to configure API key
	context.subscriptions.push(
		vscode.commands.registerCommand("totallyhot.spark.setApikey", async () => {
			const existing = await context.secrets.get("totallyhot.spark.apiKey");
			const apiKey = await vscode.window.showInputBox({
				title: "OAI Compatible Provider API Key",
				prompt: existing ? "Update your OAI Compatible API key" : "Enter your OAI Compatible API key",
				ignoreFocusOut: true,
				password: true,
				value: existing ?? "",
			});
			if (apiKey === undefined) {
				return; // user canceled
			}
			if (!apiKey.trim()) {
				await context.secrets.delete("totallyhot.spark.apiKey");
				vscode.window.showInformationMessage("OAI Compatible API key cleared.");
				return;
			}
			await context.secrets.store("totallyhot.spark.apiKey", apiKey.trim());
			vscode.window.showInformationMessage("OAI Compatible API key saved.");
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("totallyhot.spark.openConfig", async () => {
			ConfigViewPanel.openPanel(context.extensionUri);
		})
	);

	// Register the generateGitCommitMessage command handler
	context.subscriptions.push(
		vscode.commands.registerCommand("totallyhot.spark.generateGitCommitMessage", async (scm) => {
			generateCommitMsg(context.secrets, scm);
		}),
		vscode.commands.registerCommand("totallyhot.spark.abortGitCommitMessage", () => {
			abortCommitGeneration();
		})
	);

	// Watch for logLevel configuration changes
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration("totallyhot.spark.logLevel")) {
				logger.reloadConfig();
			}
		})
	);
}

export function deactivate() {}

