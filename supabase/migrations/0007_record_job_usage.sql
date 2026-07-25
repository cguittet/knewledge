alter table public.job_runs
  add column input_tokens bigint not null default 0 check (input_tokens >= 0),
  add column cached_input_tokens bigint not null default 0 check (cached_input_tokens >= 0),
  add column cache_write_input_tokens bigint not null default 0 check (cache_write_input_tokens >= 0),
  add column output_tokens bigint not null default 0 check (output_tokens >= 0),
  add column reasoning_tokens bigint not null default 0 check (reasoning_tokens >= 0),
  add column embedding_tokens bigint not null default 0 check (embedding_tokens >= 0),
  add column total_tokens bigint not null default 0 check (total_tokens >= 0),
  add column estimated_cost_usd numeric(14, 8),
  add column usage_details jsonb not null default '{}'::jsonb;

comment on column public.job_runs.estimated_cost_usd is
  'Estimate from the dated standard-pricing snapshot stored in usage_details; null when any model price is unknown.';
