BEGIN;

UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Stats Meets Partially
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates required. 
Interview  Controls are currently being implemented. - 
Test - Does not pass due to policy updates and required controls in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.13.1' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status Meets Partially
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates required. 
Interview  Controls are currently being implemented. - 
Test - Does not pass due to policy updates and required controls in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.13.5' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status Meets Partially
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates required. 
Interview  
Controls are currently being implemented. - 
Test - Pending evaluation of controls,  policy/procedure  updates and evidence of required controls in place. 
Canopy A&D - 3.10 - Physical and Environmental Protection Policy
Physical Security Measures
-Surveillance: Surveillance cameras shall be installed at all entry points and sensitive areas to monitor access activities.
-Physical Barriers: Physical barriers such as locked doors, turnstiles, and security gates shall be used to prevent unauthorized access.
Safeguarding Measures at alternate work sites
-Ensure all CUI is stored in locked containers, cabinets, or desks when not in use.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.10.1' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status Meets - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates required. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place. 
Canopy A&D - 3.10 - Physical and Environmental Protection Policy, Page 1-4', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.10.3' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status Meets - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates required. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place. 
Canopy A&D - 3.10 - Physical and Environmental Protection Policy, Page 1-4', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.10.4' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status Meets - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates required. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place. 
Canopy A&D - 3.10 - Physical and Environmental Protection Policy, Page 1-4', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.10.5' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status Meets - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates required. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place. 
DOC-012 Canopy A&D - 3.8 - System Media Protection Policy.docx
DOC-023 Certificate of Destruction-Sanitization.pdf', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.8.3' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.14.1' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.14.2' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.14.4' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.14.5' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.5.1' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.5.2' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'All access to corporate resources is routed through Cloudflare Zero Trust for Government (Access). Cloudflare Access enforces identity-based policies in conjunction with Okta for Government authentication, ensuring only authorized, verified users reach CUI-bearing systems regardless of network location.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.1.1' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Role-based access control (RBAC) is enforced through Okta group-to-application assignments. Cloudflare Access application policies provide a second enforcement layer, restricting which Okta groups may reach each application. M365 GCCH enforces SharePoint and Teams permissions aligned to job function.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.1.2' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Connections to and use of external systems are controlled per the External System Connection Policy. All outbound connections from managed endpoints to external systems are subject to Cloudflare Gateway DNS and HTTP filtering policies — connections to non-approved external destinations are blocked at the network layer. Cloudflare CASB continuously monitors for unsanctioned external SaaS usage that could expose CUI. External user access to internal systems is provisioned through Okta for Government with scoped, time-limited application assignments and mandatory MFA. Azure AD B2B governance controls external identity access to M365 GCCH. Azure GCCH workloads use Private Endpoints and Private Link — no public internet-facing endpoints exist for CUI-bearing systems. All external system connection requests must be approved per the External System Connection Approval Procedure prior to provisioning.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.1.20' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'CUI posted or processed on publicly accessible systems is controlled per the Public Posting Policy and CUI Program Policy. The organization''s architecture is designed such that no CUI-bearing system has a publicly accessible endpoint — all organizational systems require authentication through Cloudflare Zero Trust for Government before any access is granted, regardless of whether the user is internal or external.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.1.22' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'A designated Content Review Officer conducts quarterly reviews of all publicly accessible organizational web properties and content per the Publicly Accessible System Review SOP. Purview Content Explorer is used during each review cycle to identify any CUI-labeled content residing outside the authorization boundary. All findings are documented, remediated within 72 hours, and recorded in the organization''s Plan of Action and Milestones (POA&M) if systemic issues are identified.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.12.1' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'not_yet_addressed'::control_status, implementation_notes = NULL, target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.12.4' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'not_yet_addressed'::control_status, implementation_notes = NULL, target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.5.3' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.7.5' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Session lock is enforced via Intune MDM configuration profiles on all enrolled devices, requiring screen lock after 15 minutes of inactivity. Cloudflare Access device posture checks verify that screen lock policy is active on the endpoint — devices failing the posture check are denied access. CrowdStrike Falcon device health feeds into Cloudflare posture evaluation.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.1.10' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status Meets - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates required. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place. 
Canopy A&D - 3.10 - Physical and Environmental Protection Policy, Page 1-4', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.10.2' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.5.7' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.5.8' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Session termination is enforced at multiple layers. Okta session policies terminate idle sessions after 30 minutes and require re-authentication after 8 hours. Cloudflare Access enforces its own session duration limits independently of the application — when an Okta session expires or a device posture check fails, Cloudflare revokes access across all protected applications simultaneously within seconds.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.1.11' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.13.3' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.5.9' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.2.1' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.2.2' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.2.3' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.11.2' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.11.1' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.11.3' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.7.1' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.7.2' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.7.6' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.13.2' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = NULL, target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.13.11' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.12.2' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.13.10' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'not_yet_addressed'::control_status, implementation_notes = NULL, target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.5.10' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'ALL access — both on-premises and remote — is routed through Cloudflare Zero Trust for Government. The Cloudflare WARP client is deployed to all Intune-enrolled endpoints and operates in always-on mode. Users authenticate through Okta for Government with MFA; Cloudflare enforces device posture via CrowdStrike Falcon and Intune compliance before any access is granted. Azure AD Conditional Access requires a WARP-enrolled, Intune-compliant device. All sessions are logged in Cloudflare''s FedRAMP-authorized government audit logs.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.1.12' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'All endpoint-to-cloud traffic is encrypted by the Cloudflare WARP client using FIPS 140-2 validated WireGuard. Cloudflare Access enforces TLS 1.2 minimum (TLS 1.3 preferred) for all proxied application connections. Azure GCCH enforces TLS 1.2+ on all service endpoints. Intune enforces BitLocker encryption on all managed Windows endpoints.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.1.13' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'ALL endpoint traffic — both on-premises and remote — is routed through Cloudflare Zero Trust for Government as the sole managed access control point. WARP is deployed in full-tunnel mode with split tunneling disabled via Intune configuration profile. DNS queries resolve through Cloudflare Gateway. HTTP traffic is inspected through Cloudflare TLS inspection policies. Direct internet access bypassing Cloudflare is technically prevented on all Intune-managed endpoints and only allowed by except only. On-premises traffic traverses Cloudflare Tunnel (cloudflared) connectors — no direct on-network access is permitted without passing through Cloudflare policy.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.1.14' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'BeyondTrust Privileged Remote Access for Government provides the session management, credential vaulting, and privileged session recording layer for all administrator SSH and RDP sessions. BeyondTrust injects credentials directly into sessions without exposing passwords to the administrator, enforces least-privilege session policies, and captures full session recordings with keystroke logging for audit purposes. All BeyondTrust jump sessions are initiated only after the user has passed through Cloudflare Access policy enforcement.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.1.15' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Azure Bastion provides a tertiary access path scoped exclusively to Azure GCCH virtual machines within the GCCH boundary where direct Cloudflare tunnel connectivity is not available. All privileged sessions — regardless of the access path — are logged in Cloudflare audit logs, BeyondTrust session recordings, and Azure Monitor, providing three independent audit trails per session.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.13.15' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.14.3' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.14.6' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.6.1' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.6.2' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.6.3' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.3.7' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Cloudflare Zero Trust enforces a network-agnostic access model — the security of the underlying wireless network is not relied upon as a trust signal. Corporate wireless uses 802.1X certificate-based authentication via Intune Wi-Fi configuration profiles. However, whether on corporate wireless, home broadband, or public Wi-Fi, all devices receive identical Zero Trust enforcement through WARP. Only Intune-enrolled, compliant devices may authenticate to corporate wireless and connect through Cloudflare.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.1.16' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Corporate wireless is configured with WPA3-Enterprise and AES-256 encryption enforced by Intune Wi-Fi profiles on all managed devices. Cloudflare WARP provides an additional end-to-end encryption layer via FIPS-validated WireGuard, ensuring traffic confidentiality above the wireless layer regardless of the underlying wireless security posture. CrowdStrike Falcon monitors endpoints for unauthorized wireless adapter activity.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.1.17' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Connection of mobile devices to organizational systems is controlled per the Mobile Device Policy. All mobile devices must be enrolled in Microsoft Intune prior to accessing any corporate resource. Intune enrollment deploys the Cloudflare WARP client in full-tunnel always-on mode, CrowdStrike Falcon sensor, and device compliance configuration profiles. Azure AD Conditional Access enforces that only Intune-compliant devices may authenticate to M365 GCCH and Azure GCCH resources. Cloudflare Zero Trust device posture checks verify Intune compliance and CrowdStrike sensor health at each connection attempt. Unenrolled or non-compliant mobile devices receive a block enforcement action and cannot access any CUI-bearing system. Personal (BYOD) devices are prohibited from accessing CUI-bearing systems.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.1.18' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'CUI stored on or transmitted through mobile devices is encrypted per the Mobile Device Policy and Cryptographic Policy. Microsoft Intune compliance policies enforce full-device encryption on all managed mobile platforms: BitLocker on Windows endpoints, hardware-level encryption enforced via passcode requirement on iOS, and full-disk encryption on Android. Intune marks devices without active encryption as non-compliant, triggering a Cloudflare device posture block. Microsoft Purview sensitivity labels applied in M365 GCCH encrypt CUI at the file level — labeled files remain cryptographically protected on device storage and require M365 GCCH re-authentication to decrypt. The Cloudflare WARP client encrypts all CUI in transit using FIPS 140-2 validated WireGuard, ensuring no CUI traverses any network path in cleartext.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.1.19' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Use of portable storage devices is restricted per the Removable Media Policy. Microsoft Intune device configuration profiles block all unauthorized removable storage devices on managed Windows endpoints. CrowdStrike Falcon Device Control enforces removable media restrictions at the kernel level — USB storage device connections are blocked by default, with exceptions permitted only for organization-issued, encrypted devices approved by serial number. All USB connection events are captured in CrowdStrike Falcon telemetry and trigger security alerts for review. Microsoft Purview DLP policies enforce a secondary control layer — CUI-labeled files cannot be written to any removable storage device regardless of device permission status. Cloudflare Gateway DLP policies block browser-based and application-based exfiltration of CUI to external destinations. Any exception to the removable media block policy requires written approval per the Removable Media Request and Approval Procedure, and only Intune-issued, BitLocker-encrypted USB devices are eligible for approval.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.1.21' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.3.2' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.3.1' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.3.3' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.3.4' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.3.5' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.14.7' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.3.6' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.4.8' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.4.9' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.4.7' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.13.12' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.13.4' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.3.8' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.3.9' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.4.1' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.4.2' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.5.11' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'CUI flow is controlled at multiple layers. Microsoft Purview sensitivity labels and DLP policies in M365 GCCH prevent unauthorized CUI transmission. Cloudflare Gateway HTTP policies inspect and block outbound traffic to non-approved destinations on all managed endpoints. Azure GCCH NSGs enforce network-level flow controls between resource groups. Cloudflare CASB identifies unsanctioned SaaS usage that could expose CUI.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.1.3' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.8.7' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.8.8' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.7.4' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = NULL, target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.8.2' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'not_yet_addressed'::control_status, implementation_notes = NULL, target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.8.1' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.13.6' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.13.7' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Separation of duties is enforced per the Separation of Duties Policy. Azure AD PIM in M365 GCCH requires JIT role activation for privileged roles. Okta admin roles are separated between Super Admin, Application Admin, and Help Desk roles. No single user controls both identity provisioning and application assignment.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.1.4' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.4.5' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.4.6' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.4.3' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.4.4' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.12.3' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status Meets - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates required. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place. 
DOC-012 Canopy A&D - 3.8 - System Media Protection Policy.docx
DOC-023 Certificate of Destruction-Sanitization.pdf', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.8.4' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Least privilege is enforced at every layer. Azure RBAC scopes resource access to minimum required roles. Azure AD PIM requires approval workflows for elevated role activation. Okta group assignments follow least-privilege role definitions. Cloudflare Access issues per-application grants — users receive no implicit network-level access beyond what is explicitly authorized.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.1.5' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.13.16' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status Meets - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates required. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place. 
DOC-012 Canopy A&D - 3.8 - System Media Protection Policy.docx
DOC-023 Certificate of Destruction-Sanitization.pdf', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.8.9' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Privileged users maintain dedicated admin accounts used exclusively for administrative tasks. Standard work activities are performed from non-privileged accounts. Okta maintains separate admin account profiles distinct from standard user identities. Azure AD admin accounts are cloud-only and not licensed for M365 productivity services.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.1.6' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status Meets - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates required. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place. 
DOC-012 Canopy A&D - 3.8 - System Media Protection Policy.docx
DOC-023 Certificate of Destruction-Sanitization.pdf', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.8.5' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.13.8' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status Meets - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates required. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place. 
DOC-012 Canopy A&D - 3.8 - System Media Protection Policy.docx
DOC-023 Certificate of Destruction-Sanitization.pdf', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.8.6' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.9.1' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.9.2' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.7.3' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Non-privileged users are blocked from executing privileged functions via Azure RBAC and Okta role assignments. Privileged administrative sessions are brokered exclusively through Cloudflare Access for Infrastructure — all SSH and RDP sessions are rendered in-browser with full command-level logging. The M365 GCCH Unified Audit Log and Azure Monitor capture all privileged actions. CrowdStrike Falcon Insight provides endpoint-level process execution monitoring.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.1.7' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.13.9' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.5.4' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.5.5' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.5.6' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.13.13' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates may be required based on interviews/walkthroughs. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.13.14' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Account lockout is enforced per the Authentication Policy. Okta for Government locks accounts after 5 consecutive failed authentication attempts with a 15-minute lockout. Azure AD Smart Lockout applies to direct M365 GCCH authentications. Cloudflare Access integrates with Okta and inherits lockout enforcement — locked Okta accounts cannot complete Cloudflare authentication flows.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.1.8' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'A DoD-standard system use notification banner is displayed on the Okta for Government login portal and the Cloudflare Access login page prior to authentication. M365 GCCH Azure AD Terms of Use requires annual acknowledgment. The banner text is maintained per the Acceptable Use Policy and reviewed annually.', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.1.9' AND cd.is_objective = FALSE;
UPDATE program_controls pc SET status = 'implementation_begun'::control_status, implementation_notes = 'Overall Status Meets - Pending policy/procedure review meeting and observation of controls in place. 
Updates required to documentation
Test required for validating controls in place
Examine - Policy updates required. 
Interview  Controls are currently being implemented. - 
Test - Review testing measures in place. 
Canopy A&D - 3.10 - Physical and Environmental Protection Policy, Page 1-4', target_completion_date = NULL, updated_at = NOW() FROM control_definitions cd WHERE pc.control_definition_id = cd.id AND pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.nist_id = '3.10.6' AND cd.is_objective = FALSE;

