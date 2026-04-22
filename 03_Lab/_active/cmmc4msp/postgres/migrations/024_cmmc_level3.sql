-- Migration 024: CMMC Level 3 Support (NIST SP 800-172)
-- Adds cmmc_level to programs and control_definitions.
-- Seeds 35 enhanced requirements from NIST SP 800-172 (Feb 2021).
-- Level 2 programs: unchanged behavior + optional L3 advisory toggle.
-- Level 3 programs: 145 controls seeded (110 L2 + 35 L3), readiness_pct scoring.

BEGIN;

-- 1. Level column on programs (certification target)
ALTER TABLE programs
  ADD COLUMN cmmc_level INTEGER NOT NULL DEFAULT 2
  CONSTRAINT programs_cmmc_level_check CHECK (cmmc_level IN (2, 3));

-- 2. L3 advisory toggle (only meaningful for cmmc_level=2 programs)
ALTER TABLE programs
  ADD COLUMN show_l3_preview BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Readiness percentage for Level 3 programs (0-100, NULL for Level 2)
ALTER TABLE programs
  ADD COLUMN readiness_pct SMALLINT
  CONSTRAINT programs_readiness_pct_check CHECK (readiness_pct IS NULL OR (readiness_pct >= 0 AND readiness_pct <= 100));

-- 4. Level tag on control_definitions (all existing 110 controls = level 2)
ALTER TABLE control_definitions
  ADD COLUMN cmmc_level INTEGER NOT NULL DEFAULT 2
  CONSTRAINT control_defs_cmmc_level_check CHECK (cmmc_level IN (2, 3));

-- 5. Indexes
CREATE INDEX idx_control_defs_cmmc_level ON control_definitions(cmmc_level);
CREATE INDEX idx_programs_cmmc_level ON programs(cmmc_level);

-- 6. Seed 35 NIST SP 800-172 enhanced requirements (cmmc_level = 3)
--    UUIDs are deterministic: uuid5(NAMESPACE_DNS, nist_id)
--    dod_score_value = NULL (no SPRS for Level 3 — DIBCAC assessment)
--    far_above_phase = NULL (no FAR & Above phase gating for Level 3)
INSERT INTO control_definitions (
  id, nist_id, nist_sort_order, cmmc_id, family, family_abbrev,
  far_above_phase, far_above_sort_order, diy_type, is_objective,
  parent_control_id, dod_score_value, requirement_text,
  assessment_objective, dod_comment, acceptable_proof_guidance,
  is_basic, cmmc_level
) VALUES

-- Access Control (AC) — 3 enhanced requirements
('e6bb8961-1368-55bc-94ad-dd623e5c089e'::uuid,
 '3.1.1e', '03.01.01e.0', 'AC.L3-3.1.1e', 'Access Control', 'AC',
 NULL, NULL, 'hybrid', FALSE, NULL, NULL,
 'Employ dual authorization to execute critical or sensitive system and organizational operations.',
 'Determine if: (a) critical or sensitive system and organizational operations are defined; (b) dual authorization is employed to execute the defined critical or sensitive system and organizational operations.',
 NULL,
 'EXAMINE: Access control policy; procedures addressing dual authorization; system design documentation; system configuration settings; list of critical or sensitive operations requiring dual authorization; audit records. INTERVIEW: Personnel with responsibilities for dual authorization; system/network administrators.',
 FALSE, 3),

('4ebaf4ac-5239-5f3c-b5f2-5e5af2be8810'::uuid,
 '3.1.2e', '03.01.02e.0', 'AC.L3-3.1.2e', 'Access Control', 'AC',
 NULL, NULL, 'hybrid', FALSE, NULL, NULL,
 'Restrict access to systems and system components to only those information resources that are owned, provisioned, or issued by the organization.',
 'Determine if: (a) information resources that are owned, provisioned, or issued by the organization are identified; (b) access to systems and system components is restricted to only those organization-owned, provisioned, or issued information resources.',
 NULL,
 'EXAMINE: Access control policy; procedures addressing information resource restrictions; system design documentation; system configuration settings; list of organization-owned, provisioned, or issued information resources. INTERVIEW: System/network administrators; personnel with access control responsibilities.',
 FALSE, 3),

