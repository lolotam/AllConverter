import { availableParallelism } from "node:os";
import { MAX_CONVERT_PROCESS } from "./env";

type Task = { priority: number; seq: number; start: () => void };

/**
 * In-process priority queue shared by every job, so the server never runs more
 * than `concurrency` converters at once no matter how many users convert.
 * Higher priority runs first; equal priority runs in arrival order.
 */
export class PriorityQueue {
  private running = 0;
  private seq = 0;
  private readonly waiting: Task[] = [];

  constructor(private readonly concurrency: number) {}

  run<T>(fn: () => Promise<T>, priority = 0): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.waiting.push({
        priority,
        seq: this.seq++,
        start: () => {
          Promise.resolve()
            .then(fn)
            .then(resolve, reject)
            .finally(() => {
              this.running--;
              this.next();
            });
        },
      });
      this.waiting.sort((a, b) => b.priority - a.priority || a.seq - b.seq);
      this.next();
    });
  }

  /** What the queue is doing right now, for the admin dashboard. */
  stats(): { running: number; waiting: number; concurrency: number } {
    return { running: this.running, waiting: this.waiting.length, concurrency: this.concurrency };
  }

  private next(): void {
    while (this.running < this.concurrency) {
      const task = this.waiting.shift();
      if (!task) {
        return;
      }
      this.running++;
      task.start();
    }
  }
}

export const conversionQueue = new PriorityQueue(
  MAX_CONVERT_PROCESS > 0 ? MAX_CONVERT_PROCESS : availableParallelism(),
);
