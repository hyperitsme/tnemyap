create table if not exists quotes (
  nonce text primary key,
  resource text not null,
  price numeric(36,18) not null,
  symbol text not null,
  chain text not null,
  token text not null,
  decimals int not null,
  pay_to text not null,
  expiry timestamptz not null,
  created_at timestamptz not null default now(),
  used boolean not null default false
);

create table if not exists receipts (
  id text primary key,         -- ulid
  nonce text not null references quotes(nonce),
  chain text not null,
  tx_hash text not null,
  payer text,
  amount numeric(36,18) not null,
  verified boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists receipts_nonce_idx on receipts(nonce);
create index if not exists receipts_tx_idx on receipts(tx_hash);
