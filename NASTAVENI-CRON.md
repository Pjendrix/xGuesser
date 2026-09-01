# Automatické vyhodnocování bez Workeru

Endpoint `/api/tick` udělá všechno: vyhodnotí dohraná kola, otevře
nadcházející a vylosuje hráče kola. Stačí ho pravidelně zavolat.

## 1. Nastav klíč

Cloudflare → Pages → xguesser → Settings → Variables and Secrets → Add
- Name: `CRON_KEY`
- Type: **Secret**
- Value: něco dlouhého a náhodného, třeba 40 znaků

Bez tohohle klíče endpoint vrací 403, takže ho nikdo cizí nespustí.

## 2. Ověř ručně

V prohlížeči otevři:

    https://xguesser.pages.dev/api/tick?key=TVUJ_KLIC

Vrátí JSON s tím, co vyhodnotil a jaké kolo otevřel.

## 3. Nastav časovač

Na `cron-job.org` (zdarma, stačí e-mail):
- Create cronjob
- Title: `xguesser`
- URL: ta samá adresa i s `?key=...`
- Schedule: **Every 3 hours**
- Save

Hotovo. Od té chvíle se kola vyhodnocují sama.

## Poznámky

Běh je idempotentní — už vyhodnocené kolo přeskočí, takže častější
volání nevadí a výsledky se nepřepočítají dvakrát.

Vyhodnocení se spustí až když FPL označí kolo jako `data_checked`,
tedy po finální revizi statistik. Typicky den až dva po posledním zápase.

Soupisky se tímhle neaktualizují. Po přestupovém okně spusť ručně
`/api/admin/sync-fpl` (viz README).

Klíč máš v URL, takže ho neposílej nikam veřejně. Kdyby unikl,
změň hodnotu `CRON_KEY` a uprav odkaz na cron-job.org.
