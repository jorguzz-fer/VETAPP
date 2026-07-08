import { BadRequestException, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { StorageService } from '../storage/storage.service';
import { tenantBranding } from '../../database/schema';
import type { BrandingDto, SignUploadResponseDto } from './branding.dto';

// Branding do tenant (logo da clínica). Tenant-scoped (withTenant + RLS). O logo
// vive no R2 (bucket privado): a app guarda só a key e devolve URL assinada curta.
@Injectable()
export class BrandingService {
  constructor(
    private readonly database: DatabaseService,
    private readonly storage: StorageService,
  ) {}

  /** Branding do tenant. logoUrl = URL assinada (ou null se não há logo/storage off). */
  async get(tenantId: string): Promise<BrandingDto> {
    const row = await this.database.withTenant(tenantId, (tx) =>
      tx.query.tenantBranding.findFirst({ where: eq(tenantBranding.tenantId, tenantId) }),
    );
    return { logoUrl: await this.storage.signDownload(row?.logoKey) };
  }

  /** URL pré-assinada para o admin subir o logo direto ao R2 (PUT). */
  async signLogoUpload(tenantId: string, contentType: string): Promise<SignUploadResponseDto> {
    if (!contentType.startsWith('image/')) {
      throw new BadRequestException('O logo deve ser uma imagem');
    }
    const key = this.storage.buildKey(tenantId, 'branding', 'logo');
    const uploadUrl = await this.storage.signUpload(key, contentType);
    return { key, uploadUrl };
  }

  /** Confirma o upload: valida a key do tenant e grava (upsert). */
  async confirmLogo(tenantId: string, key: string): Promise<BrandingDto> {
    const prefix = `${tenantId}/branding/`;
    if (!key.startsWith(prefix)) throw new BadRequestException('Chave inválida para este tenant');
    return this.database.withTenant(tenantId, async (tx) => {
      const existing = await tx.query.tenantBranding.findFirst({ where: eq(tenantBranding.tenantId, tenantId) });
      const row = existing
        ? (
            await tx
              .update(tenantBranding)
              .set({ logoKey: key, updatedAt: new Date() })
              .where(eq(tenantBranding.tenantId, tenantId))
              .returning()
          )[0]
        : (await tx.insert(tenantBranding).values({ tenantId, logoKey: key }).returning())[0];
      return { logoUrl: await this.storage.signDownload(row.logoKey) };
    });
  }

  /** Remove o logo (desvincula a key; o objeto no R2 fica órfão e é limpo depois). */
  async removeLogo(tenantId: string): Promise<BrandingDto> {
    await this.database.withTenant(tenantId, (tx) =>
      tx
        .update(tenantBranding)
        .set({ logoKey: null, updatedAt: new Date() })
        .where(eq(tenantBranding.tenantId, tenantId)),
    );
    return { logoUrl: null };
  }
}
