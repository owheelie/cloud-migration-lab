import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { S3ContentStore, type ContentStore } from "./content-store.js";

type Result = APIGatewayProxyStructuredResultV2;

// Lowercase words separated by single hyphens, e.g. "about-us".
// Rejects anything that could escape the content/ prefix, such as "../".
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 100;

function json(statusCode: number, body: unknown): Result {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function createHandler(store: ContentStore) {
  return async (event: APIGatewayProxyEventV2): Promise<Result> => {
    const slug = event.pathParameters?.slug;

    if (!slug || slug.length > MAX_SLUG_LENGTH || !SLUG_PATTERN.test(slug)) {
      return json(400, { error: "invalid_slug" });
    }

    try {
      const body = await store.get(`content/${slug}.json`);
      if (body === null) return json(404, { error: "not_found" });

      return {
        statusCode: 200,
        headers: {
          "content-type": "application/json",
          "cache-control": "public, max-age=60",
        },
        body,
      };
    } catch (err) {
      console.error(
        JSON.stringify({ level: "error", msg: "content lookup failed", slug, err: String(err) }),
      );
      return json(500, { error: "internal_error" });
    }
  };
}

const bucket = process.env.CONTENT_BUCKET;
const unconfigured: ContentStore = {
  get: async () => {
    throw new Error("CONTENT_BUCKET is not set");
  },
};

export const handler = createHandler(bucket ? new S3ContentStore(bucket) : unconfigured);
