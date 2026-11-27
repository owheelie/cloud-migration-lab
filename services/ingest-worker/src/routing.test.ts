import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, parseContentDocument, planRoute } from "./routing.js";

describe("planRoute", () => {
  it.each([
    { key: "incoming/about.json", size: 100, kind: "content" },
    { key: "incoming/logo.PNG", size: 100, kind: "asset" },
    { key: "incoming/guide.pdf", size: 100, kind: "asset" },
    { key: "incoming/setup.exe", size: 100, kind: "reject" },
    { key: "incoming/big.json", size: MAX_UPLOAD_BYTES + 1, kind: "reject" },
    { key: "incoming/nested/page.json", size: 100, kind: "reject" },
    { key: "incoming/README", size: 100, kind: "reject" },
    { key: "outside/about.json", size: 100, kind: "reject" },
  ])("$key -> $kind", ({ key, size, kind }) => {
    expect(planRoute(key, size).kind).toBe(kind);
  });

  it("sends images to assets/images with the right content type", () => {
    expect(planRoute("incoming/logo.PNG", 100)).toEqual({
      kind: "asset",
      destKey: "assets/images/logo.PNG",
      contentType: "image/png",
    });
  });
});

describe("parseContentDocument", () => {
  it("accepts a document with a valid slug and title", () => {
    expect(parseContentDocument('{"slug":"about","title":"About","body":"x"}')).toMatchObject({
      slug: "about",
    });
  });

  it.each([
    ["not json"],
    ["[]"],
    ['{"title":"No slug"}'],
    ['{"slug":"Bad Slug","title":"x"}'],
    ['{"slug":"ok","title":"   "}'],
  ])("rejects %s", (text) => {
    expect(parseContentDocument(text)).toBeNull();
  });
});
