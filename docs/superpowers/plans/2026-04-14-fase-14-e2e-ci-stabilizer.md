# Plan — Fase 14 E2E CI Stabilizer

**Spec:** `docs/superpowers/specs/2026-04-14-fase-14-e2e-ci-stabilizer-design.md`
**Branch:** `main`
**Tag:** `phase-12-2-deployed` (aplicada quando E2E verde 2x consecutivos)

## Tasks

### T1 — Bypass rate-limit em CI via env var

**Arquivo:** `src/lib/auth-helpers.ts`

```diff
 export async function authorizeCredentials(
   credentials: { email: string; password: string },
   ipAddress: string
 ): Promise<AuthUser | null> {
   const { email, password } = credentials;

-  const rateLimit = await checkLoginRateLimit(email, ipAddress).catch(() => ({
-    allowed: true,
-    remaining: 5,
-  }));
+  const rateLimit =
+    process.env.E2E_BYPASS_RATELIMIT === "true"
+      ? { allowed: true, remaining: 999 }
+      : await checkLoginRateLimit(email, ipAddress).catch(() => ({
+          allowed: true,
+          remaining: 5,
+        }));
```

Segurança: env var não está em `.env.production`, nunca em Portainer, só no
workflow CI do GitHub Actions.

### T2 — Warm-up server + retry backoff 20s + timeout 120s

**Arquivo:** `tests/e2e/global-setup.ts`

Modificações:

1. Adicionar função `warmupServer()` descrita na spec §3.1.
2. Mudar `timeout: 90_000` → `timeout: 120_000` em `waitForURL`.
3. Mudar `setTimeout(r, 5_000)` → `setTimeout(r, 20_000)`.
4. Chamar `warmupServer(baseURL)` no início do `globalSetup` antes do loop.

### T3 — Env var no workflow

**Arquivo:** `.github/workflows/e2e.yml`

Adicionar na seção `env:` do job:

```yaml
      E2E_BYPASS_RATELIMIT: "true"
```

## Execução

Commit único:

```
ci(e2e): warm-up + retry backoff 20s + bypass rate-limit em CI (Fase 14 T1+T2+T3)
```

Push. Observar `gh run watch <run>` do E2E workflow.

## Validação

1. Se verde em push atual → aguardar segundo push verde para confiar.
2. Se falhar, logs mostrarão step que travou:
   - Warm-up timeout → problema é outro (investigar mais).
   - Login ainda timeout → compile realmente muito lento, migrar webServer
     para build+start (fase 14b).
   - Rate-limit ainda bloqueia → bypass não propagou (verificar env var no CI).

## Rollback

Single commit — revert simples se piorar.

## Tag

Após 2 runs consecutivos verdes no E2E workflow:

```sh
git tag phase-12-2-deployed
git push origin phase-12-2-deployed
```

Atualizar `docs/HANDOFF.md` §8 removendo "CI pendente" e §1.1 adicionando
`phase-12-2-deployed` ao table de tags.
