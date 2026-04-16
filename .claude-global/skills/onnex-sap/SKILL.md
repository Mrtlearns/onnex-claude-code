# Onnex SAP Skill

Mr. T has deep SAP expertise spanning 18 modules. Apply this context when working on SAP-related tasks, integrations, automation, or client deliverables involving SAP systems.

---

## Module Coverage

| Module | Full Name | Key Focus Areas |
|--------|-----------|----------------|
| ABAP | Advanced Business Application Programming | Custom development, enhancements, BAdIs, user exits |
| BC | Basis / Basis Components | System admin, transport, client management, ICM |
| EWM | Extended Warehouse Management | Warehouse processes, RF, task management |
| GRC | Governance Risk & Compliance | Access control, SOD, role management |
| BW | Business Warehouse | Data modeling, InfoProviders, queries, DTP |
| PI/PO | Process Integration / Process Orchestration | iFlows, adapters, message monitoring |
| MM | Materials Management | Procurement, inventory, MIGO, MIRO |
| SD | Sales & Distribution | Order management, billing, pricing |
| FI | Financial Accounting | G/L, AP, AR, asset accounting |
| CO | Controlling | Cost centers, profit centers, internal orders |
| HR/HCM | Human Capital Management | Personnel, payroll, time management |
| PM | Plant Maintenance | Work orders, equipment, notifications |
| QM | Quality Management | Inspection lots, defects, certificates |
| PP | Production Planning | MRP, work centers, production orders |
| CS | Customer Service | Service orders, contracts |
| PS | Project System | WBS, networks, milestones |
| RE | Real Estate | Lease management, contracts |
| SRM | Supplier Relationship Management | Procurement portals, catalog management |

---

## Integration Patterns

### RFC / BAPI (Primary Integration Method)
- Use BAPIs for standard business transactions — check `BAPI_` prefix first before custom RFC
- RFC connections: managed in SM59 — never hardcode system/client in code
- Key BAPIs by area:
  - Materials: `BAPI_MATERIAL_SAVEDATA`, `BAPI_GOODSMVT_CREATE`
  - Sales: `BAPI_SALESORDER_CREATEFROMDAT2`, `BAPI_SALESORDER_CHANGE`
  - Finance: `BAPI_ACC_DOCUMENT_POST`, `BAPI_OUTGOINGPAYMENT_CREATE`
  - HR: `BAPI_EMPLOYEE_GETDATA`, `BAPI_PERSDATA_CHANGE`
  - General: `BAPI_TRANSACTION_COMMIT`, `BAPI_TRANSACTION_ROLLBACK` — always call after write BAPIs

### SAP PI/PO Integration
- iFlow naming: `[Source]_to_[Target]_[MessageType]`
- Adapter types: IDOC, HTTP, JDBC, RFC, SFTP, SOAP, REST
- Always implement message monitoring alerts for production iFlows
- Error handling: failed messages go to `sxmb_moni` — build alerts for stuck messages

### OData / REST (S/4HANA)
- S/4HANA exposes standard OData services — check `/sap/opu/odata/` before building custom
- Use `$batch` for bulk operations
- Authentication: OAuth2 (preferred) or Basic Auth for legacy

### WebGUI / BSP Automation
- BSP apps hosted within SAP ICM — same-origin resolves cross-origin issues
- For compliance screen capture: SHA-256 hash + JSZip tamper-evident packaging pattern
- SHDB recording replay: BSP app approach preferred over external automation

---

## ABAP Development Standards

```abap
" Always use NEW syntax (7.4+) where system supports it
DATA(lo_obj) = NEW cl_example( ).

" Prefer inline declarations
DATA(lv_result) = lo_obj->get_value( ).

" Exception handling
TRY.
  " operation
CATCH cx_root INTO DATA(lx_error).
  " handle
ENDTRY.

" Database access - always use Open SQL, never Native SQL unless required
SELECT SINGLE * FROM mara INTO @DATA(ls_material)
  WHERE matnr = @lv_matnr.
```

- Never use `SELECT *` in production — specify fields
- Always use `@` data object references in Open SQL (7.4+)
- Transport all changes via proper TR — never manual changes in production
- BAdI over user exit over modification — in that priority order

---

## Key Transactions by Category

| Category | Transactions |
|----------|-------------|
| Development | SE80, SE37, SE38, SE24, SE11, SE16N |
| Transport | SE10, STMS, SCC1 |
| Basis | SM21, SM50, SM66, ST05, ST12, SICK |
| Integration | SXMB_MONI, SXI_MONITOR, SM59, SOAMANAGER |
| RFC/BAPI Testing | SE37 (test function), BAPI explorer |
| BW | RSA1, RSDP, RSRT, RSPLAN |
| GRC | NWBC (GRC UI), SUIM, SU01, PFCG |
| Monitoring | RZ20, AL11, SM37 (background jobs) |

---

## SAP Version Awareness

- **ECC 6.0**: Older syntax acceptable, Enhancement Packages matter (EhP level)
- **S/4HANA**: New GL mandatory, simplified data model, FIORI preferred UI, ABAP 7.5+
- **BW/4HANA**: New modeling objects (aDSO, CompositeProvider) — classic InfoCubes deprecated
- Always confirm release and EhP before advising on features

---

## Security & Compliance (SAP-Specific)

- GRC Access Control: SOD conflicts are blocking — check before any role assignment
- Audit log: SM20 — always enabled in regulated environments
- GDPR: Personal data in HR/FI — use SAP ILM for retention
- SNC/SSO: Prefer certificate-based auth over password in PI/PO connections
- Never store SAP credentials in non-SAP systems without encryption

---

## Common Pitfalls to Flag

- `COMMIT WORK` missing after BAPI write calls — transactions will not persist
- Missing `ROLLBACK WORK` in error paths — leaves locks dangling
- RFC destination pointing to wrong client — always verify in SM59 before running
- BW queries running on InfoProvider without aggregates — performance killer
- PI/PO iFlow without error alerting — silent failures in production
