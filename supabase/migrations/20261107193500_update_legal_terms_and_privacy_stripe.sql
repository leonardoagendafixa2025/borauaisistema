-- Atualização dos Termos de Uso, Política de Privacidade e LGPD para o Bora Uai com Stripe
INSERT INTO public.platform_settings (key, value) VALUES
('legal_terms', E'# Termos de Uso

**Última atualização:** 07 de novembro de 2026

## 1. Aceitação dos Termos
Ao se cadastrar e utilizar a plataforma Bora Uai ("Plataforma"), você ("Cliente" ou "Estabelecimento") concorda integralmente com estes Termos de Uso e com a nossa Política de Privacidade.

## 2. Descrição do Serviço
A Bora Uai é uma plataforma de software como serviço (SaaS) que fornece sistema completo de gestão operacional para restaurantes, bares, hamburguerias, pizzarias e estabelecimentos do setor de alimentação, incluindo PDV, cardápio digital por QR Code, gestão de pedidos, delivery, KDS da cozinha, comandas de mesa, controle de estoque básico e integrações operacionais.

## 3. Cadastro e Conta
3.1. O Cliente declara que todas as informações fornecidas no cadastro são verídicas, completas e atualizadas.
3.2. É responsabilidade exclusiva do Cliente manter o sigilo de suas credenciais de acesso, logins e PINs de equipe.
3.3. O responsável pelo cadastro deve possuir capacidade jurídica plena para contratar em nome do estabelecimento.

## 4. Planos, Pagamento e Cancelamento
4.1. A Bora Uai oferece planos por assinatura mensal recorrente (Básico, Profissional e Premium).
4.2. **Período de Testes (Trial):** Novos estabelecimentos recebem 14 dias gratuitos para validação sem cobrança antecipada.
4.3. **Processamento de Pagamento:** Os pagamentos das mensalidades são processados com segurança através da provedora de pagamentos **Stripe** (via cartão de crédito internacional/nacional com renovação automática mensal).
4.4. **Sem Fidelidade ou Multa:** O Cliente pode cancelar sua assinatura a qualquer momento diretamente pelo painel do restaurante. O cancelamento interrompe cobranças futuras e mantém o acesso liberado até o final do período mensal já quitado.
4.5. Em caso de falha de cobrança ou estorno indevido, a conta entrará em carência por 5 dias antes de ser suspensa automaticamente.

## 5. Obrigações e Responsabilidade Fiscal
5.1. O Cliente compromete-se a utilizar a Plataforma apenas para atividades lícitas e compatíveis com a legislação brasileira.
5.2. **Emissão de Documentos Fiscais:** O Estabelecimento é o único e exclusivo responsável pela emissão dos documentos fiscais obrigatórios (NFC-e, NF-e, SAT, CF-e) de suas próprias vendas aos consumidores finais. A Bora Uai atua estritamente como fornecedora de software de automação e gestão operacional de cardápio, mesas e pedidos, não prestando serviços contábeis, fiscais ou de emissão de cupons da SEFAZ.
5.3. O Cliente é responsável por manter a proteção e o tratamento ético dos dados de seus clientes finais conforme a Lei Geral de Proteção de Dados (LGPD).

## 6. Propriedade Intelectual
Todo o código-fonte, design de interfaces, marcas, domínios e funcionalidades da Plataforma pertencem exclusivamente à Bora Uai. O Cliente recebe uma licença temporária de uso, não exclusiva e intransferível, enquanto mantiver sua assinatura ativa.

## 7. Disponibilidade e Suporte
7.1. A Bora Uai emprega esforços comercialmente razoáveis para manter a disponibilidade média mensal de 99% da Plataforma.
7.2. Janelas de manutenção programada ou falhas generalizadas de telecomunicações não configuram quebra de SLA.
7.3. O suporte é prestado via canais digitais (Telegram, WhatsApp e e-mail).

## 8. Limitação de Responsabilidade
A Bora Uai não responde por: (i) instabilidades de sinal de internet e rede Wi-Fi local do restaurante; (ii) mau funcionamento de aparelhos celulares ou impressoras dos usuários; (iii) atrasos na entrega ocasionados por condições climáticas ou trânsito; (iv) descontinuidades de serviços terceirizados (Stripe, WhatsApp, etc.).

## 9. Foro
Fica eleito o foro da Comarca de Belo Horizonte/MG, com renúncia a qualquer outro, por mais privilegiado que seja, para dirimir quaisquer dúvidas oriundas deste contrato.

## 10. Contato
Dúvidas ou suporte: contato@borauai.com.br'),

('legal_privacy', E'# Política de Privacidade

**Última atualização:** 07 de novembro de 2026

A Bora Uai valoriza a privacidade e a segurança das informações de seus clientes e usuários. Esta política descreve como tratamos e protegemos os dados pessoais coletados na plataforma, em estrita conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).

## 1. Dados Coletados
**1.1. Dados do Estabelecimento Contratante:**
- Informações cadastrais: razão social, nome fantasia, CNPJ/CPF, e-mail, telefone, endereço comercial.
- Informações de cobrança: processadas com criptografia de ponta a ponta pela **Stripe** (dados de cartão não ficam salvos em texto puro nos nossos servidores).
- Logs operacionais de acesso e auditoria.

**1.2. Dados dos Clientes Finais (Consumidores do Restaurante):**
- Nome, telefone/WhatsApp, endereço para entrega de pedidos.
- Histórico de pedidos realizados no cardápio digital para fins de consulta e entrega.

## 2. Finalidade do Tratamento
- Viabilizar o fluxo operacional de pedidos, entrega e atendimento no salão.
- Processamento e gestão de cobrança de assinaturas da plataforma.
- Comunicação de status de pedidos e alertas operacionais.
- Suporte técnico e aprimoramento contínuo da estabilidade do sistema.

## 3. Compartilhamento Seguro de Dados
Compartilhamos dados exclusivamente com parceiros essenciais para a operação da plataforma:
- **Stripe**: Gateway de processamento de pagamentos para cobrança de assinaturas.
- **Supabase / AWS Cloud**: Infraestrutura segura em nuvem e banco de dados relacional.
- **Autoridades Públicas**: Somente mediante requisição judicial ou obrigação legal.

## 4. Segurança da Informação
- Conexões 100% criptografadas via protocolo HTTPS/TLS.
- Políticas de controle de acesso a nível de linha no banco de dados (Row Level Security - RLS), impedindo que um restaurante visualize dados de outro.
- Backups regulares e infraestrutura resiliente.

## 5. Seus Direitos (LGPD)
Qualquer titular pode solicitar a confirmação da existência de tratamento, correção de dados incompletos ou eliminação de seus dados pessoais entrando em contato através do e-mail **privacidade@borauai.com.br**.

## 6. Encarregado pelo Tratamento de Dados (DPO)
- **Encarregado:** Comitê de Privacidade Bora Uai
- **E-mail:** dpo@borauai.com.br'),

('legal_lgpd', E'# Conformidade com a LGPD

**Última atualização:** 07 de novembro de 2026

A Bora Uai adota medidas técnicas, administrativas e organizacionais para garantir total aderência à Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais).

## 1. Papéis segundo a LGPD
- **Controlador dos Dados dos Consumidores:** O Estabelecimento Comercial que recebe os pedidos dos seus clientes finais.
- **Operador dos Dados:** A Bora Uai, que atua como fornecedora da tecnologia onde os pedidos são processados e armazenados com segurança.
- **Controlador dos Dados dos Assinantes:** A Bora Uai, no que tange aos dados cadastrais e de cobrança dos restaurantes clientes da plataforma.

## 2. Práticas de Segurança Implementadas
- Criptografia em trânsito (TLS 1.3) e isolamento lógico de banco de dados (RLS).
- Armazenamento em servidores certificados de classe empresarial.
- Política de retenção de logs e descarte seguro de dados.

## 3. Canal de Atendimento ao Titular
Solicitações sobre dados pessoais podem ser enviadas diretamente para **privacidade@borauai.com.br**, com prazo de resposta de até 15 dias.')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
