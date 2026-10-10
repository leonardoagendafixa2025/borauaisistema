# BoraUai - Sistema Pedidos

Quero que você atue como um Product Designer Sênior, UX/UI Designer Sênior, Arquiteto de Software SaaS e Engenheiro Full Stack Sênior.

Sua missão é criar um produto SaaS profissional e comercialmente vendável para o mercado de restaurantes. Não quero apenas telas bonitas: quero um sistema realista, escalável, bem estruturado, com visão de negócio, visão de produto e arquitetura preparada para crescimento.

Sempre que houver ambiguidade, tome a melhor decisão com foco em:

- escalabilidade SaaS

- experiência mobile

- conversão de pedidos

- facilidade de operação para restaurantes

- controle total da plataforma pelo master admin

- organização multi-tenant

- base sólida para monetização recorrente
Crie um sistema SaaS completo de pedidos online para restaurantes, com front-end e back-end, arquitetura moderna, escalável e multi-tenant.

O produto será uma plataforma onde vários restaurantes poderão alugar o sistema, cada um com seu ambiente próprio e dados isolados. Cada restaurante deve ter acesso público por URL no formato:

menufood.com.br/restaurante

com possibilidade futura de subdomínio próprio.

Quero que você desenvolva a aplicação com foco em:

- SaaS multi-tenant

- painel master admin

- painel admin individual para cada restaurante

- área pública de cardápio e pedidos para o cliente final

- sistema moderno, profissional, responsivo e mobile-first

Objetivo do produto:

Criar uma plataforma de pedidos online white-label para restaurantes, onde eu como dono da plataforma tenho controle total de toda a operação, financeiro e gestão dos restaurantes, e cada restaurante tenha autonomia para operar seu próprio negócio dentro do sistema.

==================================================

1. ARQUITETURA GERAL

==================================================

Construa a solução com arquitetura SaaS multi-tenant, separando claramente:

1. Painel Master Admin

2. Painel Admin do Restaurante

3. Área Pública do Cliente Final

Cada restaurante deve possuir:

- dados isolados por tenant

- configurações próprias

- cardápio próprio

- pedidos próprios

- clientes próprios

- financeiro próprio

- identidade visual própria

O sistema deve ser preparado para crescimento, manutenção simples e futuras integrações.

==================================================

2. PAINEL MASTER ADMIN

==================================================

Criar um dashboard master completo para o dono da plataforma com controle total sobre todos os restaurantes.

Funcionalidades do Painel Master:

- login seguro de super admin

- dashboard geral da plataforma

- cadastro de restaurantes

- edição de restaurantes

- ativação, bloqueio, suspensão e cancelamento de restaurantes

- instalação/criação automática do ambiente de cada restaurante ao cadastrar

- geração da URL do restaurante

- definição de plano por restaurante

- gestão de período de teste grátis

- controle de assinatura

- controle financeiro por restaurante

- controle financeiro consolidado geral

- visualização de pedidos por restaurante

- visualização de faturamento por restaurante

- visualização de métricas gerais da plataforma

- gestão de usuários internos do sistema master

- permissões por perfil

- logs e auditoria de ações críticas

- tela de suporte para consultar dados de cada restaurante

Métricas do dashboard master:

- total de restaurantes

- restaurantes ativos

- restaurantes inativos

- restaurantes em trial

- restaurantes inadimplentes

- total de pedidos da plataforma

- faturamento total

- faturamento por período

- faturamento por restaurante

- ticket médio geral

- ticket médio por restaurante

- restaurantes com mais pedidos

- restaurantes com maior faturamento

- receita recorrente mensal

- alertas operacionais e financeiros

==================================================

3. GESTÃO DE RESTAURANTES NO MASTER

==================================================

Ao cadastrar um restaurante, o sistema deve permitir:

- nome do restaurante

- slug/URL personalizada

- logo

- capa/banner

- telefone

- WhatsApp

- e-mail

- CNPJ

- endereço

- plano contratado

- status da assinatura

- data de vencimento

- taxa/comissão da plataforma

- ativação de trial

- criação de usuário admin do restaurante

