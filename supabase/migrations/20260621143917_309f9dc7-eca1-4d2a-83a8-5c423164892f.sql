DO $$
DECLARE v text;
BEGIN
  FOREACH v IN ARRAY ARRAY['trialing','past_due','canceled','incomplete','incomplete_expired','unpaid','paused'] LOOP
    BEGIN
      EXECUTE format('ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS %L', v);
    EXCEPTION WHEN others THEN NULL;
    END;
  END LOOP;
END $$;