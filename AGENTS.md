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

## Architecture
- **Entry**: `src/extension.ts` - registers `HuggingFaceChatModelProvider` under vendor id `oaicopilot`
- **Core Provider**: `src/provider.ts` - implements `LanguageModelChatProvider` interface
- **Single model resolution**: `src/provideModel.ts` - `resolveSingleModel()` builds the one model from settings; `prepareLanguageModelChatInformation()` returns a 0- or 1-element list
- **API Modes**: `src/openai/`, `src/ollama/`, `src/anthropic/`, `src/gemini/` - the one model can speak any of these protocols via `oaicopilot.apiMode`

## Key Conventions
- Uses VS Code proposed API `chatProvider` - types in `src/vscode.proposed.*.d.ts`
- The single API key is stored via `vscode.SecretStorage` under `oaicopilot.apiKey`
- The model is configured via `oaicopilot.modelId` / `oaicopilot.modelName` / `oaicopilot.apiMode` (see `src/types.ts` for the internal `HFModelItem`)

## Code Style (from eslint.config.mjs)
- Semicolons required (`@stylistic/semi`)
- Curly braces required (`curly`)
- Unused vars with `_` prefix are ignored
- Use `\t` indentation (`@stylistic/indent`)
- Double quotes for strings (`@stylistic/quotes`)