('b4338b27-45e9-5043-9374-f8982d3921c6'::uuid,
 '3.1.3e', '03.01.03e.0', 'AC.L3-3.1.3e', 'Access Control', 'AC',
 NULL, NULL, 'outsource', FALSE, NULL, NULL,
 'Employ organization-defined secure information transfer solutions to control information flows between security domains on connected systems.',
 'Determine if: (a) security domains on connected systems are identified; (b) secure information transfer solutions are defined; (c) the defined secure information transfer solutions are employed to control information flows between the identified security domains.',
 NULL,
 'EXAMINE: Access control policy; procedures addressing information flow enforcement; system design documentation; system architecture; information flow enforcement mechanisms; system configuration settings; audit records. INTERVIEW: System/network administrators; personnel with information flow enforcement responsibilities.',
 FALSE, 3),

-- Awareness and Training (AT) — 2 enhanced requirements
('aed0b510-dced-5248-bedd-776bdef8981d'::uuid,
 '3.2.1e', '03.02.01e.0', 'AT.L3-3.2.1e', 'Awareness and Training', 'AT',
 NULL, NULL, 'diy', FALSE, NULL, NULL,
 'Provide awareness training focused on recognizing and responding to threats from social engineering, advanced persistent threat actors, breaches, and suspicious behaviors; update the training at an organization-defined frequency or when there are significant changes to the threat.',
 'Determine if: (a) awareness training focuses on recognizing and responding to threats including social engineering, advanced persistent threat actors, breaches, and suspicious behaviors; (b) the frequency of awareness training updates is defined; (c) awareness training is updated at the defined frequency or when significant threat changes occur.',
 NULL,
 'EXAMINE: Security awareness training program; training materials covering social engineering, APT actors, breach indicators, and suspicious behavior; training schedule and completion records; threat update procedures. INTERVIEW: Personnel with security awareness training responsibilities; personnel who completed the training.',
 FALSE, 3),

('02262aef-d373-58ea-82ca-2acf8b3d87dc'::uuid,
 '3.2.2e', '03.02.02e.0', 'AT.L3-3.2.2e', 'Awareness and Training', 'AT',
 NULL, NULL, 'diy', FALSE, NULL, NULL,
 'Include practical exercises in awareness training for organization-defined roles that are aligned with current threat scenarios and provide feedback to individuals involved in the training and their supervisors.',
 'Determine if: (a) roles requiring practical exercises in awareness training are defined; (b) practical exercises are included in awareness training for the defined roles; (c) practical exercises are aligned with current threat scenarios; (d) feedback is provided to individuals involved in training and their supervisors.',
 NULL,
 'EXAMINE: Security awareness training program; practical exercise scenarios; threat scenario documentation; feedback mechanisms and records; training completion records by role. INTERVIEW: Personnel with security training responsibilities; personnel who completed practical exercises; supervisors of trained personnel.',
 FALSE, 3),

-- Configuration Management (CM) — 3 enhanced requirements
('d742ee69-5b61-53e1-a0d0-80c9c394db31'::uuid,
 '3.4.1e', '03.04.01e.0', 'CM.L3-3.4.1e', 'Configuration Management', 'CM',
 NULL, NULL, 'hybrid', FALSE, NULL, NULL,
 'Establish and maintain an authoritative source and repository to provide a trusted source and accountability for approved and implemented system components.',
 'Determine if: (a) an authoritative source and repository for system components is established; (b) the authoritative source and repository is maintained; (c) the repository provides a trusted source for approved and implemented system components; (d) the repository provides accountability for approved and implemented system components.',
 NULL,
 'EXAMINE: Configuration management policy; procedures for authoritative component repository; repository documentation; system component inventory; change management records. INTERVIEW: System administrators; configuration management personnel.',
 FALSE, 3),

