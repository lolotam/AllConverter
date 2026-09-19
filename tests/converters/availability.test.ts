import { expect, test } from "bun:test";
import { missingExecutables } from "../../src/converters/availability";

const installed =
  (...commands: string[]) =>
  (command: string) =>
    commands.includes(command) ? `/usr/bin/${command}` : null;

test("reports the program a converter needs when it is not installed", () => {
  expect(missingExecutables("imagemagick", installed("vips"))).toEqual(["magick"]);
  expect(missingExecutables("imagemagick", installed("magick"))).toEqual([]);
});

test("a converter needing several programs is missing any that are absent", () => {
  expect(missingExecutables("libjxl", installed("cjxl"))).toEqual(["djxl"]);
});

test("converters written in JS and unknown converters need no programs", () => {
  expect(missingExecutables("vcf", installed())).toEqual([]);
  expect(missingExecutables("some-new-converter", installed())).toEqual([]);
});
