--
-- PostgreSQL database dump
--

\restrict 3HfVd1GQm9QWXM55wFkFy7Luc5DOwr5hBiRtcHpcBasBLGs9myileyYEc8Fzg2J

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: app; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA app;


--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: pipeline; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pipeline;


--
-- Name: rt; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA rt;


--
-- Name: sf; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA sf;


--
-- Name: ut; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA ut;


--
-- Name: ut_rules; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA ut_rules;


--
-- Name: workshop; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA workshop;


--
-- Name: set_quote_number(); Type: FUNCTION; Schema: rt; Owner: -
--

CREATE FUNCTION rt.set_quote_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
    NEW.quote_number := 'RT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('rt.quote_number_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: set_quote_number(); Type: FUNCTION; Schema: ut; Owner: -
--

CREATE FUNCTION ut.set_quote_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
    NEW.quote_number := 'UT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('ut.quote_number_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: diagram_analyses; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.diagram_analyses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email_quote_id uuid,
    ut_quote_id uuid,
    rt_quote_id text,
    quote_type text NOT NULL,
    quote_number text NOT NULL,
    inspection_type text NOT NULL,
    step_name text NOT NULL,
    raw_response jsonb NOT NULL,
    model_used text,
    provider text,
    tokens_used integer,
    duration_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT diagram_analyses_provider_check CHECK ((provider = ANY (ARRAY['anthropic'::text, 'ollama'::text, 'other'::text]))),
    CONSTRAINT diagram_analyses_quote_type_check CHECK ((quote_type = ANY (ARRAY['email'::text, 'ut'::text, 'rt'::text])))
);


--
-- Name: document_audit_log; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.document_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    action text NOT NULL,
    path text NOT NULL,
    actor text DEFAULT 'system'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_checks; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.email_checks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    response_message text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: eq_quote_number_seq; Type: SEQUENCE; Schema: app; Owner: -
--

CREATE SEQUENCE app.eq_quote_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: email_quotes; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.email_quotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_number text DEFAULT ((('EQ-'::text || to_char(now(), 'YYYY'::text)) || '-'::text) || lpad((nextval('app.eq_quote_number_seq'::regclass))::text, 4, '0'::text)) NOT NULL,
    gmail_message_id text NOT NULL,
    gmail_thread_id text NOT NULL,
    gmail_label_ids text[] DEFAULT '{}'::text[] NOT NULL,
    sender_email text NOT NULL,
    sender_name text,
    customer_id uuid,
    customer_name text,
    inspection_types text[] DEFAULT '{}'::text[] NOT NULL,
    classification_confidence text,
    classification_source text,
    subject text DEFAULT ''::text NOT NULL,
    body_text text,
    nextcloud_paths text[] DEFAULT '{}'::text[] NOT NULL,
    status text DEFAULT 'received'::text NOT NULL,
    llm_routing text,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_internal_sender boolean DEFAULT false NOT NULL,
    msg_original_subject text,
    msg_original_from text,
    detected_part_numbers text[] DEFAULT '{}'::text[],
    matched_part_number text,
    matched_part_account text,
    matched_part_services text[] DEFAULT '{}'::text[],
    ut_quote_id uuid,
    ut_quote_number text,
    pipeline_error text,
    llm_extraction jsonb,
    CONSTRAINT email_quotes_classification_confidence_check CHECK ((classification_confidence = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text, 'none'::text]))),
    CONSTRAINT email_quotes_classification_source_check CHECK ((classification_source = ANY (ARRAY['llm'::text, 'keyword'::text, 'manual'::text]))),
    CONSTRAINT email_quotes_llm_routing_check CHECK ((llm_routing = ANY (ARRAY['CLOUD_OK'::text, 'LOCAL_ONLY'::text, 'HOLD'::text]))),
    CONSTRAINT email_quotes_status_check CHECK ((status = ANY (ARRAY['received'::text, 'checking'::text, 'needs_info'::text, 'processing'::text, 'quoted'::text, 'failed'::text])))
);


--
-- Name: COLUMN email_quotes.is_internal_sender; Type: COMMENT; Schema: app; Owner: -
--

COMMENT ON COLUMN app.email_quotes.is_internal_sender IS 'Email came from an internal tester (mrt@on-nex.com, *@ndtesting.com, mrtmaharaj@gmail.com). Treated as a forwarded RFQ — sender is NOT a customer.';


--
-- Name: COLUMN email_quotes.msg_original_subject; Type: COMMENT; Schema: app; Owner: -
--

COMMENT ON COLUMN app.email_quotes.msg_original_subject IS 'Subject line extracted from a .msg attachment (Outlook message forwarded by tester).';


--
-- Name: COLUMN email_quotes.msg_original_from; Type: COMMENT; Schema: app; Owner: -
--

COMMENT ON COLUMN app.email_quotes.msg_original_from IS 'Original sender email extracted from a .msg attachment.';


--
-- Name: email_threads; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.email_threads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email_quote_id uuid NOT NULL,
    direction text NOT NULL,
    gmail_message_id text,
    subject text DEFAULT ''::text NOT NULL,
    body_text text,
    sender_email text NOT NULL,
    recipient_email text NOT NULL,
    triggered_by_check_code text,
    nextcloud_paths text[] DEFAULT '{}'::text[] NOT NULL,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT email_threads_direction_check CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text])))
);


--
-- Name: folder_references; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.folder_references (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    alias text NOT NULL,
    display_name text NOT NULL,
    nextcloud_path text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inspection_steps; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.inspection_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inspection_type_id uuid NOT NULL,
    name character varying NOT NULL,
    action_type character varying NOT NULL,
    instruction text,
    python_code text,
    n8n_workflow character varying,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    webhook_url character varying,
    provider character varying,
    model character varying,
    config jsonb
);


--
-- Name: inspection_types; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.inspection_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying NOT NULL,
    label character varying NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: job_runs; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.job_runs (
    id integer NOT NULL,
    job_name text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    duration_ms integer,
    status text DEFAULT 'running'::text NOT NULL,
    records_upserted jsonb,
    summary text,
    error text
);


--
-- Name: job_runs_id_seq; Type: SEQUENCE; Schema: app; Owner: -
--

CREATE SEQUENCE app.job_runs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: job_runs_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: -
--

ALTER SEQUENCE app.job_runs_id_seq OWNED BY app.job_runs.id;


--
-- Name: quote_audit_log; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.quote_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id uuid NOT NULL,
    quote_type text NOT NULL,
    changed_by text DEFAULT 'system'::text NOT NULL,
    change_type text NOT NULL,
    diff jsonb,
    pdf_version integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quote_audit_log_quote_type_check CHECK ((quote_type = ANY (ARRAY['ut'::text, 'rt'::text])))
);


--
-- Name: access_log; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.access_log (
    id bigint NOT NULL,
    user_id text NOT NULL,
    tenant_id uuid,
    action text NOT NULL,
    resource text,
    ip_address inet,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    details jsonb
);


--
-- Name: access_log_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.access_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: access_log_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.access_log_id_seq OWNED BY auth.access_log.id;


--
-- Name: permissions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    description text,
    module text,
    label text,
    category text,
    deprecated boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT permissions_category_check CHECK (((category IS NULL) OR (category = ANY (ARRAY['view'::text, 'edit'::text, 'admin'::text, 'export'::text]))))
);


