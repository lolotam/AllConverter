// Live per-file conversion progress for the results page. Kept in memory: it is
// lost on restart, which is fine because so are the conversions in flight.

export type FileState = "queued" | "converting" | "done" | "failed";

export type FileProgress = {
  file: string;
  state: FileState;
  // Real progress for converters that report it (ffmpeg); null means estimate it
  percent: number | null;
  startedAt: number | null;
  // How long a converter without progress output is expected to take, for the bar's animation
  estimateMs: number;
};

export type ProgressOptions = { onProgress?: (percent: number) => void };

const jobs = new Map<string, Map<string, FileProgress>>();

export function estimateDurationMs(sizeBytes: number): number {
  const megabytes = sizeBytes / (1024 * 1024);
  return Math.min(180_000, Math.max(2_000, 1_500 + megabytes * 800));
}

export function trackQueued(jobId: string, files: { file: string; sizeBytes: number }[]): void {
  jobs.set(
    jobId,
    new Map(
      files.map(({ file, sizeBytes }) => [
        file,
        {
          file,
          state: "queued",
          percent: null,
          startedAt: null,
          estimateMs: estimateDurationMs(sizeBytes),
        },
      ]),
    ),
  );
}

export function trackStarted(jobId: string, file: string): void {
  const entry = jobs.get(jobId)?.get(file);
  if (entry) {
    entry.state = "converting";
    entry.startedAt = Date.now();
  }
}

export function trackPercent(jobId: string, file: string, percent: number): void {
  const entry = jobs.get(jobId)?.get(file);
  if (entry?.state === "converting") {
    // Never go backwards, and leave 100% for when the output is actually written
    entry.percent = Math.max(entry.percent ?? 0, Math.min(99, percent));
  }
}

export function trackFinished(jobId: string, file: string, succeeded: boolean): void {
  const entry = jobs.get(jobId)?.get(file);
  if (entry) {
    entry.state = succeeded ? "done" : "failed";
    entry.percent = 100;
  }
}

export function jobProgress(jobId: string): (FileProgress & { elapsedMs: number })[] | undefined {
  const files = jobs.get(jobId);
  if (!files) {
    return undefined;
  }
  const now = Date.now();
  return [...files.values()].map((file) => ({
    ...file,
    elapsedMs: file.startedAt ? now - file.startedAt : 0,
  }));
}

// Keep finished jobs long enough for an open results page to see the final state
export function forgetJob(jobId: string, afterMs = 10 * 60 * 1000): void {
  setTimeout(() => jobs.delete(jobId), afterMs).unref?.();
}

/** Turns ffmpeg's stderr ("Duration: ..." then repeated "time=...") into percentages. */
export function createFfmpegProgressParser(onProgress: (percent: number) => void) {
  let durationSeconds = 0;
  const toSeconds = (match: RegExpMatchArray) =>
    Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);

  return (chunk: Buffer | string) => {
    const text = chunk.toString();
    if (!durationSeconds) {
      const duration = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(text);
      if (duration) {
        durationSeconds = toSeconds(duration);
      }
    }
    const position = [...text.matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)].at(-1);
    if (durationSeconds > 0 && position) {
      onProgress((toSeconds(position) / durationSeconds) * 100);
    }
  };
}
