{{- define "artsa.name" -}}
artsa
{{- end }}

{{- define "artsa.api.labels" -}}
app.kubernetes.io/name: {{ include "artsa.name" . }}
app.kubernetes.io/component: api
{{- end }}

{{- define "artsa.frontend.labels" -}}
app.kubernetes.io/name: {{ include "artsa.name" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{- define "artsa.celery.labels" -}}
app.kubernetes.io/name: {{ include "artsa.name" . }}
app.kubernetes.io/component: celery
{{- end }}

{{- /*
artsa.databaseUrl builds the API's asyncpg connection string from the postgres
chart values. Used only when secrets.create is false (dev/local default); in
production the Secret's DATABASE_URL is injected via envFrom instead, so no
credential is ever committed in values.yaml.
*/ -}}
{{- define "artsa.databaseUrl" -}}
{{- printf "postgresql+asyncpg://%s:%s@%s-postgres:5432/%s" .Values.postgresql.auth.username .Values.postgresql.auth.password (include "artsa.name" .) .Values.postgresql.auth.database -}}
{{- end -}}
