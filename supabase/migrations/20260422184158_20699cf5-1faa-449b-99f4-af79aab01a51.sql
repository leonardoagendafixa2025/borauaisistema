-- Limpa o preapproval travado para permitir gerar um novo limpo
UPDATE public.subscriptions
SET mp_preapproval_id = NULL,
    mp_init_point = NULL,
    updated_at = now()
WHERE mp_preapproval_id = 'b56b3002ac1f43d6a9d3f242624f07b5';