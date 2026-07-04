import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { FiscalConfig, NotaFiscal } from '../../database/schema';

// Abstração do PROVEDOR fiscal (doc 13 §3). A emissão real (Focus NFe / NFe.io /
// PlugNotas / SEFAZ / prefeitura) entra como um driver desta interface, sem tocar
// no serviço. Só o driver 'manual' está implementado nesta fase — os demais são
// o follow-up (dependem de decisão de provedor + certificado + contador).

export interface EmitirContext {
  nota: NotaFiscal;
  config: FiscalConfig;
  responsavelNome: string;
  responsavelDocumento: string | null;
}

export interface EmitirResult {
  // emitida = concluída; processando = assíncrona (provedor confirma depois);
  // rejeitada = recusada pelo provedor/fisco.
  status: 'emitida' | 'processando' | 'rejeitada';
  // Número/série vêm do provedor quando ele numera; no modo manual o serviço
  // atribui a partir da série/sequência do fiscal_config.
  numero?: string;
  serie?: string;
  providerRef?: string;
  mensagem?: string;
}

export interface FiscalProvider {
  readonly nome: string;
  emitir(ctx: EmitirContext): Promise<EmitirResult>;
  cancelar(nota: NotaFiscal, motivo: string): Promise<{ ok: boolean; mensagem?: string }>;
}

// Driver manual: a clínica emite/controla a nota por fora (portal do provedor ou
// numeração própria) e o VETAPP registra o ciclo. Numeração própria a partir do
// fiscal_config (o serviço atribui o número). Nada de integração externa aqui.
@Injectable()
export class ManualFiscalProvider implements FiscalProvider {
  readonly nome = 'manual';

  async emitir(): Promise<EmitirResult> {
    // Sem provedor externo: marca como emitida; o serviço atribui número/série.
    return { status: 'emitida' };
  }

  async cancelar(): Promise<{ ok: boolean }> {
    return { ok: true };
  }
}

/**
 * Resolve o driver a partir de `config.provedor`. Hoje só 'manual'; provedores
 * externos são recusados de forma explícita (não silenciosa) até serem plugados.
 */
@Injectable()
export class FiscalProviderFactory {
  constructor(private readonly manual: ManualFiscalProvider) {}

  resolve(provedor: string): FiscalProvider {
    if (provedor === 'manual') return this.manual;
    throw new ServiceUnavailableException(
      `Provedor fiscal "${provedor}" ainda não integrado. Use "manual" ou aguarde a integração.`,
    );
  }
}