('95e9a1df-62da-5ee5-b560-a4da1128a4eb'::uuid,
 '3.4.2e', '03.04.02e.0', 'CM.L3-3.4.2e', 'Configuration Management', 'CM',
 NULL, NULL, 'hybrid', FALSE, NULL, NULL,
 'Employ automated mechanisms to detect misconfigured or unauthorized system components; after detection, remove the components or place the components in a quarantine or remediation network to facilitate patching, re-configuration, or other mitigations.',
 'Determine if: (a) automated mechanisms are employed to detect misconfigured or unauthorized system components; (b) after detection, misconfigured or unauthorized components are removed or quarantined; (c) quarantined components have access to patching or remediation resources.',
 NULL,
 'EXAMINE: Configuration management policy; automated detection tools; quarantine/remediation network documentation; incident records for unauthorized components; system configuration settings. INTERVIEW: System/network administrators; security operations personnel.',
 FALSE, 3),

('9e5addaa-3d3f-524b-b656-b948512f6ea6'::uuid,
 '3.4.3e', '03.04.03e.0', 'CM.L3-3.4.3e', 'Configuration Management', 'CM',
 NULL, NULL, 'hybrid', FALSE, NULL, NULL,
 'Employ automated discovery and management tools to maintain an up-to-date, complete, accurate, and readily available inventory of system components.',
 'Determine if: (a) automated discovery tools are employed; (b) automated management tools are employed; (c) the system component inventory is up-to-date, complete, accurate, and readily available.',
 NULL,
 'EXAMINE: Configuration management policy; automated discovery tool configuration; system component inventory; inventory update procedures; accuracy validation records. INTERVIEW: System administrators; configuration management personnel.',
 FALSE, 3),

-- Identification and Authentication (IA) — 3 enhanced requirements
('1d1e247b-d566-535e-968c-8c0409446e5c'::uuid,
 '3.5.1e', '03.05.01e.0', 'IA.L3-3.5.1e', 'Identification and Authentication', 'IA',
 NULL, NULL, 'outsource', FALSE, NULL, NULL,
 'Identify and authenticate organization-defined systems and system components before establishing a network connection using bidirectional authentication that is cryptographically based and replay resistant.',
 'Determine if: (a) systems and system components requiring bidirectional authentication are defined; (b) bidirectional authentication is employed before establishing network connections; (c) authentication is cryptographically based; (d) authentication is replay resistant.',
 NULL,
 'EXAMINE: Identification and authentication policy; network connection procedures; authentication mechanism documentation; cryptographic module validation; system design documentation. INTERVIEW: System/network administrators; personnel with authentication responsibilities.',
 FALSE, 3),

('2e3c63d2-a265-5e52-ac80-4b70642d51c6'::uuid,
 '3.5.2e', '03.05.02e.0', 'IA.L3-3.5.2e', 'Identification and Authentication', 'IA',
 NULL, NULL, 'hybrid', FALSE, NULL, NULL,
 'Employ automated mechanisms for the generation, protection, rotation, and management of passwords for systems and system components that do not support multifactor authentication or complex account management.',
 'Determine if: (a) systems and system components that do not support MFA or complex account management are identified; (b) automated mechanisms are employed for password generation, protection, rotation, and management for those systems.',
 NULL,
 'EXAMINE: Identification and authentication policy; password management tool configuration; list of systems not supporting MFA; password rotation records; automated management tool documentation. INTERVIEW: System administrators; personnel responsible for account management.',
 FALSE, 3),

('32307c15-c8a9-5583-9a80-3ac85c453e75'::uuid,
 '3.5.3e', '03.05.03e.0', 'IA.L3-3.5.3e', 'Identification and Authentication', 'IA',
 NULL, NULL, 'hybrid', FALSE, NULL, NULL,
 'Employ automated or manual/procedural mechanisms to prohibit system components from connecting to organizational systems unless the components are known, authenticated, in a properly configured state, or in a trust profile.',
 'Determine if: (a) mechanisms (automated or procedural) prohibit unknown or unauthenticated components from connecting; (b) components must be known, authenticated, properly configured, or in a trust profile before connection is allowed.',
 NULL,
 'EXAMINE: Network access control policy; network access control system configuration; device trust profile documentation; connection attempt logs; system configuration settings. INTERVIEW: System/network administrators; security operations personnel.',
 FALSE, 3),

