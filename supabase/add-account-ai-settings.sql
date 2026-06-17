alter table public.instagram_accounts
add column if not exists openai_api_key_env_name text,
add column if not exists openai_model text,
add column if not exists analysis_instructions text;
