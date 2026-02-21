{{- define "telegram-intregation.name" -}}{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}{{- end }}
{{- define "telegram-intregation.fullname" -}}
{{- if .Values.fullnameOverride }}{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}{{- end }}{{- end }}{{- end }}
{{- define "telegram-intregation.chart" -}}{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}{{- end }}
{{- define "telegram-intregation.labels" -}}
helm.sh/chart: {{ include "telegram-intregation.chart" . }}
{{ include "telegram-intregation.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}
{{- define "telegram-intregation.selectorLabels" -}}
app.kubernetes.io/name: {{ include "telegram-intregation.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