-- Incident Response (IR) — 2 enhanced requirements
('da4f47e0-597c-5fba-a4f6-b83065bca9a6'::uuid,
 '3.6.1e', '03.06.01e.0', 'IR.L3-3.6.1e', 'Incident Response', 'IR',
 NULL, NULL, 'hybrid', FALSE, NULL, NULL,
 'Establish and maintain a security operations center capability that operates 24/7 or at an organization-defined time period.',
 'Determine if: (a) a security operations center (SOC) capability is established; (b) the SOC operating hours are defined; (c) the SOC is maintained at the defined operational level.',
 NULL,
 'EXAMINE: Incident response policy; SOC charter or documentation; SOC staffing records; SOC monitoring tool configuration; operating schedule documentation. INTERVIEW: SOC personnel; security management personnel.',
 FALSE, 3),

('97125b96-358f-5bef-aeaf-b383c97814f0'::uuid,
 '3.6.2e', '03.06.02e.0', 'IR.L3-3.6.2e', 'Incident Response', 'IR',
 NULL, NULL, 'hybrid', FALSE, NULL, NULL,
 'Establish and maintain a cyber incident response team that can be deployed by the organization within an organization-defined time period.',
 'Determine if: (a) a cyber incident response team is established; (b) the deployment time period is defined; (c) the cyber incident response team can be deployed within the defined time period.',
 NULL,
 'EXAMINE: Incident response policy; incident response team charter; team roster and contact information; deployment procedures; exercise records demonstrating deployment capability. INTERVIEW: Incident response team members; security management personnel.',
 FALSE, 3),

-- Personnel Security (PS) — 2 enhanced requirements
('bfeaaf2f-150f-5195-b26a-530efbe12858'::uuid,
 '3.9.1e', '03.09.01e.0', 'PS.L3-3.9.1e', 'Personnel Security', 'PS',
 NULL, NULL, 'outsource', FALSE, NULL, NULL,
 'Conduct organization-defined enhanced personnel screening for individuals and reassess individual positions and access to CUI at an organization-defined frequency.',
 'Determine if: (a) enhanced personnel screening criteria are defined; (b) enhanced screening is conducted for individuals with access to CUI; (c) individual positions and access are reassessed at the defined frequency.',
 NULL,
 'EXAMINE: Personnel security policy; enhanced screening procedures; screening records; position reassessment schedule and records; CUI access roster. INTERVIEW: Human resources personnel; security management personnel; personnel with CUI access responsibilities.',
 FALSE, 3),

('d4598f58-d7ff-5414-946e-4bc68bc9191d'::uuid,
 '3.9.2e', '03.09.02e.0', 'PS.L3-3.9.2e', 'Personnel Security', 'PS',
 NULL, NULL, 'diy', FALSE, NULL, NULL,
 'Ensure that organizational systems are protected if adverse information develops or is obtained about individuals with access to CUI.',
 'Determine if: (a) procedures exist to protect organizational systems if adverse information develops about CUI-access individuals; (b) the procedures are implemented when adverse information is identified.',
 NULL,
 'EXAMINE: Personnel security policy; adverse information handling procedures; access revocation procedures; incident records involving adverse personnel information. INTERVIEW: Human resources personnel; security management; personnel with CUI access authorization.',
 FALSE, 3),

-- Risk Assessment (RA) — 7 enhanced requirements
('9571058b-355c-555f-bafb-ba0086d1a748'::uuid,
 '3.11.1e', '03.11.01e.0', 'RA.L3-3.11.1e', 'Risk Assessment', 'RA',
 NULL, NULL, 'hybrid', FALSE, NULL, NULL,
 'Employ organization-defined sources of threat intelligence as part of a risk assessment to guide and inform the development of organizational systems, security architectures, selection of security solutions, monitoring, threat hunting, and response and recovery activities.',
 'Determine if: (a) threat intelligence sources are defined; (b) threat intelligence from those sources is employed in risk assessments; (c) threat intelligence guides system development, architecture, solution selection, monitoring, threat hunting, and response/recovery.',
 NULL,
 'EXAMINE: Risk assessment policy; threat intelligence sources and feeds; risk assessment reports; system design documentation showing threat intelligence integration; threat hunting procedures. INTERVIEW: Risk assessment personnel; security architects; threat intelligence analysts.',
 FALSE, 3),

