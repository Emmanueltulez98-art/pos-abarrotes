-- =========================================================
-- Punto de Venta Abarrotes · Esquema de base de datos
-- Copia TODO este archivo, pégalo en Supabase > SQL Editor y da "Run".
-- =========================================================

-- ---------- Tablas ----------

-- Cada tienda pertenece a un usuario (dueño)
create table public.tiendas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  creado timestamptz not null default now()
);

-- Catálogo de productos de cada tienda
create table public.productos (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas(id) on delete cascade,
  codigo text,
  nombre text not null,
  categoria text,
  unidad text not null default 'pieza' check (unidad in ('pieza', 'kg')),
  precio numeric(10,2) not null check (precio > 0),
  existencia numeric(12,3) not null default 0,
  minimo numeric(12,3) not null default 0,
  demo boolean not null default false,
  creado timestamptz not null default now(),
  actualizado timestamptz
);

-- No se puede repetir un código de barras dentro de la misma tienda
create unique index productos_codigo_unico
  on public.productos (tienda_id, codigo)
  where codigo is not null and codigo <> '';

-- Encabezado de cada venta (ticket)
create table public.ventas (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas(id) on delete cascade,
  folio int not null,
  fecha timestamptz not null default now(),
  total numeric(10,2) not null,
  metodo_pago text not null default 'efectivo',
  pago numeric(10,2) not null,
  cambio numeric(10,2) not null,
  demo boolean not null default false,
  unique (tienda_id, folio)
);

create index ventas_tienda_fecha on public.ventas (tienda_id, fecha desc);

-- Productos dentro de cada venta
create table public.venta_partidas (
  id bigint generated always as identity primary key,
  venta_id uuid not null references public.ventas(id) on delete cascade,
  producto_id uuid references public.productos(id) on delete set null,
  nombre text not null,
  unidad text not null,
  precio numeric(10,2) not null,
  cantidad numeric(12,3) not null,
  importe numeric(10,2) not null
);

create index venta_partidas_venta on public.venta_partidas (venta_id);

-- ---------- Seguridad: cada usuario solo ve SU tienda ----------

create or replace function public.es_mi_tienda(t uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.tiendas where id = t and owner_id = auth.uid())
$$;

alter table public.tiendas enable row level security;
alter table public.productos enable row level security;
alter table public.ventas enable row level security;
alter table public.venta_partidas enable row level security;

create policy "Mis tiendas" on public.tiendas
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "Productos de mi tienda" on public.productos
  for all using (public.es_mi_tienda(tienda_id)) with check (public.es_mi_tienda(tienda_id));

create policy "Ventas de mi tienda" on public.ventas
  for all using (public.es_mi_tienda(tienda_id)) with check (public.es_mi_tienda(tienda_id));

create policy "Partidas de mi tienda" on public.venta_partidas
  for all
  using (exists (select 1 from public.ventas v where v.id = venta_id and public.es_mi_tienda(v.tienda_id)))
  with check (exists (select 1 from public.ventas v where v.id = venta_id and public.es_mi_tienda(v.tienda_id)));

-- ---------- Registrar una venta (todo o nada) ----------
-- Guarda la venta, sus partidas y descuenta el inventario en una sola operación.
-- Si algo falla, no se guarda nada (así nunca queda una venta a medias).

create or replace function public.registrar_venta(p_tienda uuid, p_partidas jsonb, p_pago numeric)
returns public.ventas
language plpgsql security invoker set search_path = public
as $$
declare
  v_venta public.ventas;
  v_total numeric;
  v_folio int;
begin
  if not public.es_mi_tienda(p_tienda) then
    raise exception 'No tienes acceso a esta tienda';
  end if;

  select coalesce(sum((x->>'importe')::numeric), 0) into v_total
  from jsonb_array_elements(p_partidas) x;

  if jsonb_array_length(p_partidas) = 0 then
    raise exception 'La venta no tiene productos';
  end if;
  if p_pago < v_total then
    raise exception 'El pago no cubre el total';
  end if;

  -- Evita que dos cajas tomen el mismo folio al mismo tiempo
  perform pg_advisory_xact_lock(hashtext(p_tienda::text));
  select coalesce(max(folio), 0) + 1 into v_folio from public.ventas where tienda_id = p_tienda;

  insert into public.ventas (tienda_id, folio, total, pago, cambio)
  values (p_tienda, v_folio, v_total, p_pago, p_pago - v_total)
  returning * into v_venta;

  insert into public.venta_partidas (venta_id, producto_id, nombre, unidad, precio, cantidad, importe)
  select v_venta.id,
         (x->>'productoId')::uuid,
         x->>'nombre',
         x->>'unidad',
         (x->>'precio')::numeric,
         (x->>'cantidad')::numeric,
         (x->>'importe')::numeric
  from jsonb_array_elements(p_partidas) x;

  update public.productos p
  set existencia = p.existencia - s.cantidad,
      actualizado = now()
  from (
    select (x->>'productoId')::uuid as producto_id, sum((x->>'cantidad')::numeric) as cantidad
    from jsonb_array_elements(p_partidas) x
    group by 1
  ) s
  where p.id = s.producto_id and p.tienda_id = p_tienda;

  return v_venta;
end;
$$;
