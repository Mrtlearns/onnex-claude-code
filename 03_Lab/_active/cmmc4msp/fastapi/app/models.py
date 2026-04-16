"""Pydantic v2 request and response schemas for the CMMC API."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, EmailStr


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------


class OrgCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    cage_code: Optional[str] = None
    primary_contact_name: Optional[str] = None
    primary_contact_email: Optional[str] = None
    primary_contact_phone: Optional[str] = None
    primary_contact_title: Optional[str] = None
    scoping_config: Optional[dict[str, Any]] = None
    msp_id: Optional[uuid.UUID] = None


class OrgUpdate(BaseModel):
    name: Optional[str] = None
    cage_code: Optional[str] = None
    primary_contact_name: Optional[str] = None
    primary_contact_email: Optional[str] = None
    primary_contact_phone: Optional[str] = None
    primary_contact_title: Optional[str] = None


class ProgramCreate(BaseModel):
    org_id: uuid.UUID
    name: str
    system_name: Optional[str] = None


class ProgramUpdate(BaseModel):
    system_name: Optional[str] = None
    cage_codes: Optional[list[str]] = None
    topology_narrative: Optional[str] = None
    topology_diagram_url: Optional[str] = None
    ssp_system_description: Optional[str] = None
    ssp_environment_of_operation: Optional[str] = None
    ssp_information_types: Optional[str] = None
    ssp_security_requirements: Optional[str] = None
    ssp_interconnections: Optional[str] = None
    ssp_authoring_date: Optional[date] = None
    ssp_last_review_date: Optional[date] = None


class AssignmentCreate(BaseModel):
    program_control_id: uuid.UUID
    assigned_to: Optional[uuid.UUID] = None
    due_date: Optional[date] = None
    instructions: Optional[str] = None


class ControlStatusUpdate(BaseModel):
    status: str
    implementation_notes: Optional[str] = None
    is_applicable: Optional[bool] = None
    target_completion_date: Optional[date] = None


class AssessmentOverride(BaseModel):
    verdict: str
    reviewer_notes: str


class WebhookAssessmentComplete(BaseModel):
    artifact_id: uuid.UUID
    program_control_id: uuid.UUID
    verdict: str
    confidence: float
    rationale: Optional[str] = None
    gaps: list[str] = []
    model_used: Optional[str] = None
    secret: Optional[str] = None


class WebhookOnboardComplete(BaseModel):
    org_id: uuid.UUID
    program_id: uuid.UUID
    controls_seeded: int


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class OrgResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    status: Optional[str] = None
    cage_code: Optional[str] = None
    created_at: Optional[datetime] = None


class ProgramResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    org_id: uuid.UUID
    name: str
    status: Optional[str] = None
    sprs_score: Optional[int] = None
    far_above_score: Optional[int] = None
    current_phase: Optional[str] = None
    created_at: Optional[datetime] = None


class ControlDefinitionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nist_id: str
    cmmc_id: Optional[str] = None
    family: Optional[str] = None
    family_abbrev: Optional[str] = None
    far_above_phase: Optional[str] = None
    dod_score_value: Optional[int] = None
    requirement_text: Optional[str] = None
    assessment_objective: Optional[str] = None
    acceptable_proof_guidance: Optional[str] = None
    is_objective: Optional[bool] = None
    is_basic: Optional[bool] = None


class ProgramControlResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    program_id: uuid.UUID
    control_definition_id: uuid.UUID
    status: Optional[str] = None
    is_applicable: Optional[bool] = None
    is_phase_unlocked: Optional[bool] = None
    implementation_notes: Optional[str] = None
    score_impact: Optional[int] = None
    target_completion_date: Optional[date] = None


class ArtifactUploadInit(BaseModel):
    presigned_url: str
    artifact_id: uuid.UUID
    minio_key: str


class ArtifactResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    program_control_id: uuid.UUID
    file_name: Optional[str] = None
    assessment_status: Optional[str] = None
    assessment_attempts: Optional[int] = None
    created_at: Optional[datetime] = None


class AssessmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    artifact_id: uuid.UUID
    verdict: Optional[str] = None
    confidence: Optional[float] = None
    rationale: Optional[str] = None
    gaps: Optional[list[str]] = None
    model_used: Optional[str] = None
    reviewer_override: Optional[bool] = None
    reviewer_notes: Optional[str] = None
    created_at: Optional[datetime] = None


class SPRSScoreResponse(BaseModel):
    program_id: uuid.UUID
    sprs_score: int
    far_above_score: int
    current_phase: str
