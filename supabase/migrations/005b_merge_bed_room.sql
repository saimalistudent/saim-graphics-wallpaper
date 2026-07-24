-- Fix: merge BED + ROOM into one category "BED ROOM"
-- Run in Supabase SQL Editor if 005 was already applied with separate BED/ROOM

-- Rename BED → BED ROOM (if exists)
update catalog_categories
set name = 'BED ROOM', sort_order = 1, updated_at = now()
where upper(trim(name)) = 'BED';

-- Point catalogs that used ROOM over to BED ROOM, then delete ROOM
update catalogs
set category_id = (
  select id from catalog_categories where upper(trim(name)) = 'BED ROOM' limit 1
)
where category_id in (
  select id from catalog_categories where upper(trim(name)) = 'ROOM'
);

delete from catalog_categories
where upper(trim(name)) = 'ROOM';

-- Re-number remaining categories
update catalog_categories set sort_order = 2, updated_at = now()
where upper(trim(name)) = 'BETHAK';
update catalog_categories set sort_order = 3, updated_at = now()
where upper(trim(name)) = 'PARLOUR';
update catalog_categories set sort_order = 4, updated_at = now()
where upper(trim(name)) = 'SALON';
update catalog_categories set sort_order = 5, updated_at = now()
where upper(trim(name)) = 'BORDER';
