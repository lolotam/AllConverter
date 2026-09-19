import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findOutputFiles } from "../../src/converters/main";

let dir: string;

beforeEach(async () => {
  dir = `${await mkdtemp(join(tmpdir(), "convertx-outputs-"))}/`;
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const touch = (...names: string[]) => Promise.all(names.map((name) => writeFile(dir + name, "")));

test("returns the expected file when the converter wrote it", async () => {
  await touch("book.jpg");
  expect(await findOutputFiles(dir, "book.jpg")).toEqual(["book.jpg"]);
});

test("returns every page, in page order, for a multi-page conversion", async () => {
  await touch("كتاب-10.jpg", "كتاب-0.jpg", "كتاب-2.jpg", "كتاب-1.jpg");
  expect(await findOutputFiles(dir, "كتاب.jpg")).toEqual([
    "كتاب-0.jpg",
    "كتاب-1.jpg",
    "كتاب-2.jpg",
    "كتاب-10.jpg",
  ]);
});

test("returns nothing when the converter produced no output", async () => {
  expect(await findOutputFiles(dir, "book.jpg")).toEqual([]);
});

test("ignores similarly named files that are not a page sequence", async () => {
  await touch("book-2024.jpg", "book-cover.jpg", "book-1.png");
  expect(await findOutputFiles(dir, "book.jpg")).toEqual([]);
});
