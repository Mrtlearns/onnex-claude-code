\set ON_ERROR_STOP on

BEGIN;

-- =============================================================================
-- 001_core_schema.sql
-- CMMC Compliance OS — Core Schema
-- Database: cmmc_main
-- Extensions required: uuid-ossp, pgvector, pgcrypto (pre-enabled)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------------

CREATE TYPE org_status AS ENUM (
    'active',
    'inactive',
    'suspended'
);

CREATE TYPE user_role AS ENUM (
    'msp_admin',
    'client_admin',
    'contributor',
    'viewer'
);

CREATE TYPE program_status AS ENUM (
    'scoping',
    'in_progress',
    'assessment_ready',
    'certified'
);

CREATE TYPE control_status AS ENUM (
    'not_yet_assessed',
    'not_yet_addressed',
    'implementation_planned',
    'implementation_begun',
    'fully_implemented',
    'not_applicable'
);

CREATE TYPE assignment_status AS ENUM (
    'unassigned',
    'assigned',
    'submitted',
    'in_review',
    'accepted',
    'rejected'
);

CREATE TYPE artifact_status AS ENUM (
    'pending',
    'processing',
    'assessed',
    'failed'
);

CREATE TYPE assessment_verdict AS ENUM (
    'pass',
    'partial',
    'fail',
    'not_applicable'
);

CREATE TYPE diy_type AS ENUM (
    'diy',
    'outsource',
    'hybrid'
);

CREATE TYPE resource_estimate AS ENUM (
    'funded',
    'unfunded',
    'reallocated'
);

-- ---------------------------------------------------------------------------
-- TABLE: control_definitions
-- Seeded master list of NIST SP 800-171 Rev 2 controls — read-only at runtime.
-- Self-referencing FK for sub-objectives (parent_control_id).
-- ---------------------------------------------------------------------------

CREATE TABLE control_definitions (
    id                       UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    nist_id                  VARCHAR(20)  UNIQUE NOT NULL,
    nist_sort_order          VARCHAR(20),
    cmmc_id                  VARCHAR(30),
    family                   VARCHAR(100),
    family_abbrev            VARCHAR(5),
    far_above_phase          VARCHAR(2),
    far_above_sort_order     VARCHAR(20),
    diy_type                 diy_type,
    is_objective             BOOLEAN      DEFAULT FALSE,
    parent_control_id        UUID         REFERENCES control_definitions(id),
    dod_score_value          INTEGER,
    requirement_text         TEXT,
    assessment_objective     TEXT,
    dod_comment              TEXT,
    acceptable_proof_guidance TEXT,
    is_basic                 BOOLEAN      DEFAULT FALSE,
    created_at               TIMESTAMPTZ  DEFAULT NOW()
);

COMMENT ON TABLE control_definitions IS 'Master seeded list of NIST SP 800-171 Rev 2 controls and sub-objectives. Not modified at runtime.';
COMMENT ON COLUMN control_definitions.dod_score_value IS 'DoD scoring weight: 1, 3, or 5. NULL for sub-objectives.';
COMMENT ON COLUMN control_definitions.far_above_phase IS 'FAR & Above implementation phase: 1–5.';

-- ---------------------------------------------------------------------------
-- TABLE: orgs
-- MSP tenant and client organizations.
-- ---------------------------------------------------------------------------

CREATE TABLE orgs (
    id                      UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                    VARCHAR(200) NOT NULL,
    slug                    VARCHAR(100) UNIQUE NOT NULL,
    status                  org_status   DEFAULT 'active',
    cage_code               VARCHAR(10),
    primary_contact_name    VARCHAR(200),
    primary_contact_email   VARCHAR(200),
    primary_contact_phone   VARCHAR(50),
    primary_contact_title   VARCHAR(100),
    created_at              TIMESTAMPTZ  DEFAULT NOW(),
    updated_at              TIMESTAMPTZ  DEFAULT NOW()
);

COMMENT ON TABLE orgs IS 'MSP and defense contractor client organizations. Multi-tenant root.';

-- ---------------------------------------------------------------------------
-- TABLE: users
-- Platform users. Authentik provides auth; this table stores profile + role.
-- ---------------------------------------------------------------------------

CREATE TABLE users (
    id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    authentik_id  VARCHAR(200) UNIQUE,
    email         VARCHAR(200) UNIQUE NOT NULL,
    full_name     VARCHAR(200),
    role          user_role    DEFAULT 'viewer',
    org_id        UUID         REFERENCES orgs(id) ON DELETE SET NULL,
    is_msp_staff  BOOLEAN      DEFAULT FALSE,
    is_active     BOOLEAN      DEFAULT TRUE,
    created_at    TIMESTAMPTZ  DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  DEFAULT NOW()
);

