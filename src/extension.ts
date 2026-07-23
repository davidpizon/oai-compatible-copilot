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
	const provider = new HuggingFaceChatModelProvider(tokenCountStatusBarItem);
	// Register the Hugging Face provider under the vendor id used in package.json
	vscode.lm.registerLanguageModelChatProvider("totallyhot.spark", provider);

	context.subscriptions.push(
		vscode.commands.registerCommand("totallyhot.spark.openConfig", async () => {
			ConfigViewPanel.openPanel(context.extensionUri);
		})
	);

	// Register the generateGitCommitMessage command handler
	context.subscriptions.push(
		vscode.commands.registerCommand("totallyhot.spark.generateGitCommitMessage", async (scm) => {
			generateCommitMsg(scm);
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

