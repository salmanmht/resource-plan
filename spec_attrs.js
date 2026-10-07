Item attributes – install
Supabase › SQL Editor: run 1_spec_item_attrs_schema.sql, then 2_spec_item_attrs_seed_valves.sql.
GitHub: upload spec_attrs.js next to spec.html.
GitHub: edit spec.html. At the very end, after your existing add-on line and before the closing body tag, add the line from paste_this_line_attrs.txt (copy it from that file – it must start with the script tag and end with its closing tag).
Reload with Ctrl+F5. In Library, the purple ☰ Item attributes button appears at the top.
1_spec_item_attrs_schema.sql
Supabase › SQL Editor: run first.

CopyDownload
-- =====================================================================
-- MEP SPECIFICATIONS - ITEM ATTRIBUTES (the choices that change an item's specification)
-- Run ONCE in the pump / spec Supabase project (SQL Editor). Safe to re-run.
-- Needs spec_platform_migration.sql (spec_is_engineer, spec_lib_can_edit).
-- No existing table or data is changed.
-- =====================================================================
create table if not exists public.spec_item_attrs (
  id          bigint generated always as identity primary key,
  family      text not null,                       -- e.g. Valves
  item        text not null,                       -- e.g. Ball valve
  component   text not null default '',            -- e.g. Body, Trim, Seat
  attribute   text not null,                       -- e.g. Body material
  type        text,                                -- Choice / Value / Rule / Yes / No
  options     text,                                -- options separated by " | "
  standards   text,
  source      text,                                -- where it was read
  kind        text not null default 'Both' check (kind in ('Your spec','Manufacturer','Both')),
  status      text not null default 'Check' check (status in ('Verified','Check')),
  notes       text,
  sort        integer not null default 0,
  active      boolean not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  text,
  unique (item, component, attribute)
);
create index if not exists spec_item_attrs_idx on public.spec_item_attrs(family, item, sort);

create or replace function public.spec_attrs_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (to_jsonb(new) - 'updated_at' - 'updated_by') is distinct from (to_jsonb(old) - 'updated_at' - 'updated_by') then
    insert into public.spec_item_history(tbl, code, old_row, action, changed_by)
    values ('spec_item_attrs', old.item || ' : ' || old.attribute, to_jsonb(old), 'update', new.updated_by);
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_spec_item_attrs_audit on public.spec_item_attrs;
create trigger trg_spec_item_attrs_audit before update on public.spec_item_attrs
  for each row execute function public.spec_attrs_audit();

alter table public.spec_item_attrs enable row level security;
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname='public' and tablename='spec_item_attrs' loop
    execute format('drop policy if exists %I on public.spec_item_attrs', r.policyname);
  end loop;
end $$;
create policy spec_item_attrs_read on public.spec_item_attrs for select to authenticated using (public.spec_is_engineer());
create policy spec_item_attrs_ins  on public.spec_item_attrs for insert to authenticated with check (public.spec_lib_can_edit());
create policy spec_item_attrs_upd  on public.spec_item_attrs for update to authenticated using (public.spec_lib_can_edit()) with check (public.spec_lib_can_edit());
revoke all on public.spec_item_attrs from anon;

2_spec_item_attrs_seed_valves.sql
Run second. Loads the 93 valve attributes. Safe to re-run.

CopyDownload
-- Valve attributes seed. Run after spec_item_attrs_schema.sql. Re-running updates the rows (upsert).
begin;
insert into public.spec_item_attrs (family,item,component,attribute,type,options,standards,source,kind,status,notes,sort,active,updated_by) values
('Valves','All valves – general requirements','Rating','Pressure rating – plumbing','Choice','Systems up to 12 bar working pressure: valves rated 16 bar | Systems above 12 bar: valves rated 20 bar (cast steel construction or approved equal)',null,'DCH-M-MHT-SPC-IFC-PLD-0001-00 (Plumbing, cl. 14) cl. 14.23','Your spec','Verified',null,10,true,'seed'),
('Valves','All valves – general requirements','Rating','Pressure rating – fire','Choice','Standard-pressure piping: 200 psi (1200 kPa) minimum | High-pressure piping: 300 psi (2070 kPa) | Rating chosen by valve location and site pressure',null,'DCH-M-MHT-SPC-IFC-FPR-0001-00 (Section 06) cl. 1.4','Your spec','Verified',null,20,true,'seed'),
('Valves','All valves – general requirements','Source','Fire service valves – one source','Rule','Gate, check and butterfly fire-protection service valves all from one source (manufacturer)',null,'DCH-M-MHT-SPC-IFC-FPR-0001-00 (Section 06) cl. 1.4','Your spec','Verified',null,30,true,'seed'),
('Valves','All valves – general requirements','Coating','Cast iron valves – protection','Value','Epoxy coated inside and outside, average dry film thickness 300 microns',null,'DCH-M-MHT-SPC-IFC-PLD-0001-00 (Plumbing, cl. 14) cl. 14.24','Your spec','Verified',null,40,true,'seed'),
('Valves','All valves – general requirements','Operation','Hand wheels and levers','Choice','Open wheel type, malleable iron or die-cast aluminium | Bronze valves: die-cast aluminium hand wheel | Cast iron valves: cast iron / malleable iron hand wheel | Marked with open / shut direction',null,'DCH-M-MHT-SPC-IFC-PLD-0001-00 (Plumbing, cl. 14) cl. 14.10','Your spec','Verified',null,50,true,'seed'),
('Valves','All valves – general requirements','Operation','Closing direction and indication','Rule','Isolating valves close clockwise; hand wheels marked with the closing direction; an indicator shows open or shut','UL 262','DCH-M-MHT-SPC-IFC-FPR-0001-00 (Section 06) cl. 1.4.1','Your spec','Verified',null,60,true,'seed'),
('Valves','All valves – general requirements','Supervision','Main isolation valves','Choice','Tamper / supervisory switch connected to the fire alarm system | Secured open by a padlock or riveted strap',null,'DCH-M-MHT-SPC-IFC-FPR-0001-00 (Section 06) cl. 1.4.1','Your spec','Verified',null,70,true,'seed'),
('Valves','All valves – general requirements','Supervision','Supervisory / tamper switch','Choice','UL / FM listed or approved; tamper-resistant cover screws; single or double SPDT contacts; corrosion resistant; indoor or outdoor; NEMA 4 and 6P enclosures','UL; FM; NEMA 250','DCH-LM1-MHT-XXX-XXX-SPC-MEC-000003 (Section 06, DCH Icon Tower) cl. 2.4.3','Your spec','Verified','For OS&Y or butterfly valve installations.',80,true,'seed'),
('Valves','All valves – general requirements','Supply','Angle valves at fittings','Rule','Angle valves on the incoming supply to all fittings, tagged red (hot) and blue (cold)',null,'DCH-M-MHT-SPC-IFC-PLD-0001-00 (Plumbing, cl. 14) cl. 14.12–14.13','Your spec','Verified',null,90,true,'seed'),
('Valves','Ball valve','Application','Size range in your fire specs','Value','50 mm and smaller',null,'DCH-LM1-MHT-XXX-XXX-SPC-MEC-000003 (Section 06, DCH Icon Tower) cl. 2.4.1; D1-005 Fire Protection Specifications (FPR-0001 Rev A) (ball valve ≤ 50 mm)','Your spec','Verified',null,100,true,'seed'),
('Valves','Ball valve','Application','Size range, manufacturers','Value','1/4" to 2" | 1/4" to 3" | 1/2" to 4" (depends on the range)',null,'Valvetek / GALA type 600 and 1251; Watts LFFBV; Apollo 70-100','Manufacturer','Verified',null,110,true,'seed'),
('Valves','Ball valve','Body','Body material','Choice','Bronze | Bronze (gunmetal) ASTM B62 C83600 | Cast bronze ASTM B584 C89833 | Lead-free bronze','ASTM B62; ASTM B584','DCH-LM1-MHT-XXX-XXX-SPC-MEC-000003 (Section 06, DCH Icon Tower) cl. 2.4.1; Valvetek 1251; Milwaukee UPBA150; Watts LFFBV','Both','Verified','DZR brass is not in the ball-valve sources I read (it appears in your gate and globe valve clauses). Your library ball valve item says DZR brass – check which you want.',120,true,'seed'),
('Valves','Ball valve','Body','Construction','Choice','Two-piece | Screwed body cap | One-, two- and three-piece offered by some makers','MSS SP-110','DCH-LM1-MHT-XXX-XXX-SPC-MEC-000003 (Section 06, DCH Icon Tower) cl. 2.4.1; Valvetek; Milwaukee; Watts; NIBCO Press','Both','Verified',null,130,true,'seed'),
('Valves','Ball valve','Body','Port','Choice','Standard port | Full bore / full port',null,'DCH-LM1-MHT-XXX-XXX-SPC-MEC-000003 (Section 06, DCH Icon Tower) cl. 2.4.1 (standard port); Valvetek, Watts, Apollo (full port)','Both','Verified','Your DCH Icon spec asks for standard port. Check whether full port is acceptable for your projects.',140,true,'seed'),
('Valves','Ball valve','Trim','Ball material','Choice','Brass, chrome plated, machined to a perfect round | Chrome-plated ball | Brass ASTM B124 C37700 or C38800, chrome plated | Hard-chrome brass ball | 316 stainless steel ball and stem (option)','ASTM B124; ASTM A276 S31600','D1-005 Fire Protection Specifications (FPR-0001 Rev A) (ball valve); DCH-LM1-MHT-XXX-XXX-SPC-MEC-000003 (Section 06, DCH Icon Tower) cl. 2.4.1; Valvetek; Milwaukee; Apollo','Both','Verified',null,150,true,'seed'),
('Valves','Ball valve','Trim','Seat and seals','Choice','Teflon (PTFE) seat, body-bonnet gasket and gland packing | Glass-reinforced seats | PTFE seat | Glass-filled reinforced PTFE seat (15%) | Virgin PTFE seats | Options offered by one maker: UHMWPE trim, VTFE trim',null,'D1-005 Fire Protection Specifications (FPR-0001 Rev A); DCH-LM1-MHT-XXX-XXX-SPC-MEC-000003 (Section 06, DCH Icon Tower) cl. 2.4.1; Valvetek; Milwaukee; Watts; Apollo','Both','Verified',null,160,true,'seed'),
('Valves','Ball valve','Trim','Seat sealing','Rule','Gap between the ball and the Teflon packing sealed to prevent water seeping',null,'D1-005 Fire Protection Specifications (FPR-0001 Rev A) (ball valve)','Your spec','Verified',null,170,true,'seed'),
('Valves','Ball valve','Trim','Stem','Choice','Blow-out-proof stem | Brass stem ASTM B124 C38800 or B453 C35330 | 316 stainless steel stem (option)','ASTM B124; ASTM B453','DCH-LM1-MHT-XXX-XXX-SPC-MEC-000003 (Section 06, DCH Icon Tower) cl. 2.4.1; Valvetek; Milwaukee; Watts; Apollo','Both','Verified',null,180,true,'seed'),
('Valves','Ball valve','Trim','Packing and stem seal','Choice','PTFE packing | NBR O-ring | Adjustable packing gland | Graphite packing (option, one maker)',null,'Milwaukee UPBA150; Valvetek; Watts LFFBV; Apollo 70-100','Manufacturer','Verified',null,190,true,'seed'),
('Valves','Ball valve','Operation','Handle','Choice','Chrome-plated steel handle with PVC jacket, showing open and closed, with a lug limiting travel to 90° | Chrome-plated steel lever | Zinc-plated steel lever with vinyl grip | Options: stem extension, locking lever, stainless steel lever',null,'D1-005 Fire Protection Specifications (FPR-0001 Rev A) (ball valve); Valvetek; Milwaukee; Apollo','Both','Verified','Your D1-005 spec also asks that the lever works smoothly without a tool or unnecessary force.',200,true,'seed'),
('Valves','Ball valve','Connection','End connection','Choice','Threaded or sweat (solder) ends | Screwed ends | Threaded BS 21 (ISO 7) / ASME B1.20.1 / NPT | Press-to-connect (down-rated to 200 psi CWP)','BS 21; ASME B1.20.1','DCH-LM1-MHT-XXX-XXX-SPC-MEC-000003 (Section 06, DCH Icon Tower) cl. 2.4.1; D1-005 Fire Protection Specifications (FPR-0001 Rev A); Valvetek; Milwaukee; Watts; NIBCO Press System','Both','Verified',null,210,true,'seed'),
('Valves','Ball valve','Rating','Pressure rating','Choice','UL approved, minimum PN20 or higher as per site | 600 psi (41.3 bar) WOG non-shock, 150 psi saturated steam | 400 psi WOG and 125 psi WSP for 2-1/2" to 3" (Watts) | 600 psi CWP non-shock (NIBCO)',null,'DCH-LM1-MHT-XXX-XXX-SPC-MEC-000003 (Section 06, DCH Icon Tower) cl. 2.4.1; Valvetek; Milwaukee; Watts; Apollo; NIBCO','Both','Verified',null,220,true,'seed'),
('Valves','Ball valve','Rating','Test pressures (one maker)','Value','Shell 900 psi (62 bar) hydrostatic; seat 660 psi (45.5 bar) hydrostatic; 80 psi (5.5 bar) air',null,'Valvetek / GALA type 600','Manufacturer','Verified',null,230,true,'seed'),
('Valves','Ball valve','Rating','Temperature and vacuum','Value','150 psi saturated steam (two makers) | 250 °F maximum operating (NIBCO Press System) | Vacuum service to 29 inches Hg (Apollo)',null,'Valvetek; Apollo; NIBCO','Manufacturer','Verified','Batch 1 said "0–400 °F"; I could not confirm that figure.',240,true,'seed'),
('Valves','Ball valve','Standards','Design standard','Choice','MSS SP-110 | Federal Specification WW-V-35C Type II (Apollo)','MSS SP-110','Valvetek; Milwaukee; Watts; Apollo; NIBCO','Manufacturer','Verified','MSS SP-145 and BS EN 331 (Batch 1) were not found in what I read.',250,true,'seed'),
('Valves','Ball valve','Approvals','Listings and certification','Choice','UL approved | UL / FM listed for fire application | NSF/ANSI 61/8 (Watts) | Lead-free (weighted average lead ≤ 0.25%, California Health and Safety Code 116875)','NSF/ANSI 61; UL; FM','DCH-LM1-MHT-XXX-XXX-SPC-MEC-000003 (Section 06, DCH Icon Tower); D1-005 Fire Protection Specifications (FPR-0001 Rev A); Watts; Milwaukee','Both','Verified',null,260,true,'seed'),
('Valves','Ball valve','Application','Media','Choice','Water, oil, gas',null,'Valvetek','Manufacturer','Verified',null,270,true,'seed'),
('Valves','Butterfly valve','Application','Where used in your specs','Choice','Fire protection: wafer or grooved type with tamper switch | Plumbing: fully lugged type for 150 mm and above | Pump delivery isolating valve: wafer butterfly valve | Upstream of the alarm check valve: supervised butterfly valve',null,'DCH-M-MHT-SPC-IFC-FPR-0001-00 (Section 06) cl. 1.4.3; DCH-M-MHT-SPC-IFC-PLD-0001-00 (Plumbing, cl. 14) cl. 14.15; D1-005 drawing FPR-7002 (fire pump connection schematic); D1-005 Fire Protection Specifications (FPR-0001 Rev A)','Your spec','Verified',null,280,true,'seed'),
('Valves','Butterfly valve','Body','Pattern','Choice','Wafer | Lug (fully lugged, lugged and tapped) | Grooved | U-section | Long neck for insulation (AVK)',null,'DCH-M-MHT-SPC-IFC-FPR-0001-00 (Section 06); DCH-M-MHT-SPC-IFC-PLD-0001-00 (Plumbing, cl. 14); Orseal; AVK; Johnson','Both','Verified',null,290,true,'seed'),
('Valves','Butterfly valve','Body','Body material – fire (DCH)','Choice','Ductile iron, EPDM encapsulated or Nylon-11 coated','UL; FM','DCH-M-MHT-SPC-IFC-FPR-0001-00 (Section 06) cl. 1.4.3','Your spec','Verified',null,300,true,'seed'),
('Valves','Butterfly valve','Body','Body material – fire (D1-005)','Choice','Cast iron','UL; FM','D1-005 Fire Protection Specifications (FPR-0001 Rev A) (butterfly valve)','Your spec','Check','Your DCH fire spec says ductile iron, EPDM-encapsulated or Nylon-11 coated; D1-005 says cast iron. Decide which applies to which project.',310,true,'seed'),
('Valves','Butterfly valve','Body','Body material – plumbing','Choice','Fully lugged ductile or cast iron body',null,'DCH-M-MHT-SPC-IFC-PLD-0001-00 (Plumbing, cl. 14) cl. 14.15','Your spec','Verified',null,320,true,'seed'),
('Valves','Butterfly valve','Body','Body material, manufacturers','Choice','Ductile iron EN-GJS-400-15 with epoxy coating (Orseal) | Cast iron ASTM A126 Class B or ductile iron ASTM A536 65-45-12 (SW-0380) | Cast iron EN 1561 GJL 200 or ductile iron EN 1563 GJS 400-15 (Honeywell)','ASTM A126; ASTM A536; EN 1561; EN 1563','Orseal 174; SW-0380 datasheet; Honeywell V4BFWGP16','Manufacturer','Verified','Corrects Batch 1: it listed "ductile iron GG25". GG25 is a grey cast iron grade, not ductile iron.',330,true,'seed'),
('Valves','Butterfly valve','Body','Coating','Choice','Epoxy coated | 200 micron epoxy to DN400 and 250 micron polyurethane from DN450 (AVK) | EPDM encapsulated or Nylon-11 coated (your DCH fire spec) | Cast iron valves: epoxy inside and out, 300 micron DFT (your plumbing spec)',null,'DCH-M-MHT-SPC-IFC-PLD-0001-00 (Plumbing, cl. 14) cl. 14.24; DCH-M-MHT-SPC-IFC-FPR-0001-00 (Section 06); Orseal; AVK','Both','Verified',null,340,true,'seed'),
('Valves','Butterfly valve','Disc','Disc material','Choice','Stainless steel (plumbing) | Heavy-duty cast iron with nickel coating (D1-005 fire) | Stainless steel CF8M / AISI 316 | Stainless steel 304 A351 CF-8 or 316 A351 CF-8M | Ductile iron EN-JS 1040, stainless 304 or bronze CC491K (Honeywell) | Aluminium bronze or stainless (marine, Johnson)','ASTM A351','DCH-M-MHT-SPC-IFC-PLD-0001-00 (Plumbing, cl. 14) cl. 14.15; D1-005 Fire Protection Specifications (FPR-0001 Rev A); Orseal; SW-0380; Honeywell; Johnson','Both','Verified',null,350,true,'seed'),
('Valves','Butterfly valve','Stem','Stem material','Choice','Stainless steel | Stainless steel 410 A276 S41000 or 431 A276 S43100 | Stainless steel 420 (Honeywell) | Square-driven anti-blow-out shaft (AVK)','ASTM A276; EN 10088-3','DCH-M-MHT-SPC-IFC-PLD-0001-00 (Plumbing, cl. 14); D1-005 Fire Protection Specifications (FPR-0001 Rev A); SW-0380; Honeywell; AVK','Both','Verified',null,360,true,'seed'),
('Valves','Butterfly valve','Seat','Seat / liner','Choice','EPDM seat (plumbing) | Body seal and stem seal of EPDM rubber (D1-005 fire) | EPDM standard, NBR or Viton on request | EPDM / NBR / Viton liner | Loose EPDM liner for high temperature (AVK) | Bonded EPDM liner (marine, Johnson)',null,'DCH-M-MHT-SPC-IFC-PLD-0001-00 (Plumbing, cl. 14) cl. 14.15; D1-005 Fire Protection Specifications (FPR-0001 Rev A); SW-0380; Honeywell; AVK; Johnson','Both','Verified',null,370,true,'seed'),
('Valves','Butterfly valve','Seat','Bushing and O-ring','Choice','Bushing PTFE or bronze B62 C83600 | O-ring EPDM, NBR or PTFE | Honeywell: PTFE bushing, EPDM / NBR / Viton O-rings','ASTM B62','SW-0380; Honeywell','Manufacturer','Verified',null,380,true,'seed'),
('Valves','Butterfly valve','Operation','Operator','Choice','Lever operated up to 150 mm, gear operated 200 mm and above, with factory-mounted supervisory switch (D1-005 fire) | Lockable aluminium handle, 10 positions (Orseal) | Lever with locking plate (SW-0380) | Lever, gear or handwheel (Honeywell)',null,'D1-005 Fire Protection Specifications (FPR-0001 Rev A); Orseal; SW-0380; Honeywell; Johnson','Both','Verified',null,390,true,'seed'),
('Valves','Butterfly valve','Operation','Actuator interface','Value','ISO 5211 top mounting pad and square drive shaft','ISO 5211','Orseal 174; Johnson; AVK','Manufacturer','Verified',null,400,true,'seed'),
('Valves','Butterfly valve','Supervision','Tamper switch','Choice','Wafer or grooved type with tamper switch (DCH fire) | Factory-mounted in-built supervisory switch (D1-005 fire)',null,'DCH-M-MHT-SPC-IFC-FPR-0001-00 (Section 06) cl. 1.4.3; D1-005 Fire Protection Specifications (FPR-0001 Rev A)','Your spec','Verified',null,410,true,'seed'),
('Valves','Butterfly valve','Rating','Pressure rating – fire','Value','UL listed and FM approved, 200 psi minimum working pressure','UL; FM','DCH-M-MHT-SPC-IFC-FPR-0001-00 (Section 06) cl. 1.4.3','Your spec','Verified',null,420,true,'seed'),
('Valves','Butterfly valve','Rating','Pressure rating, manufacturers','Choice','PN10 / PN16 (AVK) | PN16 / PN25 at –10 to 120 °C (Honeywell) | PN16, PN25 lugged, PN10 for DN250–1200 marine (Johnson)','EN 1092','AVK 820; Honeywell; Johnson','Manufacturer','Verified',null,430,true,'seed'),
('Valves','Butterfly valve','Rating','Temperature','Value','EPDM –20 to +110 °C; NBR –10 to +80 °C (SW-0380) | Up to 130 °C with loose EPDM liner (AVK) | –20 to 120 °C (Johnson, EPDM) | –30 to 110 °C (Johnson marine)',null,'SW-0380; AVK; Johnson','Manufacturer','Verified',null,440,true,'seed'),
('Valves','Butterfly valve','Size','Size range','Value','DN40 to DN1200 (SW-0380, Johnson marine) | DN40 to DN1000 (Honeywell) | DN25 to DN1000 (AVK)',null,'SW-0380; Honeywell; AVK; Johnson','Manufacturer','Verified',null,450,true,'seed'),
('Valves','Butterfly valve','Standards','Design and dimensions','Choice','ISO 5752 / BS 5155 / BS EN 593 / MSS SP-67 / API 609 | Face-to-face EN 558-1 series 20 | EN 1092 PN10-16 and ANSI 150 positioning lugs','BS EN 593; EN 558-1; EN 1092; ISO 5211','SW-0380; Orseal; Johnson','Manufacturer','Verified',null,460,true,'seed'),
('Valves','Butterfly valve','Approvals','Approvals','Choice','UL / FM (fire) | WRAS approved (Johnson EPDM-lined types) | Lloyds, DNV, ABS, BV type approval (marine type)','UL; FM; WRAS','DCH-M-MHT-SPC-IFC-FPR-0001-00 (Section 06); Johnson','Both','Verified',null,470,true,'seed'),
('Valves','Butterfly valve','Features','Insulation neck','Yes / No','Long neck to allow pipe insulation',null,'AVK 820','Manufacturer','Verified',null,480,true,'seed'),
('Valves','Butterfly valve','Application','DCH Icon clause – heading not visible','Choice','EPDM resilient seat, EPDM seals, nickel-plated ductile iron disc; bubble-tight to 14 bar with no downstream flange or pipe attached; cap screws for removing downstream piping while the valve is used for system shut-off',null,'DCH-LM1-MHT-XXX-XXX-SPC-MEC-000003 (Section 06, DCH Icon Tower) cl. 2.4 (after the gate valve clause)','Your spec','Check','The text I read runs on from the gate valve clause with no heading. It reads like a butterfly valve clause (resilient seat, nickel-plated disc, dead-end service) but I cannot confirm it. Check the original.',490,true,'seed'),
('Valves','Gate valve','Type','Type','Choice','OS&Y (rising stem) | Non-rising stem, as indicated on the drawing | Solid wedge | Resilient wedge (manufacturer range)','UL 262','DCH-M-MHT-SPC-IFC-FPR-0001-00 (Section 06) cl. 1.4.1; DCH-LM1-MHT-XXX-XXX-SPC-MEC-000003 (Section 06, DCH Icon Tower) cl. 2.4.2; AVK; Shield; US Pipe','Both','Verified',null,500,true,'seed'),
('Valves','Gate valve','Body','Body – 50 mm and smaller','Choice','Cast bronze, bronze mounted, screwed bonnet | Cast iron hand wheel (fire) | Bronze / DZR brass, threaded ends (plumbing)','UL 262','DCH-M-MHT-SPC-IFC-FPR-0001-00 (Section 06) cl. 1.4.1; DCH-LM1-MHT-XXX-XXX-SPC-MEC-000003 (Section 06, DCH Icon Tower) cl. 2.4.2; DCH-M-MHT-SPC-IFC-PLD-0001-00 (Plumbing, cl. 14) cl. 14.15','Your spec','Verified',null,510,true,'seed'),
('Valves','Gate valve','Body','Body – 65 mm and larger','Choice','Cast iron, bronze mounted, bolted bonnet, flanged | Flanged cast iron body with bronze / gunmetal spindle, wall seat and wedge nuts (D1-005)','UL 262; FM','DCH-M-MHT-SPC-IFC-FPR-0001-00 (Section 06) cl. 1.4.1; DCH-LM1-MHT-XXX-XXX-SPC-MEC-000003 (Section 06, DCH Icon Tower) cl. 2.4.2; D1-005 Fire Protection Specifications (FPR-0001 Rev A)','Your spec','Verified',null,520,true,'seed'),
('Valves','Gate valve','Body','Body, manufacturers','Choice','Ductile iron (AVK, ASC) | Cast iron (Shield, US Pipe) | Bronze OS&Y 1/2" to 2" (TPMC)','AWWA C515','AVK 45/56-001; ASC 35FW; Shield; US Pipe; TPMC','Manufacturer','Verified',null,530,true,'seed'),
('Valves','Gate valve','Trim','Wedge','Choice','Solid wedge | Wedge fully vulcanised with drinking-water EPDM (AVK) | EPDM-encapsulated ductile iron wedge (US Pipe)',null,'DCH-LM1-MHT-XXX-XXX-SPC-MEC-000003 (Section 06, DCH Icon Tower) cl. 2.4.2; AVK; US Pipe','Both','Verified',null,540,true,'seed'),
('Valves','Gate valve','Trim','Stem','Choice','Rising stem | Copper alloy DN50–250, aluminium bronze above (AVK) | 304 stainless steel (ASC) | Stainless 304, 316 or 431, or low-zinc silicon bronze (US Pipe options)',null,'DCH-LM1-MHT-XXX-XXX-SPC-MEC-000003 (Section 06, DCH Icon Tower) cl. 2.4.2; AVK; ASC; US Pipe','Both','Verified',null,550,true,'seed'),
('Valves','Gate valve','Coating','Coating','Choice','Fusion-bonded epoxy to DIN 3476 part 1 and EN 14901 (AVK) | Fusion-bonded epoxy to ANSI/AWWA C550 (Shield, ASC, US Pipe)','AWWA C550; DIN 3476; EN 14901','AVK; Shield; ASC; US Pipe','Manufacturer','Verified',null,560,true,'seed'),
('Valves','Gate valve','Connection','End connection','Choice','Threaded up to 2 inch | Flanged | Flanged to PN10/16 drilling (AVK) | ASME B16.1 Class 125 or ASME B16.42 Class 150 (Shield, US Pipe)','ASME B16.1; ASME B16.42','DCH-M-MHT-SPC-IFC-FPR-0001-00 (Section 06) cl. 1.4.1; AVK; Shield; US Pipe','Both','Verified',null,570,true,'seed'),
('Valves','Gate valve','Rating','Pressure rating','Choice','UL listed and rated 200 psi working pressure (50 mm and below, fire) | UL / FM 200 psi minimum (65 mm and above, fire) | 1,400 kPa (14 bar) (DCH Icon) | 175, 250 or 300 psi (manufacturer ranges)','UL 262','DCH-M-MHT-SPC-IFC-FPR-0001-00 (Section 06) cl. 1.4.1; DCH-LM1-MHT-XXX-XXX-SPC-MEC-000003 (Section 06, DCH Icon Tower) cl. 2.4.2; Shield; ASC; US Pipe; AVK','Both','Verified','Your DCH fire spec says use non-UL-listed valves where pressure exceeds the UL listing range.',580,true,'seed'),
('Valves','Gate valve','Rating','Maximum temperature','Value','70 °C for fire service (AVK) | 63 °C for the 250 psi cold-water rating (Shield)',null,'AVK; Shield','Manufacturer','Verified',null,590,true,'seed'),
('Valves','Gate valve','Approvals','Listings','Choice','UL 262 | FM 1120/1130 | FM Fire Service Water Control Valves | AWWA C515 | NSF/ANSI 61 and 372 (lead-free option)','UL 262; AWWA C515','FIRE spec; Shield; US Pipe; ASC; AVK','Both','Verified',null,600,true,'seed'),
('Valves','Gate valve','Supervision','Tamper switch','Choice','Normally open supervisory / tamper switch with double wire leads on gate valves (DCH Icon) | Grooved stem for tamper switch (ASC)',null,'DCH-LM1-MHT-XXX-XXX-SPC-MEC-000003 (Section 06, DCH Icon Tower) cl. 2.4.2; ASC 35FW','Both','Verified',null,610,true,'seed'),
('Valves','Gate valve','Application','Fire pump connection','Rule','All gate valves OS&Y type; pump suction OS&Y gate valve, cast iron flanged',null,'D1-005 drawing FPR-7002 (fire pump connection schematic)','Your spec','Verified',null,620,true,'seed'),
('Valves','Gate valve','Application','Plumbing gate valve – 65 mm and larger','Choice','Wording in the text I read: "shall be butterfly valve type with flanged cast iron body, non-rising stem, bronze trim wedge disc type complete with hand wheels, bolted bonnet and stuffing box"',null,'DCH-M-MHT-SPC-IFC-PLD-0001-00 (Plumbing, cl. 14) cl. 14.15; DCH-LM1-MHT-XXX-XXX-SPC-MEC-000002 (Plumbing, cl. 15) cl. 15.15','Your spec','Check','The clause mixes butterfly-valve and wedge-gate wording. Check what was intended before it goes into the library.',630,true,'seed'),
('Valves','Check valve (non-return)','Type','Pattern','Choice','Swing | Split clapper | Spring-loaded wafer or globe type | Flanged or grooved ends | Double door (manufacturer range)','UL 312; FM 1210','DCH-M-MHT-SPC-IFC-FPR-0001-00 (Section 06) cl. 1.4.2; DCH-LM1-MHT-XXX-XXX-SPC-MEC-000003 (Section 06, DCH Icon Tower) cl. 2.4.4; Weflo','Both','Verified',null,640,true,'seed'),
('Valves','Check valve (non-return)','Body','Body – fire (DCH, flanged / grooved)','Choice','Cast iron body, UL listed and FM approved, 200 psi minimum','UL; FM','DCH-M-MHT-SPC-IFC-FPR-0001-00 (Section 06) cl. 1.4.2','Your spec','Verified',null,650,true,'seed'),
('Valves','Check valve (non-return)','Body','Body – 50 mm and smaller (spring-loaded)','Choice','Bronze body, threaded ends, bronze trim, stainless steel spring, stainless steel centre guide pin, Teflon seat (14 bar) unless only bronze is available',null,'DCH-LM1-MHT-XXX-XXX-SPC-MEC-000003 (Section 06, DCH Icon Tower) cl. 2.4.4','Your spec','Verified',null,660,true,'seed'),
('Valves','Check valve (non-return)','Body','Body – 65 mm and larger (spring-loaded)','Choice','Cast or ductile iron body, wafer or globe type, bronze trim, bronze or EPDM seat, stainless steel spring, stainless steel stem if required, 16 bar',null,'DCH-LM1-MHT-XXX-XXX-SPC-MEC-000003 (Section 06, DCH Icon Tower) cl. 2.4.4','Your spec','Verified',null,670,true,'seed'),
('Valves','Check valve (non-return)','Body','D1-005 – 50 mm and below','Choice','Bronze body, resilient seat, screwed ends; arrow showing flow direction; bronze seat; clapper, spring, hinge pin and locknut of stainless steel; facing seal and gasket of EPDM','UL; FM','D1-005 Fire Protection Specifications (FPR-0001 Rev A) (non-return valve ≤ 50 mm)','Your spec','Verified',null,680,true,'seed'),
('Valves','Check valve (non-return)','Body','D1-005 – 65 mm and above','Choice','Flanged; cast iron body; bronze seat; clapper, spring, hinge pin and locknut of stainless steel; facing seal and gasket of EPDM','UL; FM','D1-005 Fire Protection Specifications (FPR-0001 Rev A) (non-return valve ≥ 65 mm)','Your spec','Verified',null,690,true,'seed'),
('Valves','Check valve (non-return)','Body','Plumbing – up to 50 mm','Choice','Threaded bronze pattern swing type with renewable disc and screw-in cap',null,'DCH-M-MHT-SPC-IFC-PLD-0001-00 (Plumbing, cl. 14) cl. 14.16','Your spec','Verified',null,700,true,'seed'),
('Valves','Check valve (non-return)','Body','Plumbing – 65 mm and above','Choice','Flanged cast iron swing type with renewable seat and disc components',null,'DCH-M-MHT-SPC-IFC-PLD-0001-00 (Plumbing, cl. 14) cl. 14.16','Your spec','Verified',null,710,true,'seed'),
('Valves','Check valve (non-return)','Body','Pump delivery','Choice','Non-return valve, cast iron, flanged',null,'D1-005 drawing FPR-7002 (fire pump connection schematic)','Your spec','Verified',null,720,true,'seed'),
('Valves','Check valve (non-return)','Trim','Seat and disc, manufacturers','Choice','Renewable rubber disc with bronze seat ring (NIBCO F-908-W, Mueller A-2122) | Bronze-to-bronze or stainless steel seat (Kennedy 1126) | Resilient seat with bronze or stainless steel seat ring (Kennedy 1126A) | Resilient seated, full waterway (Weflo)',null,'NIBCO F-908-W; Mueller; Kennedy; Weflo','Manufacturer','Verified',null,730,true,'seed'),
('Valves','Check valve (non-return)','Rating','Pressure rating','Choice','200 psi UL / FM minimum (fire) | 14 bar (small spring-loaded) | 16 bar (large spring-loaded) | 175 psi (NIBCO, Kennedy) | 350 psi for 2"–12" and 250 psi for 14"–16" (Mueller) | 175 or 300 psi double door (Weflo)','UL; FM','DCH-M-MHT-SPC-IFC-FPR-0001-00 (Section 06); DCH-LM1-MHT-XXX-XXX-SPC-MEC-000003 (Section 06, DCH Icon Tower); NIBCO; Kennedy; Mueller; Weflo','Both','Verified',null,740,true,'seed'),
('Valves','Check valve (non-return)','Standards','Standards and listings','Choice','UL 312 / FM 1210 (fire service check valves) | AWWA C508 swing check valves | API 584 (double door) | ANSI B16.1 Class 125 flanges | Fusion-bonded epoxy to AWWA C550','UL 312; FM 1210; AWWA C508; AWWA C550','Weflo; Mueller','Manufacturer','Verified','UL 312 and FM 1210 are quoted by Weflo, not by your specs.',750,true,'seed'),
('Valves','Check valve (non-return)','Features','Test and drain tappings','Choice','Tapped 3/4 inch for ball drip assembly (NIBCO) | Tapped for gauges at up to six locations (Kennedy)',null,'NIBCO F-908-W; Kennedy 1126','Manufacturer','Verified',null,760,true,'seed'),
('Valves','Check valve (non-return)','Limit','Potable water','Rule','NIBCO F-908-W: use in U.S. drinking water applications is prohibited after January 3, 2014',null,'NIBCO F-908-W','Manufacturer','Verified',null,770,true,'seed'),
('Valves','Alarm valve','Body','Alarm check valve','Choice','Check-type valve with divided seat ring, rubber-faced clapper to actuate the water motor alarm, pressure retard chamber and variable-pressure trim',null,'D1-005 Fire Protection Specifications (FPR-0001 Rev A) (alarm check valve assembly)','Your spec','Verified',null,780,true,'seed'),
('Valves','Alarm valve','Trim','Capabilities','Choice','Electric alarm | Test and drain valve | Replaceable internal components without removing the valve from its position',null,'D1-005 Fire Protection Specifications (FPR-0001 Rev A)','Your spec','Verified',null,790,true,'seed'),
('Valves','Alarm valve','Assembly','Valve assembly','Choice','Supervised butterfly valve upstream | Pressure gauges upstream and downstream | Pressure switch | Retarding device where needed to avoid false alarms',null,'D1-005 Fire Protection Specifications (FPR-0001 Rev A)','Your spec','Verified',null,800,true,'seed'),
('Valves','Alarm valve','Assembly','Control valve assembly (zone / floor)','Choice','Pressure gauge in each assembly | Test connection with sight glass and a smooth-bore orifice equal to one sprinkler | Sectional drain valve: minimum 32 mm below 100 mm pipe, 50 mm at 100 mm and above | Non-return valve | Isolation valves of the same type throughout',null,'D1-005 Fire Protection Specifications (FPR-0001 Rev A)','Your spec','Verified',null,810,true,'seed'),
('Valves','Alarm valve','Trim','Water flow alarm','Choice','Water motor alarm and gong; pressure switch on a vertical branch at least 300 mm long, diaphragm bellows or bourdon type, sensitive to one sprinkler, with volt-free contacts',null,'D1-005 Fire Protection Specifications (FPR-0001 Rev A); DCH-M-MHT-SPC-IFC-FPR-0001-00 (Section 06) cl. 2.2','Your spec','Verified',null,820,true,'seed'),
('Valves','Pre-action / deluge valve','System','Interlock type','Choice','Single interlock, electric release (D1-005) | Double interlock, electric-pneumatic release (DCH Icon)','NFPA 13','D1-005 Fire Protection Specifications (FPR-0001 Rev A); DCH-LM1-MHT-XXX-XXX-SPC-MEC-000003 (Section 06, DCH Icon Tower) cl. 4.4','Your spec','Check','Your two specs differ. The library default for pre-action is double interlock.',830,true,'seed'),
('Valves','Pre-action / deluge valve','Body','Deluge valve and trim','Choice','Deluge valve complete with Schedule 40 galvanised steel trim rated 250 psi | Release trim with solenoid valves and pneumatic actuator | Rubber-seated check valve downstream of the deluge valve, before the supervisory air connection','UL; FM','DCH-LM1-MHT-XXX-XXX-SPC-MEC-000003 (Section 06, DCH Icon Tower) cl. 4.4','Your spec','Verified',null,840,true,'seed'),
('Valves','Pre-action / deluge valve','Release','Release and latching','Choice','Operated by a detection system listed for releasing service, independent of the building fire alarm | Local, manual and remote release | Mechanical latching of valve clappers independent of pressure fluctuations | Test detection device for each actuation circuit','NFPA 13','D1-005 Fire Protection Specifications (FPR-0001 Rev A)','Your spec','Verified',null,850,true,'seed'),
('Valves','Breeching inlet (fire department connection)','Body','Inlet connection','Choice','4-way head, four 63 mm male instantaneous inlets to BS 336, with built-in gunmetal check valve; 150 mm flange outlet; tested to 21 bar; 2-way inlets where indicated','BS 5041; BS 336','D1-005 Fire Protection Specifications (FPR-0001 Rev A) (breeching inlet connection)','Your spec','Verified',null,860,true,'seed'),
('Valves','Breeching inlet (fire department connection)','Body','Drain and enclosure','Choice','1 inch drain by a brass-body gate valve built into the assembly | Stainless steel box suitable for external weather, as detailed on the drawing',null,'D1-005 Fire Protection Specifications (FPR-0001 Rev A)','Your spec','Verified',null,870,true,'seed'),
('Valves','Pressure reducing valve','Type','Fire – class and body','Choice','Class 150 / 250 / 300; cast iron or cast steel body; externally site adjustable; stainless steel disc seat or main piston',null,'DCH-M-MHT-SPC-IFC-FPR-0001-00 (Section 06) cl. 1.4.4','Your spec','Verified',null,880,true,'seed'),
('Valves','Pressure reducing valve','Type','Plumbing – operation','Choice','Pilot-controlled, hydraulically operated, diaphragm type with low by-pass capability from a balanced direct-acting PRV built into the main valve, to prevent cavitation at very low flow',null,'DCH-M-MHT-SPC-IFC-PLD-0001-00 (Plumbing, cl. 14) cl. 14.17','Your spec','Verified',null,890,true,'seed'),
('Valves','Pressure reducing valve','Body','Up to 50 mm','Choice','PN 16, ASSE 1003; bronze body, stainless steel internal parts, fabric-reinforced diaphragm, strainer, threaded single-union ends','ASSE 1003','21 3000 BSD – Fire Pumps (master) cl. 2.1.A.13','Your spec','Verified',null,900,true,'seed'),
('Valves','Pressure reducing valve','Body','Over 50 mm','Choice','PN 16 ductile iron body (100 °C), ASSE 1003; lining to AWWA C550; bronze fitted; elastomeric diaphragm and seat disc; flanged','ASSE 1003; AWWA C550','21 3000 BSD – Fire Pumps (master) cl. 2.1.A.13','Your spec','Verified',null,910,true,'seed'),
('Valves','Globe valve','Body','Up to 50 mm','Choice','Threaded ends; bronze / DZR brass body and trim; renewable dynamic disc; screwed bonnet suitable for re-packing under pressure',null,'DCH-M-MHT-SPC-IFC-PLD-0001-00 (Plumbing, cl. 14) cl. 14.14','Your spec','Verified',null,920,true,'seed'),
('Valves','Globe valve','Body','65 mm and larger','Choice','Cast iron body; bronze trim; flanged ends; outside screw; renewable seat and disc',null,'DCH-M-MHT-SPC-IFC-PLD-0001-00 (Plumbing, cl. 14) cl. 14.14','Your spec','Verified',null,930,true,'seed')
on conflict (item, component, attribute) do update set family=excluded.family, type=excluded.type, options=excluded.options, standards=excluded.standards, source=excluded.source, kind=excluded.kind, status=excluded.status, notes=excluded.notes, sort=excluded.sort, active=true, updated_by='seed';
commit;
select item, count(*) as attributes, count(*) filter (where status='Check') as to_check from public.spec_item_attrs where family='Valves' group by item order by item;

spec_attrs.js
Upload to GitHub next to spec.html.

CopyDownload
/* spec_attrs.js — MEP Specifications: Item attributes viewer (v1.0)
   Adds a "Item attributes" button on the Library screens. Shows the attribute catalogue
   (the choices that change an item's specification: materials, ratings, seats, approvals…)
   with the source of every row. Read-only for now. Needs spec_item_attrs_schema.sql.
   If anything fails the page works exactly as before. */
(function () {
  'use strict';
  const h = React.createElement;
  const G = n => { try { return (0, eval)(n); } catch (e) { return undefined; } };
  let ROWS = [], LOADED = false, ERR = '';

  async function load() {
    try {
      const r = await sb.from('spec_item_attrs').select('*').order('sort').range(0, 19999);
      if (r.error) { ERR = r.error.message; ROWS = []; LOADED = false; return; }
      ROWS = (r.data || []).filter(x => x.active !== false); LOADED = true; ERR = '';
    } catch (e) { ERR = String((e && e.message) || e); LOADED = false; }
  }
  const opts = s => String(s || '').split(' | ').map(x => x.trim()).filter(Boolean);
  const chipStyle = k => ({display:'inline-block', fontSize:9, fontWeight:800, borderRadius:999, padding:'2px 8px',
    background:k === 'Verified' ? '#e8faf0' : k === 'Check' ? '#fff4e0' : '#f1f1f3', color:k === 'Verified' ? '#208a45' : k === 'Check' ? '#a76200' : '#6e6e73'});
  const kindStyle = k => ({display:'inline-block', fontSize:9, fontWeight:700, borderRadius:6, padding:'2px 6px',
    background:k === 'Your spec' ? '#e8f0fe' : k === 'Manufacturer' ? '#f1f1f3' : '#eef7ee', color:k === 'Your spec' ? '#1559a6' : k === 'Manufacturer' ? '#555' : '#2f6b3a'});

  function csv(rows) {
    const F = ['family', 'item', 'component', 'attribute', 'type', 'options', 'standards', 'source', 'kind', 'status', 'notes'];
    const t = [F.join(',')].concat(rows.map(r => F.map(k => '"' + String(r[k] ?? '').replace(/"/g, '""') + '"').join(','))).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + t], {type:'text/csv'})); a.download = 'item_attributes.csv';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function Viewer(props) {
    const {useState, useEffect, useMemo} = React;
    const [ver, setVer] = useState(0), [item, setItem] = useState(''), [kind, setKind] = useState(''), [st, setSt] = useState(''), [q, setQ] = useState(''), [busy, setBusy] = useState(true), [open, setOpen] = useState({});
    useEffect(() => { let c = false; load().then(() => { if (!c) { setBusy(false); setVer(x => x + 1); } }); return () => { c = true; }; }, []);
    const items = useMemo(() => [...new Set(ROWS.map(r => r.item))], [ver]);
    const rows = useMemo(() => ROWS.filter(r => (!item || r.item === item) && (!kind || r.kind === kind) && (!st || r.status === st) &&
      (!q || [r.item, r.component, r.attribute, r.options, r.standards, r.source, r.notes].join(' ').toLowerCase().includes(q.toLowerCase()))), [ver, item, kind, st, q]);
    const groups = useMemo(() => { const g = {}; rows.forEach(r => { (g[r.item] = g[r.item] || []).push(r); }); return g; }, [rows]);
    const nCheck = ROWS.filter(r => r.status === 'Check').length;
    const btn = {padding:'6px 12px', background:'#fff', color:'#424245', border:'1px solid #d2d2d7', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer'};
    const card = (l, v, n, k) => h('div', {className:'health-card ' + (k || 'capacity'), style:{cursor:'default'}}, h('div', {className:'h-label'}, l), h('div', {className:'h-value'}, v), h('div', {className:'h-note'}, n));
    return h('div', {className:'global-page', style:{minHeight:'100vh', background:'#f5f5f7'}},
      h('div', {className:'app-header'}, h('div', {style:{maxWidth:1400, margin:'0 auto', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12}},
        h('div', null, h('div', {style:{fontSize:9, letterSpacing:'.15em', textTransform:'uppercase', color:'#86868b', fontWeight:800}}, 'MEP Specifications'), h('div', {style:{fontSize:19, fontWeight:800, letterSpacing:'-.03em'}}, 'Item attributes')),
        h('div', {style:{display:'flex', gap:8}}, h('button', {onClick:props.onLibrary, style:btn}, '📚 Library'), h('button', {onClick:props.onBack, style:btn}, '← All projects')))),
      h('div', {style:{maxWidth:1400, margin:'0 auto', padding:'16px 20px'}},
        busy ? h('div', {className:'piw-empty big'}, 'Loading attributes…') :
        !LOADED ? h('div', {className:'ai-msg bad'}, 'Item attributes are not set up yet' + (ERR ? ' (' + ERR + ')' : '') + '. Run spec_item_attrs_schema.sql, then spec_item_attrs_seed_valves.sql, in Supabase › SQL Editor.') :
        h('div', null,
          h('div', {className:'schedule-health', style:{marginBottom:10}},
            card('Attributes', ROWS.length, `${items.length} item groups`),
            card('Verified', ROWS.length - nCheck, 'text read in the cited source', 'pass'),
            card('To check', nCheck, 'conflicting or unclear – decide first', nCheck ? 'review' : 'pass'),
            card('From your specs', ROWS.filter(r => r.kind !== 'Manufacturer').length, 'your own specifications'),
            card('Manufacturer data', ROWS.filter(r => r.kind !== 'Your spec').length, 'reference only, per product')),
          h('div', {className:'schedule-card'},
            h('div', {className:'schedule-toolbar'},
              h('input', {value:q, onChange:e => setQ(e.target.value), placeholder:'Search attribute, option, standard, source…'}),
              h('select', {value:item, onChange:e => setItem(e.target.value)}, h('option', {value:''}, 'All items'), items.map(i => h('option', {key:i}, i))),
              h('select', {value:kind, onChange:e => setKind(e.target.value)}, h('option', {value:''}, 'Any source'), h('option', null, 'Your spec'), h('option', null, 'Manufacturer'), h('option', null, 'Both')),
              h('select', {value:st, onChange:e => setSt(e.target.value)}, h('option', {value:''}, 'Any status'), h('option', null, 'Verified'), h('option', null, 'Check')),
              h('span', {className:'toolbar-spacer'}),
              h('button', {className:'schedule-action', onClick:() => setOpen(Object.fromEntries(Object.keys(groups).map(k => [k, true])))}, 'Expand all'),
              h('button', {className:'schedule-action', onClick:() => setOpen({})}, 'Collapse all'),
              h('button', {className:'schedule-action', onClick:() => csv(rows)}, '↧ CSV')),
            h('div', {style:{maxHeight:'calc(100vh - 330px)', overflow:'auto'}},
              Object.keys(groups).length === 0 ? h('div', {className:'empty-schedule'}, 'No attributes match.') :
              Object.entries(groups).map(([name, list]) => {
                const isOpen = open[name] !== undefined ? open[name] : (item || q ? true : false), nc = list.filter(r => r.status === 'Check').length;
                return h('div', {key:name, style:{borderBottom:'1px solid #e8e8ed'}},
                  h('div', {onClick:() => setOpen({...open, [name]:!isOpen}), style:{display:'flex', alignItems:'center', gap:10, padding:'10px 14px', cursor:'pointer', background:isOpen ? '#f5f9ff' : '#fff'}},
                    h('span', {style:{width:14, fontSize:11, color:'#86868b'}}, isOpen ? '▾' : '▸'), h('b', {style:{fontSize:13, flex:1}}, name),
                    h('span', {style:{fontSize:10, color:'#86868b'}}, list.length + ' attributes'), nc ? h('span', {style:chipStyle('Check')}, nc + ' to check') : null),
                  isOpen && h('table', {className:'schedule-table', style:{minWidth:900, tableLayout:'auto'}},
                    h('thead', null, h('tr', {className:'labels'}, ['Component', 'Attribute', 'Options / values', 'Standards', 'Where read', 'Status'].map((x, i) => h('th', {key:i}, x)))),
                    h('tbody', null, list.map(r => h('tr', {key:r.id, style:{cursor:'default'}},
                      h('td', {style:{fontSize:10.5, whiteSpace:'nowrap'}}, r.component),
                      h('td', {style:{fontWeight:700, minWidth:150}}, r.attribute, r.type ? h('div', {style:{fontSize:9, color:'#86868b', fontWeight:500}}, r.type) : null),
                      h('td', {style:{minWidth:380, whiteSpace:'normal'}}, h('ul', {style:{margin:0, paddingLeft:16}}, opts(r.options).map((o, i) => h('li', {key:i, style:{marginBottom:2, fontSize:11}}, o))),
                        r.notes ? h('div', {style:{marginTop:4, fontSize:10, color:r.status === 'Check' ? '#a76200' : '#6e6e73', background:r.status === 'Check' ? '#fff4e0' : '#f5f5f7', borderRadius:6, padding:'4px 7px'}}, r.notes) : null),
                      h('td', {style:{fontSize:10, maxWidth:150, whiteSpace:'normal'}}, r.standards),
                      h('td', {style:{fontSize:10, maxWidth:260, whiteSpace:'normal'}}, h('span', {style:kindStyle(r.kind)}, r.kind), h('div', {style:{marginTop:3}}, r.source)),
                      h('td', null, h('span', {style:chipStyle(r.status)}, r.status))))))); })),
            h('div', {style:{padding:'8px 12px', fontSize:10, color:'#86868b'}}, `${rows.length} of ${ROWS.length} attributes shown · read-only · Verified = the cited source says this; Check = conflicting or unclear, decide before use · manufacturer rows describe that product only`)))));
  }

  function install() {
    if (window.SPEC_ATTRS && window.SPEC_ATTRS.installed) return;
    const Prev = G('LibraryAdmin');
    function LibraryWithAttrs(props) {
      const [mode, setMode] = React.useState('lib');
      if (mode === 'attrs') return h(Viewer, {onBack:props.onBack, onLibrary:() => setMode('lib')});
      return h('div', null,
        h('div', {className:'no-print', style:{position:'fixed', top:14, left:'calc(50% - 168px)', zIndex:60}},
          h('button', {onClick:() => setMode('attrs'), style:{padding:'6px 14px', background:'#6d3fd6', color:'#fff', border:0, borderRadius:999, fontSize:11, fontWeight:800, cursor:'pointer', boxShadow:'0 2px 8px rgba(109,63,214,.35)', whiteSpace:'nowrap'}}, '☰ Item attributes')),
        h(Prev, props));
    }
    window.__specAttrsWrap = LibraryWithAttrs;
    (0, eval)('LibraryAdmin = window.__specAttrsWrap');
    window.SPEC_ATTRS = {installed:true, version:'1.0'};
    console.info('spec_attrs 1.0 installed');
  }
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    let ok = false;
    try { ok = typeof G('LibraryAdmin') === 'function' && typeof sb !== 'undefined' && !!window.React && (!!window.SPEC_ITEMS_V2 || tries > 400); } catch (e) { ok = false; }
    if (ok) { clearInterval(t); try { install(); } catch (e) { console.error('spec_attrs: install failed – page runs without it', e); } }
    else if (tries > 3000) clearInterval(t);
  }, 10);
})();

