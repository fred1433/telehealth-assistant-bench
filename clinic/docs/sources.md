# Sources for the repository rules

The rules in README.md are rules of this benchmark repository. They are written from the public
sources below; they are not legal advice and they do not claim HIPAA compliance.

- OWASP Logging Cheat Sheet, section "Data to exclude": session identification values, access
  tokens, and sensitive personal data such as health data "should usually not be recorded directly
  in the logs, but instead should be removed, masked, sanitized, hashed, or encrypted".
  https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- U.S. HHS, 45 CFR 164.501, definition of "psychotherapy notes": notes recorded by a health care
  provider who is a mental health professional, documenting or analyzing the contents of
  conversation during a counseling session, and that are separated from the rest of the
  individual's medical record.
  https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-E/section-164.501
- U.S. HHS, 45 CFR 164.508(a)(2): most uses and disclosures of psychotherapy notes require a
  specific authorization.
  https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-E/section-164.508