COMMENT ON TABLE users IS 'Platform users. authentik_id links to Authentik SSO identity.';
COMMENT ON COLUMN users.is_msp_staff IS 'TRUE for MSP employees who can access all client programs.';

-- ---------------------------------------------------------------------------
-- TABLE: programs
-- A compliance program for one org — tracks one CUI boundary / system.
-- Stores SPRS scoring and SSP narrative fields.
-- ---------------------------------------------------------------------------

CREATE TABLE programs (
    id                          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id                      UUID         NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    name                        VARCHAR(200) NOT NULL,
    status                      program_status DEFAULT 'scoping',
    system_name                 VARCHAR(200),
    cage_codes                  TEXT[]       DEFAULT '{}',
    sprs_score                  INTEGER      DEFAULT -203,
    far_above_score             INTEGER      DEFAULT 0,
    current_phase               VARCHAR(2)   DEFAULT '1',
    topology_narrative          TEXT,
    topology_diagram_url        TEXT,
    ssp_system_description      TEXT,
    ssp_environment_of_operation TEXT,
    ssp_information_types       TEXT,
    ssp_security_requirements   TEXT,
    ssp_interconnections        TEXT,
    ssp_authoring_date          DATE,
    ssp_last_review_date        DATE,
    created_at                  TIMESTAMPTZ  DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ  DEFAULT NOW()
);

COMMENT ON TABLE programs IS 'A CMMC compliance program scoped to one CUI boundary / system. One org may have multiple programs.';
COMMENT ON COLUMN programs.sprs_score IS 'Live SPRS score. Range -203 to 110. Recalculated on control status changes via pg_notify.';
COMMENT ON COLUMN programs.far_above_score IS 'Score contribution from FAR & Above (basic) controls only.';

-- ---------------------------------------------------------------------------
-- TABLE: program_controls
-- Per-program instance of every control_definition. Seeded on program create.
-- ---------------------------------------------------------------------------

CREATE TABLE program_controls (
    id                    UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id            UUID           NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    control_definition_id UUID           NOT NULL REFERENCES control_definitions(id),
    status                control_status DEFAULT 'not_yet_assessed',
    is_applicable         BOOLEAN        DEFAULT TRUE,
    is_phase_unlocked     BOOLEAN        DEFAULT FALSE,
    implementation_notes  TEXT,
    score_impact          INTEGER        DEFAULT 0,
    target_completion_date DATE,
    created_at            TIMESTAMPTZ    DEFAULT NOW(),
    updated_at            TIMESTAMPTZ    DEFAULT NOW(),
    UNIQUE (program_id, control_definition_id)
);

COMMENT ON TABLE program_controls IS 'Per-program control instance. One row per control per program. Seeded from control_definitions on program creation.';
COMMENT ON COLUMN program_controls.score_impact IS 'Cached score contribution of this control. Negative for unimplemented weighted controls.';
COMMENT ON COLUMN program_controls.is_phase_unlocked IS 'TRUE once the program has reached or passed this control phase.';

-- ---------------------------------------------------------------------------
-- TABLE: assignments
-- Task assignments linking a program_control to a responsible user.
-- ---------------------------------------------------------------------------

CREATE TABLE assignments (
    id                  UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_control_id  UUID              NOT NULL REFERENCES program_controls(id) ON DELETE CASCADE,
    program_id          UUID              NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    assigned_to         UUID              REFERENCES users(id) ON DELETE SET NULL,
    assigned_by         UUID              REFERENCES users(id) ON DELETE SET NULL,
    status              assignment_status DEFAULT 'unassigned',
    due_date            DATE,
    instructions        TEXT,
    created_at          TIMESTAMPTZ       DEFAULT NOW(),
    updated_at          TIMESTAMPTZ       DEFAULT NOW()
);

COMMENT ON TABLE assignments IS 'Task assignments for a program control. Tracks who is responsible for gathering evidence.';

-- ---------------------------------------------------------------------------
-- TABLE: artifacts
-- Uploaded evidence files stored in MinIO, linked to a program_control.
-- ---------------------------------------------------------------------------

