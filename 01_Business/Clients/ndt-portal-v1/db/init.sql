-- PostgREST roles
CREATE ROLE anon NOLOGIN;
GRANT USAGE ON SCHEMA public TO anon;
CREATE ROLE authenticated NOLOGIN;
GRANT USAGE ON SCHEMA public TO authenticated;

-- ============================================================
-- RT SCHEMA
-- ============================================================
CREATE SCHEMA rt;
GRANT USAGE ON SCHEMA rt TO anon, authenticated;

CREATE TABLE rt.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  burden_multiplier DECIMAL NOT NULL DEFAULT 1.16,
  loaded_rate_multiplier DECIMAL NOT NULL DEFAULT 3.0,
  monthly_oh_costs DECIMAL NOT NULL DEFAULT 135000,
  monthly_direct_labor DECIMAL NOT NULL DEFAULT 275000,
  film_markup_pct DECIMAL NOT NULL DEFAULT 0.10,
  sandbox_price_pct DECIMAL NOT NULL DEFAULT 0.10,
  misc_profit_pct DECIMAL NOT NULL DEFAULT 0.15,
  profit_multiplier DECIMAL NOT NULL DEFAULT 0.45,
  sales_bonus_multiplier DECIMAL NOT NULL DEFAULT 1.02,
  shooter_machine_count INTEGER NOT NULL DEFAULT 3,
  shooter_crew_divisor INTEGER NOT NULL DEFAULT 4,
  darkroom_operator_count INTEGER NOT NULL DEFAULT 2,
  reader_crew_count INTEGER NOT NULL DEFAULT 4,
  reader_divisor INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO rt.settings DEFAULT VALUES;

CREATE TABLE rt.film_sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label VARCHAR NOT NULL,
  width DECIMAL NOT NULL,
  height DECIMAL NOT NULL,
  price_per_box_100 DECIMAL NOT NULL,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO rt.film_sizes (label, width, height, price_per_box_100, sort_order) VALUES
  ('5X7',    5,    7,   89.07, 1),
  ('4.5X10', 4.5, 10,  112.58, 2),
  ('4.5X17', 4.5, 17,  180.33, 3),
  ('8X10',   8,   10,  188.20, 4),
  ('7X17',   7,   17,  275.46, 5),
  ('10X12', 10,   12,  276.85, 6),
  ('11X14', 11,   14,  350.75, 7),
  ('14X17', 14,   17,  537.06, 8);

CREATE TABLE rt.operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  role VARCHAR NOT NULL CHECK (role IN ('SHOOTER','DARKROOM_SORT','READER')),
  base_hourly_rate DECIMAL NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO rt.operators (name, role, base_hourly_rate, sort_order) VALUES
  ('Jessica',   'SHOOTER',       22,     1),
  ('Valeria',   'SHOOTER',       22,     2),
  ('Marisol',   'SHOOTER',       22,     3),
  ('Shane',     'SHOOTER',       30,     4),
  ('Victor',    'SHOOTER',       30,     5),
  ('Mario',     'SHOOTER',       37,     6),
  ('Jose',      'SHOOTER',       34,     7),
  ('Kimberly',  'SHOOTER',       34,     8),
  ('DR/Sort 1', 'DARKROOM_SORT', 20,     9),
  ('DR/Sort 2', 'DARKROOM_SORT', 22,    10),
  ('Reader 1',  'READER',        34,    11),
  ('Reader 2',  'READER',        34,    12),
  ('Reader 3',  'READER',        37,    13),
  ('Dan',       'READER',        55.29, 14);

CREATE TABLE rt.pricing_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label VARCHAR NOT NULL,
  single_shot_rate DECIMAL NOT NULL,
  multi_shot_rate DECIMAL NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO rt.pricing_tiers (label, single_shot_rate, multi_shot_rate, sort_order) VALUES
  ('$0.085/$0.09',  0.09,  0.085, 1),
  ('$0.115',        0.115, 0.115, 2),
  ('$0.125',        0.125, 0.125, 3),
  ('$0.13',         0.13,  0.13,  4),
  ('$0.14/$0.145',  0.145, 0.14,  5),
  ('$0.15/$0.155',  0.155, 0.15,  6),
  ('$0.16/$0.165',  0.165, 0.16,  7),
  ('$0.17/$0.175',  0.175, 0.17,  8),
  ('$0.18/$0.185',  0.185, 0.18,  9),
  ('$0.185/$0.18',  0.185, 0.18, 10);

