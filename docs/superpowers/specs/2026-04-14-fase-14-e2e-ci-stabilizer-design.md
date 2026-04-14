# Fase 14 — E2E CI Stabilizer

**Data:** 2026-04-14
**Status:** spec v3
**Depends on:** Fase 13 deployed (UI estabilizada)

## 1. Contexto

Fase 12.2 entregou scaffold completo de E2E Playwright (seed, global-setup,
4 specs: admin/manager/viewer/cross-tenant, workflow CI). CI falha
consistentemente por **timeout no global-setup** em algumas roles:

Log real (run 24422974448 de hoje):

```
21:09:26 [global-setup] storage state: admin → ... .auth/admin.json          ✅
21:11:27 [global-setup] login manager attempt 1/3 timeout — errorBox=null
21:11:35 [global-setup] storage state: manager → ... manager.json            ✅ (attempt 2)
21:11:36 [WebServer] [auth][error] CredentialsSignin
21:13:05 [global-setup] login viewer attempt 1/3 timeout — errorBox="E-mail ou senha inválidos"
21:15:11 [global-setup] login viewer attempt 2/3 timeout — errorBox=null
21:17:17 [global-setup] login viewer attempt 3/3 timeout — FAIL
```

Viewer nunca passa. Admin sempre passa. Manager inconsistente.

### 1.1 Causa provável (triage)

Rate-limit de login é por `email:ip`. Mas o global-setup faz 3 logins
sequenciais, cada um com email diferente — não deveria bater rate-limit
por email. **Porém:**

1. O `CredentialsSignin` no log sugere que autorização retornou `null`.
2. `authorizeCredentials` retorna null se: rate-limit, user not found,
   senha errada, ou `isActive` false.
3. Seed cria os 3 users idênticos (hash bcrypt cost 8, isActive true,
   `email/platformRole` mapeado via fixtures).
4. Por que admin passa e viewer não? Duas hipóteses:
   - **(A) next dev está lento para compilar rotas (protected)** no primeiro
     acesso — `waitForURL(!login)` espera navegação pós-submit, mas dashboard/
     leads pode levar >90s para compilar e navegar.
   - **(B) O submit fica pendurado porque o middleware auth faz DB query ainda
     durante compile de outra rota** em paralelo.
5. Timeout de 90s por attempt × 3 attempts = já são 270s+ só de viewer.

### 1.2 Evidência indireta

- Em rodada local (dev machine rápido), admin/manager/viewer passam em ordem.
- Em CI runner (2 vCPUs, turbopack cold start), cada rota SSR nova leva 15-30s
  para compilar no primeiro hit.

## 2. Objetivo

CI `E2E Tests` retorna verde em push main. Tag `phase-12-2-deployed` aplicada
após E2E workflow success.

Critérios de sucesso:

- `gh run view <e2e-run>` → conclusion success.
- Todos os 3 roles completam global-setup sem retry.
- Specs admin/manager/viewer/cross-tenant passam.

Fora de escopo:

- Otimizar tempo total do E2E (atualmente ~12min).
- Adicionar novos specs.
- Migrar webServer para `next build && next start` (requer build 5min+).

## 3. Arquitetura de fix

### 3.1 Pre-warm do servidor antes do global-setup

Hipótese (A): primeira compilação de cada rota é lenta. Solução: após o
webServer startar, fazer pre-fetch de `/login` e `/dashboard` para forçar
compilação antes dos logins paralelos/sequenciais.

Implementação: dentro do `global-setup.ts`, adicionar um warm-up inicial
que roda antes de qualquer loginRole:

```ts
async function warmupServer(baseURL: string) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ baseURL });
  const page = await ctx.newPage();
  try {
    // domcontentloaded (não networkidle — next dev tem HMR polling, idle nunca ocorre)
    await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 120_000 });
  } catch {
    /* dashboard redirect p/ login ok */
  }
  await browser.close();
}
```

### 3.2 Retry com backoff mais gentil

Hipótese (B) ou rate-limit edge case: aumentar intervalo entre retries de
5s para 20s. Permite janela de 60s do rate-limit resetar entre attempts
sem explodir tempo total.

### 3.3 Bypass rate-limit em CI

Adicionar bypass no `authorizeCredentials` quando `process.env.E2E_BYPASS_RATELIMIT === "true"`:

```ts
const BYPASS = process.env.E2E_BYPASS_RATELIMIT === "true";
const rateLimit = BYPASS
  ? { allowed: true, remaining: 999 }
  : await checkLoginRateLimit(email, ipAddress).catch(() => ({ allowed: true, remaining: 5 }));
```

E no workflow E2E adicionar `E2E_BYPASS_RATELIMIT: "true"` nas env vars do job.

### 3.4 Timeout por attempt ajustado

Global-setup usa 90s por attempt. Aumentar para 120s deixando cushion para
compile lento.

## 4. Plano de mudanças

| Arquivo | Mudança |
|---|---|
| `src/lib/auth-helpers.ts` | Bypass rate-limit sob `E2E_BYPASS_RATELIMIT=true` |
| `tests/e2e/global-setup.ts` | Warm-up antes de loginRole; timeout 90s→120s; retry backoff 5s→30s |
| `.github/workflows/e2e.yml` | env var `E2E_BYPASS_RATELIMIT: "true"` |

## 5. Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Bypass vazar para prod | muito baixa | gated atrás de env var específica, não setada em prod |
| Warm-up aumentar tempo total | baixa | ~30s extras; aceitável vs. 12min total |
| Problema ser diferente (ex: Prisma db push flakiness) | média | se persistir, adicionar `prisma db push` retry e logs detalhados |

## 6. Validação

1. Push e observar `gh run watch` do E2E workflow.
2. Se verde 2x consecutivos → tag `phase-12-2-deployed`.
3. Se falhar, logs mostrarão exatamente em qual role/step travou → iteração.

## 7. Entregáveis

1. 3 arquivos modificados.
2. 1 commit único (atômico — as mudanças só fazem sentido juntas).
3. E2E workflow verde.
4. Tag `phase-12-2-deployed`.
5. HANDOFF.md §8 atualizado removendo "CI pendente".
