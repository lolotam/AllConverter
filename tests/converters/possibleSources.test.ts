import { describe, expect, it } from "bun:test";
import { getPossibleSources, getPossibleTargets } from "../../src/converters/main";
import { normalizeFiletype } from "../../src/helpers/normalizeFiletype";

// The reverse index has to be keyed the same way it is read back. Converters spell the same
// output several ways — markitdown offers "md" where pandoc offers "markdown" — and storing
// the raw spelling while looking up the normalized one silently loses the alias converter
// from the supported-format tables.
describe("getPossibleSources", () => {
  it("answers under either spelling of an aliased format", () => {
    const viaAlias = getPossibleSources("md");
    const viaCanonical = getPossibleSources("markdown");
    expect(viaCanonical).toEqual(viaAlias);
    expect(Object.keys(viaCanonical).length).toBeGreaterThan(0);
  });

  it("keeps a converter that only advertises the alias", () => {
    // markitdown lists "md", never "markdown"
    const sources = getPossibleSources("markdown");
    expect(Object.keys(sources)).toContain("markitDown");
  });

  it("does the same for the other aliases", () => {
    for (const [alias, canonical] of [
      ["jpg", "jpeg"],
      ["tex", "latex"],
      ["htm", "html"],
    ]) {
      expect(normalizeFiletype(alias)).toBe(canonical);
      expect(getPossibleSources(alias)).toEqual(getPossibleSources(canonical));
    }
  });

  it("agrees with the forward index", () => {
    // Anything that says it can reach mp4 must appear among mp4's sources
    for (const converter of Object.keys(getPossibleTargets("avi"))) {
      if (getPossibleTargets("avi")[converter]?.includes("mp4")) {
        expect(Object.keys(getPossibleSources("mp4"))).toContain(converter);
      }
    }
  });

  it("lists each input once per converter", () => {
    for (const inputs of Object.values(getPossibleSources("jpeg"))) {
      expect(inputs.length).toBe(new Set(inputs).size);
    }
  });

  it("returns nothing for a format no converter produces", () => {
    expect(getPossibleSources("not-a-real-format")).toEqual({});
  });
});