UPDATE programs SET
  system_name = 'Canopy CMMC Enclave',
  cage_codes = ARRAY['7WXG3','4RZT1'],
  ssp_system_description = 'Canopy Aerospace and Defense operates a CMMC Level 2 enclave supporting CUI handling for DoD programs. The system spans 4 physical locations (California, Colorado, Florida) and approximately 180 employees with 50 authorized for government information access. Access is routed through Cloudflare Zero Trust with Okta for Government identity management.',
  ssp_environment_of_operation = 'Multi-site hybrid cloud environment. On-premises at California (Hera A&D West, MSM A&D), Colorado (Canopy Technologies), and Florida (Hera A&D East). Cloud via Microsoft Azure GCCH and Cloudflare Zero Trust. Remote access via BeyondTrust Privileged Remote Access for Government.',
  ssp_information_types = 'Controlled Unclassified Information (CUI) - Defense: technical data, export-controlled information (EAR/ITAR), DoD contract data. ~50 of 180 employees authorized. 3 contractors also authorized.',
  updated_at = NOW()
WHERE id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991';

COMMIT;
SELECT status, COUNT(*) FROM program_controls pc JOIN control_definitions cd ON pc.control_definition_id = cd.id WHERE pc.program_id = 'ba8d74d0-cff7-46ea-a24b-68355cf2e991' AND cd.is_objective = FALSE GROUP BY status ORDER BY status;