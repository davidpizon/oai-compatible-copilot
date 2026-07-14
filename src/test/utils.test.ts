import * as assert from "assert";
import { describeErrorCause } from "../utils";

suite("describeErrorCause", () => {
	test("returns undefined when the error has no cause", () => {
		assert.strictEqual(describeErrorCause(new Error("boom")), undefined);
	});

	test("returns undefined for non-Error values", () => {
		assert.strictEqual(describeErrorCause("fetch failed"), undefined);
		assert.strictEqual(describeErrorCause(undefined), undefined);
	});

	test("surfaces the cause message and code (the undici ECONNREFUSED case)", () => {
		const cause = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5002"), { code: "ECONNREFUSED" });
		const err = new TypeError("fetch failed", { cause });
		assert.deepStrictEqual(describeErrorCause(err), {
			message: "connect ECONNREFUSED 127.0.0.1:5002",
			code: "ECONNREFUSED",
		});
	});

	test("omits code when the cause has none", () => {
		const err = new TypeError("fetch failed", { cause: new Error("something went wrong") });
		assert.deepStrictEqual(describeErrorCause(err), { message: "something went wrong" });
	});

	test("unwraps the first sub-error of an AggregateError (dual-stack IPv4/IPv6 refusal)", () => {
		const ipv6 = Object.assign(new Error("connect ECONNREFUSED ::1:5002"), { code: "ECONNREFUSED" });
		const ipv4 = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5002"), { code: "ECONNREFUSED" });
		const err = new TypeError("fetch failed", { cause: new AggregateError([ipv6, ipv4], "") });
		assert.deepStrictEqual(describeErrorCause(err), {
			message: "connect ECONNREFUSED ::1:5002",
			code: "ECONNREFUSED",
		});
	});

	test("stringifies a non-Error cause", () => {
		const err = Object.assign(new Error("wrapper"), { cause: "raw string reason" });
		assert.deepStrictEqual(describeErrorCause(err), { message: "raw string reason" });
	});
});
