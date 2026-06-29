import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { EnvConfig } from '../../config/env';

/**
 * Acesso ao object storage (Cloudflare R2 / S3-compatível).
 *
 * O servidor é o único que conhece as credenciais (docs/spec/02). O cliente recebe
 * apenas **URLs pré-assinadas** de curta validade para PUT (upload direto) e GET
 * (leitura). Bucket privado; sem proxy de bytes pela API.
 */
@Injectable()
export class StorageService {
  private readonly client?: S3Client;
  private readonly bucket?: string;

  constructor(@Inject('ENV') env: EnvConfig) {
    if (env.S3_ENDPOINT && env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY) {
      this.client = new S3Client({
        region: env.S3_REGION,
        endpoint: env.S3_ENDPOINT,
        forcePathStyle: env.S3_FORCE_PATH_STYLE,
        credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
      });
      this.bucket = env.S3_BUCKET;
    }
  }

  get enabled(): boolean {
    return !!this.client && !!this.bucket;
  }

  /** Gera uma key isolada por tenant (docs/spec/03 §3). */
  buildKey(tenantId: string, ...parts: string[]): string {
    return [tenantId, ...parts, randomUUID()].join('/');
  }

  /** URL pré-assinada para upload direto (PUT). Validade curta. */
  async signUpload(key: string, contentType: string, expiresIn = 900): Promise<string> {
    if (!this.client || !this.bucket) {
      throw new ServiceUnavailableException('Object storage não configurado');
    }
    return getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn },
    );
  }

  /** URL pré-assinada para leitura (GET). Retorna null se o storage não estiver ativo. */
  async signDownload(key: string | null | undefined, expiresIn = 900): Promise<string | null> {
    if (!key || !this.client || !this.bucket) return null;
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn });
  }
}
