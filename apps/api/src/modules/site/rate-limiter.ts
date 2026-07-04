import { Injectable } from '@nestjs/common';

// Rate limiter em memória para a única rota pública de escrita (solicitação de
// agendamento). Suficiente para instância única / MVP. Em produção com múltiplas
// instâncias, trocar por Redis/@nestjs/throttler + WAF na borda (doc 02/09).
@Injectable()
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  /** true se permitido; registra o hit. Janela deslizante por chave (ex.: IP+slug). */
  allow(key: string, max: number, windowMs: number): boolean {
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    // Limpeza oportunista para não crescer sem limite.
    if (this.hits.size > 5000) {
      for (const [k, v] of this.hits) {
        if (v.every((t) => now - t >= windowMs)) this.hits.delete(k);
      }
    }
    return true;
  }
}
