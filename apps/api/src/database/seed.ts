import 'dotenv/config';
import { randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import postgres from 'postgres';

/**
 * Seed de DEMONSTRAÇÃO: popula uma clínica-demo completa para apresentar ao
 * cliente. Idempotente — apaga a clínica-demo anterior (cascade) e recria.
 * Rodar: node dist/database/seed.js  (usa DATABASE_ADMIN_URL, como o migrate).
 *
 * NÃO usar em produção com dados reais no mesmo tenant: cria um tenant separado
 * "Clínica VetExemplo (DEMO)" e usuários @vetexemplo.demo.
 */
export const DEMO_TENANT = 'Clínica VetExemplo (DEMO)';
export const DEMO_EMAIL_DOMAIN = 'vetexemplo.demo';
export const DEMO_PASSWORD = 'Demo@123';

/** Popula a clínica-demo. Idempotente. `connectionUrl` deve ter papel admin. */
export async function seed(connectionUrl: string): Promise<{ tenantId: string }> {
  const sql = postgres(connectionUrl, { max: 1 });
  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });

  // Datas relativas (o script roda em Node — Date disponível).
  const now = new Date();
  const at = (dias: number, hora: number, min = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + dias);
    d.setHours(hora, min, 0, 0);
    return d;
  };
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

  const tenantId = randomUUID();

  // ── IDs referenciados ──
  const U = {
    ana: randomUUID(),
    bruno: randomUUID(),
    carla: randomUUID(),
    felipe: randomUUID(),
    diego: randomUUID(),
    elaine: randomUUID(),
  };

  // Catálogo: id por código.
  const cat: Record<string, string> = {};
  const catalogo = [
    ['SRV001', 'Consulta clínica', 'servico', 12000, 0],
    ['SRV002', 'Retorno', 'servico', 0, 0],
    ['SRV003', 'Banho e tosa', 'servico', 8000, 0],
    ['SRV004', 'Castração felina', 'servico', 45000, 0],
    ['SRV005', 'Limpeza dental', 'servico', 30000, 0],
    ['VAC001', 'Vacina V10', 'vacina', 9000, 5],
    ['VAC002', 'Vacina antirrábica', 'vacina', 7000, 5],
    ['VAC003', 'Vacina felina quádrupla', 'vacina', 11000, 5],
    ['MED001', 'Dipirona injetável', 'medicamento', 2500, 10],
    ['MED002', 'Amoxicilina 500mg', 'medicamento', 1800, 10],
    ['MED003', 'Anti-inflamatório injetável', 'medicamento', 3500, 8],
    ['PRD001', 'Ração Premium 1kg', 'produto', 4500, 8],
    ['PRD002', 'Antipulgas pipeta', 'produto', 6500, 6],
    ['PRD003', 'Shampoo dermatológico', 'produto', 3900, 4],
  ] as const;
  for (const [codigo] of catalogo) cat[codigo] = randomUUID();

  // Responsáveis + animais.
  const resp = {
    marina: randomUUID(),
    joao: randomUUID(),
    fernanda: randomUUID(),
    carlos: randomUUID(),
    patricia: randomUUID(),
  };
  const an = {
    rex: randomUUID(),
    mia: randomUUID(),
    thor: randomUUID(),
    luna: randomUUID(),
    bob: randomUUID(),
    nina: randomUUID(),
    fred: randomUUID(),
    lola: randomUUID(),
  };

  const fat = { marinaPaga: randomUUID(), joaoParcial: randomUUID(), fernandaAberta: randomUUID() };
  const internacaoId = randomUUID();
  const modeloPrescId = randomUUID();

  // Tipos de atendimento: id por chave.
  const tipoConsulta = randomUUID();
  const tipoVacinacao = randomUUID();
  const tipoRetorno = randomUUID();
  const tipoBanho = randomUUID();
  const tipoCirurgia = randomUUID();

  await sql.begin(async (tx) => {
    // ── Limpeza da demo anterior (cascade apaga tudo do tenant) ──
    await tx`DELETE FROM tenants WHERE name = ${DEMO_TENANT}`;
    await tx`DELETE FROM site_config WHERE slug = 'vetexemplo'`;
    await tx`DELETE FROM users WHERE email LIKE ${'%@' + DEMO_EMAIL_DOMAIN}`;

    // ── Tenant + usuários (globais, sem RLS) ──
    await tx`INSERT INTO tenants (id, name) VALUES (${tenantId}, ${DEMO_TENANT})`;
    await tx`SELECT set_config('app.current_tenant', ${tenantId}, true)`;

    const users = [
      { id: U.ana, name: 'Ana Terra', email: `ana@${DEMO_EMAIL_DOMAIN}` },
      { id: U.bruno, name: 'Bruno Gestor', email: `bruno@${DEMO_EMAIL_DOMAIN}` },
      { id: U.carla, name: 'Dra. Carla Nunes', email: `carla@${DEMO_EMAIL_DOMAIN}` },
      { id: U.felipe, name: 'Dr. Felipe Rocha', email: `felipe@${DEMO_EMAIL_DOMAIN}` },
      { id: U.diego, name: 'Diego Alves', email: `diego@${DEMO_EMAIL_DOMAIN}` },
      { id: U.elaine, name: 'Elaine Souza', email: `elaine@${DEMO_EMAIL_DOMAIN}` },
    ].map((u) => ({ ...u, password_hash: passwordHash, status: 'active' }));
    await tx`INSERT INTO users ${tx(users, 'id', 'name', 'email', 'password_hash', 'status')}`;

    const memberships = [
      { tenant_id: tenantId, user_id: U.ana, role: 'admin' },
      { tenant_id: tenantId, user_id: U.bruno, role: 'gestor' },
      { tenant_id: tenantId, user_id: U.carla, role: 'veterinario' },
      { tenant_id: tenantId, user_id: U.felipe, role: 'veterinario' },
      { tenant_id: tenantId, user_id: U.diego, role: 'recepcao' },
      { tenant_id: tenantId, user_id: U.elaine, role: 'financeiro' },
    ];
    await tx`INSERT INTO memberships ${tx(memberships, 'tenant_id', 'user_id', 'role')}`;

    // ── Tipos de atendimento ──
    const tipos = [
      { id: tipoConsulta, nome: 'Consulta', duracao_minutos: 30, cor: '#605dff' },
      { id: tipoRetorno, nome: 'Retorno', duracao_minutos: 20, cor: '#22c55e' },
      { id: tipoVacinacao, nome: 'Vacinação', duracao_minutos: 15, cor: '#f59e0b' },
      { id: tipoBanho, nome: 'Banho e Tosa', duracao_minutos: 60, cor: '#06b6d4' },
      { id: tipoCirurgia, nome: 'Cirurgia', duracao_minutos: 120, cor: '#ef4444' },
      { id: randomUUID(), nome: 'Exame', duracao_minutos: 20, cor: '#8b5cf6' },
    ].map((t) => ({ ...t, tenant_id: tenantId, ativo: true }));
    await tx`INSERT INTO tipos_atendimento ${tx(tipos, 'id', 'tenant_id', 'nome', 'duracao_minutos', 'cor', 'ativo')}`;

    // ── Formas de recebimento ──
    const formas = [
      { nome: 'Dinheiro', tipo: 'dinheiro', taxa_bps: 0 },
      { nome: 'Pix', tipo: 'pix', taxa_bps: 0 },
      { nome: 'Cartão Crédito', tipo: 'cartao_credito', taxa_bps: 299 },
      { nome: 'Cartão Débito', tipo: 'cartao_debito', taxa_bps: 149 },
      { nome: 'Transferência', tipo: 'transferencia', taxa_bps: 0 },
    ].map((f) => ({ ...f, tenant_id: tenantId, ativo: true }));
    await tx`INSERT INTO formas_recebimento ${tx(formas, 'tenant_id', 'nome', 'tipo', 'taxa_bps', 'ativo')}`;

    // ── Catálogo ──
    const catRows = catalogo.map(([codigo, nome, tipo, preco, minimo]) => ({
      id: cat[codigo],
      tenant_id: tenantId,
      codigo,
      nome,
      tipo,
      preco_centavos: preco,
      estoque_minimo: minimo,
      ativo: true,
    }));
    await tx`INSERT INTO itens_catalogo ${tx(catRows, 'id', 'tenant_id', 'codigo', 'nome', 'tipo', 'preco_centavos', 'estoque_minimo', 'ativo')}`;

    // ── Estoque (entrada = +, saída = -) ──
    const mov = (codigo: string, tipo: string, quantidade: number) => ({
      tenant_id: tenantId,
      item_id: cat[codigo],
      tipo,
      quantidade,
    });
    const movimentos = [
      mov('VAC001', 'entrada', 20),
      mov('VAC002', 'entrada', 15),
      mov('VAC003', 'entrada', 12),
      mov('MED001', 'entrada', 50),
      mov('MED001', 'saida', -6),
      mov('MED002', 'entrada', 40),
      mov('MED003', 'entrada', 25),
      mov('PRD001', 'entrada', 30),
      mov('PRD001', 'saida', -24), // fica em 6 (acima do mínimo 8? não → alerta)
      mov('PRD002', 'entrada', 18),
      mov('PRD003', 'entrada', 10),
      mov('PRD003', 'saida', -8), // fica em 2 (< mínimo 4 → alerta)
    ];
    await tx`INSERT INTO estoque_movimentos ${tx(movimentos, 'tenant_id', 'item_id', 'tipo', 'quantidade')}`;

    // ── Motivos e boxes de internação ──
    const motivos = ['Pós-operatório', 'Observação clínica', 'Gastroenterite', 'Cirurgia eletiva', 'Insuficiência renal'].map(
      (nome) => ({ tenant_id: tenantId, nome }),
    );
    await tx`INSERT INTO internacao_motivos ${tx(motivos, 'tenant_id', 'nome')}`;
    const boxes = ['Box 1', 'Box 2', 'Box 3', 'Isolamento', 'UTI'].map((nome) => ({ tenant_id: tenantId, nome }));
    await tx`INSERT INTO internacao_boxes ${tx(boxes, 'tenant_id', 'nome')}`;

    // ── Responsáveis + animais ──
    const responsaveis = [
      { id: resp.marina, nome: 'Marina Lopes', telefone: '(11) 98888-1001', email: 'marina@exemplo.com', origem: 'Indicação' },
      { id: resp.joao, nome: 'João Pereira', telefone: '(11) 98888-1002', email: 'joao@exemplo.com', origem: 'Google' },
      { id: resp.fernanda, nome: 'Fernanda Dias', telefone: '(11) 98888-1003', email: 'fernanda@exemplo.com', origem: 'Instagram' },
      { id: resp.carlos, nome: 'Carlos Mendes', telefone: '(11) 98888-1004', email: 'carlos@exemplo.com', origem: 'Passagem' },
      { id: resp.patricia, nome: 'Patrícia Gomes', telefone: '(11) 98888-1005', email: 'patricia@exemplo.com', origem: 'Site' },
    ].map((r) => ({ ...r, tenant_id: tenantId }));
    await tx`INSERT INTO responsaveis ${tx(responsaveis, 'id', 'tenant_id', 'nome', 'telefone', 'email', 'origem')}`;

    const animais = [
      { id: an.rex, responsavel_id: resp.marina, nome: 'Rex', especie: 'Canina', raca: 'Labrador', sexo: 'M', castrado: true },
      { id: an.mia, responsavel_id: resp.marina, nome: 'Mia', especie: 'Felina', raca: 'SRD', sexo: 'F', castrado: true },
      { id: an.thor, responsavel_id: resp.joao, nome: 'Thor', especie: 'Canina', raca: 'Bulldog', sexo: 'M', castrado: false },
      { id: an.luna, responsavel_id: resp.fernanda, nome: 'Luna', especie: 'Felina', raca: 'Persa', sexo: 'F', castrado: true },
      { id: an.bob, responsavel_id: resp.carlos, nome: 'Bob', especie: 'Canina', raca: 'Poodle', sexo: 'M', castrado: true },
      { id: an.nina, responsavel_id: resp.patricia, nome: 'Nina', especie: 'Felina', raca: 'Siamês', sexo: 'F', castrado: false },
      { id: an.fred, responsavel_id: resp.joao, nome: 'Fred', especie: 'Canina', raca: 'Vira-lata', sexo: 'M', castrado: true },
      { id: an.lola, responsavel_id: resp.fernanda, nome: 'Lola', especie: 'Roedor', raca: 'Coelho', sexo: 'F', castrado: false },
    ].map((a) => ({ ...a, tenant_id: tenantId, status: 'vivo' }));
    await tx`INSERT INTO animais ${tx(animais, 'id', 'tenant_id', 'responsavel_id', 'nome', 'especie', 'raca', 'sexo', 'castrado', 'status')}`;

    // ── Prontuário: eventos na timeline ──
    const ev = (animal_id: string, tipo: string, descricao: string, valor: number | null, dias: number) => ({
      tenant_id: tenantId,
      animal_id,
      tipo,
      descricao,
      valor_centavos: valor,
      data: daysAgo(dias),
    });
    const eventos = [
      ev(an.rex, 'atendimento', 'Consulta clínica — check-up anual', 12000, 40),
      ev(an.rex, 'vacina', 'Vacina V10 (reforço)', 9000, 40),
      ev(an.rex, 'peso', 'Peso: 28,5 kg', null, 40),
      ev(an.mia, 'vacina', 'Vacina felina quádrupla', 11000, 30),
      ev(an.mia, 'atendimento', 'Consulta dermatológica', 12000, 15),
      ev(an.thor, 'exame', 'Hemograma completo', 8000, 20),
      ev(an.thor, 'observacao', 'Tutor relata coceira; investigar alergia alimentar', null, 20),
      ev(an.luna, 'atendimento', 'Castração felina', 45000, 10),
      ev(an.luna, 'medicacao', 'Anti-inflamatório pós-cirúrgico', 3500, 10),
      ev(an.bob, 'vacina', 'Vacina antirrábica', 7000, 5),
      ev(an.nina, 'atendimento', 'Consulta — vômito', 12000, 2),
    ];
    await tx`INSERT INTO prontuario_eventos ${tx(eventos, 'tenant_id', 'animal_id', 'tipo', 'descricao', 'valor_centavos', 'data')}`;

    // ── Faturas + itens + recebimentos ──
    const faturas = [
      { id: fat.marinaPaga, responsavel_id: resp.marina, status: 'paga', total_centavos: 21000 },
      { id: fat.joaoParcial, responsavel_id: resp.joao, status: 'parcial', total_centavos: 20000 },
      { id: fat.fernandaAberta, responsavel_id: resp.fernanda, status: 'aberta', total_centavos: 48500 },
    ].map((f) => ({ ...f, tenant_id: tenantId }));
    await tx`INSERT INTO faturas ${tx(faturas, 'id', 'tenant_id', 'responsavel_id', 'status', 'total_centavos')}`;

    const fi = (fatura_id: string, item: string, descricao: string, valor: number, prof: string) => ({
      tenant_id: tenantId,
      fatura_id,
      item_id: cat[item],
      profissional_id: prof,
      descricao,
      valor_centavos: valor,
    });
    const faturaItens = [
      fi(fat.marinaPaga, 'SRV001', 'Consulta clínica', 12000, U.carla),
      fi(fat.marinaPaga, 'VAC001', 'Vacina V10', 9000, U.carla),
      fi(fat.joaoParcial, 'SRV001', 'Consulta clínica', 12000, U.felipe),
      fi(fat.joaoParcial, 'SRV003', 'Banho e tosa', 8000, U.diego),
      fi(fat.fernandaAberta, 'SRV004', 'Castração felina', 45000, U.carla),
      fi(fat.fernandaAberta, 'MED003', 'Anti-inflamatório injetável', 3500, U.carla),
    ];
    await tx`INSERT INTO fatura_itens ${tx(faturaItens, 'tenant_id', 'fatura_id', 'item_id', 'profissional_id', 'descricao', 'valor_centavos')}`;

    // Formas: pegar ids inseridos (pix, dinheiro) para os recebimentos.
    const [formaPix] = await tx`SELECT id FROM formas_recebimento WHERE nome = 'Pix' LIMIT 1`;
    const [formaDin] = await tx`SELECT id FROM formas_recebimento WHERE nome = 'Dinheiro' LIMIT 1`;
    const recebimentos = [
      { tenant_id: tenantId, fatura_id: fat.marinaPaga, forma_id: formaPix.id, valor_centavos: 21000, observacao: 'Quitação' },
      { tenant_id: tenantId, fatura_id: fat.joaoParcial, forma_id: formaDin.id, valor_centavos: 8000, observacao: 'Entrada' },
    ];
    await tx`INSERT INTO recebimentos ${tx(recebimentos, 'tenant_id', 'fatura_id', 'forma_id', 'valor_centavos', 'observacao')}`;

    // ── Agenda ──
    const ag = (
      prof: string,
      tipo: string,
      animal: string,
      responsavel: string,
      titulo: string,
      inicio: Date,
      fim: Date,
      status = 'agendado',
    ) => ({
      tenant_id: tenantId,
      profissional_id: prof,
      tipo_atendimento_id: tipo,
      animal_id: animal,
      responsavel_id: responsavel,
      titulo,
      inicio,
      fim,
      status,
    });
    const agendamentos = [
      ag(U.carla, tipoConsulta, an.rex, resp.marina, 'Consulta — Rex', at(0, 9), at(0, 9, 30)),
      ag(U.felipe, tipoVacinacao, an.mia, resp.marina, 'Vacinação — Mia', at(0, 10), at(0, 10, 15)),
      ag(U.carla, tipoRetorno, an.luna, resp.fernanda, 'Retorno — Luna', at(0, 11), at(0, 11, 20), 'concluido'),
      ag(U.diego, tipoBanho, an.thor, resp.joao, 'Banho e Tosa — Thor', at(1, 14), at(1, 15)),
      ag(U.felipe, tipoConsulta, an.nina, resp.patricia, 'Consulta — Nina', at(1, 9, 30), at(1, 10)),
      ag(U.carla, tipoCirurgia, an.bob, resp.carlos, 'Cirurgia — Bob', at(2, 8), at(2, 10)),
      ag(U.carla, tipoConsulta, an.fred, resp.joao, 'Consulta — Fred', at(3, 16), at(3, 16, 30)),
    ];
    await tx`INSERT INTO agendamentos ${tx(agendamentos, 'tenant_id', 'profissional_id', 'tipo_atendimento_id', 'animal_id', 'responsavel_id', 'titulo', 'inicio', 'fim', 'status')}`;

    // ── Internação (1 ativa) + execuções + parâmetros ──
    await tx`INSERT INTO internacoes (id, tenant_id, animal_id, motivo, box, status, entrada_em)
      VALUES (${internacaoId}, ${tenantId}, ${an.luna}, 'Pós-operatório', 'Box 2', 'internado', ${daysAgo(1)})`;
    const exec = (item: string | null, descricao: string, qtd: number, valor: number | null, executada: Date | null) => ({
      tenant_id: tenantId,
      internacao_id: internacaoId,
      item_id: item ? cat[item] : null,
      descricao,
      quantidade: qtd,
      valor_centavos: valor,
      executada_em: executada,
    });
    const execucoes = [
      exec('MED003', 'Anti-inflamatório injetável', 1, 3500, daysAgo(1)),
      exec('MED001', 'Dipirona injetável', 1, 2500, null),
      exec(null, 'Curativo cirúrgico', 1, null, null),
      exec('MED002', 'Amoxicilina 500mg', 1, 1800, null),
    ];
    await tx`INSERT INTO internacao_execucoes ${tx(execucoes, 'tenant_id', 'internacao_id', 'item_id', 'descricao', 'quantidade', 'valor_centavos', 'executada_em')}`;

    const params = [
      { tenant_id: tenantId, internacao_id: internacaoId, peso_g: 4200, temperatura_decimos: 385, freq_cardiaca: 120, freq_respiratoria: 28, observacao: 'Estável', registrado_em: daysAgo(1) },
      { tenant_id: tenantId, internacao_id: internacaoId, peso_g: 4150, temperatura_decimos: 383, freq_cardiaca: 116, freq_respiratoria: 26, observacao: 'Recuperando bem', registrado_em: new Date(now.getTime() - 6 * 3_600_000) },
    ];
    await tx`INSERT INTO internacao_parametros ${tx(params, 'tenant_id', 'internacao_id', 'peso_g', 'temperatura_decimos', 'freq_cardiaca', 'freq_respiratoria', 'observacao', 'registrado_em')}`;

    // ── Comissões ──
    const comissoes = [
      { tenant_id: tenantId, user_id: U.carla, item_id: null, percent_bps: 1000 }, // 10% geral
      { tenant_id: tenantId, user_id: U.felipe, item_id: null, percent_bps: 800 }, // 8% geral
      { tenant_id: tenantId, user_id: U.carla, item_id: cat['SRV004'], percent_bps: 1500 }, // 15% em castração
    ];
    await tx`INSERT INTO comissao_regras ${tx(comissoes, 'tenant_id', 'user_id', 'item_id', 'percent_bps')}`;

    // ── Modelos de documento ──
    const modelosDoc = [
      {
        tipo: 'receita',
        nome: 'Receita simples',
        conteudo:
          'RECEITUÁRIO\n\nPaciente: {{animal}} ({{especie}} - {{raca}})\nResponsável: {{tutor}}\n\nPrescrição:\n1) \n2) \n\nData: {{data}}\n{{clinica}}',
      },
      {
        tipo: 'documento',
        nome: 'Termo de internação',
        conteudo:
          'TERMO DE INTERNAÇÃO\n\nEu, {{tutor}}, autorizo a internação do animal {{animal}} ({{especie}}) na {{clinica}}, ciente dos procedimentos indicados.\n\nData: {{data}}\nAssinatura: ______________________',
      },
      {
        tipo: 'documento',
        nome: 'Atestado',
        conteudo:
          'ATESTADO\n\nAtesto para os devidos fins que o animal {{animal}}, de responsabilidade de {{tutor}}, encontra-se sob cuidados veterinários.\n\n{{clinica}} — {{data}}',
      },
    ].map((m) => ({ ...m, tenant_id: tenantId }));
    await tx`INSERT INTO modelos_documento ${tx(modelosDoc, 'tenant_id', 'tipo', 'nome', 'conteudo')}`;

    // ── Modelos de prescrição ──
    await tx`INSERT INTO modelos_prescricao (id, tenant_id, nome) VALUES (${modeloPrescId}, ${tenantId}, 'Pós-cirúrgico padrão')`;
    const prescItens = [
      { tenant_id: tenantId, modelo_id: modeloPrescId, item_id: cat['MED003'], descricao: 'Anti-inflamatório injetável', quantidade: 1 },
      { tenant_id: tenantId, modelo_id: modeloPrescId, item_id: cat['MED001'], descricao: 'Dipirona injetável', quantidade: 1 },
      { tenant_id: tenantId, modelo_id: modeloPrescId, item_id: cat['MED002'], descricao: 'Amoxicilina 500mg', quantidade: 1 },
    ];
    await tx`INSERT INTO modelos_prescricao_itens ${tx(prescItens, 'tenant_id', 'modelo_id', 'item_id', 'descricao', 'quantidade')}`;

    // ── Fiscal config ──
    await tx`INSERT INTO fiscal_config (tenant_id, cnpj, razao_social, inscricao_municipal, regime_tributario, serie_nfse, proximo_numero, provedor, ambiente, ativo)
      VALUES (${tenantId}, '12.345.678/0001-90', 'Clínica VetExemplo LTDA', '123456', 'simples', '1', 1, 'manual', 'homologacao', true)`;

    // ── Site público ──
    await tx`INSERT INTO site_config (tenant_id, slug, publicado, nome_exibicao, sobre, servicos, endereco, telefone, whatsapp, email, horario, cor_primaria)
      VALUES (${tenantId}, 'vetexemplo', true, 'Clínica VetExemplo',
        'Cuidado veterinário completo para o seu melhor amigo, com equipe especializada e estrutura moderna.',
        ${'Consultas clínicas\nVacinação\nCirurgias\nBanho e tosa\nInternação 24h\nExames laboratoriais'},
        'Av. dos Animais, 1000 - São Paulo/SP', '(11) 3333-1000', '(11) 98888-0000', 'contato@vetexemplo.com',
        'Seg–Sex 8h–19h · Sáb 8h–13h', '#605dff')`;

    // ── Orçamento (aberto) ──
    const orcamentoId = randomUUID();
    await tx`INSERT INTO orcamentos (id, tenant_id, responsavel_id, status, observacoes)
      VALUES (${orcamentoId}, ${tenantId}, ${resp.patricia}, 'aberto', 'Pacote check-up + vacinas para a Nina')`;
    const orcItens = [
      { tenant_id: tenantId, orcamento_id: orcamentoId, item_id: cat['SRV001'], descricao: 'Consulta clínica', quantidade: 1, valor_centavos: 12000 },
      { tenant_id: tenantId, orcamento_id: orcamentoId, item_id: cat['VAC003'], descricao: 'Vacina felina quádrupla', quantidade: 1, valor_centavos: 11000 },
      { tenant_id: tenantId, orcamento_id: orcamentoId, item_id: cat['SRV005'], descricao: 'Limpeza dental', quantidade: 1, valor_centavos: 30000 },
    ];
    await tx`INSERT INTO orcamento_itens ${tx(orcItens, 'tenant_id', 'orcamento_id', 'item_id', 'descricao', 'quantidade', 'valor_centavos')}`;
  });

  await sql.end();
  return { tenantId };
}

async function runCli(): Promise<void> {
  const url =
    process.env.DATABASE_ADMIN_URL ?? 'postgresql://vetapp_admin:admin_password@localhost:5432/vetapp';
  await seed(url);
  // eslint-disable-next-line no-console
  console.log(
    `Seed DEMO aplicado.\n  Tenant: ${DEMO_TENANT}\n  Login admin: ana@${DEMO_EMAIL_DOMAIN}  |  senha: ${DEMO_PASSWORD}\n  Outros: bruno/carla/felipe/diego/elaine @${DEMO_EMAIL_DOMAIN} (mesma senha)\n  Site público: /clinica/vetexemplo`,
  );
}

// Só roda automaticamente quando executado direto (node dist/database/seed.js),
// não quando importado por um teste. O try/catch cobre ambientes ESM (vitest)
// onde `require` não existe.
const isDirectRun = (() => {
  try {
    return require.main === module;
  } catch {
    return false;
  }
})();
if (isDirectRun) {
  runCli().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}