('ddd1ecb0-1fd5-5bbb-839a-0d66e37180e8'::uuid,
 '3.11.2e', '03.11.02e.0', 'RA.L3-3.11.2e', 'Risk Assessment', 'RA',
 NULL, NULL, 'hybrid', FALSE, NULL, NULL,
 'Conduct cyber threat hunting activities at an organization-defined frequency or event to search for indicators of compromise in organization-defined systems and detect, track, and disrupt threats that evade existing controls.',
 'Determine if: (a) threat hunting frequency or triggering events are defined; (b) systems subject to threat hunting are defined; (c) threat hunting is conducted at the defined frequency or events; (d) threat hunting searches for IoCs and detects, tracks, and disrupts evasive threats.',
 NULL,
 'EXAMINE: Risk assessment policy; threat hunting procedures; threat hunting schedules; threat hunting results/reports; indicator of compromise (IoC) sources; evidence of threat detection and disruption. INTERVIEW: Threat hunters; security operations personnel; incident response team.',
 FALSE, 3),

('0f60b939-a9a8-5e12-85ba-f71f01bcbd36'::uuid,
 '3.11.3e', '03.11.03e.0', 'RA.L3-3.11.3e', 'Risk Assessment', 'RA',
 NULL, NULL, 'hybrid', FALSE, NULL, NULL,
 'Employ advanced automation and analytics capabilities in support of analysts to predict and identify risks to organizations, systems, and system components.',
 'Determine if: (a) advanced automation and analytics capabilities are employed; (b) these capabilities support analyst identification and prediction of risks to organizations, systems, and system components.',
 NULL,
 'EXAMINE: Risk assessment policy; security analytics tool documentation and configuration; analyst workflow documentation; risk prediction reports; SIEM/SOAR configuration. INTERVIEW: Security analysts; risk assessment personnel; security operations personnel.',
 FALSE, 3),

('0c54553d-1e8d-58cf-b3b2-2aa975e883c3'::uuid,
 '3.11.4e', '03.11.04e.0', 'RA.L3-3.11.4e', 'Risk Assessment', 'RA',
 NULL, NULL, 'diy', FALSE, NULL, NULL,
 'Document or reference in the system security plan the security solution selected, the rationale for the security solution, and the risk determination.',
 'Determine if: (a) the selected security solution is documented in the SSP; (b) the rationale for the security solution is documented; (c) the risk determination is documented in the SSP.',
 NULL,
 'EXAMINE: System security plan; security solution documentation; risk determination records; solution selection rationale. INTERVIEW: System owners; security engineers; risk assessment personnel.',
 FALSE, 3),

('78526f96-2442-5b36-9844-5a65e3ce77c0'::uuid,
 '3.11.5e', '03.11.05e.0', 'RA.L3-3.11.5e', 'Risk Assessment', 'RA',
 NULL, NULL, 'hybrid', FALSE, NULL, NULL,
 'Assess the effectiveness of security solutions at an organization-defined frequency to address anticipated risk to organizational systems and the organization based on current and accumulated threat intelligence.',
 'Determine if: (a) the frequency for assessing security solution effectiveness is defined; (b) effectiveness assessments are conducted at the defined frequency; (c) assessments are based on current and accumulated threat intelligence.',
 NULL,
 'EXAMINE: Risk assessment policy; security solution effectiveness review records; threat intelligence reports used in assessments; effectiveness assessment schedule. INTERVIEW: Security engineers; risk assessment personnel; threat intelligence analysts.',
 FALSE, 3),

