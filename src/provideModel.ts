import * as vscode from "vscode";
import { CancellationToken, LanguageModelChatInformation } from "vscode";

import type { HFApiMode, HFModelItem } from "./types";
import { logger } from "./logger";

const DEFAULT_CONTEXT_LENGTH = 128000;
const DEFAULT_MAX_TOKENS = 4096;
const EXTENSION_LABEL = "OAICopilot";
const DEFAULT_API_MODE: HFApiMode = "openai";
const API_MODES: readonly HFApiMode[] = ["openai", "openai-responses", "ollama", "anthropic", "gemini"];

/**
 * Coerce an arbitrary configuration value into a supported {@link HFApiMode},
 * falling back to the default ("openai") when unset or unrecognized.
 */
export function normalizeApiMode(value: unknown): HFApiMode {
	return API_MODES.includes(value as HFApiMode) ? (value as HFApiMode) : DEFAULT_API_MODE;
}

/**
 * Resolve the single model this extension exposes to Copilot Chat.
 *
 * The model is defined entirely by the flat `oaicopilot.baseUrl`,
 * `oaicopilot.modelId`, and `oaicopilot.apiMode` settings — the extension is a
 * bridge to one Agentic Router (OpenAI-compatible) endpoint, so there is never
 * more than one model. Returns `undefined` when no model id is configured.
 */
export function resolveSingleModel(
	config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration()
): HFModelItem | undefined {
	const modelId = config.get<string>("oaicopilot.modelId", "").trim();
	if (!modelId) {
		return undefined;
	}

	return {
		id: modelId,
		owned_by: "",
		apiMode: normalizeApiMode(config.get<string>("oaicopilot.apiMode", DEFAULT_API_MODE)),
		baseUrl: config.get<string>("oaicopilot.baseUrl", ""),
	};
}

/**
 * Get the language model contributed by this provider. Always returns either a
 * single-element list (when a model id is configured) or an empty list.
 * @param _options Options which specify the calling context of this function
 * @param _token A cancellation token which signals if the user cancelled the request or not
 * @returns A promise that resolves to the list of available language models
 */
export async function prepareLanguageModelChatInformation(
	_options: { silent: boolean },
	_token: CancellationToken,
	_secrets: vscode.SecretStorage
): Promise<LanguageModelChatInformation[]> {
	const config = vscode.workspace.getConfiguration();
	const model = resolveSingleModel(config);
	if (!model) {
		logger.info("models.loaded", { count: 0, source: "config" });
		return [];
	}

	const modelName = config.get<string>("oaicopilot.modelName", "").trim() || model.id;
	const maxOutput = DEFAULT_MAX_TOKENS;
	const maxInput = Math.max(1, DEFAULT_CONTEXT_LENGTH - maxOutput);

	const info: LanguageModelChatInformation = {
		id: model.id,
		name: modelName,
		detail: EXTENSION_LABEL,
		tooltip: EXTENSION_LABEL,
		family: EXTENSION_LABEL,
		version: "1.0.0",
		maxInputTokens: maxInput,
		maxOutputTokens: maxOutput,
		// Single model: pre-select it and surface it in the picker without a
		// "Manage Models..." step.
		isDefault: true,
		isUserSelectable: true,
		capabilities: {
			toolCalling: true,
			imageInput: false,
		},
	};

	logger.info("models.loaded", { count: 1, source: "config" });
	return [info];
}
