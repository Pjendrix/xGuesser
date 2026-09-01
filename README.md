# xGuesser — Premier League xG Challenge

Cloudflare Pages + Pages Functions + D1. Žádný vlastní server.

## Nasazení

```bash
npx wrangler d1 create xguesser          # ID vlož do wrangler.toml
npx wrangler d1 execute xguesser --remote --file=./migrations/0001_init.sql
npx wrangler pages project create xguesser
npx wrangler pages secret put SESSION_SECRET     # náhodných 32+ znaků
npx wrangler pages secret put GOOGLE_CLIENT_ID   # z Google Cloud Console
npx wrangler pages deploy
```

V Google Cloud Console → OAuth client (typ *Web application*) přidej svou
Pages doménu do **Authorized JavaScript origins**. Client ID pak vlož místo
`__GOOGLE_CLIENT_ID__` v `public/index.html` (buildem nebo ručně) — je veřejné,
tajný je jen SESSION_SECRET.

Admina si nastav ručně:
```bash
npx wrangler d1 execute xguesser --remote \
  --command "UPDATE users SET is_admin = 1 WHERE email = 'ty@gmail.com'"
```

## API

| Endpoint | Co dělá |
|---|---|
| `POST /api/auth/google` | ověří Google ID token, založí session cookie |
| `GET /api/auth/me` | kdo je přihlášený · `DELETE` = odhlášení |
| `GET /api/gameweek` | aktuální kolo, soupisky, moje tipy |
| `POST /api/picks` | uloží tip (`category`, `subject_id`, `xg ≥ 0.01`) |
| `GET /api/leaderboard?category=player&gw=12` | kolový nebo sezónní žebříček |
| `POST /api/admin/settle` | zapíše reálná xG a přepočte pořadí |

## Pravidlo shody

`settle.js` řadí podle `|tip − realita|`. Při shodě vyhrává vyšší tip
(`signed_diff` sestupně), pak dřívější odeslání. Reálné 0.15 xG: tip 0.16
je před 0.14.

## Naplnění dat

Soupisky a výsledná xG plň přes `wrangler d1 execute`, nebo si přidej
Cron Trigger, který po skončení kola stáhne data z FPL API a zavolá
`/api/admin/settle`. FPL API vrací `expected_goals` v `element-summary`
endpointu; Opta/Stats Perform feed je licencovaný a chce vlastní klíč.