('da083a04-fef6-5c66-a31b-344f6911ce23'::uuid,
 '3.11.6e', '03.11.06e.0', 'RA.L3-3.11.6e', 'Risk Assessment', 'RA',
 NULL, NULL, 'hybrid', FALSE, NULL, NULL,
 'Assess, respond to, and monitor supply chain risks associated with organizational systems and system components.',
 'Determine if: (a) supply chain risks associated with systems and components are assessed; (b) supply chain risks are responded to; (c) supply chain risks are monitored on an ongoing basis.',
 NULL,
 'EXAMINE: Risk assessment policy; supply chain risk management plan; supplier risk assessments; supply chain monitoring procedures; incident records related to supply chain. INTERVIEW: Supply chain risk management personnel; procurement personnel; system owners.',
 FALSE, 3),

('4b9aa73c-1632-549a-b0b3-731472fdbd94'::uuid,
 '3.11.7e', '03.11.07e.0', 'RA.L3-3.11.7e', 'Risk Assessment', 'RA',
 NULL, NULL, 'diy', FALSE, NULL, NULL,
 'Develop a plan for managing supply chain risks associated with organizational systems and system components; update the plan at an organization-defined frequency.',
 'Determine if: (a) a supply chain risk management plan is developed; (b) the plan covers organizational systems and system components; (c) the plan update frequency is defined; (d) the plan is updated at the defined frequency.',
 NULL,
 'EXAMINE: Supply chain risk management plan; plan update schedule; previous plan versions showing updates; risk management procedures. INTERVIEW: Supply chain risk management personnel; system owners; procurement personnel.',
 FALSE, 3),

-- Security Assessment (CA) — 1 enhanced requirement
('ab3f608a-ed4b-53a7-8ff6-6a6d641637c7'::uuid,
 '3.12.1e', '03.12.01e.0', 'CA.L3-3.12.1e', 'Security Assessment', 'CA',
 NULL, NULL, 'outsource', FALSE, NULL, NULL,
 'Conduct penetration testing at an organization-defined frequency, leveraging automated scanning tools and ad hoc tests using subject matter experts.',
 'Determine if: (a) penetration testing frequency is defined; (b) penetration testing is conducted at the defined frequency; (c) automated scanning tools are used; (d) ad hoc tests by subject matter experts are included.',
 NULL,
 'EXAMINE: Security assessment policy; penetration testing procedures; penetration test plans and results; automated scanning tool configuration; penetration testing schedule; subject matter expert qualifications. INTERVIEW: Penetration testing personnel; security assessment personnel; system owners.',
 FALSE, 3),

-- System and Communications Protection (SC) — 5 enhanced requirements
('1ba07925-a1e1-5a98-b6be-dc46c5b435ba'::uuid,
 '3.13.1e', '03.13.01e.0', 'SC.L3-3.13.1e', 'System and Communications Protection', 'SC',
 NULL, NULL, 'hybrid', FALSE, NULL, NULL,
 'Create diversity in organization-defined system components to reduce the extent of malicious code propagation.',
 'Determine if: (a) system components requiring diversity are defined; (b) diversity is created in the defined system components; (c) the diversity reduces the extent of malicious code propagation.',
 NULL,
 'EXAMINE: System and communications protection policy; system design documentation showing component diversity; software diversity analysis; malware protection configuration. INTERVIEW: System architects; security engineers; system administrators.',
 FALSE, 3),

('9eb3388d-03b4-5f05-83a2-1cf3ccdaa504'::uuid,
 '3.13.2e', '03.13.02e.0', 'SC.L3-3.13.2e', 'System and Communications Protection', 'SC',
 NULL, NULL, 'hybrid', FALSE, NULL, NULL,
 'Implement changes to organizational systems and system components to introduce a degree of unpredictability into operations at an organization-defined frequency.',
 'Determine if: (a) types of changes introducing unpredictability are defined; (b) change frequency is defined by system/component; (c) changes are implemented at the defined frequency to introduce operational unpredictability.',
 NULL,
 'EXAMINE: System and communications protection policy; system change procedures; change implementation records; system configuration diversity documentation; moving target defense procedures. INTERVIEW: System architects; security engineers; system administrators.',
 FALSE, 3),

