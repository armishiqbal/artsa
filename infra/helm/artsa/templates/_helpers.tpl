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
