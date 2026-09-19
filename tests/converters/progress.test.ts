import { expect, test } from "bun:test";
import {
  createFfmpegProgressParser,
  estimateDurationMs,
  jobProgress,
  trackFinished,
  trackPercent,
  trackQueued,
  trackStarted,
} from "../../src/converters/progress";

test("ffmpeg stderr is turned into a percentage of the input duration", () => {
  const seen: number[] = [];
  const parse = createFfmpegProgressParser((percent) => seen.push(percent));

  parse("Input #0, mov,mp4 from 'in.mp4':\n  Duration: 00:01:40.00, start: 0.000000\n");
  parse("frame=  10 fps=0.0 size=  256kB time=00:00:25.00 bitrate=...\r");
  parse("frame=  20 size=  512kB time=00:00:40.00 bitrate=...\rframe= 30 time=00:00:50.00 \r");

  expect(seen).toEqual([25, 50]);
});

test("ffmpeg output without a duration (e.g. a single image) reports nothing", () => {
  const seen: number[] = [];
  const parse = createFfmpegProgressParser((percent) => seen.push(percent));

  parse("  Duration: N/A, start: 0.000000\nframe=1 time=00:00:00.04\r");

  expect(seen).toEqual([]);
});

test("a file moves from queued to converting to done, never exceeding 99% before done", () => {
  trackQueued("job-a", [
    { file: "a.mp4", sizeBytes: 1024 },
    { file: "b.mp4", sizeBytes: 1024 },
  ]);
  expect(jobProgress("job-a")?.map((f) => f.state)).toEqual(["queued", "queued"]);

  trackStarted("job-a", "a.mp4");
  trackPercent("job-a", "a.mp4", 40);
  trackPercent("job-a", "a.mp4", 30); // progress never goes backwards
  trackPercent("job-a", "a.mp4", 120);
  expect(jobProgress("job-a")?.[0]).toMatchObject({ state: "converting", percent: 99 });

  trackFinished("job-a", "a.mp4", true);
  trackStarted("job-a", "b.mp4");
  trackFinished("job-a", "b.mp4", false);
  expect(jobProgress("job-a")?.map((f) => [f.state, f.percent])).toEqual([
    ["done", 100],
    ["failed", 100],
  ]);
});

test("unknown jobs have no progress, and estimates scale with file size within bounds", () => {
  expect(jobProgress("never-queued")).toBeUndefined();
  expect(estimateDurationMs(0)).toBe(2_000);
  expect(estimateDurationMs(10 * 1024 * 1024)).toBe(9_500);
  expect(estimateDurationMs(10 * 1024 * 1024 * 1024)).toBe(180_000);
});
