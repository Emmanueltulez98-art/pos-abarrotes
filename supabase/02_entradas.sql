-- =========================================================
-- Punto de Venta Abarrotes · Entradas de mercancía
-- Copia TODO este archivo, pégalo en Supabase > SQL Editor > New query y da "Run".
-- =========================================================

-- Último costo de compra de cada producto (para calcular ganancias más adelante)
alter table public.productos add column if not exists costo numeric(10,2);

-- Encabezado de cada entrada (lo que llegó en un pedido)
create table public.entradas (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas(id) on delete cascade,
  folio int not null,
  fecha timestamptz not null default now(),
  proveedor text,
  notas text,
  total numeric(12,2) not null default 0,
  unique (tienda_id, folio)
);

create index entradas_tienda_fecha on public.entradas (tienda_id, fecha desc);

-- Productos dentro de cada entrada
create table public.entrada_partidas (
  id bigint generated always as identity primary key,
  entrada_id uuid not null references public.entradas(id) on delete cascade,
  producto_id uuid references public.productos(id) on delete set null,
  nombre text not null,
  unidad text not null,
  cantidad numeric(12,3) not null check (cantidad > 0),
  costo numeric(10,2),
  importe numeric(12,2)
);

create index entrada_partidas_entrada on public.entrada_partidas (entrada_id);

-- Seguridad: cada usuario solo ve las entradas de su tienda
alter table public.entradas enable row level security;
alter table public.entrada_partidas enable row level security;

create policy "Entradas de mi tienda" on public.entradas
  for all using (public.es_mi_tienda(tienda_id)) with check (public.es_mi_tienda(tienda_id));

create policy "Partidas de entradas de mi tienda" on public.entrada_partidas
  for all
  using (exists (select 1 from public.entradas e where e.id = entrada_id and public.es_mi_tienda(e.tienda_id)))
  with check (exists (select 1 from public.entradas e where e.id = entrada_id and public.es_mi_tienda(e.tienda_id)));

-- Registrar una entrada (todo o nada): guarda la entrada, sus partidas,
-- SUMA las existencias y actualiza el último costo de cada producto.
create or replace function public.registrar_entrada(
  p_tienda uuid,
  p_proveedor text,
  p_notas text,
  p_partidas jsonb
)
returns public.entradas
language plpgsql security invoker set search_path = public
as $$
declare
  v_entrada public.entradas;
  v_folio int;
begin
  if not public.es_mi_tienda(p_tienda) then
    raise exception 'No tienes acceso a esta tienda';
  end if;
  if jsonb_array_length(p_partidas) = 0 then
    raise exception 'La entrada no tiene productos';
  end if;

  perform pg_advisory_xact_lock(hashtext('entradas' || p_tienda::text));
  select coalesce(max(folio), 0) + 1 into v_folio from public.entradas where tienda_id = p_tienda;

  insert into public.entradas (tienda_id, folio, proveedor, notas, total)
  select p_tienda, v_folio, nullif(trim(p_proveedor), ''), nullif(trim(p_notas), ''),
         coalesce(sum((x->>'importe')::numeric), 0)
  from jsonb_array_elements(p_partidas) x
  returning * into v_entrada;

  insert into public.entrada_partidas (entrada_id, producto_id, nombre, unidad, cantidad, costo, importe)
  select v_entrada.id,
         (x->>'productoId')::uuid,
         x->>'nombre',
         x->>'unidad',
         (x->>'cantidad')::numeric,
         (x->>'costo')::numeric,
         (x->>'importe')::numeric
  from jsonb_array_elements(p_partidas) x;

  update public.productos p
  set existencia = p.existencia + s.cantidad,
      costo = coalesce(s.costo, p.costo),
      actualizado = now()
  from (
    select (x->>'productoId')::uuid as producto_id,
           sum((x->>'cantidad')::numeric) as cantidad,
           max((x->>'costo')::numeric) as costo
    from jsonb_array_elements(p_partidas) x
    group by 1
  ) s
  where p.id = s.producto_id and p.tienda_id = p_tienda;

  return v_entrada;
end;
$$;

-- Permisos (solo usuarios que iniciaron sesión)
grant select, insert, update, delete on public.entradas, public.entrada_partidas to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.registrar_entrada(uuid, text, text, jsonb) to authenticated;
