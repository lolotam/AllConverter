import { expect, test } from "bun:test";
import { PriorityQueue } from "../../src/helpers/queue";

const conversionQueue = new PriorityQueue(1);

const deferred = () => {
  let release!: () => void;
  const done = new Promise<void>((resolve) => (release = resolve));
  return { done, release };
};

test("runs higher-priority tasks first once a slot frees up", async () => {
  const order: string[] = [];
  const blocker = deferred();

  const running = conversionQueue.run(() => blocker.done);
  const tasks = [
    conversionQueue.run(async () => void order.push("free-1"), 0),
    conversionQueue.run(async () => void order.push("free-2"), 0),
    conversionQueue.run(async () => void order.push("pro"), 1),
  ];

  blocker.release();
  await Promise.all([running, ...tasks]);

  expect(order).toEqual(["pro", "free-1", "free-2"]);
});

test("a failing task rejects its caller and does not block the queue", async () => {
  const failing = conversionQueue.run(async () => {
    throw new Error("converter crashed");
  });
  await expect(failing).rejects.toThrow("converter crashed");

  expect(await conversionQueue.run(async () => "next")).toBe("next");
});