--
-- Name: role_permissions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.role_permissions (
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    tenant_id uuid,
    description text,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tenants; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.tenants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    ms365_tenant_id text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_permissions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.user_permissions (
    user_id text NOT NULL,
    permission_id uuid NOT NULL,
    granted boolean DEFAULT true NOT NULL,
    assigned_by text,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.user_roles (
    user_id text NOT NULL,
    role_id uuid NOT NULL,
    tenant_id uuid,
    assigned_by text,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    sub text NOT NULL,
    email text,
    name text,
    last_login timestamp with time zone,
    tenant_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: comply_cage_code_registry; Type: TABLE; Schema: pipeline; Owner: -
--

CREATE TABLE pipeline.comply_cage_code_registry (
    cage_code character(5) NOT NULL,
    company text NOT NULL,
    country character(2) DEFAULT 'US'::bpchar NOT NULL,
    is_defense boolean DEFAULT false NOT NULL
);


--
-- Name: comply_documents; Type: TABLE; Schema: pipeline; Owner: -
--

CREATE TABLE pipeline.comply_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    intake_id uuid NOT NULL,
    filename text NOT NULL,
    classification text NOT NULL,
    llm_routing text NOT NULL,
    risk_score integer DEFAULT 0 NOT NULL,
    cage_codes text[] DEFAULT '{}'::text[],
    usml_hits jsonb DEFAULT '[]'::jsonb,
    drawing_number text,
    dist_statement text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT comply_documents_classification_check CHECK ((classification = ANY (ARRAY['CLEAN'::text, 'EAR_LOW'::text, 'EAR_HIGH'::text, 'ITAR'::text, 'NEEDS_REVIEW'::text, 'REJECTED'::text]))),
    CONSTRAINT comply_documents_llm_routing_check CHECK ((llm_routing = ANY (ARRAY['CLOUD_OK'::text, 'LOCAL_ONLY'::text, 'HOLD'::text])))
);


--
-- Name: comply_keyword_audit_log; Type: TABLE; Schema: pipeline; Owner: -
--

CREATE TABLE pipeline.comply_keyword_audit_log (
    id integer NOT NULL,
    action text NOT NULL,
    keyword_id integer,
    keyword text NOT NULL,
    category text,
    weight integer,
    description text,
    changed_by text NOT NULL,
    changed_by_email text DEFAULT ''::text NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    prev_category text,
    prev_weight integer,
    prev_description text,
    CONSTRAINT comply_keyword_audit_log_action_check CHECK ((action = ANY (ARRAY['CREATE'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: comply_keyword_audit_log_id_seq; Type: SEQUENCE; Schema: pipeline; Owner: -
--

CREATE SEQUENCE pipeline.comply_keyword_audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: comply_keyword_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: pipeline; Owner: -
--

ALTER SEQUENCE pipeline.comply_keyword_audit_log_id_seq OWNED BY pipeline.comply_keyword_audit_log.id;


--
-- Name: comply_keyword_library; Type: TABLE; Schema: pipeline; Owner: -
--

CREATE TABLE pipeline.comply_keyword_library (
    id integer NOT NULL,
    keyword text NOT NULL,
    category text NOT NULL,
    weight integer DEFAULT 5 NOT NULL,
    description text,
    CONSTRAINT comply_keyword_library_category_check CHECK ((category = ANY (ARRAY['ITAR'::text, 'EAR'::text, 'MIL_SPEC'::text, 'USML'::text, 'CAGE'::text])))
);


--
-- Name: comply_keyword_library_id_seq; Type: SEQUENCE; Schema: pipeline; Owner: -
--

CREATE SEQUENCE pipeline.comply_keyword_library_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: comply_keyword_library_id_seq; Type: SEQUENCE OWNED BY; Schema: pipeline; Owner: -
--

ALTER SEQUENCE pipeline.comply_keyword_library_id_seq OWNED BY pipeline.comply_keyword_library.id;


--
-- Name: gateway_reidentify_log; Type: TABLE; Schema: pipeline; Owner: -
--

CREATE TABLE pipeline.gateway_reidentify_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gateway_req_id uuid NOT NULL,
    caller_role text NOT NULL,
    tokens_revealed text[] DEFAULT '{}'::text[],
    revealed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: gateway_requests; Type: TABLE; Schema: pipeline; Owner: -
--

CREATE TABLE pipeline.gateway_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    intake_id uuid,
    sanitize_job_id uuid,
    provider_used text NOT NULL,
    model_used text NOT NULL,
    classification text NOT NULL,
    llm_routing text NOT NULL,
    prompt_tokens integer,
    completion_tokens integer,
    latency_ms integer,
    response_json jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT gateway_requests_provider_used_check CHECK ((provider_used = ANY (ARRAY['anthropic'::text, 'ollama'::text, 'claude_cli'::text, 'openrouter'::text, 'openai'::text, 'gemini'::text])))
);


--
-- Name: intake_sessions; Type: TABLE; Schema: pipeline; Owner: -
--

CREATE TABLE pipeline.intake_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    msg_filename text,
    status text DEFAULT 'processing'::text NOT NULL,
    strictest_routing text,
    quote_id uuid,
    result_json jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    step_progress jsonb DEFAULT '[]'::jsonb NOT NULL,
    rt_quote_id text,
    email_from text,
    CONSTRAINT intake_sessions_status_check CHECK ((status = ANY (ARRAY['processing'::text, 'completed'::text, 'failed'::text, 'hold'::text]))),
    CONSTRAINT intake_sessions_strictest_routing_check CHECK ((strictest_routing = ANY (ARRAY['CLOUD_OK'::text, 'LOCAL_ONLY'::text, 'HOLD'::text])))
);


--
-- Name: COLUMN intake_sessions.step_progress; Type: COMMENT; Schema: pipeline; Owner: -
--

COMMENT ON COLUMN pipeline.intake_sessions.step_progress IS 'Array of { key, status, log[], detail, startedAt, completedAt } objects, one per pipeline step. Status: pending|processing|success|failed|skipped.';


--
-- Name: sanitize_jobs; Type: TABLE; Schema: pipeline; Owner: -
--

CREATE TABLE pipeline.sanitize_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    comply_doc_id uuid,
    entity_count integer DEFAULT 0 NOT NULL,
    input_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sanitize_reidentify_audit; Type: TABLE; Schema: pipeline; Owner: -
--

CREATE TABLE pipeline.sanitize_reidentify_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    token text NOT NULL,
    caller_role text NOT NULL,
    caller_identity text,
    revealed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sanitize_token_vault; Type: TABLE; Schema: pipeline; Owner: -
--

CREATE TABLE pipeline.sanitize_token_vault (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    token text NOT NULL,
    entity_type text NOT NULL,
    encrypted_val bytea NOT NULL,
    iv bytea NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: step_events; Type: TABLE; Schema: pipeline; Owner: -
--

CREATE TABLE pipeline.step_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    intake_id uuid NOT NULL,
    step_key text NOT NULL,
    event_type text NOT NULL,
    direction text,
    service_name text,
    endpoint text,
    http_status integer,
    latency_ms integer,
    payload jsonb,
    log_message text,
    detail jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT step_events_direction_check CHECK ((direction = ANY (ARRAY['out'::text, 'in'::text, 'internal'::text]))),
    CONSTRAINT step_events_event_type_check CHECK ((event_type = ANY (ARRAY['start'::text, 'request_sent'::text, 'response_received'::text, 'complete'::text, 'error'::text, 'skip'::text, 'stalled'::text])))
);


--
-- Name: analysis_jobs; Type: TABLE; Schema: rt; Owner: -
--

CREATE TABLE rt.analysis_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    stage text,
    file_name text,
    file_hash text,
    comply_result jsonb,
    classification jsonb,
    analysis jsonb,
    sanitize_job_id text,
    llm_routing text,
    low_confidence boolean DEFAULT false NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: film_sizes; Type: TABLE; Schema: rt; Owner: -
--

CREATE TABLE rt.film_sizes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    label character varying NOT NULL,
    width numeric NOT NULL,
    height numeric NOT NULL,
    price_per_box_100 numeric NOT NULL,
    is_custom boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: incoming_quotes; Type: TABLE; Schema: rt; Owner: -
--

CREATE TABLE rt.incoming_quotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_number character varying DEFAULT ''::character varying NOT NULL,
    source character varying DEFAULT 'api'::character varying NOT NULL,
    external_ref character varying,
    requested_by character varying,
    part_number character varying,
    customer_name character varying,
    status character varying DEFAULT 'calculated'::character varying NOT NULL,
    request_body jsonb NOT NULL,
    response_body jsonb,
    grand_total numeric,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    pdf_path text,
    pdf_version integer DEFAULT 0 NOT NULL,
    notes text,
    CONSTRAINT incoming_quotes_source_check CHECK (((source)::text = ANY ((ARRAY['api'::character varying, 'salesforce'::character varying, 'email'::character varying, 'portal'::character varying])::text[]))),
    CONSTRAINT incoming_quotes_status_check CHECK (((status)::text = ANY ((ARRAY['calculated'::character varying, 'pending'::character varying, 'sent'::character varying, 'accepted'::character varying, 'rejected'::character varying])::text[])))
);


--
-- Name: machine_catalog; Type: TABLE; Schema: rt; Owner: -
--

CREATE TABLE rt.machine_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    machine_id text NOT NULL,
    nickname text NOT NULL,
    make_model text,
    spec jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: operators; Type: TABLE; Schema: rt; Owner: -
--

CREATE TABLE rt.operators (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    role character varying NOT NULL,
    base_hourly_rate numeric NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT operators_role_check CHECK (((role)::text = ANY ((ARRAY['SHOOTER'::character varying, 'DARKROOM_SORT'::character varying, 'READER'::character varying])::text[])))
);


--
-- Name: part_quotes; Type: TABLE; Schema: rt; Owner: -
--

CREATE TABLE rt.part_quotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    part_number character varying NOT NULL,
    customer_name character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: planning_sessions; Type: TABLE; Schema: rt; Owner: -
--

CREATE TABLE rt.planning_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    raw_input text NOT NULL,
    extraction jsonb,
    plan jsonb,
    selected_machine_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pricing_tiers; Type: TABLE; Schema: rt; Owner: -
--

CREATE TABLE rt.pricing_tiers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    label character varying NOT NULL,
    single_shot_rate numeric NOT NULL,
    multi_shot_rate numeric NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: quote_number_seq; Type: SEQUENCE; Schema: rt; Owner: -
--

CREATE SEQUENCE rt.quote_number_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: settings; Type: TABLE; Schema: rt; Owner: -
--

CREATE TABLE rt.settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    burden_multiplier numeric DEFAULT 1.16 NOT NULL,
    loaded_rate_multiplier numeric DEFAULT 3.0 NOT NULL,
    monthly_oh_costs numeric DEFAULT 135000 NOT NULL,
    monthly_direct_labor numeric DEFAULT 275000 NOT NULL,
    film_markup_pct numeric DEFAULT 0.10 NOT NULL,
    sandbox_price_pct numeric DEFAULT 0.10 NOT NULL,
    misc_profit_pct numeric DEFAULT 0.15 NOT NULL,
    profit_multiplier numeric DEFAULT 0.45 NOT NULL,
    sales_bonus_multiplier numeric DEFAULT 1.02 NOT NULL,
    shooter_machine_count integer DEFAULT 3 NOT NULL,
    shooter_crew_divisor integer DEFAULT 4 NOT NULL,
    darkroom_operator_count integer DEFAULT 2 NOT NULL,
    reader_crew_count integer DEFAULT 4 NOT NULL,
    reader_divisor integer DEFAULT 3 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: view_rows; Type: TABLE; Schema: rt; Owner: -
--

CREATE TABLE rt.view_rows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id uuid,
    view_number integer NOT NULL,
    shot_type integer DEFAULT 1 NOT NULL,
    qty_parts_per_film integer DEFAULT 2 NOT NULL,
    film_size_id uuid,
    unpack_load_time numeric DEFAULT 1.0 NOT NULL,
    darkroom_sort_time numeric DEFAULT 1.0 NOT NULL,
    shot_time numeric DEFAULT 2.0 NOT NULL,
    read_time numeric DEFAULT 1.0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT view_rows_shot_type_check CHECK ((shot_type = ANY (ARRAY[0, 1, 2, 3])))
);


--
-- Name: accounts; Type: TABLE; Schema: sf; Owner: -
--

CREATE TABLE sf.accounts (
    sf_id text NOT NULL,
    name text NOT NULL,
    type text,
    market text,
    status text,
    oem_approvals text[],
    rate_sheet_ver text,
    payment_terms text,
    ytd_total numeric(12,2),
    synced_at timestamp with time zone DEFAULT now(),
    billing_state text,
    billing_country text,
    billing_city text,
    owner_name text,
    created_date date,
    phone text,
    industry text,
    techniques_criterias text,
    wo_notes text,
    add_wo_notes text,
    add_wo_notes_2 text,
    region text,
    client_types text[],
    faa_account boolean,
    top_10_account boolean,
    credit_hold boolean,
    courier text,
    courier_acct text,
    delivery_methods text,
    ytd_lab_revenue numeric(12,2),
    ytd_field_revenue numeric(12,2),
    lab_pricing_direction text,
    admin_fee_pct numeric(5,2),
    competitors text[]
);


--
-- Name: bom_items; Type: TABLE; Schema: sf; Owner: -
--

CREATE TABLE sf.bom_items (
    sf_id text NOT NULL,
    account_sf_id text,
    part_number text NOT NULL,
    part_rev text,
    drawing_number text,
    service text,
    specification text,
    technique text,
    ndt_procedure text,
    acceptance_criteria text,
    material text,
    notes text,
    is_active boolean DEFAULT true,
    effective_date date,
    synced_at timestamp with time zone DEFAULT now()
);


--
-- Name: jobs; Type: TABLE; Schema: sf; Owner: -
--

CREATE TABLE sf.jobs (
    sf_id text NOT NULL,
    account_sf_id text,
    account_name text,
    work_order_number text,
    invoice_number text,
    invoice_amount numeric(12,2),
    part_number text,
    part_rev text,
    lot_serial text,
    services text[],
    specification text,
    ndt_procedure text,
    acceptance_criteria text,
    scope text,
    po_number text,
    price_per_basis text,
    date_received date,
    date_completed date,
    record_type text,
    close_date date,
    synced_at timestamp with time zone DEFAULT now(),
    stage_name text,
    amount numeric(12,2),
    owner_name text,
    created_date date,
    description text,
    is_won boolean,
    is_closed boolean,
    lab_status text,
    billing_status text,
    date_due date,
    contact_sf_id text,
    qty_received numeric(10,2),
    lab_notes text,
    billing_notes text,
    faa_job boolean,
    expedite boolean,
    expedite_type text,
    expedite_fee numeric(10,2),
    inspection_time_min numeric(10,2),
    film_sq_in numeric(10,2),
    subtotal numeric(12,2),
    total numeric(12,2),
    admin_fee_amount numeric(10,2),
    pricing_details text
);


--
-- Name: bom_parts; Type: MATERIALIZED VIEW; Schema: sf; Owner: -
--

CREATE MATERIALIZED VIEW sf.bom_parts AS
 SELECT j.account_sf_id,
    a.name AS account_name,
    j.part_number,
    array_agg(DISTINCT j.part_rev) FILTER (WHERE (j.part_rev IS NOT NULL)) AS revisions,
    array_agg(DISTINCT svc.svc) FILTER (WHERE (svc.svc IS NOT NULL)) AS services,
    array_agg(DISTINCT j.specification) FILTER (WHERE (j.specification IS NOT NULL)) AS specifications,
    array_agg(DISTINCT j.ndt_procedure) FILTER (WHERE (j.ndt_procedure IS NOT NULL)) AS procedures,
    array_agg(DISTINCT j.acceptance_criteria) FILTER (WHERE (j.acceptance_criteria IS NOT NULL)) AS acceptance_criteria,
    count(*) AS job_count,
    max(COALESCE(j.date_completed, j.date_received)) AS last_processed,
    avg(j.invoice_amount) FILTER (WHERE (j.invoice_amount > (0)::numeric)) AS avg_invoice,
    max(j.invoice_amount) AS max_invoice,
    ( SELECT j2.specification
           FROM sf.jobs j2
          WHERE ((j2.account_sf_id = j.account_sf_id) AND (j2.part_number = j.part_number) AND (j2.specification IS NOT NULL))
          ORDER BY COALESCE(j2.date_completed, j2.date_received) DESC NULLS LAST
         LIMIT 1) AS last_specification,
    ( SELECT j2.ndt_procedure
           FROM sf.jobs j2
          WHERE ((j2.account_sf_id = j.account_sf_id) AND (j2.part_number = j.part_number) AND (j2.ndt_procedure IS NOT NULL))
          ORDER BY COALESCE(j2.date_completed, j2.date_received) DESC NULLS LAST
         LIMIT 1) AS last_technique,
    ( SELECT j2.acceptance_criteria
           FROM sf.jobs j2
          WHERE ((j2.account_sf_id = j.account_sf_id) AND (j2.part_number = j.part_number) AND (j2.acceptance_criteria IS NOT NULL))
          ORDER BY COALESCE(j2.date_completed, j2.date_received) DESC NULLS LAST
         LIMIT 1) AS last_acceptance_criteria,
    ( SELECT j2.services
           FROM sf.jobs j2
          WHERE ((j2.account_sf_id = j.account_sf_id) AND (j2.part_number = j.part_number) AND (j2.services IS NOT NULL))
          ORDER BY COALESCE(j2.date_completed, j2.date_received) DESC NULLS LAST
         LIMIT 1) AS last_services
   FROM ((sf.jobs j
     JOIN sf.accounts a ON ((a.sf_id = j.account_sf_id)))
     CROSS JOIN LATERAL unnest(j.services) svc(svc))
  WHERE ((j.part_number IS NOT NULL) AND (j.part_number <> ''::text))
  GROUP BY j.account_sf_id, a.name, j.part_number
  WITH NO DATA;


--
-- Name: contacts; Type: TABLE; Schema: sf; Owner: -
--

CREATE TABLE sf.contacts (
    sf_id text NOT NULL,
    account_sf_id text,
    account_name text,
    first_name text,
    last_name text NOT NULL,
    full_name text GENERATED ALWAYS AS (
CASE
    WHEN (first_name IS NOT NULL) THEN ((first_name || ' '::text) || last_name)
    ELSE last_name
END) STORED,
    email text,
    phone text,
    title text,
    department text,
    is_active boolean DEFAULT true,
    synced_at timestamp with time zone DEFAULT now()
);


--
-- Name: contracts; Type: TABLE; Schema: sf; Owner: -
--

CREATE TABLE sf.contracts (
    sf_id text NOT NULL,
    account_sf_id text,
    contract_number text,
    status text,
    start_date date,
    end_date date,
    billing_frequency text,
    total_value numeric(12,2),
    description text,
    owner_name text,
    synced_at timestamp with time zone DEFAULT now()
);


--
-- Name: order_items; Type: TABLE; Schema: sf; Owner: -
--

CREATE TABLE sf.order_items (
    sf_id text NOT NULL,
    order_sf_id text,
    product_sf_id text,
    product_code text,
    product_name text,
    quantity numeric(10,2),
    unit_price numeric(12,2),
    total_price numeric(12,2),
    description text,
    synced_at timestamp with time zone DEFAULT now()
);


--
-- Name: orders; Type: TABLE; Schema: sf; Owner: -
--

CREATE TABLE sf.orders (
    sf_id text NOT NULL,
    account_sf_id text,
    opportunity_sf_id text,
    order_number text,
    status text,
    order_start_date date,
    total_amount numeric(12,2),
    po_number text,
    description text,
    owner_name text,
    synced_at timestamp with time zone DEFAULT now()
);


--
-- Name: part_last_used; Type: VIEW; Schema: sf; Owner: -
--

CREATE VIEW sf.part_last_used AS
 SELECT DISTINCT ON (j.account_sf_id, j.part_number) j.account_sf_id,
    a.name AS account_name,
    j.part_number,
    j.part_rev AS last_rev,
    j.services AS last_services,
    j.specification AS last_specification,
    j.ndt_procedure AS last_technique,
    j.acceptance_criteria AS last_acceptance_criteria,
    j.scope AS last_scope,
    j.work_order_number AS last_work_order,
    j.invoice_number AS last_invoice_number,
    j.invoice_amount AS last_invoice_amount,
    j.stage_name AS last_stage,
    j.is_won AS last_job_was_won,
    COALESCE(j.date_completed, j.date_received) AS last_job_date,
    j.date_completed AS last_completed_date,
    j.date_received AS last_received_date,
    j.record_type AS last_record_type,
    j.sf_id AS last_job_sf_id
   FROM (sf.jobs j
     JOIN sf.accounts a ON ((a.sf_id = j.account_sf_id)))
  WHERE ((j.part_number IS NOT NULL) AND (j.part_number <> ''::text))
  ORDER BY j.account_sf_id, j.part_number, COALESCE(j.date_completed, j.date_received) DESC NULLS LAST;


--
-- Name: VIEW part_last_used; Type: COMMENT; Schema: sf; Owner: -
--

COMMENT ON VIEW sf.part_last_used IS 'Most recent job per part × account. Answers "what spec/technique did we last use for this part?"';


--
-- Name: pricebook_entries; Type: TABLE; Schema: sf; Owner: -
--

CREATE TABLE sf.pricebook_entries (
    sf_id text NOT NULL,
    product_sf_id text,
    product_code text,
    product_name text,
    pricebook_name text,
    currency text DEFAULT 'USD'::text,
    unit_price numeric(10,2),
    list_price numeric(10,2),
    is_active boolean DEFAULT true,
    synced_at timestamp with time zone DEFAULT now()
);


--
-- Name: products; Type: TABLE; Schema: sf; Owner: -
--

CREATE TABLE sf.products (
    sf_id text NOT NULL,
    product_code text,
    name text,
    family text,
    description text,
    std_price numeric(10,2),
    union_price numeric(10,2),
    faa_price numeric(10,2),
    is_active boolean DEFAULT true,
    synced_at timestamp with time zone DEFAULT now()
);


--
-- Name: quote_lines; Type: TABLE; Schema: sf; Owner: -
--

CREATE TABLE sf.quote_lines (
    sf_id text NOT NULL,
    quote_sf_id text,
    product_code text,
    product_name text,
    quantity numeric(10,2),
    unit_price numeric(12,2),
    total_price numeric(12,2),
    list_price numeric(12,2),
    description text,
    line_number integer,
    synced_at timestamp with time zone DEFAULT now()
);


--
-- Name: quotes; Type: TABLE; Schema: sf; Owner: -
--

CREATE TABLE sf.quotes (
    sf_id text NOT NULL,
    job_sf_id text,
    account_sf_id text,
    quote_number text,
    part_numbers text,
    services_included text[],
    grand_total numeric(12,2),
    status text,
    expiration_date date,
    pricing_basis text,
    notes text,
    description text,
    synced_at timestamp with time zone DEFAULT now(),
    created_date timestamp with time zone
);


--
-- Name: app_settings; Type: TABLE; Schema: ut; Owner: -
--

CREATE TABLE ut.app_settings (
    key text NOT NULL,
    value text DEFAULT ''::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customers; Type: TABLE; Schema: ut; Owner: -
--

CREATE TABLE ut.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    hourly_rate numeric DEFAULT 225 NOT NULL,
    cscan_rate numeric DEFAULT 250 NOT NULL,
    technique_fee numeric DEFAULT 125 NOT NULL,
    env_fee_rate numeric DEFAULT 0.02 NOT NULL,
    min_charge numeric DEFAULT 225 NOT NULL,
    cscan_min_charge numeric DEFAULT 250 NOT NULL,
    delivery_fee character varying DEFAULT 'N/A'::character varying NOT NULL,
    lead_time character varying DEFAULT '4-5 Days'::character varying NOT NULL,
    has_env_fee boolean DEFAULT true NOT NULL,
    has_tech_fee boolean DEFAULT true NOT NULL,
    lot_pattern character varying DEFAULT 'simple'::character varying NOT NULL,
    notes text DEFAULT ''::text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    rule_set_id uuid,
    rule_version_pin integer,
    custom_variables jsonb DEFAULT '{}'::jsonb NOT NULL,
    email text,
    domain text,
    sf_account_id text,
    misc_fee numeric(10,2),
    CONSTRAINT customers_lot_pattern_check CHECK (((lot_pattern)::text = ANY ((ARRAY['simple'::character varying, 'min_enforced'::character varying])::text[])))
);


--
-- Name: COLUMN customers.misc_fee; Type: COMMENT; Schema: ut; Owner: -
--

COMMENT ON COLUMN ut.customers.misc_fee IS 'One-off customer surcharge stacked before env fee (e.g. COULTER FORGE GSI FEE $450, BLUE ORIGIN C-SCAN FEE $125)';


--
-- Name: global_settings; Type: TABLE; Schema: ut; Owner: -
--

CREATE TABLE ut.global_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    default_hourly_rate numeric DEFAULT 225 NOT NULL,
    cscan_hourly_rate numeric DEFAULT 250 NOT NULL,
    high_res_hourly_rate numeric DEFAULT 250 NOT NULL,
    default_env_fee_rate numeric DEFAULT 0.02 NOT NULL,
    default_technique_fee numeric DEFAULT 125 NOT NULL,
    default_min_charge numeric DEFAULT 225 NOT NULL,
    default_load_time numeric DEFAULT 3.0 NOT NULL,
    scan_speed_divisor numeric DEFAULT 10 NOT NULL,
    default_lead_time character varying DEFAULT '4-5 Days'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    custom_variables jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: incoming_quotes; Type: TABLE; Schema: ut; Owner: -
--

CREATE TABLE ut.incoming_quotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_number character varying NOT NULL,
    source character varying DEFAULT 'api'::character varying NOT NULL,
    external_ref character varying,
    requested_by character varying,
    customer_id uuid,
    customer_name character varying,
    status character varying DEFAULT 'calculated'::character varying NOT NULL,
    request_body jsonb NOT NULL,
    response_body jsonb,
    grand_total numeric,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    intake_id uuid,
    pdf_path text,
    pdf_version integer DEFAULT 0 NOT NULL,
    standard character varying(150),
    rush_level character varying(20) DEFAULT 'normal'::character varying NOT NULL,
    rush_multiplier numeric(4,2) DEFAULT 1.00 NOT NULL,
    rush_surcharge numeric(10,2) DEFAULT 0.00 NOT NULL,
    rule_set_version_id uuid,
    calculation_trace_id uuid,
    CONSTRAINT incoming_quotes_source_check CHECK (((source)::text = ANY ((ARRAY['api'::character varying, 'salesforce'::character varying, 'email'::character varying, 'portal'::character varying])::text[]))),
    CONSTRAINT incoming_quotes_status_check CHECK (((status)::text = ANY ((ARRAY['calculated'::character varying, 'pending'::character varying, 'sent'::character varying, 'accepted'::character varying, 'rejected'::character varying])::text[])))
);


--
-- Name: line_items; Type: TABLE; Schema: ut; Owner: -
--

CREATE TABLE ut.line_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id uuid,
    geometry_type character varying DEFAULT 'FLAT_BAR'::character varying NOT NULL,
    thickness numeric,
    width numeric,
    length numeric,
    diameter numeric,
    outer_diameter numeric,
    inner_diameter numeric,
    scan_index numeric DEFAULT 0.065 NOT NULL,
    resolution character varying DEFAULT '.250"'::character varying,
    load_time numeric DEFAULT 3.0 NOT NULL,
    hourly_rate numeric DEFAULT 225 NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    number_of_scans integer DEFAULT 1 NOT NULL,
    material_id uuid,
    inspection_class character varying,
    use_weight_pricing boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT line_items_geometry_type_check CHECK (((geometry_type)::text = ANY ((ARRAY['FLAT_BAR'::character varying, 'ROUND_BAR'::character varying, 'RING'::character varying, 'TUBING'::character varying, 'CSCAN_FLAT'::character varying, 'CSCAN_ROUND'::character varying, 'THIN_SHEET'::character varying])::text[]))),
    CONSTRAINT line_items_inspection_class_check CHECK (((inspection_class)::text = ANY ((ARRAY['A'::character varying, 'AA'::character varying])::text[])))
);


--
-- Name: materials; Type: TABLE; Schema: ut; Owner: -
--

CREATE TABLE ut.materials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    density_lb_per_cu_in numeric NOT NULL,
    class_a_rate_per_lb numeric,
    class_aa_rate_per_lb numeric,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: quote_number_seq; Type: SEQUENCE; Schema: ut; Owner: -
--

CREATE SEQUENCE ut.quote_number_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: quotes; Type: TABLE; Schema: ut; Owner: -
--

CREATE TABLE ut.quotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid,
    quote_number character varying,
    quoted_by character varying DEFAULT ''::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: calculation_traces; Type: TABLE; Schema: ut_rules; Owner: -
--

CREATE TABLE ut_rules.calculation_traces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id uuid,
    rule_set_name text NOT NULL,
    rule_set_version integer NOT NULL,
    rule_set_version_id uuid NOT NULL,
    geometry_type text NOT NULL,
    inputs jsonb NOT NULL,
    steps jsonb NOT NULL,
    scan_result jsonb NOT NULL,
    weight_result jsonb,
    lot_result jsonb NOT NULL,
    final_result jsonb NOT NULL,
    calculated_at timestamp with time zone DEFAULT now() NOT NULL,
    calculated_by text DEFAULT 'system'::text NOT NULL
);


