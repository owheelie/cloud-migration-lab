import { CopyObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export interface ObjectRef {
  bucket: string;
  key: string;
}

/** The S3 operations the worker needs. Tests use an in-memory fake instead. */
export interface Storage {
  read(bucket: string, key: string): Promise<string>;
  write(bucket: string, key: string, body: string, contentType: string): Promise<void>;
  copy(from: ObjectRef, to: ObjectRef, contentType: string): Promise<void>;
}

export class S3Storage implements Storage {
  constructor(private readonly client: S3Client = new S3Client({})) {}

  async read(bucket: string, key: string): Promise<string> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return (await res.Body?.transformToString()) ?? "";
  }

  async write(bucket: string, key: string, body: string, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async copy(from: ObjectRef, to: ObjectRef, contentType: string): Promise<void> {
    // Server-side copy: the file never passes through the Lambda.
    const source = `${from.bucket}/${from.key.split("/").map(encodeURIComponent).join("/")}`;
    await this.client.send(
      new CopyObjectCommand({
        Bucket: to.bucket,
        Key: to.key,
        CopySource: source,
        ContentType: contentType,
        MetadataDirective: "REPLACE",
      }),
    );
  }
}
