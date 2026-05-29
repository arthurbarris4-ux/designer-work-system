# Deploy gratuito: Cloudflare Pages + Supabase

Este projeto agora roda em dois modos:

- Local: usa `data/db.json` e `data/uploads`.
- Online: usa Supabase quando `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_SECRET_KEY` estiverem configuradas.

## 1. Criar Supabase

1. Crie um projeto gratuito em https://supabase.com.
2. Abra `SQL Editor`.
3. Rode o arquivo `supabase/schema.sql`.
4. Vá em `Project Settings > API`.
5. Copie:
   - `Project URL`
   - `service_role key`

Guarde a `service_role key` como segredo. Ela fica apenas no backend do Render.

## 2. Subir para GitHub

Suba a pasta `designer-work-system` para um repositório GitHub.

## 3. Criar Cloudflare Pages

1. Crie uma conta em https://dash.cloudflare.com.
2. Vá em `Workers & Pages`.
3. Clique em `Create application`.
4. Escolha `Pages`.
5. Conecte o repositório do GitHub.
4. Configure:
   - Framework preset: `None`
   - Build command: deixe vazio
   - Build output directory: `public`

## 4. Variáveis de ambiente no Cloudflare

Adicione:

```txt
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
SUPABASE_BUCKET=designer-artes
```

Se você copiar a URL com `/rest/v1/` no final, tudo bem; o backend remove esse trecho automaticamente.

Se o Supabase mostrar uma chave no formato novo `sb_secret_...`, você também pode usar:

```txt
SUPABASE_SECRET_KEY=sua-sb-secret-key
```

Use apenas uma das duas: `SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_SECRET_KEY`.

## 5. Depois do deploy

Abra o link `pages.dev` gerado pelo Cloudflare.

O endpoint `/api/health` deve mostrar:

```json
{
  "ok": true,
  "storage": "supabase-cloudflare"
}
```

## Observações

- Cloudflare Pages não usa o servidor local Node. A API online fica em `functions/api/[[path]].js`.
- As artes ficam no bucket `designer-artes` do Supabase.
- O banco inteiro do app fica em `public.designer_state`, coluna `data`.