--
-- Name: change_log; Type: TABLE; Schema: ut_rules; Owner: -
--

CREATE TABLE ut_rules.change_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_set_id uuid NOT NULL,
    version_from integer,
    version_to integer NOT NULL,
    change_type text NOT NULL,
    diff jsonb,
    changed_by text DEFAULT 'system'::text NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT change_log_change_type_check CHECK ((change_type = ANY (ARRAY['create'::text, 'update'::text, 'clone'::text])))
);


--
-- Name: rule_set_versions; Type: TABLE; Schema: ut_rules; Owner: -
--

CREATE TABLE ut_rules.rule_set_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_set_id uuid NOT NULL,
    version integer NOT NULL,
    is_latest boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by text DEFAULT 'system'::text NOT NULL
);


--
-- Name: rule_sets; Type: TABLE; Schema: ut_rules; Owner: -
--

CREATE TABLE ut_rules.rule_sets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by text DEFAULT 'system'::text NOT NULL
);


--
-- Name: rules; Type: TABLE; Schema: ut_rules; Owner: -
--

CREATE TABLE ut_rules.rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    version_id uuid NOT NULL,
    category text NOT NULL,
    geometry_type text,
    sort_order integer DEFAULT 0 NOT NULL,
    label text NOT NULL,
    description text,
    definition jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rules_category_check CHECK ((category = ANY (ARRAY['rate'::text, 'load_time'::text, 'scan_formula'::text, 'price_modifier'::text, 'weight_formula'::text, 'lot_calculation'::text, 'rounding'::text])))
);


