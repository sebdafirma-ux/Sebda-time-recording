# SEBDA — ewidencja pracy brygad

Mobilna aplikacja PWA dla brygadzistów oraz panel administracyjny. Frontend nigdy nie łączy się bezpośrednio z Airtable — wszystkie operacje przechodzą przez uwierzytelnione Netlify Functions.

## Uruchomienie

```bash
npm install
npm run dev
```

Lokalnie interfejs działa z danymi demonstracyjnymi (`VITE_DEMO_MODE=true`). Logowanie Netlify Identity wymaga preview deployu Netlify.

## Konfiguracja Netlify

Ustaw sekrety `AIRTABLE_TOKEN` i `AIRTABLE_BASE_ID=appbxC8Ique8Uxqh6` w panelu Netlify. Włącz Identity, ustaw rejestrację na **Invite only** i przypisz `app_metadata`: `{"role":"foreman","crewId":"rec..."}` albo `{"role":"admin"}`. Role oraz przypisanie brygady są kontrolowane przez funkcje serwerowe.

Do ewidencji czasu dodaj tabelę `Ewidencja czasu pracy` z polami: `Dzień`, `Data`, `Brygada`, `Brygadzista`, `Start`, `Koniec`, `Minuty`, `Status`.

Szczegóły: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
