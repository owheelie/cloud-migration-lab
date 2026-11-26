import { GetObjectCommand, NoSuchKey, S3Client } from "@aws-sdk/client-s3";

/** Where published content lives. Lets the handler be tested without AWS. */
export interface ContentStore {
  get(key: string): Promise<string | null>;
}

export class S3ContentStore implements ContentStore {
  constructor(
    private readonly bucket: string,
    private readonly client: S3Client = new S3Client({}),
  ) {}

  async get(key: string): Promise<string | null> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return (await res.Body?.transformToString()) ?? null;
    } catch (err) {
      if (err instanceof NoSuchKey) return null;
      throw err;
    }
  }
}
