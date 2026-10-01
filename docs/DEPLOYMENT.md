# Architektura i wdrożenie

## Granice bezpieczeństwa

`PWA → /api/* → Netlify Function → Airtable REST API`. Token PAT istnieje wyłącznie w zmiennych środowiskowych Netlify. Funkcja odczytuje rolę z podpisanego tokenu Identity i ponownie sprawdza `crewId` przy każdym zapisie. Brygadzista nie może podmienić brygady w treści żądania. Endpoint startowy zwraca tylko pola operacyjne — nigdy stawki ani rozliczenia.

## Kroki przed preview

1. Zweryfikuj istniejącą tabelę `Ewidencja czasu pracy` (ID `tblfGqEvRqXID1SPp`). Pole `Brygada` jest połączone z tabelą `Brygady`.
2. W Netlify ustaw `AIRTABLE_TOKEN`, `AIRTABLE_BASE_ID` i `ADMIN_EMAIL`. PAT ogranicz do jednej bazy i minimalnych zakresów. `ADMIN_EMAIL` jest jedynym kontem z pełnym dostępem.
3. Włącz Identity, ustaw **Invite only**, wyłącz publiczną rejestrację i zaproś użytkowników.
4. W tabeli `Brygady` wpisuj adres logowania danej osoby w polu `E-mail brygadzisty`. Zmiana adresu natychmiast zmienia przypisanie bez edycji Identity i kodu.
5. Wykonaj preview deploy, zaloguj oba typy użytkownika i przetestuj negatywnie próbę wysłania cudzego `crewId`.

## Przypomnienia PWA

Przeglądarki wymagają zgody użytkownika na notifications. Lokalna aplikacja może pokazać powiadomienie po uruchomieniu PWA, ale niezawodny alarm przy całkowicie zamkniętej aplikacji wymaga Web Push: trwałej subskrypcji urządzenia oraz zaplanowanej funkcji wysyłającej push. Nie należy obiecywać alarmu systemowego bez wdrożenia tego zaplecza. Obecna wersja prosi o zgodę, pozwala zainstalować PWA i eksponuje wyraźny stan „Dzień nierozpoczęty”.

## Checklist odbioru

- Konto brygadzisty widzi jedynie przypisaną brygadę, jej budowy i budynki.
- Zmiana identyfikatorów w żądaniu kończy się 403.
- Brak tokenu Airtable w plikach `dist` i źródłach klienta.
- Start drugi raz jest idempotentny; stop bez startu zwraca konflikt.
- Raport tworzy rekord `Postęp robót`, a wpisany problem także `Problemy i dokumentacja`.
- Admin ma wejście do modułu zarządczego; stawki i rozliczenia nie trafiają do endpointu brygadzisty.

Produkcję uruchom dopiero po odbiorze preview i rotacji testowego PAT.