('cea51745-f411-575c-b811-2f51564bb3c4'::uuid,
 '3.13.3e', '03.13.03e.0', 'SC.L3-3.13.3e', 'System and Communications Protection', 'SC',
 NULL, NULL, 'hybrid', FALSE, NULL, NULL,
 'Employ organization-defined technical and procedural means to confuse and mislead adversaries.',
 'Determine if: (a) technical and procedural means for adversary deception are defined; (b) the defined deceptive measures are employed.',
 NULL,
 'EXAMINE: System and communications protection policy; deception technology documentation; honeypot/honeynet configuration; adversary deception procedures; deception event logs. INTERVIEW: Security engineers; security operations personnel; system architects.',
 FALSE, 3),

('5665d781-31b4-56cc-afed-bb849a108cf8'::uuid,
 '3.13.4e', '03.13.04e.0', 'SC.L3-3.13.4e', 'System and Communications Protection', 'SC',
 NULL, NULL, 'hybrid', FALSE, NULL, NULL,
 'Employ physical isolation techniques or logical isolation techniques in organizational systems and system components.',
 'Determine if: (a) physical or logical isolation techniques are selected; (b) the selected isolation techniques are employed in organizational systems and components.',
 NULL,
 'EXAMINE: System and communications protection policy; system architecture documentation; physical isolation controls; logical isolation/segmentation documentation; VLAN/enclave configuration. INTERVIEW: System architects; system/network administrators; security engineers.',
 FALSE, 3),

('97046c8a-1396-5c2d-8057-a2cddc8d446f'::uuid,
 '3.13.5e', '03.13.05e.0', 'SC.L3-3.13.5e', 'System and Communications Protection', 'SC',
 NULL, NULL, 'hybrid', FALSE, NULL, NULL,
 'Distribute and relocate organization-defined system functions or resources at an organization-defined frequency.',
 'Determine if: (a) system functions or resources subject to distribution/relocation are defined; (b) the relocation frequency is defined; (c) functions/resources are distributed and relocated at the defined frequency.',
 NULL,
 'EXAMINE: System and communications protection policy; system function distribution procedures; relocation schedule; system architecture documentation showing distributed functions. INTERVIEW: System architects; security engineers; system administrators.',
 FALSE, 3),

-- System and Information Integrity (SI) — 7 enhanced requirements
('9558f59b-27c1-5f9b-a725-f7db229544b8'::uuid,
 '3.14.1e', '03.14.01e.0', 'SI.L3-3.14.1e', 'System and Information Integrity', 'SI',
 NULL, NULL, 'hybrid', FALSE, NULL, NULL,
 'Verify the integrity of organization-defined security critical or essential software using root of trust mechanisms or cryptographic signatures.',
 'Determine if: (a) security critical or essential software is defined; (b) integrity verification is performed using root of trust mechanisms or cryptographic signatures; (c) integrity verification is applied to the defined software.',
 NULL,
 'EXAMINE: System and information integrity policy; software integrity verification procedures; root of trust documentation; cryptographic signature verification records; BIOS/UEFI secure boot configuration; code signing certificates. INTERVIEW: System administrators; security engineers.',
 FALSE, 3),

('f2502ef6-04de-5976-92d1-6249a342ac92'::uuid,
 '3.14.2e', '03.14.02e.0', 'SI.L3-3.14.2e', 'System and Information Integrity', 'SI',
 NULL, NULL, 'hybrid', FALSE, NULL, NULL,
 'Monitor organizational systems and system components on an ongoing basis for anomalous or suspicious behavior.',
 'Determine if: (a) systems and system components are monitored on an ongoing basis; (b) monitoring detects anomalous or suspicious behavior.',
 NULL,
 'EXAMINE: System and information integrity policy; monitoring tool configuration; anomaly detection rules; behavioral baseline documentation; alert and incident records; SIEM/EDR configuration. INTERVIEW: Security operations personnel; system administrators; threat analysts.',
 FALSE, 3),

