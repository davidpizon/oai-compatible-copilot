# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Build/Test/Lint Commands
```bash
npm run compile        # Build TypeScript
npm run watch          # Build in watch mode
npm run lint           # Run ESLint
npm run format         # Format with Prettier
npm run test           # Run tests (compile + vscode-test)
npm run build          # Package extension to .vsix
npm run download-api   # Download VS Code proposed API types (required after vscode.d.ts updates)
```

## Single-model design
This extension is **single-model on purpose**. It registers one `LanguageModelChatProvider`
that exposes exactly one model to Copilot Chat — the Agentic Router (OpenAI-compatible)
endpoint at `oaicopilot.baseUrl`. There is no multi-model list, no per-provider API keys,
and no "Manage Models..." flow: the model is defined by the flat settings
`oaicopilot.modelId` + `oaicopilot.modelName` + `oaicopilot.apiMode`, and authenticated with
the single `oaicopilot.apiKey` secret. Any backend routing/fan-out is the Agentic Router's
job, server-side — not this extension's.

> **TODO (revisit `modelId`):** We still send `oaicopilot.modelId` as the request `model`
> field, and require it (a non-empty value drives `resolveSingleModel()` and the picker),
> because the Agentic Router currently rejects any request without a non-empty `model` even
> in single-model serving mode (see `RequestInterceptor.ResolveModelRouteAsync` in the
> agent-as-a-router repo — the non-empty check runs before the forced-model override). If the
> Agentic Router is changed to no longer require the `model` field (e.g. defaults it
> server-side when single-model serving is forced), revisit whether `modelId` can be dropped
> here: stop sending the `model` field to the router and remove the `oaicopilot.modelId`
> setting entirely, exposing the single model under `oaicopilot.modelName` alone.

> **TODO (revisit `apiKey`):** Confirm whether `oaicopilot.apiKey` is still needed at all.
> When pointed at the Agentic Router proxy, the upstream router discards the credential we
> send in the `Authorization` header, so the secret buys us nothing in the default setup. It
> is still used when the extension is pointed directly at a real OpenAI/Anthropic/Gemini/Ollama
> endpoint (`CommonApi.prepareHeaders`). If we decide the direct-endpoint case is out of scope
> — or the router grows its own auth — revisit whether the `oaicopilot.apiKey` secret and the
> "Set OAI Compatible Apikey" command can be removed entirely. (The API Key field was already
> removed from the configuration webview.)

## Architecture
- **Entry**: `src/extension.ts` - registers `HuggingFaceChatModelProvider` under vendor id `oaicopilot`
- **Core Provider**: `src/provider.ts` - implements `LanguageModelChatProvider` interface
- **Single model resolution**: `src/provideModel.ts` - `resolveSingleModel()` builds the one model from settings; `prepareLanguageModelChatInformation()` returns a 0- or 1-element list
- **API Modes**: `src/openai/`, `src/ollama/`, `src/anthropic/`, `src/gemini/` - the one model can speak any of these protocols via `oaicopilot.apiMode`

## Key Conventions
- Uses VS Code proposed API `chatProvider` - types in `src/vscode.proposed.*.d.ts`
- The `oaicopilot.apiKey` secret's necessity is under review — see the **TODO (revisit `apiKey`)** in "Single-model design" above
- The model is configured via `oaicopilot.modelId` / `oaicopilot.modelName` / `oaicopilot.apiMode` (see `src/types.ts` for the internal `HFModelItem`)

## Code Style (from eslint.config.mjs)
- Semicolons required (`@stylistic/semi`)
- Curly braces required (`curly`)
- Unused vars with `_` prefix are ignored
- Use `\t` indentation (`@stylistic/indent`)
- Double quotes for strings (`@stylistic/quotes`)
