-- ============================================
-- FASE 1 + 2: Master Admin Foundation
-- ============================================

-- =====================================================
-- 1. AUDIT LOGS - Triggers automáticos para ações críticas
-- =====================================================

-- Helper function: registra audit log
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _action text,
  _entity_type text,
  _entity_id uuid,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), _action, _entity_type, _entity_id, _metadata);
END;
$$;

-- Trigger: status do restaurante mudou (suspended, cancelled, etc.)
CREATE OR REPLACE FUNCTION public.trg_audit_restaurant_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
    VALUES (
      auth.uid(),
      'restaurant_status_changed',
      'restaurant',
      NEW.id,
      jsonb_build_object(
        'restaurant_name', NEW.name,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_restaurant_status ON restaurants;
CREATE TRIGGER audit_restaurant_status
AFTER UPDATE ON restaurants
FOR EACH ROW EXECUTE FUNCTION trg_audit_restaurant_status();

-- Trigger: subscription mudou de plano
CREATE OR REPLACE FUNCTION public.trg_audit_subscription_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.plan_id IS DISTINCT FROM OLD.plan_id OR NEW.status IS DISTINCT FROM OLD.status) THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
    VALUES (
      auth.uid(),
      'subscription_changed',
      'subscription',
      NEW.id,
      jsonb_build_object(
        'restaurant_id', NEW.restaurant_id,
        'old_plan_id', OLD.plan_id,
        'new_plan_id', NEW.plan_id,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_subscription_change ON subscriptions;
CREATE TRIGGER audit_subscription_change
AFTER UPDATE ON subscriptions
FOR EACH ROW EXECUTE FUNCTION trg_audit_subscription_change();

-- Trigger: novo restaurante criado
CREATE OR REPLACE FUNCTION public.trg_audit_restaurant_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(),
    'restaurant_created',
    'restaurant',
    NEW.id,
    jsonb_build_object('restaurant_name', NEW.name, 'slug', NEW.slug, 'status', NEW.status)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_restaurant_created ON restaurants;
CREATE TRIGGER audit_restaurant_created
AFTER INSERT ON restaurants
FOR EACH ROW EXECUTE FUNCTION trg_audit_restaurant_created();

-- Trigger: platform_settings mudou
CREATE OR REPLACE FUNCTION public.trg_audit_platform_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.value IS DISTINCT FROM OLD.value THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
    VALUES (
      auth.uid(),
      'platform_setting_changed',
      'platform_setting',
      NEW.id,
      jsonb_build_object('key', NEW.key, 'old_value', OLD.value, 'new_value', NEW.value)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_platform_settings ON platform_settings;
CREATE TRIGGER audit_platform_settings
AFTER UPDATE ON platform_settings
FOR EACH ROW EXECUTE FUNCTION trg_audit_platform_settings();

-- Adicionar coluna motivo no restaurant para suspensão
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS suspension_reason text;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

-- =====================================================
-- 2. FASE 2: Templates de mensagens (master)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.master_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  channel text NOT NULL DEFAULT 'telegram', -- telegram | email | whatsapp | in_app
  subject text,
  body text NOT NULL,
  variables jsonb DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE master_message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins full access templates"
ON master_message_templates
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_templates_updated_at
BEFORE UPDATE ON master_message_templates
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed templates iniciais
INSERT INTO master_message_templates (key, name, description, channel, subject, body, variables) VALUES
  ('welcome_restaurant', 'Boas-vindas restaurante', 'Enviado ao criar novo restaurante', 'telegram', NULL,
   E'🎉 Bem-vindo(a) ao MeuBar, *{{nome}}*!\n\nSua conta está ativa no plano *{{plano}}* com trial de {{trial_dias}} dias.\n\n📲 Acesse: {{url_login}}\n📧 E-mail: {{email}}\n\nQualquer dúvida, fale com nosso suporte: {{suporte}}',
   '["nome","plano","trial_dias","url_login","email","suporte"]'::jsonb),
  ('payment_overdue', 'Cobrança - inadimplência', 'Enviado quando subscription fica overdue', 'telegram', NULL,
   E'⚠️ *{{nome}}*, identificamos que sua assinatura está com pagamento em atraso há {{dias_atraso}} dia(s).\n\nValor: R$ {{valor}}\nPlano: {{plano}}\n\nRegularize em: {{url_pagamento}}\n\nApós 7 dias, o acesso será suspenso automaticamente.',
   '["nome","dias_atraso","valor","plano","url_pagamento"]'::jsonb),
  ('subscription_suspended', 'Conta suspensa', 'Enviado ao suspender restaurante', 'telegram', NULL,
   E'🚫 *{{nome}}*, sua conta foi suspensa.\n\nMotivo: {{motivo}}\n\nPara reativar, entre em contato com o suporte: {{suporte}}',
   '["nome","motivo","suporte"]'::jsonb),
  ('trial_expiring', 'Trial expirando', 'Enviado 3 dias antes do trial acabar', 'telegram', NULL,
   E'⏰ *{{nome}}*, seu trial termina em {{dias_restantes}} dia(s)!\n\nPara continuar usando o MeuBar, ative sua assinatura:\n{{url_pagamento}}\n\nPlano sugerido: *{{plano}}* — R$ {{valor}}/mês',
   '["nome","dias_restantes","url_pagamento","plano","valor"]'::jsonb),
  ('broadcast_default', 'Comunicado padrão', 'Template base para comunicados gerais', 'telegram', NULL,
   E'📢 *{{titulo}}*\n\n{{mensagem}}\n\n— Equipe MeuBar',
   '["titulo","mensagem"]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- 3. FASE 2: Histórico de broadcasts
-- =====================================================

CREATE TABLE IF NOT EXISTS public.master_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by uuid REFERENCES auth.users(id),
  template_key text,
  channel text NOT NULL DEFAULT 'telegram',
  subject text,
  body text NOT NULL,
  segment jsonb DEFAULT '{}'::jsonb, -- { plan_tier?: string, status?: string, restaurant_ids?: uuid[] }
  total_recipients int NOT NULL DEFAULT 0,
  sent_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- pending | sending | completed | failed
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE master_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins full access broadcasts"
ON master_broadcasts
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- =====================================================
-- 4. FASE 2: Tokens de impersonate
-- =====================================================

CREATE TABLE IF NOT EXISTS public.impersonation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  admin_user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  restaurant_id uuid,
  reason text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE impersonation_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins full access impersonation"
ON impersonation_tokens
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_impersonation_token ON impersonation_tokens(token);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);