('334e81b8-b124-5044-994f-5e0ddebb0533'::uuid,
 '3.14.3e', '03.14.03e.0', 'SI.L3-3.14.3e', 'System and Information Integrity', 'SI',
 NULL, NULL, 'hybrid', FALSE, NULL, NULL,
 'Ensure that organization-defined systems and system components are included in the scope of the specified enhanced security requirements or are segregated in purpose-specific networks.',
 'Determine if: (a) systems and components subject to enhanced requirements or network segregation are defined; (b) the defined systems are either within scope of enhanced requirements or segregated in purpose-specific networks.',
 NULL,
 'EXAMINE: System and information integrity policy; system boundary documentation; network segmentation architecture; scope determination records; network diagrams. INTERVIEW: System owners; security architects; network administrators.',
 FALSE, 3),

('b5e61de2-2fde-51fe-aa96-db269680f771'::uuid,
 '3.14.4e', '03.14.04e.0', 'SI.L3-3.14.4e', 'System and Information Integrity', 'SI',
 NULL, NULL, 'hybrid', FALSE, NULL, NULL,
 'Refresh organization-defined systems and system components from a known, trusted state at an organization-defined frequency.',
 'Determine if: (a) systems and components subject to periodic refresh are defined; (b) the refresh frequency is defined; (c) systems/components are refreshed from a known trusted state at the defined frequency.',
 NULL,
 'EXAMINE: System and information integrity policy; system refresh procedures; trusted state baseline documentation; refresh schedule and completion records; golden image management. INTERVIEW: System administrators; security engineers.',
 FALSE, 3),

('3e2251cc-8829-58a6-a7e3-80d9f316fe84'::uuid,
 '3.14.5e', '03.14.05e.0', 'SI.L3-3.14.5e', 'System and Information Integrity', 'SI',
 NULL, NULL, 'diy', FALSE, NULL, NULL,
 'Conduct reviews of persistent organizational storage locations at an organization-defined frequency and remove CUI that is no longer needed.',
 'Determine if: (a) persistent storage locations are identified; (b) the review frequency is defined; (c) reviews are conducted at the defined frequency; (d) CUI that is no longer needed is removed.',
 NULL,
 'EXAMINE: System and information integrity policy; CUI storage review procedures; review schedules and completion records; data disposal/sanitization records; CUI inventory. INTERVIEW: Data owners; system administrators; personnel with CUI handling responsibilities.',
 FALSE, 3),

('ce1c554a-57b0-5d21-8fa2-9859232d6ee6'::uuid,
 '3.14.6e', '03.14.06e.0', 'SI.L3-3.14.6e', 'System and Information Integrity', 'SI',
 NULL, NULL, 'hybrid', FALSE, NULL, NULL,
 'Use threat indicator information and effective mitigations obtained from organization-defined external organizations to guide and inform intrusion detection and threat hunting.',
 'Determine if: (a) external organizations for threat indicator sharing are defined; (b) threat indicator information and mitigations are obtained from these organizations; (c) the information is used to guide intrusion detection and threat hunting.',
 NULL,
 'EXAMINE: System and information integrity policy; threat information sharing agreements; threat indicator feeds configuration; intrusion detection system rules based on external indicators; threat hunting procedures using external intelligence. INTERVIEW: Threat intelligence personnel; security operations personnel.',
 FALSE, 3),

('0856ef1a-bd62-5eaa-98f1-ff6e938e5fd9'::uuid,
 '3.14.7e', '03.14.07e.0', 'SI.L3-3.14.7e', 'System and Information Integrity', 'SI',
 NULL, NULL, 'hybrid', FALSE, NULL, NULL,
 'Verify the correctness of organization-defined security critical or essential software, firmware, and hardware components using organization-defined verification methods or techniques.',
 'Determine if: (a) security critical or essential software, firmware, and hardware components are defined; (b) verification methods or techniques are defined; (c) correctness is verified using the defined methods.',
 NULL,
 'EXAMINE: System and information integrity policy; component verification procedures; verification tool documentation; verification records; firmware integrity logs; hardware attestation documentation. INTERVIEW: System administrators; security engineers; procurement personnel.',
 FALSE, 3);

COMMIT;