CREATE TABLE artifacts (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_control_id  UUID            NOT NULL REFERENCES program_controls(id) ON DELETE CASCADE,
    assignment_id       UUID            REFERENCES assignments(id) ON DELETE SET NULL,
    uploaded_by         UUID            REFERENCES users(id) ON DELETE SET NULL,
    file_name           VARCHAR(500)    NOT NULL,
    mime_type           VARCHAR(100),
    minio_bucket        VARCHAR(100)    DEFAULT 'cmmc-artifacts',
    minio_key           VARCHAR(1000),
    extracted_text      TEXT,
    assessment_status   artifact_status DEFAULT 'pending',
    assessment_attempts INTEGER         DEFAULT 0,
    last_attempted_at   TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     DEFAULT NOW()
);

COMMENT ON TABLE artifacts IS 'Evidence files uploaded by contributors. Stored in MinIO; extracted_text populated by document parser.';
COMMENT ON COLUMN artifacts.assessment_attempts IS 'Number of LLM assessment attempts. Used for retry backoff and stuck-job detection.';

-- ---------------------------------------------------------------------------
-- TABLE: assessments
-- LLM assessment result for a single artifact against a program_control.
-- ---------------------------------------------------------------------------

CREATE TABLE assessments (
    id                  UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
    artifact_id         UUID               NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    program_control_id  UUID               NOT NULL REFERENCES program_controls(id) ON DELETE CASCADE,
    verdict             assessment_verdict NOT NULL,
    confidence          DECIMAL(4,3),
    rationale           TEXT,
    gaps                JSONB              DEFAULT '[]',
    raw_response        JSONB,
    model_used          VARCHAR(100),
    reviewer_override   BOOLEAN            DEFAULT FALSE,
    reviewer_notes      TEXT,
    reviewed_by         UUID               REFERENCES users(id),
    reviewed_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ        DEFAULT NOW()
);

COMMENT ON TABLE assessments IS 'LLM assessment results per artifact. reviewer_override allows a human reviewer to supersede the model verdict.';
COMMENT ON COLUMN assessments.confidence IS 'Model confidence score 0.000–1.000.';
COMMENT ON COLUMN assessments.gaps IS 'Structured list of identified compliance gaps from the LLM.';

-- ---------------------------------------------------------------------------
-- TABLE: milestones
-- POA&M milestone rows for a program_control — tracks remediation plans.
-- ---------------------------------------------------------------------------

CREATE TABLE milestones (
    id                    UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_control_id    UUID              NOT NULL REFERENCES program_controls(id) ON DELETE CASCADE,
    program_id            UUID              NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    responsible_org       VARCHAR(200),
    resource_estimate     resource_estimate,
    remediation_plan      TEXT,
    current_milestone_date DATE,
    is_complete           BOOLEAN           DEFAULT FALSE,
    created_at            TIMESTAMPTZ       DEFAULT NOW(),
    updated_at            TIMESTAMPTZ       DEFAULT NOW()
);

COMMENT ON TABLE milestones IS 'POA&M milestone entries for controls not yet fully implemented.';

-- ---------------------------------------------------------------------------
-- TABLE: program_members
-- Explicit membership of users in a program (for RBAC beyond org membership).
-- ---------------------------------------------------------------------------

CREATE TABLE program_members (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID        NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role       user_role   DEFAULT 'viewer',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (program_id, user_id)
);

COMMENT ON TABLE program_members IS 'Explicit program membership. Grants a user access to a specific program, optionally overriding their org-level role.';

-- ---------------------------------------------------------------------------
-- TABLE: program_locations
-- Physical locations associated with a program (for SSP boundary definition).
-- ---------------------------------------------------------------------------

CREATE TABLE program_locations (
    id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID         NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    name       VARCHAR(200) NOT NULL,
    address    TEXT,
    city       VARCHAR(100),
    state      VARCHAR(50),
    zip        VARCHAR(20),
    is_primary BOOLEAN      DEFAULT FALSE,
    created_at TIMESTAMPTZ  DEFAULT NOW()
);

COMMENT ON TABLE program_locations IS 'Physical locations in scope for a program CUI boundary.';

-- ---------------------------------------------------------------------------
-- TABLE: hardware_inventory
-- Hardware assets in scope for the program.
-- ---------------------------------------------------------------------------

CREATE TABLE hardware_inventory (
    id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id    UUID         NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    asset_name    VARCHAR(200),
    asset_type    VARCHAR(100),
    manufacturer  VARCHAR(200),
    model         VARCHAR(200),
    serial_number VARCHAR(200),
    ip_address    VARCHAR(50),
    location      VARCHAR(200),
    handles_cui   BOOLEAN      DEFAULT FALSE,
    notes         TEXT,
    created_at    TIMESTAMPTZ  DEFAULT NOW()
);