- senha inicial ou convite por e-mail

- configuração inicial automática

Quando um restaurante for criado, executar onboarding automático:

- criar tenant

- criar configuração base

- criar usuário admin

- criar área pública

- criar painel do restaurante

- aplicar plano

- liberar funcionalidades conforme plano

==================================================

4. PAINEL ADMIN DO RESTAURANTE

==================================================

Criar um painel exclusivo para cada restaurante com interface moderna e intuitiva.

Módulos do painel do restaurante:

- dashboard

- perfil do restaurante

- cardápio

- categorias

- produtos

- adicionais e complementos

- combos

- promoções

- cupons

- pedidos

- clientes

- relatórios

- financeiro

- configurações

- usuários e permissões

Funcionalidades:

- editar identidade visual

- editar horário de funcionamento

- definir pedidos para entrega, retirada e consumo local

- definir taxa de entrega por bairro/região

- definir pedido mínimo

- definir tempo estimado de preparo

- definir formas de pagamento aceitas

- ativar/desativar catálogo

- ativar/desativar produtos

- visualizar pedidos em tempo real

- alterar status do pedido

- visualizar histórico de pedidos

- acessar relatórios financeiros

- cadastrar atendentes e gerentes

Métricas do dashboard do restaurante:

- pedidos do dia

- faturamento do dia

- ticket médio

- pedidos em andamento

- pedidos concluídos

- pedidos cancelados

- produtos mais vendidos

- horários de maior movimento

- clientes recorrentes

- receita por período

==================================================

5. CARDÁPIO E PRODUTOS

==================================================

Criar sistema completo de gestão de cardápio com:

- categorias

- subcategorias

- produtos

- descrição

- imagens

- preço

- preço promocional

- disponibilidade

- destaque

- ordenação

- adicionais

- complementos

- observações

- variações de tamanho

- combos

- limite de adicionais

- produto esgotado

- controle de estoque simples opcional

Cada item deve permitir:

- nome

- descrição

- foto

- preço

- status ativo/inativo

- categoria

- adicionais obrigatórios ou opcionais

- quantidade mínima e máxima de adicionais

- observação livre do cliente

==================================================

6. ÁREA PÚBLICA DO CLIENTE FINAL

==================================================

Criar uma área pública bonita, profissional, rápida e extremamente otimizada para celular.

Fluxo do cliente:

- acessar URL do restaurante

- visualizar capa, logo, nome e informações

- navegar por categorias

- pesquisar produtos

- abrir detalhes do produto

- escolher adicionais

- adicionar observações

- adicionar ao carrinho

- revisar carrinho

- fazer login/cadastro

- informar endereço

- escolher entrega, retirada ou consumo no local

- escolher pagamento

- finalizar pedido

- acompanhar status do pedido

Funcionalidades públicas:

- layout mobile-first

- carrinho lateral ou fixo mobile

- checkout simples

- validação de horário de funcionamento

- exibição de tempo estimado

- área de login/cadastro do cliente

- histórico de pedidos

- reenvio de pedido anterior

- cupom de desconto

- confirmação visual do pedido

- tela de acompanhamento do pedido

==================================================

7. GESTÃO DE PEDIDOS

==================================================

Criar fluxo completo de pedidos com status:

- novo pedido

- aceito

- em preparo

- pronto

- saiu para entrega

- aguardando retirada

- concluído

- cancelado

Funcionalidades:

- fila de pedidos em tempo real

- atualização de status

- detalhes do cliente

- detalhes do endereço

- itens do pedido

- observações

- forma de pagamento

- pagamento confirmado ou pendente

- impressão futura preparada

- filtros por status e período

==================================================

8. FINANCEIRO

==================================================

Criar módulo financeiro em dois níveis.

Financeiro Master:

- receita recorrente mensal

- mensalidade por restaurante

- comissão por restaurante

- inadimplência

- vencimentos

- status de pagamento da assinatura

- relatórios consolidados

- histórico financeiro da plataforma

Financeiro do Restaurante:

- total vendido

- total por período

- pedidos pagos

- pedidos pendentes

- vendas por forma de pagamento

- fechamento diário

