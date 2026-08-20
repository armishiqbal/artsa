# ARTSA — Tasks for Today (handoff)

Hey! These are self-contained tasks on the ARTSA repo (`github.com/armishiqbal/artsa`, branch `main`). Each is independently shippable — pick any and go. Everything below is built on honest measurement: the guardrail scores **0.97** on familiar attacks but only **0.375** on a held-out set of real-world-style attacks (multilingual, obfuscated, modern tool surfaces). These tasks close that gap.

## ⚠️ Two rules before you start

1. **Never touch `backend/benchmarks/canary_set.json` or tune to it.** Its labels are hashed on purpose (evals discipline). Your goal is measured by the **independent gate**, not by the canary.
2. **Never let the golden/regression gates drop.** After any change run:
   ```bash
   cd backend && ENVIRONMENT=testing PYTHONPATH=. .venv/bin/python scripts/golden_gate.py
   cd backend && ENVIRONMENT=testing PYTHONPATH=. .venv/bin/python scripts/ci_regression_gate.py
   ```
   Both must still pass. And `ruff check src tests` clean, `pytest tests` green.

## Setup

```bash
git clone https://github.com/armishiqbal/artsa.git && cd artsa
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-vercel.txt        # slim set is enough for detection work
pip install fastembed                          # optional, for the real-embedding runs
cd backend && ENVIRONMENT=testing PYTHONPATH=. python scripts/independent_gate.py   # baseline: recall@80 = 0.375
```

Each task references a class from that gate's per-class table. **Definition of done for every task: the class recall improves, the golden gate still passes, tests added, ruff clean.**

---

## Task 1 — Multilingual prompt-injection patterns  🎯 biggest impact (0/3 → goal ≥ 2/3)

`inject_prompt` payloads in Spanish / Chinese / Hindi are invisible today (the detectors are English-only).

- Edit `backend/src/containment/detectors/prompt_injection.py` → add `INJECTION_PATTERNS` for the same instruction-override semantics in **Spanish, French, German, Chinese, Japanese, Hindi, Arabic** (e.g., "ignora todas las instrucciones", "忽略之前的所有指令", "अपने निर्देशों को अनदेखा करें").
- Add tests in `backend/tests/test_prompt_injection_detector.py` for ≥ 4 languages.
- **Check:** the 3 multilingual samples in `independent_set.json` now score ≥ 80.

## Task 2 — IaC / cloud destructive-tool detection  (0/3)

`terraform destroy -auto-approve`, `kubectl delete cluster`, `gcloud compute instances delete` are legitimate-looking but destructive — currently invisible.

- Edit `backend/src/containment/detectors/rule_based.py` → add `DEFAULT_PATTERNS` for IaC/cloud destroy/terminate/delete (terraform destroy, kubectl delete <resource>, gcloud compute instances delete, aws <service> delete/terminate/detach).
- Careful: read-only ops (`kubectl get`, `terraform plan`, `gcloud auth list`) must stay SAFE — they're in the independent safe set.
- Tests in `backend/tests/test_rule_based_detector.py` (or `test_golden_regressions.py`).

## Task 3 — Credential-path coverage (Windows + unusual)  (0–1/4)

`C:\Users\...\PowerShell\PSReadLine\ConsoleHost_history.txt`, `.netrc`, Azure `accessTokens.json`, gcloud `credentials.db`.

- Add credential-theft patterns for these paths in `rule_based.py`.
- Add tests. **Check:** the 4 cloud/unusual-credential samples in `independent_set.json` improve.

## Task 4 — Obfuscation normalization (homoglyph / leet)  (1/3 → goal ≥ 2/3)

`іgnore аll prevіous іnstructіons` (Cyrillic lookalikes), `1gn0r3 4ll pr3v10us 1nstruct10ns` (leet) evade the detectors.

- Add a **normalizer** (homoglyph→ASCII map + leet→letters) applied to tool-argument text before the rule-based and prompt-injection matching. Start with `backend/src/utils/text_normalize.py` + wire it into `prompt_injection.py` and `rule_based.py`.
- Tests: a homoglyph and a leet variant of a known injection must now be caught.

## Task 5 — Egress-GET false-positive  (FPR@50 0.062)

A benign `GET` to an external API (e.g., `https://api.stripe.com`) is flagged at the review band (≥50) by the EGRESS_TUNNEL rule.

- Refine `rule_based.py` EGRESS so **read-only GETs without an upload/data construct** are surfaced below the enforcement threshold (< 50), while uploads (curl -F/-d/-X POST, --data) and metadata/SSRF stays KILL-band.
- **Check:** the external-API GET and docs GET samples in `independent_set.json` score < 50, and FPR@50 drops to 0.0 — without lowering recall on the egress/SSRF malicious samples.

## Task 6 — (stretch) Tool-confusion coverage  (1/3)

`mcp_call` to synonym tool names (`filesystem_delete`), and injection embedded in RAG/`query_vector_db` and email `body`.

- Add the synonym-tool-name mappings and an indirect-injection check for `query_vector_db` / `send_email` bodies to `mcp_destructive.py` / `prompt_injection.py`.
- Tests + check the 3 `tool_confusion` samples improve.

---

## Shared verification (run all before `git push`)

```bash
cd backend
ENVIRONMENT=testing PYTHONPATH=. python scripts/golden_gate.py         # must PASS (recall@80 >= 0.85)
ENVIRONMENT=testing PYTHONPATH=. python scripts/ci_regression_gate.py  # must PASS
ENVIRONMENT=testing PYTHONPATH=. python scripts/independent_gate.py    # YOUR class recall should improve
ruff check src tests                                                     # clean
ENVIRONMENT=testing PYTHONPATH=. python -m pytest tests -q            # all green
```

Then commit with a clear message and push to `main`. If you finish two, great; quality over quantity. Don't game the numbers — a detector that only matches the three samples in the file isn't done; write it to catch the *class*.
