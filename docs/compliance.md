# Compliance support and evidence rules

Checked 19 November 2026. The checks support documented review work. They neither certify legal compliance nor decide whether a model should be deployed.

| Check | Source | What the desk checks | Limit |
|---|---|---|---|
| NIST-MEASURE-2.4 | [NIST Measure playbook](https://airc.nist.gov/airmf-resources/playbook/measure/) | Missing evaluations and overdue operator-set review dates | Voluntary risk-management guidance. No mandatory interval is invented. Monitoring remains an operational responsibility. |
| NZ-IPP8 | [New Zealand Privacy Commissioner, principle 8](https://www.privacy.org.nz/privacy-principles/8/) | Loaded counts and events outside their declared window | Accuracy, relevance and completeness require human review. This check only supports that work when records contain personal information. |
| NZ-IPP9 | [New Zealand Privacy Commissioner, principle 9](https://www.privacy.org.nz/privacy-principles/9/) | Overdue operator-set retention reviews | The Act does not set this desk's dates. The business must decide lawful retention, other applicable duties and disposal. No automatic deletion. |

The schema does not need personal attributes. Use pseudonymous event identifiers and non-sensitive business segments. Keep source records only where the business has authority to hold and use them. Identity and access controls, secure backups and retention deletion are deployment work, not features implied by the local demo. Append-only evidence protects review history through the application; lawful correction and disposal need an authorised, logged maintenance process and backup policy.

/compliance reports exceptions. /review records a checked source reference and the next agreed dates. This does not establish that a source is accurate just because a date was entered. Read the counts, missing outcomes and saved comparison before signing off a review. The NIST source states its framework is being updated; review the source when adopting or revising your process.
