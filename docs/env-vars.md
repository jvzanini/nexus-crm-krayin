# Variáveis de Ambiente — Nexus CRM

Documento canônico das env vars usadas pelo CRM. Para cada nova fase, adicionar
seção dedicada com tabela `var × descrição × required/optional × default`.

> Fonte de exemplos: `.env.example`. Em dev local copiar para `.env`; em prod,
> popular via Portainer/secrets-manager. **Nunca commitar valores reais.**

---

## Data Transfer (Fase 10)

Adapter de storage e parâmetros do worker de import/export.

| Variável | Descrição | Required | Default |
|----------|-----------|----------|---------|
| `STORAGE_DRIVER` | Driver de storage. `local` (FS adapter) ou `s3` (S3 adapter). | optional | `local` |
| `STORAGE_FS_ROOT` | Raiz no filesystem para o `FsStorageAdapter`. Necessário quando `STORAGE_DRIVER=local`. Container precisa de write+0600 nesse path. | required (se `local`) | `/var/lib/nexus-crm/data-transfer` |
| `STORAGE_SIGN_SECRET` | Segredo HMAC para assinar URLs em `/api/storage/signed` (apenas FS adapter; S3 usa presigner nativo). Min 32 bytes. Gerar: `openssl rand -base64 48`. | required (se `local`) | — |
| `S3_REGION` | Região AWS do bucket. | required (se `s3`) | — |
| `S3_BUCKET` | Nome do bucket. Recomendado bucket dedicado por tenant ou prefix por `companyId`. | required (se `s3`) | — |
| `S3_ACCESS_KEY_ID` | Credencial IAM com permissões mínimas: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:ListBucket`. | required (se `s3`) | — |
| `S3_SECRET_ACCESS_KEY` | Secret access key correspondente. **Nunca commitar.** | required (se `s3`) | — |
| `S3_ENDPOINT` | Endpoint custom (MinIO ou compatível). Em produção AWS deixar vazio. | optional | — |
| `DATA_TRANSFER_POLL_INTERVAL_MS` | Intervalo (ms) usado pela UI SWR para consultar progresso do job de commit/preview em execução. | optional | `2000` |

### Notas operacionais

- **FS dev:** o root deve existir e ser gravável pelo UID do processo Node. O adapter cria subpastas `quarantine/`, `exports/`, `reports/` sob demanda.
- **S3 prod:** usar bucket com versionamento desabilitado e lifecycle de 30 dias para `quarantine/*`. Exports vivem 90 dias (alinhado ao history retention).
- **Sign secret rotation:** girar `STORAGE_SIGN_SECRET` invalida todos signed URLs já emitidos (~1h TTL). Aceitável; comunicar antes.
- **Polling cadence:** valores <1000 sobrecarregam o backend; >5000 degrada UX.
