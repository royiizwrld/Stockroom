CREATE TYPE public.workspace_role AS ENUM ('owner','admin','manager','staff','viewer');

CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'My workspace',
  owner_id uuid NOT NULL,
  hide_prices_from_staff boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.workspace_members (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.workspace_role NOT NULL DEFAULT 'staff',
  email text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
CREATE TABLE public.workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.workspace_role NOT NULL DEFAULT 'staff',
  invited_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, email)
);
CREATE TABLE public.workspace_inventory (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 0,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  actor_name text,
  action text NOT NULL,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_log_ws_idx ON public.activity_log (workspace_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces, public.workspace_members, public.workspace_invites, public.workspace_inventory TO authenticated;
GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT ALL ON public.workspaces, public.workspace_members, public.workspace_invites, public.workspace_inventory, public.activity_log TO service_role;

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.ws_role(_ws uuid)
RETURNS public.workspace_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.workspace_members WHERE workspace_id = _ws AND user_id = auth.uid()
$$;
CREATE OR REPLACE FUNCTION public.ws_has_role(_ws uuid, _roles public.workspace_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.ws_role(_ws) = ANY(_roles), false)
$$;

CREATE POLICY "Members read workspace" ON public.workspaces FOR SELECT TO authenticated USING (public.ws_role(id) IS NOT NULL);
CREATE POLICY "Owner/admin update workspace" ON public.workspaces FOR UPDATE TO authenticated USING (public.ws_has_role(id, ARRAY['owner','admin']::public.workspace_role[]));
CREATE POLICY "Owner deletes workspace" ON public.workspaces FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "Members read members" ON public.workspace_members FOR SELECT TO authenticated USING (public.ws_role(workspace_id) IS NOT NULL);
CREATE POLICY "Admins change roles" ON public.workspace_members FOR UPDATE TO authenticated
  USING (public.ws_has_role(workspace_id, ARRAY['owner','admin']::public.workspace_role[]) AND role <> 'owner')
  WITH CHECK (role <> 'owner');
CREATE POLICY "Admins remove members or self leave" ON public.workspace_members FOR DELETE TO authenticated
  USING (role <> 'owner' AND (user_id = auth.uid() OR public.ws_has_role(workspace_id, ARRAY['owner','admin']::public.workspace_role[])));

CREATE POLICY "Admins read invites" ON public.workspace_invites FOR SELECT TO authenticated USING (public.ws_has_role(workspace_id, ARRAY['owner','admin']::public.workspace_role[]));
CREATE POLICY "Admins create invites" ON public.workspace_invites FOR INSERT TO authenticated
  WITH CHECK (public.ws_has_role(workspace_id, ARRAY['owner','admin']::public.workspace_role[]) AND role <> 'owner' AND invited_by = auth.uid());
CREATE POLICY "Admins delete invites" ON public.workspace_invites FOR DELETE TO authenticated USING (public.ws_has_role(workspace_id, ARRAY['owner','admin']::public.workspace_role[]));

CREATE POLICY "Members read inventory" ON public.workspace_inventory FOR SELECT TO authenticated USING (public.ws_role(workspace_id) IS NOT NULL);
CREATE POLICY "Editors update inventory" ON public.workspace_inventory FOR UPDATE TO authenticated
  USING (public.ws_has_role(workspace_id, ARRAY['owner','admin','manager','staff']::public.workspace_role[]))
  WITH CHECK (public.ws_has_role(workspace_id, ARRAY['owner','admin','manager','staff']::public.workspace_role[]));

CREATE POLICY "Members read activity" ON public.activity_log FOR SELECT TO authenticated USING (public.ws_role(workspace_id) IS NOT NULL);
CREATE POLICY "Editors write activity" ON public.activity_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.ws_has_role(workspace_id, ARRAY['owner','admin','manager','staff']::public.workspace_role[]));

CREATE OR REPLACE FUNCTION public.create_workspace(_name text, _data jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ws uuid; uid uuid := auth.uid(); em text; dn text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT email, raw_user_meta_data->>'display_name' INTO em, dn FROM auth.users WHERE id = uid;
  INSERT INTO public.workspaces(name, owner_id) VALUES (COALESCE(NULLIF(trim(_name), ''), 'My workspace'), uid) RETURNING id INTO ws;
  INSERT INTO public.workspace_members(workspace_id, user_id, role, email, display_name) VALUES (ws, uid, 'owner', em, dn);
  INSERT INTO public.workspace_inventory(workspace_id, data, updated_by) VALUES (ws, COALESCE(_data, '{}'::jsonb), uid);
  RETURN ws;
END $$;

CREATE OR REPLACE FUNCTION public.accept_my_invites()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); em text; dn text; n integer := 0; confirmed timestamptz;
BEGIN
  IF uid IS NULL THEN RETURN 0; END IF;
  SELECT lower(email), raw_user_meta_data->>'display_name', email_confirmed_at INTO em, dn, confirmed FROM auth.users WHERE id = uid;
  IF em IS NULL OR confirmed IS NULL THEN RETURN 0; END IF;
  INSERT INTO public.workspace_members(workspace_id, user_id, role, email, display_name)
    SELECT workspace_id, uid, role, em, dn FROM public.workspace_invites WHERE lower(email) = em
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  DELETE FROM public.workspace_invites WHERE lower(email) = em;
  RETURN n;
END $$;

REVOKE EXECUTE ON FUNCTION public.create_workspace(text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.accept_my_invites() FROM anon;