--
-- Name: jobs; Type: TABLE; Schema: workshop; Owner: -
--

CREATE TABLE workshop.jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    inspection_type text NOT NULL,
    sequence_index integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'unscheduled'::text NOT NULL,
    scheduled_start timestamp with time zone,
    scheduled_end timestamp with time zone,
    actual_start timestamp with time zone,
    actual_end timestamp with time zone,
    duration_minutes integer DEFAULT 60 NOT NULL,
    inspector_name text,
    scheduling_mode text DEFAULT 'auto'::text NOT NULL,
    position_override integer,
    is_simulated boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    allowed_machines uuid[],
    assigned_machine uuid,
    CONSTRAINT jobs_inspection_type_check CHECK ((inspection_type = ANY (ARRAY['RT'::text, 'UT'::text, 'ET'::text, 'MT'::text, 'PT'::text, 'VT'::text]))),
    CONSTRAINT jobs_scheduling_mode_check CHECK ((scheduling_mode = ANY (ARRAY['auto'::text, 'manual'::text]))),
    CONSTRAINT jobs_status_check CHECK ((status = ANY (ARRAY['unscheduled'::text, 'scheduled'::text, 'in_progress'::text, 'completed'::text])))
);


--
-- Name: machine_offline_windows; Type: TABLE; Schema: workshop; Owner: -
--

CREATE TABLE workshop.machine_offline_windows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    machine_id uuid NOT NULL,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_offline_range CHECK ((end_at > start_at))
);


--
-- Name: machines; Type: TABLE; Schema: workshop; Owner: -
--

CREATE TABLE workshop.machines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    inspector_name text,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    rt_catalog_id text,
    CONSTRAINT machines_type_check CHECK ((type = ANY (ARRAY['RT'::text, 'UT'::text, 'ET'::text, 'MT'::text, 'PT'::text, 'VT'::text])))
);


--
-- Name: orders; Type: TABLE; Schema: workshop; Owner: -
--

CREATE TABLE workshop.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_number text NOT NULL,
    customer_id uuid,
    part_number text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    due_date timestamp with time zone,
    status text DEFAULT 'incoming'::text NOT NULL,
    is_simulated boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT orders_priority_check CHECK ((priority = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text]))),
    CONSTRAINT orders_status_check CHECK ((status = ANY (ARRAY['incoming'::text, 'in_progress'::text, 'completed'::text, 'on_hold'::text])))
);


--
-- Name: settings; Type: TABLE; Schema: workshop; Owner: -
--

CREATE TABLE workshop.settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: job_runs id; Type: DEFAULT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.job_runs ALTER COLUMN id SET DEFAULT nextval('app.job_runs_id_seq'::regclass);


--
-- Name: access_log id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.access_log ALTER COLUMN id SET DEFAULT nextval('auth.access_log_id_seq'::regclass);


--
-- Name: comply_keyword_audit_log id; Type: DEFAULT; Schema: pipeline; Owner: -
--

ALTER TABLE ONLY pipeline.comply_keyword_audit_log ALTER COLUMN id SET DEFAULT nextval('pipeline.comply_keyword_audit_log_id_seq'::regclass);


--
-- Name: comply_keyword_library id; Type: DEFAULT; Schema: pipeline; Owner: -
--

ALTER TABLE ONLY pipeline.comply_keyword_library ALTER COLUMN id SET DEFAULT nextval('pipeline.comply_keyword_library_id_seq'::regclass);


--
-- Name: diagram_analyses diagram_analyses_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.diagram_analyses
    ADD CONSTRAINT diagram_analyses_pkey PRIMARY KEY (id);


--
-- Name: document_audit_log document_audit_log_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.document_audit_log
    ADD CONSTRAINT document_audit_log_pkey PRIMARY KEY (id);


--
-- Name: email_checks email_checks_code_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.email_checks
    ADD CONSTRAINT email_checks_code_key UNIQUE (code);


--
-- Name: email_checks email_checks_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.email_checks
    ADD CONSTRAINT email_checks_pkey PRIMARY KEY (id);


--
-- Name: email_quotes email_quotes_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.email_quotes
    ADD CONSTRAINT email_quotes_pkey PRIMARY KEY (id);


--
-- Name: email_quotes email_quotes_quote_number_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.email_quotes
    ADD CONSTRAINT email_quotes_quote_number_key UNIQUE (quote_number);


--
-- Name: email_threads email_threads_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.email_threads
    ADD CONSTRAINT email_threads_pkey PRIMARY KEY (id);


--
-- Name: folder_references folder_references_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.folder_references
    ADD CONSTRAINT folder_references_pkey PRIMARY KEY (id);


--
-- Name: inspection_steps inspection_steps_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.inspection_steps
    ADD CONSTRAINT inspection_steps_pkey PRIMARY KEY (id);


--
-- Name: inspection_types inspection_types_code_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.inspection_types
    ADD CONSTRAINT inspection_types_code_key UNIQUE (code);


--
-- Name: inspection_types inspection_types_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.inspection_types
    ADD CONSTRAINT inspection_types_pkey PRIMARY KEY (id);