CREATE TABLE rt.part_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_number VARCHAR NOT NULL,
  customer_name VARCHAR NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE rt.view_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES rt.part_quotes(id) ON DELETE CASCADE,
  view_number INTEGER NOT NULL,
  shot_type INTEGER NOT NULL DEFAULT 1 CHECK (shot_type IN (0,1,2,3)),
  qty_parts_per_film INTEGER NOT NULL DEFAULT 2,
  film_size_id UUID REFERENCES rt.film_sizes(id),
  unpack_load_time DECIMAL NOT NULL DEFAULT 1.0,
  darkroom_sort_time DECIMAL NOT NULL DEFAULT 1.0,
  shot_time DECIMAL NOT NULL DEFAULT 2.0,
  read_time DECIMAL NOT NULL DEFAULT 1.0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA rt TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA rt GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO anon, authenticated;

-- ============================================================
-- UT SCHEMA
-- ============================================================
CREATE SCHEMA ut;
GRANT USAGE ON SCHEMA ut TO anon, authenticated;

CREATE TABLE ut.global_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  default_hourly_rate DECIMAL NOT NULL DEFAULT 225,
  cscan_hourly_rate DECIMAL NOT NULL DEFAULT 250,
  high_res_hourly_rate DECIMAL NOT NULL DEFAULT 250,
  default_env_fee_rate DECIMAL NOT NULL DEFAULT 0.02,
  default_technique_fee DECIMAL NOT NULL DEFAULT 125,
  default_min_charge DECIMAL NOT NULL DEFAULT 225,
  default_load_time DECIMAL NOT NULL DEFAULT 3.0,
  scan_speed_divisor DECIMAL NOT NULL DEFAULT 10,
  default_lead_time VARCHAR NOT NULL DEFAULT '4-5 Days',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO ut.global_settings DEFAULT VALUES;

CREATE TABLE ut.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  hourly_rate DECIMAL NOT NULL DEFAULT 225,
  cscan_rate DECIMAL NOT NULL DEFAULT 250,
  technique_fee DECIMAL NOT NULL DEFAULT 125,
  env_fee_rate DECIMAL NOT NULL DEFAULT 0.02,
  min_charge DECIMAL NOT NULL DEFAULT 225,
  cscan_min_charge DECIMAL NOT NULL DEFAULT 250,
  delivery_fee VARCHAR NOT NULL DEFAULT 'N/A',
  lead_time VARCHAR NOT NULL DEFAULT '4-5 Days',
  has_env_fee BOOLEAN NOT NULL DEFAULT true,
  has_tech_fee BOOLEAN NOT NULL DEFAULT true,
  lot_pattern VARCHAR NOT NULL DEFAULT 'simple' CHECK (lot_pattern IN ('simple','min_enforced')),
  notes TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO ut.customers (name,hourly_rate,cscan_rate,technique_fee,env_fee_rate,min_charge,cscan_min_charge,delivery_fee,has_env_fee,has_tech_fee,lot_pattern,notes,sort_order) VALUES
