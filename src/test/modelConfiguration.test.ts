import * as assert from "assert";
import * as vscode from "vscode";
import { AnthropicApi } from "../anthropic/anthropicApi";
import { GeminiApi } from "../gemini/geminiApi";
import {
	createReasoningEffortConfigurationSchema,
	getConfiguredReasoningEffort,
	isReasoningEffortPickerEnabled,
	type ModelPickerChatInformation,
	REASONING_EFFORT_CONFIGURATION_SCHEMA,
} from "../modelConfiguration";
import { OllamaApi } from "../ollama/ollamaApi";
import { OpenaiApi } from "../openai/openaiApi";
import { OpenaiResponsesApi } from "../openai/openaiResponsesApi";
import { prepareLanguageModelChatInformation } from "../provideModel";
import type { HFModelItem } from "../types";

suite("modelConfiguration", () => {
	const deepSeekModel: HFModelItem = {
		id: "deepseek-v4-pro",
		displayName: "DeepSeek V4 Pro",
		owned_by: "deepseek",
		baseUrl: "https://api.deepseek.com",
		apiMode: "openai",
		context_length: 1_000_000,
		max_tokens: 384_000,
		reasoning_effort: "medium",
	};

	test("only enables the picker when the model has a reasoning effort default", () => {
		assert.strictEqual(isReasoningEffortPickerEnabled({ id: "m", owned_by: "p" }), false);
		assert.strictEqual(isReasoningEffortPickerEnabled({ id: "m", owned_by: "p", reasoning_effort: "" }), false);
		assert.strictEqual(isReasoningEffortPickerEnabled({ id: "m", owned_by: "p", reasoning_effort: "custom" }), false);
		assert.strictEqual(isReasoningEffortPickerEnabled({ id: "m", owned_by: "p", reasoning_effort: "high" }), true);
	});

	test("defines reasoning effort choices for provider configuration", () => {
		const schema = REASONING_EFFORT_CONFIGURATION_SCHEMA.properties.reasoningEffort;
		assert.strictEqual(schema.title, "Reasoning Effort");
		assert.strictEqual(schema.default, "medium");
		assert.deepStrictEqual(schema.enum, ["minimal", "low", "medium", "high", "xhigh", "max"]);
		assert.strictEqual(createReasoningEffortConfigurationSchema("high").properties.reasoningEffort.default, "high");
	});

	test("reads the selected reasoning effort from VS Code model configuration", () => {
		assert.strictEqual(getConfiguredReasoningEffort(undefined), "medium");
		assert.strictEqual(getConfiguredReasoningEffort(undefined, "low"), "low");
		assert.strictEqual(
			getConfiguredReasoningEffort({ modelConfiguration: { reasoningEffort: "high" } } as never),
			"high"
		);
		assert.strictEqual(getConfiguredReasoningEffort({ configuration: { reasoningEffort: "max" } } as never), "max");
		assert.strictEqual(
			getConfiguredReasoningEffort({ modelConfiguration: { reasoningEffort: "invalid" } } as never, "xhigh"),
			"xhigh"
		);
	});

	test("exposes exactly one model built from the flat settings", async () => {
		const config = vscode.workspace.getConfiguration();
		const previousModelId = config.get<unknown>("totallyhot.spark.modelId", "");
		const previousModelName = config.get<unknown>("totallyhot.spark.modelName", "");
		const cts = new vscode.CancellationTokenSource();

		try {
			await config.update("totallyhot.spark.modelId", "glm-4.6", vscode.ConfigurationTarget.Global);
			await config.update("totallyhot.spark.modelName", "Agentic Router", vscode.ConfigurationTarget.Global);

			const infos = await prepareLanguageModelChatInformation({ silent: true }, cts.token, {} as vscode.SecretStorage);

			assert.strictEqual(infos.length, 1, "exactly one model should be exposed");
			const info = infos[0] as ModelPickerChatInformation;
			assert.strictEqual(info.id, "glm-4.6");
			assert.strictEqual(info.name, "Agentic Router");
			assert.strictEqual(info.isUserSelectable, true);
			assert.strictEqual(info.isDefault, true);
			// The single-model provider never surfaces the reasoning-effort picker.
			assert.strictEqual(info.configurationSchema, undefined);
		} finally {
			cts.dispose();
			await config.update("totallyhot.spark.modelId", previousModelId, vscode.ConfigurationTarget.Global);
			await config.update("totallyhot.spark.modelName", previousModelName, vscode.ConfigurationTarget.Global);
		}
	});

	test("exposes no model when the model id is empty", async () => {
		const config = vscode.workspace.getConfiguration();
		const previousModelId = config.get<unknown>("totallyhot.spark.modelId", "");
		const cts = new vscode.CancellationTokenSource();

		try {
			await config.update("totallyhot.spark.modelId", "", vscode.ConfigurationTarget.Global);

			const infos = await prepareLanguageModelChatInformation({ silent: true }, cts.token, {} as vscode.SecretStorage);
			assert.strictEqual(infos.length, 0);
		} finally {
			cts.dispose();
			await config.update("totallyhot.spark.modelId", previousModelId, vscode.ConfigurationTarget.Global);
		}
	});

	test("applies selected reasoning effort to OpenAI-compatible chat requests", () => {
		const requestBody = new OpenaiApi("deepseek-v4-pro").prepareRequestBody(
			{ model: "deepseek-v4-pro", messages: [], stream: true },
			deepSeekModel,
			{ modelConfiguration: { reasoningEffort: "high" } } as never
		);

		assert.strictEqual(requestBody.reasoning_effort, "high");
	});

	test("falls back to the configured default reasoning effort when Copilot has no temporary override", () => {
		const requestBody = new OpenaiApi("deepseek-v4-pro").prepareRequestBody(
			{ model: "deepseek-v4-pro", messages: [], stream: true },
			{ ...deepSeekModel, reasoning_effort: "low" },
			undefined
		);

		assert.strictEqual(requestBody.reasoning_effort, "low");
	});

	test("applies selected reasoning effort to OpenAI Responses requests", () => {
		const requestBody = new OpenaiResponsesApi("deepseek-v4-pro").prepareRequestBody(
			{ model: "deepseek-v4-pro", input: [], stream: true },
			{ ...deepSeekModel, apiMode: "openai-responses" },
			{ modelConfiguration: { reasoningEffort: "max" } } as never
		);

		assert.deepStrictEqual(requestBody.reasoning, { effort: "max" });
	});

	test("keeps the picker out of unsupported native API request bodies", () => {
		const options = { modelConfiguration: { reasoningEffort: "high" } } as never;
		const anthropicBody = new AnthropicApi("claude").prepareRequestBody(
			{ model: "claude", messages: [], max_tokens: 1024, stream: true },
			{ ...deepSeekModel, apiMode: "anthropic" },
			options
		) as unknown as Record<string, unknown>;
		const ollamaBody = new OllamaApi("qwen3").prepareRequestBody(
			{ model: "qwen3", messages: [], stream: true },
			{ ...deepSeekModel, apiMode: "ollama" },
			options
		) as unknown as Record<string, unknown>;
		const geminiBody = new GeminiApi("gemini").prepareRequestBody(
			{ contents: [] },
			{ ...deepSeekModel, apiMode: "gemini" },
			options
		) as Record<string, unknown>;

		assert.strictEqual(anthropicBody.reasoning_effort, undefined);
		assert.strictEqual(anthropicBody.thinking, undefined);
		assert.strictEqual(ollamaBody.reasoning_effort, undefined);
		assert.strictEqual(ollamaBody.think, undefined);
		assert.strictEqual(geminiBody.reasoning_effort, undefined);
		assert.strictEqual(geminiBody.thinkingConfig, undefined);
	});
});

