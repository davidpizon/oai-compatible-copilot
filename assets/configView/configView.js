// @ts-check
(function () {
	const vscode = acquireVsCodeApi();

	/** @param {string} id */
	const el = (id) => /** @type {HTMLInputElement & HTMLSelectElement} */ (document.getElementById(id));

	const fields = {
		baseUrl: () => el("baseUrl"),
		apiKey: () => el("apiKey"),
		modelId: () => el("modelId"),
		modelName: () => el("modelName"),
		apiMode: () => el("apiMode"),
		delay: () => el("delay"),
		readFileLines: () => el("readFileLines"),
		retryEnabled: () => el("retryEnabled"),
		retryMaxAttempts: () => el("retryMaxAttempts"),
		retryInterval: () => el("retryInterval"),
		commitLanguage: () => el("commitLanguage"),
	};

	/** @param {number} value @param {number} fallback */
	function num(value, fallback) {
		return Number.isFinite(value) ? value : fallback;
	}

	/** @param {any} payload */
	function applyInit(payload) {
		fields.baseUrl().value = payload.baseUrl ?? "";
		fields.apiKey().value = payload.apiKey ?? "";
		fields.modelId().value = payload.modelId ?? "";
		fields.modelName().value = payload.modelName ?? "";
		fields.apiMode().value = payload.apiMode ?? "openai";
		fields.delay().value = String(payload.delay ?? 0);
		fields.readFileLines().value = String(payload.readFileLines ?? 0);
		const retry = payload.retry ?? {};
		fields.retryEnabled().checked = retry.enabled !== false;
		fields.retryMaxAttempts().value = String(retry.max_attempts ?? 3);
		fields.retryInterval().value = String(retry.interval_ms ?? 1000);
		fields.commitLanguage().value = payload.commitLanguage ?? "English";
	}

	function collect() {
		return {
			type: "saveConfig",
			baseUrl: fields.baseUrl().value,
			apiKey: fields.apiKey().value,
			modelId: fields.modelId().value,
			modelName: fields.modelName().value,
			apiMode: fields.apiMode().value,
			delay: num(parseInt(fields.delay().value, 10), 0),
			readFileLines: num(parseInt(fields.readFileLines().value, 10), 0),
			retry: {
				enabled: fields.retryEnabled().checked,
				max_attempts: num(parseInt(fields.retryMaxAttempts().value, 10), 3),
				interval_ms: num(parseInt(fields.retryInterval().value, 10), 1000),
			},
			commitLanguage: fields.commitLanguage().value,
		};
	}

	/** @param {string} text */
	function setStatus(text) {
		const status = document.getElementById("status");
		if (status) {
			status.textContent = text;
			if (text) {
				setTimeout(() => {
					if (status.textContent === text) {
						status.textContent = "";
					}
				}, 3000);
			}
		}
	}

	document.getElementById("saveConfig")?.addEventListener("click", () => {
		vscode.postMessage(collect());
		setStatus("Saving…");
	});

	document.getElementById("refreshConfig")?.addEventListener("click", () => {
		vscode.postMessage({ type: "requestInit" });
	});

	window.addEventListener("message", (event) => {
		const message = event.data;
		if (message && message.type === "init") {
			applyInit(message.payload);
			setStatus("");
		}
	});

	// Request initial state.
	vscode.postMessage({ type: "requestInit" });
})();
