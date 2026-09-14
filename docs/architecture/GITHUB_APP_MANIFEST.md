# Registering the disposable evaluation App

GitHub's manifest flow requires one account-owner action in the GitHub UI. Use
the values in [GITHUB_APP_MANIFEST.json](./GITHUB_APP_MANIFEST.json) when
registering **ARTSA Live Evaluation**, and install it only on the private
`haroonsh-dev/artsa-live-evaluation` repository.

After GitHub redirects back with the temporary `code`, exchange it locally:

```bash
export ARTSA_GITHUB_MANIFEST_CODE='code-from-the-github-redirect'
PYTHONPATH=backend python backend/scripts/exchange_github_app_manifest.py \
  --output /secure/path/artsa-github-app-secrets.json
chmod 600 /secure/path/artsa-github-app-secrets.json
```

The helper writes only `app_id`, `private_key`, and `webhook_secret`; it does
not print any secret values. Move them immediately into the VPC secret manager
as `ARTSA_GITHUB_APP_ID`, `ARTSA_GITHUB_APP_PRIVATE_KEY`, and
`ARTSA_GITHUB_WEBHOOK_SECRET`. Configure the App webhook URL to the deployed
ARTSA `/api/v1/github/webhooks` endpoint before installing it.

The temporary code expires after one hour. Never commit the generated JSON
file, paste its contents into chat, or use it as a substitute for a secret
manager.
