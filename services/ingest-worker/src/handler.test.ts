import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SQSEvent } from "aws-lambda";
import { createHandler } from "./handler.js";
import type { ObjectRef, Storage } from "./storage.js";

const LANDING = "landing-bucket";
const CONTENT = "content-bucket";

class FakeStorage implements Storage {
  objects = new Map<string, { body: string; contentType?: string }>();
  failWrites = false;

  async read(bucket: string, key: string): Promise<string> {
    const obj = this.objects.get(`${bucket}/${key}`);
    if (!obj) throw new Error("NoSuchKey");
    return obj.body;
  }

  async write(bucket: string, key: string, body: string, contentType: string): Promise<void> {
    if (this.failWrites) throw new Error("S3 unavailable");
    this.objects.set(`${bucket}/${key}`, { body, contentType });
  }

  async copy(from: ObjectRef, to: ObjectRef, contentType: string): Promise<void> {
    const obj = this.objects.get(`${from.bucket}/${from.key}`);
    if (!obj) throw new Error("NoSuchKey");
    this.objects.set(`${to.bucket}/${to.key}`, { body: obj.body, contentType });
  }
}

function s3Event(key: string, size = 100): string {
  return JSON.stringify({ Records: [{ s3: { bucket: { name: LANDING }, object: { key, size } } }] });
}

function sqsEvent(...bodies: string[]): SQSEvent {
  return {
    Records: bodies.map((body, i) => ({ messageId: `msg-${i + 1}`, body })),
  } as unknown as SQSEvent;
}

describe("ingest worker", () => {
  let storage: FakeStorage;
  let handler: ReturnType<typeof createHandler>;

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    storage = new FakeStorage();
    handler = createHandler(storage, CONTENT);
  });

  afterEach(() => vi.restoreAllMocks());

  it("publishes a valid content document to content/<slug>.json", async () => {
    storage.objects.set(`${LANDING}/incoming/about.json`, { body: '{"slug":"about","title":"About"}' });
    const res = await handler(sqsEvent(s3Event("incoming/about.json")));
    expect(res.batchItemFailures).toEqual([]);
    expect(storage.objects.get(`${CONTENT}/content/about.json`)?.contentType).toBe("application/json");
  });

  it("copies images to assets/images/", async () => {
    storage.objects.set(`${LANDING}/incoming/logo.png`, { body: "binary" });
    await handler(sqsEvent(s3Event("incoming/logo.png")));
    expect(storage.objects.get(`${CONTENT}/assets/images/logo.png`)?.contentType).toBe("image/png");
  });

  it("ignores the S3 test event", async () => {
    const res = await handler(sqsEvent(JSON.stringify({ Event: "s3:TestEvent" })));
    expect(res.batchItemFailures).toEqual([]);
  });

  it("drops invalid documents without retrying", async () => {
    storage.objects.set(`${LANDING}/incoming/bad.json`, { body: '{"slug":"Bad Slug"}' });
    const res = await handler(sqsEvent(s3Event("incoming/bad.json")));
    expect(res.batchItemFailures).toEqual([]);
    expect([...storage.objects.keys()].some((k) => k.startsWith(CONTENT))).toBe(false);
  });

  it("drops unsupported file types without retrying", async () => {
    const res = await handler(sqsEvent(s3Event("incoming/setup.exe")));
    expect(res.batchItemFailures).toEqual([]);
  });

  it("returns only the failed message for retry", async () => {
    storage.failWrites = true;
    storage.objects.set(`${LANDING}/incoming/about.json`, { body: '{"slug":"about","title":"About"}' });
    storage.objects.set(`${LANDING}/incoming/logo.png`, { body: "binary" });
    const res = await handler(sqsEvent(s3Event("incoming/about.json"), s3Event("incoming/logo.png")));
    expect(res.batchItemFailures).toEqual([{ itemIdentifier: "msg-1" }]);
    expect(storage.objects.has(`${CONTENT}/assets/images/logo.png`)).toBe(true);
  });
});
