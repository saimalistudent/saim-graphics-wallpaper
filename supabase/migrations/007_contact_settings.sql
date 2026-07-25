-- Contact settings (singleton row — Call + WhatsApp popup, floating FAB, PDF viewer share this row)

create table if not exists contact_settings (
  id uuid primary key default gen_random_uuid(),
  enabled boolean not null default true,
  call_intro_ur text not null default '',
  call_button_label text not null default 'CALL ONLY',
  call_phone text not null default '',
  whatsapp_intro_ur text not null default '',
  whatsapp_button_label text not null default 'WHATSAPP ONLY',
  whatsapp_phone text not null default '',
  updated_at timestamptz default now()
);

alter table contact_settings enable row level security;

create policy "Public can read contact_settings"
  on contact_settings for select
  using (true);

-- Seed one default row (skip if any row already exists)
insert into contact_settings (
  enabled,
  call_intro_ur,
  call_button_label,
  call_phone,
  whatsapp_intro_ur,
  whatsapp_button_label,
  whatsapp_phone
)
select
  true,
  'ہم سے فون کال پر رابطہ کرنے کے لئے اس نیچے دیے گئے بٹن پر کلک کریں',
  'CALL ONLY',
  '0318 7976294',
  'ہم سے واٹس ایپ پر رابطہ کرنے کے لئے نیچے دیے گئے بٹن پر کلک کریں',
  'WHATSAPP ONLY',
  '03127290072'
where not exists (select 1 from contact_settings limit 1);
