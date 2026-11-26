import { describe, expect, it, vi } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createHandler } from "./handler.js";
import type { ContentStore } from "./content-store.js";

function requestFor(slug?: string): APIGatewayProxyEventV2 {
  return {
    pathParameters: slug === undefined ? undefined : { slug },
  } as unknown as APIGatewayProxyEventV2;
}

function memoryStore(items: Record<string, string>): ContentStore {
  return { get: async (key) => items[key] ?? null };
}

const failingStore: ContentStore = {
  get: async () => {
    throw new Error("S3 unavailable");
  },
};

describe("content API handler", () => {
  const handler = createHandler(
    memoryStore({ "content/about-us.json": '{"title":"About us"}' }),
  );

  it("returns stored content for a valid slug", async () => {
    const res = await handler(requestFor("about-us"));
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('{"title":"About us"}');
    expect(res.headers?.["cache-control"]).toBe("public, max-age=60");
  });

  it("returns 404 when the content does not exist", async () => {
    const res = await handler(requestFor("missing-page"));
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 when the slug is missing", async () => {
    const res = await handler(requestFor(undefined));
    expect(res.statusCode).toBe(400);
  });

  it.each(["../secrets", "About-Us", "a/b", "-leading", "trailing-", "x".repeat(101)])(
    "rejects invalid slug %s",
    async (slug) => {
      const res = await handler(requestFor(slug));
      expect(res.statusCode).toBe(400);
    },
  );

  it("returns 500 without leaking error details when storage fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await createHandler(failingStore)(requestFor("about-us"));
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain("S3 unavailable");
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });
});
