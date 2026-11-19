-- Choices for a list's filters (#1015): list_choices_json read the list's source once per counted column, five times for
-- the Door's Today's players, each running private.todays_players again. Each counted column is now one branch of a single
-- query over the source, read once (a materialised `src`), with the same answer: each column's values, most members first,
-- two hundred at most, the columns in the list's order.
--
-- The function is the live definition (20261118100800_door_orders_checks_and_feedback_on_the_server.sql), so made.

CREATE OR REPLACE FUNCTION private.list_choices_json(p_list text, p_venue_id uuid, p_view jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_view jsonb := coalesce(p_view, '{}'::jsonb);
  v_spec record;
  v_counts text;
  v_all jsonb;
begin
  select * into v_spec from private.list_spec(p_list);
  if v_spec.o_source is null then raise exception 'No such list' using errcode = '22023'; end if;
  select string_agg(format(
           '(select %1$s as place, %2$L::text as column_key, counted.value, counted.members
             from (select (%3$s)::text as value, count(*) as members from src where %4$s group by 1) counted
             where counted.value is not null order by counted.members desc, counted.value limit 200)',
           c.place, c.key, v_spec.o_columns ->> c.key, private.list_where_sql(v_spec.o_columns, v_spec.o_search, v_view, c.key)),
         ' union all ' order by c.place)
    into v_counts
  from unnest(v_spec.o_choices) with ordinality as c(key, place);
  if v_counts is null then return '[]'::jsonb; end if;
  execute format(
    'with src as materialized (%1$s)
     select coalesce(jsonb_agg(jsonb_build_object(''column_key'', top.column_key, ''value'', top.value, ''members'', top.members)
                               order by top.place, top.members desc, top.value), ''[]''::jsonb)
     from (%2$s) top',
    v_spec.o_source, v_counts)
    into v_all using p_venue_id, v_view;
  return v_all;
end;
$function$;
