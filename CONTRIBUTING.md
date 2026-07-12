# Contributing Guide

Thanks for taking the time to start contributing. This guide will help you get started with the project.

This extension is the connective layer between GitHub Copilot Chat and any OpenAI/Ollama/Anthropic/Gemini-compatible backend — including Custom Agentic Routers and Agentic Proxy Orchestrators. Keep that in mind for contributions: changes should stay protocol-agnostic (they shouldn't assume a specific hosted provider) so the extension keeps working as a generic bridge for whatever endpoint a user configures.

Also the project welcome serious and willing maintainers.

## How to contribute?

### Creating an Issue

For anything else than a typo or a bug fix, please raise an issue to discuss your proposal before submitting any code.

### License for contributions

As the copyright owner, you agree to license your contributions under an irrevocable MIT license.

### For Developers: Creating a Pull Request

**Requirements:**
- VS Code 1.104.0 or higher.
- Node.js 22.
- Your OpenAI-compatible provider API key.

```bash
git clone https://github.com/JohnnyZ93/oai-compatible-copilot
cd oai-compatible-copilot
npm install
npm run compile
```
Press F5 to launch an Extension Development Host.

**Common scripts:**
- Build: `npm run compile`
- Watch: `npm run watch`
- Lint: `npm run lint`
- Format: `npm run format`

### Tests

You should use your own OpenAI-compatible provider API key for test.