('PREMCO',225,250,0,0.02,225,250,'No',true,false,'min_enforced','$0.13/LB over 6.00x6.00',1),
('ACTION INDUSTRIES',225,250,125,0.02,225,250,'$100',false,true,'min_enforced','',2),
('ACUTEK US',225,250,125,0.02,225,250,'$75',true,true,'min_enforced','',3),
('ALLOY METALS',225,250,0,0.02,225,250,'N/A',true,false,'simple','Weight-based pricing for SS/Ti',4),
('ALTEMP ALLOYS',225,250,125,0.02,225,250,'N/A',true,true,'min_enforced','Weight-based pricing for SS/Ni',5),
('AVIATION METALS',225,250,0,0.02,225,250,'Varies',true,false,'simple','',6),
('AXXIS CORP',225,250,125,0.02,225,250,'$100',true,true,'min_enforced','',7),
('BLUELINE INDUSTRIES',225,250,100,0.02,225,250,'No',true,true,'min_enforced','Fixed round bar price table',8),
('CALIFORNIA METALS',225,250,125,0.02,225,250,'$100',true,true,'min_enforced','',9),
('FALCON ENGINEERING',225,250,0,0.02,225,250,'N/A',true,false,'min_enforced','',10),
('HUB METALS',225,250,0,0.02,225,250,'No',true,false,'min_enforced','',11),
('INDEPENDENT FORGE',225,250,125,0.02,225,250,'N/A',true,true,'min_enforced','',12),
('JR MACHINE',225,250,125,0.02,225,250,'Varies',true,true,'min_enforced','',13),
('LEADING EDGE',225,250,125,0.02,225,250,'$100',true,true,'simple','',14),
('LEAN MANUFACTURING',225,250,200,0.02,225,250,'N/A',true,true,'simple','',15),
('MAGNA TOOL',225,250,125,0.02,225,250,'N/A',true,true,'min_enforced','Weight-based pricing for SS/Ni',16),
('MCNEELEY MFG',225,250,125,0.02,225,250,'N/A',true,true,'simple','',17),
('OLYMPIC AVIATION',225,250,0,0.02,225,250,'No',true,false,'min_enforced','',18),
('PRECISION WATERJET',225,250,125,0.02,225,250,'$100',true,true,'min_enforced','',19),
('PROGRESSIVE ALLOY',225,250,125,0.02,225,250,'Varies',true,true,'simple','',20),
('Q&L METALS',225,250,125,0.02,225,250,'Various',true,true,'simple','',21),
('RAM ALLOYS',225,250,125,0.02,225,250,'Various',true,true,'simple','',22),
('RED LION',225,250,125,0.02,225,250,'Various',true,true,'min_enforced','Pacific Metal Cutting: $75',23),
('RICKARD SPECIALTY',225,250,0,0.02,225,250,'N/A',true,false,'simple','Weight-based pricing for SS/Ti',24),
('SA AEROSPACE',225,250,125,0.02,225,250,'$150',true,true,'simple','',25),
('SIERRA ALLOYS',225,250,125,0.02,225,250,'N/A',true,true,'simple','Weight-based pricing for SS/Ti',26),
('SUPERIOR HANDFORGE',225,250,0,0.0,225,250,'No',false,false,'min_enforced','$0.13/LB over 6.00x6.00',27),
('TOOLCRAFT',225,250,125,0.02,225,250,'N/A',true,true,'simple','',28),
('TRITON ALLOYS',225,250,125,0.02,225,250,'Varies',true,true,'min_enforced','',29),
('TRUE STEEL',195,250,0,0.0,195,250,'N/A',false,false,'simple','',30);

CREATE TABLE ut.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  density_lb_per_cu_in DECIMAL NOT NULL,
  class_a_rate_per_lb DECIMAL,
  class_aa_rate_per_lb DECIMAL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO ut.materials (name,density_lb_per_cu_in,class_a_rate_per_lb,class_aa_rate_per_lb,sort_order) VALUES
('Mild steel',0.283,0.14,NULL,1),
('Stainless steel',0.290,0.12,0.14,2),
('Aluminum',0.100,0.16,NULL,3),
('Titanium',0.160,0.20,0.25,4),
('Nickel alloys',0.2965,0.14,0.16,5);

CREATE TABLE ut.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES ut.customers(id),
  quote_number VARCHAR,
  quoted_by VARCHAR DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ut.line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES ut.quotes(id) ON DELETE CASCADE,
  geometry_type VARCHAR NOT NULL DEFAULT 'FLAT_BAR'
    CHECK (geometry_type IN ('FLAT_BAR','ROUND_BAR','RING','TUBING','CSCAN_FLAT','CSCAN_ROUND','THIN_SHEET')),
  thickness DECIMAL,
  width DECIMAL,
  length DECIMAL,
  diameter DECIMAL,
  outer_diameter DECIMAL,
  inner_diameter DECIMAL,
  scan_index DECIMAL NOT NULL DEFAULT 0.065,
  resolution VARCHAR DEFAULT '.250"',
  load_time DECIMAL NOT NULL DEFAULT 3.0,
  hourly_rate DECIMAL NOT NULL DEFAULT 225,
  quantity INTEGER NOT NULL DEFAULT 1,
  number_of_scans INTEGER NOT NULL DEFAULT 1,
  material_id UUID REFERENCES ut.materials(id),
  inspection_class VARCHAR CHECK (inspection_class IN ('A','AA')),
  use_weight_pricing BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA ut TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA ut GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO anon, authenticated;