- fechamento mensal

- ticket médio

- exportação futura preparada

==================================================

9. PLANOS E ASSINATURAS

==================================================

Criar estrutura de planos SaaS:

- plano básico

- plano profissional

- plano premium

Cada plano pode limitar ou liberar:

- quantidade de usuários

- quantidade de cupons

- relatórios avançados

- personalização visual

- domínio próprio futuro

- integrações futuras

- automações futuras

Criar estrutura de assinatura com:

- trial

- ativo

- vencido

- suspenso

- cancelado

==================================================

10. USUÁRIOS E PERMISSÕES

==================================================

Criar RBAC (controle por papéis/permissões).

Perfis do Master:

- super admin

- financeiro

- suporte

- comercial

Perfis do Restaurante:

- dono

- gerente

- atendente

- cozinha

Cada perfil deve ter permissões adequadas por módulo.

==================================================

11. TECNOLOGIA E QUALIDADE

==================================================

Quero uma aplicação com:

- front-end moderno

- design premium

- responsivo

- mobile-first

- excelente UX/UI

- código organizado

- back-end estruturado

- autenticação segura

- separação clara por tenant

- banco de dados modelado corretamente

- APIs bem definidas

- componentes reutilizáveis

- escalabilidade

- base pronta para evolução

Sugira e implemente stack moderna adequada, por exemplo:

- Front-end: React / Next.js

- Back-end: Node.js / NestJS ou similar

- Banco: PostgreSQL

- ORM: Prisma

- Autenticação: JWT + session strategy

- UI: design system moderno

- Deploy ready

==================================================

12. TELAS QUE DEVEM SER CRIADAS

==================================================

Quero no mínimo as seguintes telas:

MASTER ADMIN

- login master

- dashboard geral

- lista de restaurantes

- cadastro de restaurante

- detalhes do restaurante

- financeiro geral

- assinaturas e planos

- usuários internos

- configurações da plataforma

RESTAURANTE

- login restaurante

- dashboard restaurante

- perfil/configurações

- categorias

- produtos

- adicionais

- combos/promos

- pedidos

- clientes

- relatórios

- financeiro

- usuários e permissões

CLIENTE FINAL

- home/cardápio do restaurante

- detalhe do produto

- carrinho

- checkout

- login/cadastro

- pedidos do cliente

- acompanhamento do pedido

==================================================

13. BANCO DE DADOS

==================================================

Modele o banco pensando em multi-tenant.

Entidades principais:

- platform_users

- restaurants

- restaurant_users

- subscription_plans

- subscriptions

- restaurant_settings

- categories

- products

- product_options

- product_option_groups

- coupons

- customers

- addresses

- orders

- order_items

- payments

- financial_transactions

- audit_logs

Garanta isolamento por tenant onde necessário.

==================================================

14. REGRAS IMPORTANTES

==================================================

- Um restaurante não pode acessar dados de outro restaurante

- O master admin pode acessar todos os restaurantes

- O sistema deve validar assinatura e status do restaurante

- Restaurante suspenso pode ter acesso bloqueado ou limitado

- Cardápio público deve respeitar horário de funcionamento

- Pedido deve validar disponibilidade de produto

- Fluxo precisa ser simples para o cliente final

- Interface deve ser pensada para conversão em vendas

==================================================

15. ENTREGA ESPERADA

==================================================

Quero que você gere:

1. arquitetura do sistema

2. estrutura de páginas

3. modelagem das entidades

4. fluxos principais

5. interface moderna de alto nível

6. front-end completo

7. back-end completo

8. autenticação

9. banco de dados

10. exemplos de dados seed

11. organização de pastas

12. instruções para rodar o projeto

Quero que o resultado tenha aparência de produto SaaS real, pronto para ser apresentado, validado e evoluído comercialmente.

Além disso:

- proponha melhorias de produto se identificar oportunidades

- aplique boas práticas de UX para restaurantes e clientes finais

- use uma estética moderna, premium e confiável

- priorize clareza, escalabilidade e experiência mobile

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://borauai.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/04f6528c-fd0d-4c44-96c6-12848efc12fe).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
