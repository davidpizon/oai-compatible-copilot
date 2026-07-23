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
endpoint at `totallyhot.spark.baseUrl`. There is no multi-model list, no per-provider API keys,
and no "Manage Models..." flow: the model is defined by the flat settings
`totallyhot.spark.modelId` + `totallyhot.spark.modelName` + `totallyhot.spark.apiMode`. Requests
are sent with no auth header — any credential the upstream endpoint needs is the Agentic
Router's concern, server-side, not this extension's. Any backend routing/fan-out is likewise
the Agentic Router's job.

> **TODO (revisit `modelId`):** We still send `totallyhot.spark.modelId` as the request `model`
> field, and require it (a non-empty value drives `resolveSingleModel()` and the picker),
> because the Agentic Router currently rejects any request without a non-empty `model` even
> in single-model serving mode (see `RequestInterceptor.ResolveModelRouteAsync` in the
> agent-as-a-router repo — the non-empty check runs before the forced-model override). If the
> Agentic Router is changed to no longer require the `model` field (e.g. defaults it
> server-side when single-model serving is forced), revisit whether `modelId` can be dropped
> here: stop sending the `model` field to the router and remove the `totallyhot.spark.modelId`
> setting entirely, exposing the single model under `totallyhot.spark.modelName` alone.

> **Removed `apiKey`:** The `totallyhot.spark.apiKey` secret, the "Set OAI Compatible Apikey"
> command, and `CommonApi.prepareHeaders`'s auth-header logic (`Authorization`/`x-api-key`/
> `x-goog-api-key`) have been removed. Requests to any endpoint — including a direct (non-router)
> OpenAI/Anthropic/Gemini/Ollama endpoint — now go out with no credential from this extension.
> If direct-endpoint auth is needed again in the future, it will need to be reintroduced.

## Architecture
- **Entry**: `src/extension.ts` - registers `HuggingFaceChatModelProvider` under vendor id `totallyhot.spark`
- **Core Provider**: `src/provider.ts` - implements `LanguageModelChatProvider` interface
- **Single model resolution**: `src/provideModel.ts` - `resolveSingleModel()` builds the one model from settings; `prepareLanguageModelChatInformation()` returns a 0- or 1-element list
- **API Modes**: `src/openai/`, `src/ollama/`, `src/anthropic/`, `src/gemini/` - the one model can speak any of these protocols via `totallyhot.spark.apiMode`

## Key Conventions
- Uses VS Code proposed API `chatProvider` - types in `src/vscode.proposed.*.d.ts`
- The `totallyhot.spark.apiKey` secret has been removed — see **Removed `apiKey`** in "Single-model design" above; requests carry no credential from this extension
- The model is configured via `totallyhot.spark.modelId` / `totallyhot.spark.modelName` / `totallyhot.spark.apiMode` (see `src/types.ts` for the internal `HFModelItem`)

## Code Style (from eslint.config.mjs)
- Semicolons required (`@stylistic/semi`)
- Curly braces required (`curly`)
- Unused vars with `_` prefix are ignored
- Use `\t` indentation (`@stylistic/indent`)
- Double quotes for strings (`@stylistic/quotes`)

