UPDATE public.subscription_plans
SET 
  description = 'Para começar a vender online — ideal para operação solo',
  features = '["PDV completo + caixa", "Cardápio digital com fotos", "Pedidos delivery e retirada", "Até 100 produtos", "2 usuários · 1 caixa", "Notificação WhatsApp para cliente", "Relatórios básicos", "Suporte por e-mail"]'::jsonb
WHERE tier = 'basic';

UPDATE public.subscription_plans
SET 
  description = 'A escolha da maioria dos comércios — operação completa multi-canal',
  features = '["Tudo do Básico", "QR Code na mesa + Cardápio Dine-in", "KDS (tela da cozinha) + impressão térmica 80mm", "App PWA do Garçom com modo offline", "Comandas individuais + Divisão de conta", "Gestão de entregadores (motoboys)", "Controle de estoque + custo por insumo", "Reservas de mesa online", "Pesquisa de satisfação (NPS)", "Cupons de desconto (até 20)", "Multi-caixa (até 3) · 5 usuários", "Relatórios avançados", "Suporte prioritário"]'::jsonb,
  advanced_reports = true,
  visual_customization = true,
  max_users = 5,
  max_coupons = 20
WHERE tier = 'professional';

UPDATE public.subscription_plans
SET 
  description = 'Operação inteligente com IA e bot Telegram completo',
  features = '["Tudo do Profissional", "🤖 Bot Telegram inteligente (comandos /relatorio, /comandas, /mesas, /estoque, /abrir, /fechar)", "✅ Aceitar/recusar pedidos direto pelo Telegram", "👥 Múltiplos garçons vinculados ao bot", "📊 AI Insights — análise de vendas com IA", "🔔 Resumo diário automático às 22h (Top 3 produtos + KPIs)", "🚨 Alertas de estoque baixo no Telegram", "CRM completo de clientes", "Cupons ilimitados", "Domínio personalizado", "API de integração", "Caixas e usuários ilimitados", "SLA garantido", "Gerente de conta dedicado", "Suporte 24/7"]'::jsonb,
  advanced_reports = true,
  visual_customization = true,
  custom_domain = true,
  max_users = 999,
  max_coupons = 999
WHERE tier = 'premium';