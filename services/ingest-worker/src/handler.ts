import type { SQSBatchResponse, SQSEvent, SQSRecord } from "aws-lambda";
import { parseContentDocument, planRoute } from "./routing.js";
import { S3Storage, type Storage } from "./storage.js";

interface S3Notification {
  Event?: string;
  Records?: Array<{
    s3: { bucket: { name: string }; object: { key: string; size: number } };
  }>;
}

type Level = "info" | "warn" | "error";

function log(level: Level, msg: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ level, msg, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

// S3 URL-encodes object keys in event notifications and turns spaces into "+".
function decodeKey(key: string): string {
  return decodeURIComponent(key.replace(/\+/g, " "));
}

export function createHandler(storage: Storage, contentBucket: string) {
  async function publish(bucket: string, key: string, size: number): Promise<void> {
    const route = planRoute(key, size);

    if (route.kind === "reject") {
      // Bad input will not improve on retry, so it is logged and dropped instead of retried.
      log("warn", "upload rejected", { key, reason: route.reason });
      return;
    }

    if (route.kind === "asset") {
      await storage.copy({ bucket, key }, { bucket: contentBucket, key: route.destKey }, route.contentType);
      log("info", "asset published", { key, destKey: route.destKey });
      return;
    }

    const doc = parseContentDocument(await storage.read(bucket, key));
    if (!doc) {
      log("warn", "upload rejected", { key, reason: "invalid_content_document" });
      return;
    }
    const destKey = `content/${doc.slug}.json`;
    await storage.write(contentBucket, destKey, JSON.stringify(doc, null, 2), "application/json");
    log("info", "content published", { key, destKey });
  }

  async function processMessage(record: SQSRecord): Promise<void> {
    const body = JSON.parse(record.body) as S3Notification;
    if (body.Event === "s3:TestEvent") return; // sent once when the notification is created
    for (const item of body.Records ?? []) {
      await publish(item.s3.bucket.name, decodeKey(item.s3.object.key), item.s3.object.size);
    }
  }

  // Partial batch response: only failed messages go back to the queue for retry.
  return async (event: SQSEvent): Promise<SQSBatchResponse> => {
    const batchItemFailures: SQSBatchResponse["batchItemFailures"] = [];
    for (const record of event.Records) {
      try {
        await processMessage(record);
      } catch (err) {
        log("error", "message failed; will be retried", { messageId: record.messageId, err: String(err) });
        batchItemFailures.push({ itemIdentifier: record.messageId });
      }
    }
    return { batchItemFailures };
  };
}

export const handler = createHandler(new S3Storage(), process.env.CONTENT_BUCKET ?? "");