--
-- Name: job_runs job_runs_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.job_runs
    ADD CONSTRAINT job_runs_pkey PRIMARY KEY (id);


--
-- Name: quote_audit_log quote_audit_log_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.quote_audit_log
    ADD CONSTRAINT quote_audit_log_pkey PRIMARY KEY (id);


--
-- Name: access_log access_log_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.access_log
    ADD CONSTRAINT access_log_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_code_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.permissions
    ADD CONSTRAINT permissions_code_key UNIQUE (code);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_name_tenant_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.roles
    ADD CONSTRAINT roles_name_tenant_id_key UNIQUE (name, tenant_id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_slug_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.tenants
    ADD CONSTRAINT tenants_slug_key UNIQUE (slug);


--
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (user_id, permission_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (sub);


--
-- Name: comply_cage_code_registry comply_cage_code_registry_pkey; Type: CONSTRAINT; Schema: pipeline; Owner: -
--

ALTER TABLE ONLY pipeline.comply_cage_code_registry
    ADD CONSTRAINT comply_cage_code_registry_pkey PRIMARY KEY (cage_code);


--
-- Name: comply_documents comply_documents_pkey; Type: CONSTRAINT; Schema: pipeline; Owner: -
--

ALTER TABLE ONLY pipeline.comply_documents
    ADD CONSTRAINT comply_documents_pkey PRIMARY KEY (id);


--
-- Name: comply_keyword_audit_log comply_keyword_audit_log_pkey; Type: CONSTRAINT; Schema: pipeline; Owner: -
--

ALTER TABLE ONLY pipeline.comply_keyword_audit_log
    ADD CONSTRAINT comply_keyword_audit_log_pkey PRIMARY KEY (id);


--
-- Name: comply_keyword_library comply_keyword_library_keyword_key; Type: CONSTRAINT; Schema: pipeline; Owner: -
--

ALTER TABLE ONLY pipeline.comply_keyword_library
    ADD CONSTRAINT comply_keyword_library_keyword_key UNIQUE (keyword);


--
-- Name: comply_keyword_library comply_keyword_library_pkey; Type: CONSTRAINT; Schema: pipeline; Owner: -
--

ALTER TABLE ONLY pipeline.comply_keyword_library
    ADD CONSTRAINT comply_keyword_library_pkey PRIMARY KEY (id);


--
-- Name: gateway_reidentify_log gateway_reidentify_log_pkey; Type: CONSTRAINT; Schema: pipeline; Owner: -
--

ALTER TABLE ONLY pipeline.gateway_reidentify_log
    ADD CONSTRAINT gateway_reidentify_log_pkey PRIMARY KEY (id);


--
-- Name: gateway_requests gateway_requests_pkey; Type: CONSTRAINT; Schema: pipeline; Owner: -
--

ALTER TABLE ONLY pipeline.gateway_requests
    ADD CONSTRAINT gateway_requests_pkey PRIMARY KEY (id);


--
-- Name: intake_sessions intake_sessions_pkey; Type: CONSTRAINT; Schema: pipeline; Owner: -
--

ALTER TABLE ONLY pipeline.intake_sessions
    ADD CONSTRAINT intake_sessions_pkey PRIMARY KEY (id);


--
-- Name: sanitize_jobs sanitize_jobs_pkey; Type: CONSTRAINT; Schema: pipeline; Owner: -
--

ALTER TABLE ONLY pipeline.sanitize_jobs
    ADD CONSTRAINT sanitize_jobs_pkey PRIMARY KEY (id);


--
-- Name: sanitize_reidentify_audit sanitize_reidentify_audit_pkey; Type: CONSTRAINT; Schema: pipeline; Owner: -
--

ALTER TABLE ONLY pipeline.sanitize_reidentify_audit
    ADD CONSTRAINT sanitize_reidentify_audit_pkey PRIMARY KEY (id);


--
-- Name: sanitize_token_vault sanitize_token_vault_job_id_token_key; Type: CONSTRAINT; Schema: pipeline; Owner: -
--

ALTER TABLE ONLY pipeline.sanitize_token_vault
    ADD CONSTRAINT sanitize_token_vault_job_id_token_key UNIQUE (job_id, token);


--
-- Name: sanitize_token_vault sanitize_token_vault_pkey; Type: CONSTRAINT; Schema: pipeline; Owner: -
--

ALTER TABLE ONLY pipeline.sanitize_token_vault
    ADD CONSTRAINT sanitize_token_vault_pkey PRIMARY KEY (id);


--
-- Name: step_events step_events_pkey; Type: CONSTRAINT; Schema: pipeline; Owner: -
--

ALTER TABLE ONLY pipeline.step_events
    ADD CONSTRAINT step_events_pkey PRIMARY KEY (id);


--
-- Name: analysis_jobs analysis_jobs_pkey; Type: CONSTRAINT; Schema: rt; Owner: -
--

ALTER TABLE ONLY rt.analysis_jobs
    ADD CONSTRAINT analysis_jobs_pkey PRIMARY KEY (id);


--
-- Name: film_sizes film_sizes_pkey; Type: CONSTRAINT; Schema: rt; Owner: -
--

ALTER TABLE ONLY rt.film_sizes
    ADD CONSTRAINT film_sizes_pkey PRIMARY KEY (id);


--
-- Name: incoming_quotes incoming_quotes_pkey; Type: CONSTRAINT; Schema: rt; Owner: -
--

ALTER TABLE ONLY rt.incoming_quotes
    ADD CONSTRAINT incoming_quotes_pkey PRIMARY KEY (id);


--
-- Name: machine_catalog machine_catalog_machine_id_key; Type: CONSTRAINT; Schema: rt; Owner: -
--

ALTER TABLE ONLY rt.machine_catalog
    ADD CONSTRAINT machine_catalog_machine_id_key UNIQUE (machine_id);


--
-- Name: machine_catalog machine_catalog_pkey; Type: CONSTRAINT; Schema: rt; Owner: -
--

ALTER TABLE ONLY rt.machine_catalog
    ADD CONSTRAINT machine_catalog_pkey PRIMARY KEY (id);


--
-- Name: operators operators_pkey; Type: CONSTRAINT; Schema: rt; Owner: -
--

ALTER TABLE ONLY rt.operators
    ADD CONSTRAINT operators_pkey PRIMARY KEY (id);


--
-- Name: part_quotes part_quotes_pkey; Type: CONSTRAINT; Schema: rt; Owner: -
--

ALTER TABLE ONLY rt.part_quotes
    ADD CONSTRAINT part_quotes_pkey PRIMARY KEY (id);


--
-- Name: planning_sessions planning_sessions_pkey; Type: CONSTRAINT; Schema: rt; Owner: -
--

ALTER TABLE ONLY rt.planning_sessions
    ADD CONSTRAINT planning_sessions_pkey PRIMARY KEY (id);


--
-- Name: pricing_tiers pricing_tiers_pkey; Type: CONSTRAINT; Schema: rt; Owner: -
--

ALTER TABLE ONLY rt.pricing_tiers
    ADD CONSTRAINT pricing_tiers_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: rt; Owner: -
--

ALTER TABLE ONLY rt.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: view_rows view_rows_pkey; Type: CONSTRAINT; Schema: rt; Owner: -
--

ALTER TABLE ONLY rt.view_rows
    ADD CONSTRAINT view_rows_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: sf; Owner: -
--

ALTER TABLE ONLY sf.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (sf_id);


--
-- Name: bom_items bom_items_pkey; Type: CONSTRAINT; Schema: sf; Owner: -
--

ALTER TABLE ONLY sf.bom_items
    ADD CONSTRAINT bom_items_pkey PRIMARY KEY (sf_id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: sf; Owner: -
--

ALTER TABLE ONLY sf.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (sf_id);


--
-- Name: contracts contracts_pkey; Type: CONSTRAINT; Schema: sf; Owner: -
--

ALTER TABLE ONLY sf.contracts
    ADD CONSTRAINT contracts_pkey PRIMARY KEY (sf_id);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: sf; Owner: -
--

ALTER TABLE ONLY sf.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (sf_id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: sf; Owner: -
--

ALTER TABLE ONLY sf.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (sf_id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: sf; Owner: -
--

ALTER TABLE ONLY sf.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (sf_id);


--
-- Name: pricebook_entries pricebook_entries_pkey; Type: CONSTRAINT; Schema: sf; Owner: -
--

ALTER TABLE ONLY sf.pricebook_entries
    ADD CONSTRAINT pricebook_entries_pkey PRIMARY KEY (sf_id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: sf; Owner: -
--

ALTER TABLE ONLY sf.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (sf_id);


--
-- Name: products products_product_code_key; Type: CONSTRAINT; Schema: sf; Owner: -
--

ALTER TABLE ONLY sf.products
    ADD CONSTRAINT products_product_code_key UNIQUE (product_code);


--
-- Name: quote_lines quote_lines_pkey; Type: CONSTRAINT; Schema: sf; Owner: -
--

ALTER TABLE ONLY sf.quote_lines
    ADD CONSTRAINT quote_lines_pkey PRIMARY KEY (sf_id);


--
-- Name: quotes quotes_pkey; Type: CONSTRAINT; Schema: sf; Owner: -
--

ALTER TABLE ONLY sf.quotes
    ADD CONSTRAINT quotes_pkey PRIMARY KEY (sf_id);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: ut; Owner: -
--

ALTER TABLE ONLY ut.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: ut; Owner: -
--

ALTER TABLE ONLY ut.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: global_settings global_settings_pkey; Type: CONSTRAINT; Schema: ut; Owner: -
--

ALTER TABLE ONLY ut.global_settings
    ADD CONSTRAINT global_settings_pkey PRIMARY KEY (id);


--
-- Name: incoming_quotes incoming_quotes_pkey; Type: CONSTRAINT; Schema: ut; Owner: -
--

ALTER TABLE ONLY ut.incoming_quotes
    ADD CONSTRAINT incoming_quotes_pkey PRIMARY KEY (id);


--
-- Name: line_items line_items_pkey; Type: CONSTRAINT; Schema: ut; Owner: -
--

ALTER TABLE ONLY ut.line_items
    ADD CONSTRAINT line_items_pkey PRIMARY KEY (id);


--
-- Name: materials materials_pkey; Type: CONSTRAINT; Schema: ut; Owner: -
--

ALTER TABLE ONLY ut.materials
    ADD CONSTRAINT materials_pkey PRIMARY KEY (id);


--
-- Name: quotes quotes_pkey; Type: CONSTRAINT; Schema: ut; Owner: -
--

ALTER TABLE ONLY ut.quotes
    ADD CONSTRAINT quotes_pkey PRIMARY KEY (id);


--
-- Name: calculation_traces calculation_traces_pkey; Type: CONSTRAINT; Schema: ut_rules; Owner: -
--

ALTER TABLE ONLY ut_rules.calculation_traces
    ADD CONSTRAINT calculation_traces_pkey PRIMARY KEY (id);


--
-- Name: change_log change_log_pkey; Type: CONSTRAINT; Schema: ut_rules; Owner: -
--

ALTER TABLE ONLY ut_rules.change_log
    ADD CONSTRAINT change_log_pkey PRIMARY KEY (id);


--
-- Name: rule_set_versions rule_set_versions_pkey; Type: CONSTRAINT; Schema: ut_rules; Owner: -
--

ALTER TABLE ONLY ut_rules.rule_set_versions
    ADD CONSTRAINT rule_set_versions_pkey PRIMARY KEY (id);


--
-- Name: rule_set_versions rule_set_versions_rule_set_id_version_key; Type: CONSTRAINT; Schema: ut_rules; Owner: -
--

ALTER TABLE ONLY ut_rules.rule_set_versions
    ADD CONSTRAINT rule_set_versions_rule_set_id_version_key UNIQUE (rule_set_id, version);


--
-- Name: rule_sets rule_sets_name_key; Type: CONSTRAINT; Schema: ut_rules; Owner: -
--

ALTER TABLE ONLY ut_rules.rule_sets
    ADD CONSTRAINT rule_sets_name_key UNIQUE (name);


--
-- Name: rule_sets rule_sets_pkey; Type: CONSTRAINT; Schema: ut_rules; Owner: -
--

ALTER TABLE ONLY ut_rules.rule_sets
    ADD CONSTRAINT rule_sets_pkey PRIMARY KEY (id);


--
-- Name: rules rules_pkey; Type: CONSTRAINT; Schema: ut_rules; Owner: -
--

ALTER TABLE ONLY ut_rules.rules
    ADD CONSTRAINT rules_pkey PRIMARY KEY (id);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: workshop; Owner: -
--

ALTER TABLE ONLY workshop.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: machine_offline_windows machine_offline_windows_pkey; Type: CONSTRAINT; Schema: workshop; Owner: -
--

ALTER TABLE ONLY workshop.machine_offline_windows
    ADD CONSTRAINT machine_offline_windows_pkey PRIMARY KEY (id);


--
-- Name: machines machines_pkey; Type: CONSTRAINT; Schema: workshop; Owner: -
--

ALTER TABLE ONLY workshop.machines
    ADD CONSTRAINT machines_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_number_key; Type: CONSTRAINT; Schema: workshop; Owner: -
--

ALTER TABLE ONLY workshop.orders
    ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: workshop; Owner: -
--

ALTER TABLE ONLY workshop.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: settings settings_key_key; Type: CONSTRAINT; Schema: workshop; Owner: -
--

ALTER TABLE ONLY workshop.settings
    ADD CONSTRAINT settings_key_key UNIQUE (key);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: workshop; Owner: -
--

ALTER TABLE ONLY workshop.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: idx_diagram_analyses_created_at; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_diagram_analyses_created_at ON app.diagram_analyses USING btree (created_at DESC);


--
-- Name: idx_diagram_analyses_email_quote; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_diagram_analyses_email_quote ON app.diagram_analyses USING btree (email_quote_id) WHERE (email_quote_id IS NOT NULL);


--
-- Name: idx_diagram_analyses_inspection_type; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_diagram_analyses_inspection_type ON app.diagram_analyses USING btree (inspection_type);


--
-- Name: idx_diagram_analyses_quote_number; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_diagram_analyses_quote_number ON app.diagram_analyses USING btree (quote_number);


--
-- Name: idx_doc_audit_created; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_doc_audit_created ON app.document_audit_log USING btree (created_at);


--
-- Name: idx_email_quotes_customer_id; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_email_quotes_customer_id ON app.email_quotes USING btree (customer_id) WHERE (customer_id IS NOT NULL);


--
-- Name: idx_email_quotes_received_at; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_email_quotes_received_at ON app.email_quotes USING btree (received_at DESC);


--
-- Name: idx_email_quotes_status; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_email_quotes_status ON app.email_quotes USING btree (status);


--
-- Name: idx_email_quotes_thread_id; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_email_quotes_thread_id ON app.email_quotes USING btree (gmail_thread_id);


--
-- Name: idx_email_threads_quote_id; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_email_threads_quote_id ON app.email_threads USING btree (email_quote_id, created_at);


--
-- Name: idx_folder_references_alias_active; Type: INDEX; Schema: app; Owner: -
--

CREATE UNIQUE INDEX idx_folder_references_alias_active ON app.folder_references USING btree (alias) WHERE (is_active = true);


--
-- Name: idx_quote_audit_log_quote_id; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_quote_audit_log_quote_id ON app.quote_audit_log USING btree (quote_id);


--
-- Name: job_runs_name_idx; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX job_runs_name_idx ON app.job_runs USING btree (job_name);


--
-- Name: job_runs_started_idx; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX job_runs_started_idx ON app.job_runs USING btree (started_at DESC);


--
-- Name: idx_access_log_action; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_access_log_action ON auth.access_log USING btree (action);


--
-- Name: idx_access_log_created_at; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_access_log_created_at ON auth.access_log USING btree (created_at DESC);


--
-- Name: idx_access_log_user_id; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_access_log_user_id ON auth.access_log USING btree (user_id);


--
-- Name: idx_user_permissions_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_permissions_user ON auth.user_permissions USING btree (user_id);


--
-- Name: idx_user_roles_tenant_id; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_roles_tenant_id ON auth.user_roles USING btree (tenant_id);


--
-- Name: idx_user_roles_user_id; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_roles_user_id ON auth.user_roles USING btree (user_id);


--
-- Name: idx_comply_docs_intake; Type: INDEX; Schema: pipeline; Owner: -
--

CREATE INDEX idx_comply_docs_intake ON pipeline.comply_documents USING btree (intake_id);


--
-- Name: idx_gateway_intake; Type: INDEX; Schema: pipeline; Owner: -
--

CREATE INDEX idx_gateway_intake ON pipeline.gateway_requests USING btree (intake_id);


--
-- Name: idx_intake_sessions_email_domain; Type: INDEX; Schema: pipeline; Owner: -
--

CREATE INDEX idx_intake_sessions_email_domain ON pipeline.intake_sessions USING btree (lower(split_part(email_from, '@'::text, 2))) WHERE (email_from IS NOT NULL);


--
-- Name: idx_intake_sessions_email_from; Type: INDEX; Schema: pipeline; Owner: -
--

CREATE INDEX idx_intake_sessions_email_from ON pipeline.intake_sessions USING btree (email_from) WHERE (email_from IS NOT NULL);


--
-- Name: idx_intake_sessions_rt_quote_id; Type: INDEX; Schema: pipeline; Owner: -
--

CREATE INDEX idx_intake_sessions_rt_quote_id ON pipeline.intake_sessions USING btree (rt_quote_id) WHERE (rt_quote_id IS NOT NULL);


--
-- Name: idx_intake_status; Type: INDEX; Schema: pipeline; Owner: -
--

CREATE INDEX idx_intake_status ON pipeline.intake_sessions USING btree (status);


--
-- Name: idx_kwaudit_changed_at; Type: INDEX; Schema: pipeline; Owner: -
--

CREATE INDEX idx_kwaudit_changed_at ON pipeline.comply_keyword_audit_log USING btree (changed_at DESC);


--
-- Name: idx_kwaudit_keyword_id; Type: INDEX; Schema: pipeline; Owner: -
--

CREATE INDEX idx_kwaudit_keyword_id ON pipeline.comply_keyword_audit_log USING btree (keyword_id);


--
-- Name: idx_sanitize_jobs_comply; Type: INDEX; Schema: pipeline; Owner: -
--

CREATE INDEX idx_sanitize_jobs_comply ON pipeline.sanitize_jobs USING btree (comply_doc_id);


--
-- Name: idx_step_events_intake; Type: INDEX; Schema: pipeline; Owner: -
--

CREATE INDEX idx_step_events_intake ON pipeline.step_events USING btree (intake_id, created_at);


--
-- Name: idx_vault_job; Type: INDEX; Schema: pipeline; Owner: -
--

CREATE INDEX idx_vault_job ON pipeline.sanitize_token_vault USING btree (job_id);


--
-- Name: idx_analysis_jobs_created; Type: INDEX; Schema: rt; Owner: -
--

CREATE INDEX idx_analysis_jobs_created ON rt.analysis_jobs USING btree (created_at DESC);


--
-- Name: idx_analysis_jobs_quote; Type: INDEX; Schema: rt; Owner: -
--

CREATE INDEX idx_analysis_jobs_quote ON rt.analysis_jobs USING btree (quote_id);


--
-- Name: idx_analysis_jobs_status; Type: INDEX; Schema: rt; Owner: -
--

CREATE INDEX idx_analysis_jobs_status ON rt.analysis_jobs USING btree (status);


--
-- Name: bom_parts_account_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX bom_parts_account_idx ON sf.bom_parts USING btree (account_sf_id);


--
-- Name: bom_parts_part_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX bom_parts_part_idx ON sf.bom_parts USING btree (part_number);


--
-- Name: sf_accounts_credit_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_accounts_credit_idx ON sf.accounts USING btree (credit_hold) WHERE (credit_hold = true);


--
-- Name: sf_accounts_faa_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_accounts_faa_idx ON sf.accounts USING btree (faa_account) WHERE (faa_account = true);


--
-- Name: sf_accounts_mkt_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_accounts_mkt_idx ON sf.accounts USING btree (market) WHERE (market IS NOT NULL);


--
-- Name: sf_accounts_region_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_accounts_region_idx ON sf.accounts USING btree (region) WHERE (region IS NOT NULL);


--
-- Name: sf_bom_items_account_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_bom_items_account_idx ON sf.bom_items USING btree (account_sf_id);


--
-- Name: sf_bom_items_active_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_bom_items_active_idx ON sf.bom_items USING btree (is_active) WHERE (is_active = true);


--
-- Name: sf_bom_items_part_acct_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_bom_items_part_acct_idx ON sf.bom_items USING btree (part_number, account_sf_id);


--
-- Name: sf_bom_items_part_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_bom_items_part_idx ON sf.bom_items USING btree (part_number);


--
-- Name: sf_contacts_account_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_contacts_account_idx ON sf.contacts USING btree (account_sf_id);


--
-- Name: sf_contacts_email_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_contacts_email_idx ON sf.contacts USING btree (email) WHERE (email IS NOT NULL);


--
-- Name: sf_contacts_name_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_contacts_name_idx ON sf.contacts USING btree (last_name, first_name);


--
-- Name: sf_contracts_account_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_contracts_account_idx ON sf.contracts USING btree (account_sf_id);


--
-- Name: sf_contracts_dates_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_contracts_dates_idx ON sf.contracts USING btree (start_date, end_date);


--
-- Name: sf_contracts_status_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_contracts_status_idx ON sf.contracts USING btree (status) WHERE (status IS NOT NULL);


--
-- Name: sf_jobs_account_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_jobs_account_idx ON sf.jobs USING btree (account_sf_id);


--
-- Name: sf_jobs_billing_status_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_jobs_billing_status_idx ON sf.jobs USING btree (billing_status) WHERE (billing_status IS NOT NULL);


--
-- Name: sf_jobs_contact_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_jobs_contact_idx ON sf.jobs USING btree (contact_sf_id) WHERE (contact_sf_id IS NOT NULL);


--
-- Name: sf_jobs_due_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_jobs_due_idx ON sf.jobs USING btree (date_due) WHERE (date_due IS NOT NULL);


--
-- Name: sf_jobs_expedite_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_jobs_expedite_idx ON sf.jobs USING btree (expedite) WHERE (expedite = true);


--
-- Name: sf_jobs_faa_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_jobs_faa_idx ON sf.jobs USING btree (faa_job) WHERE (faa_job = true);


--
-- Name: sf_jobs_invoice_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_jobs_invoice_idx ON sf.jobs USING btree (invoice_number) WHERE (invoice_number IS NOT NULL);


--
-- Name: sf_jobs_lab_status_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_jobs_lab_status_idx ON sf.jobs USING btree (lab_status) WHERE (lab_status IS NOT NULL);


--
-- Name: sf_jobs_owner_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_jobs_owner_idx ON sf.jobs USING btree (owner_name) WHERE (owner_name IS NOT NULL);


--
-- Name: sf_jobs_part_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_jobs_part_idx ON sf.jobs USING btree (part_number) WHERE (part_number IS NOT NULL);


--
-- Name: sf_jobs_part_last_used_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_jobs_part_last_used_idx ON sf.jobs USING btree (account_sf_id, part_number, COALESCE(date_completed, date_received) DESC NULLS LAST) WHERE ((part_number IS NOT NULL) AND (part_number <> ''::text));


--
-- Name: sf_jobs_stage_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_jobs_stage_idx ON sf.jobs USING btree (stage_name) WHERE (stage_name IS NOT NULL);


--
-- Name: sf_jobs_won_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_jobs_won_idx ON sf.jobs USING btree (is_won) WHERE (is_won = true);


--
-- Name: sf_order_items_order_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_order_items_order_idx ON sf.order_items USING btree (order_sf_id);


--
-- Name: sf_order_items_product_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_order_items_product_idx ON sf.order_items USING btree (product_sf_id) WHERE (product_sf_id IS NOT NULL);


--
-- Name: sf_orders_account_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_orders_account_idx ON sf.orders USING btree (account_sf_id);


--
-- Name: sf_orders_date_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_orders_date_idx ON sf.orders USING btree (order_start_date) WHERE (order_start_date IS NOT NULL);


--
-- Name: sf_orders_opp_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_orders_opp_idx ON sf.orders USING btree (opportunity_sf_id) WHERE (opportunity_sf_id IS NOT NULL);


--
-- Name: sf_orders_status_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_orders_status_idx ON sf.orders USING btree (status) WHERE (status IS NOT NULL);


--
-- Name: sf_pbe_active_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_pbe_active_idx ON sf.pricebook_entries USING btree (is_active) WHERE (is_active = true);


--
-- Name: sf_pbe_pricebook_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_pbe_pricebook_idx ON sf.pricebook_entries USING btree (pricebook_name) WHERE (pricebook_name IS NOT NULL);


--
-- Name: sf_pbe_product_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_pbe_product_idx ON sf.pricebook_entries USING btree (product_sf_id);


--
-- Name: sf_quote_lines_quote_idx; Type: INDEX; Schema: sf; Owner: -
--

CREATE INDEX sf_quote_lines_quote_idx ON sf.quote_lines USING btree (quote_sf_id);


--
-- Name: idx_customers_domain; Type: INDEX; Schema: ut; Owner: -
--

CREATE INDEX idx_customers_domain ON ut.customers USING btree (lower(domain));


--
-- Name: idx_customers_email; Type: INDEX; Schema: ut; Owner: -
--

CREATE INDEX idx_customers_email ON ut.customers USING btree (lower(email));


--
-- Name: idx_cl_rule_set_id; Type: INDEX; Schema: ut_rules; Owner: -
--

CREATE INDEX idx_cl_rule_set_id ON ut_rules.change_log USING btree (rule_set_id);


--
-- Name: idx_ct_calculated_at; Type: INDEX; Schema: ut_rules; Owner: -
--

CREATE INDEX idx_ct_calculated_at ON ut_rules.calculation_traces USING btree (calculated_at DESC);


--
-- Name: idx_ct_quote_id; Type: INDEX; Schema: ut_rules; Owner: -
--

CREATE INDEX idx_ct_quote_id ON ut_rules.calculation_traces USING btree (quote_id);


--
-- Name: idx_ct_rule_set; Type: INDEX; Schema: ut_rules; Owner: -
--

CREATE INDEX idx_ct_rule_set ON ut_rules.calculation_traces USING btree (rule_set_name, rule_set_version);


--
-- Name: idx_rsv_latest; Type: INDEX; Schema: ut_rules; Owner: -
--

CREATE INDEX idx_rsv_latest ON ut_rules.rule_set_versions USING btree (rule_set_id, is_latest) WHERE (is_latest = true);


--
-- Name: idx_rsv_rule_set_id; Type: INDEX; Schema: ut_rules; Owner: -
--

CREATE INDEX idx_rsv_rule_set_id ON ut_rules.rule_set_versions USING btree (rule_set_id);


--
-- Name: idx_rules_category; Type: INDEX; Schema: ut_rules; Owner: -
--

CREATE INDEX idx_rules_category ON ut_rules.rules USING btree (version_id, category);


--
-- Name: idx_rules_version_id; Type: INDEX; Schema: ut_rules; Owner: -
--

CREATE INDEX idx_rules_version_id ON ut_rules.rules USING btree (version_id);


--
-- Name: idx_offline_windows_machine; Type: INDEX; Schema: workshop; Owner: -
--

CREATE INDEX idx_offline_windows_machine ON workshop.machine_offline_windows USING btree (machine_id, start_at, end_at);


--
-- Name: idx_workshop_jobs_assigned_machine; Type: INDEX; Schema: workshop; Owner: -
--

CREATE INDEX idx_workshop_jobs_assigned_machine ON workshop.jobs USING btree (assigned_machine, scheduled_start) WHERE (assigned_machine IS NOT NULL);


--
-- Name: idx_workshop_jobs_order_id; Type: INDEX; Schema: workshop; Owner: -
--

CREATE INDEX idx_workshop_jobs_order_id ON workshop.jobs USING btree (order_id);


--
-- Name: idx_workshop_jobs_status; Type: INDEX; Schema: workshop; Owner: -
--

CREATE INDEX idx_workshop_jobs_status ON workshop.jobs USING btree (status);


--
-- Name: idx_workshop_jobs_type_scheduled; Type: INDEX; Schema: workshop; Owner: -
--

CREATE INDEX idx_workshop_jobs_type_scheduled ON workshop.jobs USING btree (inspection_type, scheduled_start);


--
-- Name: idx_workshop_machines_type; Type: INDEX; Schema: workshop; Owner: -
--

CREATE INDEX idx_workshop_machines_type ON workshop.machines USING btree (type) WHERE (is_active = true);


--
-- Name: idx_workshop_orders_is_simulated; Type: INDEX; Schema: workshop; Owner: -
--

CREATE INDEX idx_workshop_orders_is_simulated ON workshop.orders USING btree (is_simulated);


--
-- Name: idx_workshop_orders_status; Type: INDEX; Schema: workshop; Owner: -
--

CREATE INDEX idx_workshop_orders_status ON workshop.orders USING btree (status);


--
-- Name: workshop_machines_rt_catalog_id_uniq; Type: INDEX; Schema: workshop; Owner: -
--

CREATE UNIQUE INDEX workshop_machines_rt_catalog_id_uniq ON workshop.machines USING btree (rt_catalog_id) WHERE (rt_catalog_id IS NOT NULL);


--
-- Name: incoming_quotes trg_rt_quote_number; Type: TRIGGER; Schema: rt; Owner: -
--

CREATE TRIGGER trg_rt_quote_number BEFORE INSERT ON rt.incoming_quotes FOR EACH ROW EXECUTE FUNCTION rt.set_quote_number();


--
-- Name: incoming_quotes trg_quote_number; Type: TRIGGER; Schema: ut; Owner: -
--

CREATE TRIGGER trg_quote_number BEFORE INSERT ON ut.incoming_quotes FOR EACH ROW EXECUTE FUNCTION ut.set_quote_number();


--
-- Name: diagram_analyses diagram_analyses_email_quote_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.diagram_analyses
    ADD CONSTRAINT diagram_analyses_email_quote_id_fkey FOREIGN KEY (email_quote_id) REFERENCES app.email_quotes(id) ON DELETE SET NULL;


--
-- Name: email_threads email_threads_email_quote_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.email_threads
    ADD CONSTRAINT email_threads_email_quote_id_fkey FOREIGN KEY (email_quote_id) REFERENCES app.email_quotes(id) ON DELETE CASCADE;


--
-- Name: inspection_steps inspection_steps_inspection_type_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.inspection_steps
    ADD CONSTRAINT inspection_steps_inspection_type_id_fkey FOREIGN KEY (inspection_type_id) REFERENCES app.inspection_types(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES auth.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES auth.roles(id) ON DELETE CASCADE;


--
-- Name: roles roles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.roles
    ADD CONSTRAINT roles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES auth.tenants(id);


--
-- Name: user_permissions user_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.user_permissions
    ADD CONSTRAINT user_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES auth.permissions(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES auth.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.user_roles
    ADD CONSTRAINT user_roles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES auth.tenants(id);


--
-- Name: users users_tenant_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES auth.tenants(id);


--
-- Name: gateway_reidentify_log gateway_reidentify_log_gateway_req_id_fkey; Type: FK CONSTRAINT; Schema: pipeline; Owner: -
--

ALTER TABLE ONLY pipeline.gateway_reidentify_log
    ADD CONSTRAINT gateway_reidentify_log_gateway_req_id_fkey FOREIGN KEY (gateway_req_id) REFERENCES pipeline.gateway_requests(id);


--
-- Name: gateway_requests gateway_requests_sanitize_job_id_fkey; Type: FK CONSTRAINT; Schema: pipeline; Owner: -
--

ALTER TABLE ONLY pipeline.gateway_requests
    ADD CONSTRAINT gateway_requests_sanitize_job_id_fkey FOREIGN KEY (sanitize_job_id) REFERENCES pipeline.sanitize_jobs(id);


--
-- Name: sanitize_jobs sanitize_jobs_comply_doc_id_fkey; Type: FK CONSTRAINT; Schema: pipeline; Owner: -
--

ALTER TABLE ONLY pipeline.sanitize_jobs
    ADD CONSTRAINT sanitize_jobs_comply_doc_id_fkey FOREIGN KEY (comply_doc_id) REFERENCES pipeline.comply_documents(id);


--
-- Name: sanitize_reidentify_audit sanitize_reidentify_audit_job_id_fkey; Type: FK CONSTRAINT; Schema: pipeline; Owner: -
--

ALTER TABLE ONLY pipeline.sanitize_reidentify_audit
    ADD CONSTRAINT sanitize_reidentify_audit_job_id_fkey FOREIGN KEY (job_id) REFERENCES pipeline.sanitize_jobs(id);


--
-- Name: sanitize_token_vault sanitize_token_vault_job_id_fkey; Type: FK CONSTRAINT; Schema: pipeline; Owner: -
--

ALTER TABLE ONLY pipeline.sanitize_token_vault
    ADD CONSTRAINT sanitize_token_vault_job_id_fkey FOREIGN KEY (job_id) REFERENCES pipeline.sanitize_jobs(id);


--
-- Name: analysis_jobs analysis_jobs_quote_id_fkey; Type: FK CONSTRAINT; Schema: rt; Owner: -
--

ALTER TABLE ONLY rt.analysis_jobs
    ADD CONSTRAINT analysis_jobs_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES rt.part_quotes(id) ON DELETE SET NULL;


--
-- Name: view_rows view_rows_film_size_id_fkey; Type: FK CONSTRAINT; Schema: rt; Owner: -
--

ALTER TABLE ONLY rt.view_rows
    ADD CONSTRAINT view_rows_film_size_id_fkey FOREIGN KEY (film_size_id) REFERENCES rt.film_sizes(id);


--
-- Name: view_rows view_rows_quote_id_fkey; Type: FK CONSTRAINT; Schema: rt; Owner: -
--

ALTER TABLE ONLY rt.view_rows
    ADD CONSTRAINT view_rows_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES rt.part_quotes(id) ON DELETE CASCADE;


--
-- Name: bom_items bom_items_account_sf_id_fkey; Type: FK CONSTRAINT; Schema: sf; Owner: -
--

ALTER TABLE ONLY sf.bom_items
    ADD CONSTRAINT bom_items_account_sf_id_fkey FOREIGN KEY (account_sf_id) REFERENCES sf.accounts(sf_id);


--
-- Name: contacts contacts_account_sf_id_fkey; Type: FK CONSTRAINT; Schema: sf; Owner: -
--

ALTER TABLE ONLY sf.contacts
    ADD CONSTRAINT contacts_account_sf_id_fkey FOREIGN KEY (account_sf_id) REFERENCES sf.accounts(sf_id);


--
-- Name: contracts contracts_account_sf_id_fkey; Type: FK CONSTRAINT; Schema: sf; Owner: -
--

ALTER TABLE ONLY sf.contracts
    ADD CONSTRAINT contracts_account_sf_id_fkey FOREIGN KEY (account_sf_id) REFERENCES sf.accounts(sf_id);


--
-- Name: jobs jobs_account_sf_id_fkey; Type: FK CONSTRAINT; Schema: sf; Owner: -
--

ALTER TABLE ONLY sf.jobs
    ADD CONSTRAINT jobs_account_sf_id_fkey FOREIGN KEY (account_sf_id) REFERENCES sf.accounts(sf_id);


--
-- Name: order_items order_items_order_sf_id_fkey; Type: FK CONSTRAINT; Schema: sf; Owner: -
--

ALTER TABLE ONLY sf.order_items
    ADD CONSTRAINT order_items_order_sf_id_fkey FOREIGN KEY (order_sf_id) REFERENCES sf.orders(sf_id);


--
-- Name: order_items order_items_product_sf_id_fkey; Type: FK CONSTRAINT; Schema: sf; Owner: -
--

ALTER TABLE ONLY sf.order_items
    ADD CONSTRAINT order_items_product_sf_id_fkey FOREIGN KEY (product_sf_id) REFERENCES sf.products(sf_id);


--
-- Name: orders orders_account_sf_id_fkey; Type: FK CONSTRAINT; Schema: sf; Owner: -
--

ALTER TABLE ONLY sf.orders
    ADD CONSTRAINT orders_account_sf_id_fkey FOREIGN KEY (account_sf_id) REFERENCES sf.accounts(sf_id);


--
-- Name: orders orders_opportunity_sf_id_fkey; Type: FK CONSTRAINT; Schema: sf; Owner: -
--

ALTER TABLE ONLY sf.orders
    ADD CONSTRAINT orders_opportunity_sf_id_fkey FOREIGN KEY (opportunity_sf_id) REFERENCES sf.jobs(sf_id);


--
-- Name: pricebook_entries pricebook_entries_product_sf_id_fkey; Type: FK CONSTRAINT; Schema: sf; Owner: -
--

ALTER TABLE ONLY sf.pricebook_entries
    ADD CONSTRAINT pricebook_entries_product_sf_id_fkey FOREIGN KEY (product_sf_id) REFERENCES sf.products(sf_id);


--
-- Name: quote_lines quote_lines_quote_sf_id_fkey; Type: FK CONSTRAINT; Schema: sf; Owner: -
--

ALTER TABLE ONLY sf.quote_lines
    ADD CONSTRAINT quote_lines_quote_sf_id_fkey FOREIGN KEY (quote_sf_id) REFERENCES sf.quotes(sf_id);


--
-- Name: quotes quotes_account_sf_id_fkey; Type: FK CONSTRAINT; Schema: sf; Owner: -
--

ALTER TABLE ONLY sf.quotes
    ADD CONSTRAINT quotes_account_sf_id_fkey FOREIGN KEY (account_sf_id) REFERENCES sf.accounts(sf_id);


--
-- Name: quotes quotes_job_sf_id_fkey; Type: FK CONSTRAINT; Schema: sf; Owner: -
--

ALTER TABLE ONLY sf.quotes
    ADD CONSTRAINT quotes_job_sf_id_fkey FOREIGN KEY (job_sf_id) REFERENCES sf.jobs(sf_id);


--
-- Name: customers customers_rule_set_id_fkey; Type: FK CONSTRAINT; Schema: ut; Owner: -
--

ALTER TABLE ONLY ut.customers
    ADD CONSTRAINT customers_rule_set_id_fkey FOREIGN KEY (rule_set_id) REFERENCES ut_rules.rule_sets(id);


--
-- Name: incoming_quotes incoming_quotes_customer_id_fkey; Type: FK CONSTRAINT; Schema: ut; Owner: -
--

ALTER TABLE ONLY ut.incoming_quotes
    ADD CONSTRAINT incoming_quotes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES ut.customers(id);


--
-- Name: incoming_quotes incoming_quotes_intake_id_fkey; Type: FK CONSTRAINT; Schema: ut; Owner: -
--

ALTER TABLE ONLY ut.incoming_quotes
    ADD CONSTRAINT incoming_quotes_intake_id_fkey FOREIGN KEY (intake_id) REFERENCES pipeline.intake_sessions(id) ON DELETE SET NULL;


--
-- Name: incoming_quotes incoming_quotes_rule_set_version_id_fkey; Type: FK CONSTRAINT; Schema: ut; Owner: -
--

ALTER TABLE ONLY ut.incoming_quotes
    ADD CONSTRAINT incoming_quotes_rule_set_version_id_fkey FOREIGN KEY (rule_set_version_id) REFERENCES ut_rules.rule_set_versions(id);


--
-- Name: line_items line_items_material_id_fkey; Type: FK CONSTRAINT; Schema: ut; Owner: -
--

ALTER TABLE ONLY ut.line_items
    ADD CONSTRAINT line_items_material_id_fkey FOREIGN KEY (material_id) REFERENCES ut.materials(id);


--
-- Name: line_items line_items_quote_id_fkey; Type: FK CONSTRAINT; Schema: ut; Owner: -
--

ALTER TABLE ONLY ut.line_items
    ADD CONSTRAINT line_items_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES ut.quotes(id) ON DELETE CASCADE;


--
-- Name: quotes quotes_customer_id_fkey; Type: FK CONSTRAINT; Schema: ut; Owner: -
--

ALTER TABLE ONLY ut.quotes
    ADD CONSTRAINT quotes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES ut.customers(id);


--
-- Name: calculation_traces calculation_traces_rule_set_version_id_fkey; Type: FK CONSTRAINT; Schema: ut_rules; Owner: -
--

ALTER TABLE ONLY ut_rules.calculation_traces
    ADD CONSTRAINT calculation_traces_rule_set_version_id_fkey FOREIGN KEY (rule_set_version_id) REFERENCES ut_rules.rule_set_versions(id);


--
-- Name: change_log change_log_rule_set_id_fkey; Type: FK CONSTRAINT; Schema: ut_rules; Owner: -
--

ALTER TABLE ONLY ut_rules.change_log
    ADD CONSTRAINT change_log_rule_set_id_fkey FOREIGN KEY (rule_set_id) REFERENCES ut_rules.rule_sets(id);


--
-- Name: rule_set_versions rule_set_versions_rule_set_id_fkey; Type: FK CONSTRAINT; Schema: ut_rules; Owner: -
--

ALTER TABLE ONLY ut_rules.rule_set_versions
    ADD CONSTRAINT rule_set_versions_rule_set_id_fkey FOREIGN KEY (rule_set_id) REFERENCES ut_rules.rule_sets(id) ON DELETE CASCADE;


--
-- Name: rules rules_version_id_fkey; Type: FK CONSTRAINT; Schema: ut_rules; Owner: -
--

ALTER TABLE ONLY ut_rules.rules
    ADD CONSTRAINT rules_version_id_fkey FOREIGN KEY (version_id) REFERENCES ut_rules.rule_set_versions(id) ON DELETE CASCADE;


--
-- Name: jobs jobs_assigned_machine_fkey; Type: FK CONSTRAINT; Schema: workshop; Owner: -
--

ALTER TABLE ONLY workshop.jobs
    ADD CONSTRAINT jobs_assigned_machine_fkey FOREIGN KEY (assigned_machine) REFERENCES workshop.machines(id) ON DELETE SET NULL;


--
-- Name: jobs jobs_order_id_fkey; Type: FK CONSTRAINT; Schema: workshop; Owner: -
--

ALTER TABLE ONLY workshop.jobs
    ADD CONSTRAINT jobs_order_id_fkey FOREIGN KEY (order_id) REFERENCES workshop.orders(id) ON DELETE CASCADE;


--
-- Name: machine_offline_windows machine_offline_windows_machine_id_fkey; Type: FK CONSTRAINT; Schema: workshop; Owner: -
--

ALTER TABLE ONLY workshop.machine_offline_windows
    ADD CONSTRAINT machine_offline_windows_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES workshop.machines(id) ON DELETE CASCADE;


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: workshop; Owner: -
--

ALTER TABLE ONLY workshop.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES ut.customers(id);


--
-- PostgreSQL database dump complete
--

\unrestrict 3HfVd1GQm9QWXM55wFkFy7Luc5DOwr5hBiRtcHpcBasBLGs9myileyYEc8Fzg2J

