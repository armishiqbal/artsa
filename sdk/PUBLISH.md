# Publishing artsa-guard (dry-run checklist)

Do **not** publish from CI without an explicit release. Local dry-run:

## Python (`sdk/python`)

```bash
cd sdk/python
python -m pip install build twine
python -m build
twine check dist/*
# publish only when intentional:
# twine upload dist/*
```

## TypeScript (`sdk/typescript`)

```bash
cd sdk/typescript
npm run build
npm pack --dry-run
# publish only when intentional:
# npm publish --access public
```

Version is currently **0.4.1** (Phase 3–7 situation + baseline + quota-aware SDKs).
