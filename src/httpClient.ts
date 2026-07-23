import type { Socket } from "net";
import type { TLSSocket } from "tls";
import * as vscode from "vscode";
import { Agent, buildConnector, type Dispatcher } from "undici";
import { logger } from "./logger";

/**
 * Node's global `fetch` is undici under the hood and honors a `dispatcher`
 * init option at runtime, but the DOM `RequestInit` type doesn't declare it.
 * Augment it so call sites can pass `dispatcher: getDispatcher()` to the
 * ambient global `fetch` and keep the standard DOM `Response`/`ReadableStream`
 * types the rest of the codebase already expects (importing `fetch` from the
 * `undici` package directly returns its own incompatible stream/Response types).
 */
declare global {
	interface RequestInit {
		dispatcher?: Dispatcher;
	}
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isLoopbackHost(hostname: string): boolean {
	return LOOPBACK_HOSTS.has(hostname);
}

function isTlsSocket(socket: Socket | TLSSocket): socket is TLSSocket {
	return (socket as TLSSocket).encrypted === true;
}

/**
 * Whether a connection should trigger the "HTTP/2 wasn't negotiated" warning.
 * Pure and exported so it can be unit tested without a real socket.
 * Plaintext (non-TLS) connections never negotiate ALPN/h2 — that's expected
 * default behavior, not a fallback, so they never warn.
 */
export function shouldWarnHttp1(encrypted: boolean, alpnProtocol: string | false | null | undefined): boolean {
	return encrypted && alpnProtocol !== "h2";
}

let cachedDispatcher: Agent | undefined;
let cachedAllowInsecureTls: boolean | undefined;
const warnedHosts = new Set<string>();

function getSetting<T>(key: string, defaultValue: T): T {
	return vscode.workspace.getConfiguration().get<T>(key, defaultValue);
}

function notifyHttp1Fallback(hostname: string, protocol: string): void {
	if (warnedHosts.has(hostname) || !getSetting("totallyhot.spark.warnOnHttp1", true)) {
		return;
	}
	warnedHosts.add(hostname);
	logger.warn("http.protocol.fallback", { host: hostname, protocol });
	vscode.window.showWarningMessage(
		`TotallyHot Spark: connected to "${hostname}" over ${protocol} — HTTP/2 was not negotiated. Requests still work, but consider enabling HTTP/2 on the endpoint for better multiplexing/performance.`
	);
}

/**
 * Build the undici Agent used for every request this extension makes.
 * `allowH2` negotiates HTTP/2 via ALPN when the endpoint supports it and
 * transparently falls back to HTTP/1.1 otherwise — `buildConnector` needs
 * `allowH2` passed directly since a custom `connect` function bypasses the
 * Agent-level default ALPN wiring.
 * @param allowInsecureTls Skip TLS certificate verification for loopback
 * hosts only (localhost/127.0.0.1/::1) — intended for local dev endpoints
 * with self-signed certificates, never applied to remote hosts.
 */
function buildDispatcher(allowInsecureTls: boolean): Agent {
	const strictConnect = buildConnector({ allowH2: true });
	const insecureConnect = buildConnector({ allowH2: true, rejectUnauthorized: false });

	const connect: buildConnector.connector = (opts, callback) => {
		const hostname = String(opts.hostname ?? "");
		const connectFn = allowInsecureTls && isLoopbackHost(hostname) ? insecureConnect : strictConnect;
		connectFn(opts, (err, socket) => {
			if (err) {
				callback(err, null);
				return;
			}
			// socket is non-null here per the connector contract when err is null.
			const encrypted = isTlsSocket(socket);
			const alpnProtocol = encrypted ? socket.alpnProtocol : undefined;
			if (shouldWarnHttp1(encrypted, alpnProtocol)) {
				notifyHttp1Fallback(hostname, alpnProtocol || "http/1.1");
			}
			callback(null, socket);
		});
	};

	return new Agent({ allowH2: true, connect });
}

/**
 * Get the shared HTTP/2-capable dispatcher for all extension requests.
 * Rebuilds the underlying Agent when `totallyhot.spark.allowInsecureTls` changes.
 */
export function getDispatcher(): Agent {
	const allowInsecureTls = getSetting("totallyhot.spark.allowInsecureTls", false);
	if (!cachedDispatcher || cachedAllowInsecureTls !== allowInsecureTls) {
		cachedDispatcher?.close().catch(() => {
			/* best-effort close of the previous dispatcher */
		});
		cachedDispatcher = buildDispatcher(allowInsecureTls);
		cachedAllowInsecureTls = allowInsecureTls;
	}
	return cachedDispatcher;
}

