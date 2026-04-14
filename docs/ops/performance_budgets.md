# Performance Budgets — Nexus CRM

## Rota testada (MVP)

- `/` — landing/login (rota pública, não requer autenticação)

## Budgets definidos

| Métrica | Threshold | Categoria |
|---------|-----------|-----------|
| LCP (Largest Contentful Paint) | < 2.5s | Core Web Vitals |
| CLS (Cumulative Layout Shift) | < 0.1 | Core Web Vitals |
| TBT (Total Blocking Time) | < 300ms | Core Web Vitals (proxy FID) |
| TTI (Time to Interactive) | < 3s | Responsividade |
| JS bundle (gzip) | < 170KB | Tamanho de recurso |

## Por que esses valores

Os thresholds seguem os limites "Good" do Core Web Vitals do Google (LCP, CLS, FID/TBT), que são sinais diretos de ranking em SEO e experiência do usuário. O limite de 170KB gzip de JS reflete o budget razoável para uma SPA Next.js com design system carregada em conexão 3G fast simulada no desktop.

## Como aplicar

Antes de abrir PR com adição de módulo ou dependência pesada, rodar localmente:

```sh
# Build + start local (substitua as envs conforme necessário)
npm run build && npm run start &
npx wait-on http://localhost:3000/api/health

# Rodar budgets
npx @lhci/cli autorun
```

Se algum budget estourar, investigate o bundle com:

```sh
npx @next/bundle-analyzer
# ou
npx source-map-explorer .next/static/chunks/*.js
```

## Roadmap

- **Fase 12.1 (atual):** apenas rota `/` (pública).
- **Fase 12.2:** expandir para `/dashboard` e `/leads` — requer auth state via Playwright (storageState com sessão autenticada injetada no LHCI).