COMMENT ON TABLE hardware_inventory IS 'Hardware assets in the program CUI boundary. Used to populate SSP system component inventory.';

-- ---------------------------------------------------------------------------
-- TABLE: software_inventory
-- Software installed on in-scope systems.
-- ---------------------------------------------------------------------------

CREATE TABLE software_inventory (
    id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id   UUID         NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    product_name VARCHAR(200),
    vendor       VARCHAR(200),
    version      VARCHAR(100),
    license_type VARCHAR(100),
    handles_cui  BOOLEAN      DEFAULT FALSE,
    notes        TEXT,
    created_at   TIMESTAMPTZ  DEFAULT NOW()
);

COMMENT ON TABLE software_inventory IS 'Software inventory for in-scope systems. Supports 3.4.x (Configuration Management) controls.';

-- ---------------------------------------------------------------------------
-- TABLE: cloud_services_inventory
-- Cloud and SaaS services used within the CUI boundary.
-- ---------------------------------------------------------------------------

CREATE TABLE cloud_services_inventory (
    id                UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id        UUID         NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    service_name      VARCHAR(200),
    provider          VARCHAR(200),
    service_type      VARCHAR(100),
    fedramp_authorized BOOLEAN     DEFAULT FALSE,
    handles_cui       BOOLEAN      DEFAULT FALSE,
    notes             TEXT,
    created_at        TIMESTAMPTZ  DEFAULT NOW()
);

COMMENT ON TABLE cloud_services_inventory IS 'Cloud and SaaS services in scope. FedRAMP authorization status relevant to 3.13.x controls.';

-- ---------------------------------------------------------------------------
-- TABLE: activity_log
-- Immutable audit trail. No updated_at — rows are append-only.
-- ---------------------------------------------------------------------------

CREATE TABLE activity_log (
    id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id      UUID         REFERENCES orgs(id) ON DELETE CASCADE,
    program_id  UUID         REFERENCES programs(id) ON DELETE CASCADE,
    user_id     UUID         REFERENCES users(id) ON DELETE SET NULL,
    event_type  VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id   UUID,
    description TEXT,
    metadata    JSONB        DEFAULT '{}',
    created_at  TIMESTAMPTZ  DEFAULT NOW()
);

COMMENT ON TABLE activity_log IS 'Append-only audit trail for all significant platform events. Never update or delete rows.';

-- ---------------------------------------------------------------------------
-- TABLE: control_dependencies
-- Declared dependencies between control_definitions (e.g. 3.1.2 depends on 3.1.1).
-- ---------------------------------------------------------------------------

CREATE TABLE control_dependencies (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    control_id     UUID NOT NULL REFERENCES control_definitions(id),
    depends_on_id  UUID NOT NULL REFERENCES control_definitions(id),
    UNIQUE (control_id, depends_on_id)
);

COMMENT ON TABLE control_dependencies IS 'Prerequisite relationships between controls. Used to enforce implementation ordering.';

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_updated_at() IS 'Generic trigger function to stamp updated_at on every row update.';

-- ---------------------------------------------------------------------------
-- SPRS recalculation notify trigger
-- Fires a pg_notify event whenever a control status or applicability changes.
-- The FastAPI worker listens on channel "sprs_recalc" and recalculates the score.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_sprs_recalc()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status
       OR OLD.is_applicable IS DISTINCT FROM NEW.is_applicable
    THEN
        PERFORM pg_notify(
            'sprs_recalc',
            json_build_object(
                'program_id', NEW.program_id::text,
                'control_id', NEW.id::text
            )::text
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION notify_sprs_recalc() IS 'Emits sprs_recalc pg_notify event when a program_control status or applicability changes.';

-- =============================================================================
-- TRIGGERS: updated_at
-- =============================================================================

CREATE TRIGGER trg_orgs_updated_at
    BEFORE UPDATE ON orgs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_programs_updated_at
    BEFORE UPDATE ON programs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_program_controls_updated_at
    BEFORE UPDATE ON program_controls
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_assignments_updated_at
    BEFORE UPDATE ON assignments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_artifacts_updated_at
    BEFORE UPDATE ON artifacts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_milestones_updated_at
    BEFORE UPDATE ON milestones
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- TRIGGER: SPRS recalculation notify
-- =============================================================================

CREATE TRIGGER program_control_status_changed
    AFTER UPDATE ON program_controls
    FOR EACH ROW EXECUTE FUNCTION notify_sprs_recalc();

COMMIT;
