// Abstração de provedor de mensagem (doc 17) — provider-agnostic, igual ao Fiscal.
// O envio real (WhatsApp Business/SMS/e-mail) exige credenciais/decisão do stakeholder;
// por ora só o driver `log`/`manual` está plugado.

export interface EnvioMensagem {
  canal: string;
  corpo: string;
  assunto?: string | null;
  destino?: string | null; // telefone/e-mail do destinatário
}

export interface EnvioResultado {
  status: 'registrada' | 'enviada' | 'falha';
  erro?: string | null;
  enviadaEm?: Date | null;
}

export interface MensagemProvider {
  enviar(msg: EnvioMensagem): Promise<EnvioResultado>;
}

// Driver default: NÃO envia por conta própria — apenas REGISTRA a mensagem no
// histórico (status `registrada`). O envio efetivo é manual (ex.: botão WhatsApp na
// ficha). Entrega o rastreio/CRM sem depender de provedor externo.
export class LogMensagemProvider implements MensagemProvider {
  async enviar(): Promise<EnvioResultado> {
    return { status: 'registrada', enviadaEm: null, erro: null };
  }
}

// Factory por canal. Externos (whatsapp/email/sms) ficam para quando o provedor for
// escolhido e as credenciais estiverem no cofre — hoje tudo cai no driver `log`.
export function resolveMensagemProvider(_canal: string): MensagemProvider {
  return new LogMensagemProvider();
}
