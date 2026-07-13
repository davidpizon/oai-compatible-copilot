import * as assert from "assert";
import { shouldWarnHttp1 } from "../httpClient";

suite("httpClient", () => {
	test("warns when a TLS connection did not negotiate h2", () => {
		assert.strictEqual(shouldWarnHttp1(true, "http/1.1"), true);
		assert.strictEqual(shouldWarnHttp1(true, false), true);
		assert.strictEqual(shouldWarnHttp1(true, undefined), true);
	});

	test("does not warn when a TLS connection negotiated h2", () => {
		assert.strictEqual(shouldWarnHttp1(true, "h2"), false);
	});

	test("does not warn for plaintext connections — h2 is never attempted without TLS", () => {
		assert.strictEqual(shouldWarnHttp1(false, undefined), false);
		assert.strictEqual(shouldWarnHttp1(false, "http/1.1"), false);
	});
});
