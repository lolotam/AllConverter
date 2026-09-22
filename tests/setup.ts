// Runs before any test file, and before any src module is imported.
//
// src/helpers/env.ts reads process.env once, when it is first imported, and `bun test` puts
// every test file in one process. So the first file to pull in anything from src/ decides
// what every later file sees — a test that sets a variable in its own preamble is already
// too late if another file got there first.
//
// That made the suite depend on a developer's local .env: with one present the values were
// there from the start and everything passed, without one (CI) whichever file loaded first
// snapshotted the defaults, and an unrelated test failed. Setting the values here, before
// anything can read them, is what makes the run the same everywhere.

// Guests may convert. Several tests exercise the guest path, and none rely on it being off.
process.env.ALLOW_UNAUTHENTICATED = "true";

// Signing has to work; the value itself does not matter, only that there is one.
process.env.JWT_SECRET ??= "test-secret-not-used-outside-the-suite";

// DB_PATH is deliberately left alone: test files pick their own, and several rely on
// getting a database nothing else is writing to.
