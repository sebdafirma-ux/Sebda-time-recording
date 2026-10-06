# SEBDA — ewidencja pracy brygad

Mobilna aplikacja PWA dla brygadzistów oraz panel administracyjny. Frontend nigdy nie łączy się bezpośrednio z Airtable — wszystkie operacje przechodzą przez uwierzytelnione Netlify Functions.

## Uruchomienie

```bash
npm install
npm run dev
```

Lokalnie interfejs działa z danymi demonstracyjnymi (`VITE_DEMO_MODE=true`). Logowanie Netlify Identity wymaga preview deployu Netlify.

## Konfiguracja Netlify

Ustaw sekrety `AIRTABLE_TOKEN`, `AIRTABLE_BASE_ID=appbxC8Ique8Uxqh6` oraz `ADMIN_EMAIL` (jedyny adres z pełnym dostępem) w panelu Netlify. Włącz Identity i ustaw rejestrację na **Invite only**. Pozostałe zaproszone konta są brygadzistami, a ich przypisanie wynika z pola `E-mail brygadzisty` w tabeli `Brygady`.

W bazie `SEBDA – Zarządzanie firmą` utworzono tabelę `Ewidencja czasu pracy` z polami: `Dzień`, `Data`, `Brygada`, `Brygadzista`, `Start`, `Koniec`, `Minuty`, `Status`.

Szczegóły: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
