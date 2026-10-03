# Halo Miasto

**Zrób zdjęcie problemu w mieście. Resztą zajmie się AI i miasto.**
HackYeah 2026 · Smart City

Demo: **https://halo-miasto.vercel.app**

Halo Miasto zamyka pętlę zgłoszenia usterki w mieście:

1. **Mieszkaniec** loguje się numerem telefonu, robi zdjęcie (dziura, latarnia, wysypisko, auto pod bramą…) i wysyła je w dwóch dotknięciach. Status śledzi na żywo.
2. **AI** z jednego zdjęcia rozpoznaje kategorię, ocenia pilność 1–10, wybiera właściwą jednostkę miasta i przygotowuje formalne pismo.
3. **Urząd** widzi zgłoszenia na mapie (pinezki według pilności i mapa cieplna), z połączonymi duplikatami, i przypisuje je pracownikowi.
4. **Pracownik w terenie** naprawia problem i zamyka zadanie zdjęciem „po naprawie”. Mieszkaniec dostaje status „Rozwiązane”.

## Jak przetestować

| Rola | Adres | Logowanie |
|---|---|---|
| Mieszkaniec | https://halo-miasto.vercel.app | dowolny numer, kod SMS **123-123** (symulowany) |
| Urząd | https://halo-miasto.vercel.app/panel | hasło podane w zgłoszeniu projektu |
| Pracownik | https://halo-miasto.vercel.app/pracownik | **500 100 100**, kod **123-123** |

Najlepiej na telefonie: aparat i GPS wymagają HTTPS, który zapewnia link. Na komputerze zamiast aparatu można wybrać zdjęcie z dysku. Panel zawiera ok. 40 przykładowych zgłoszeń.

## Architektura

```
PWA (Next.js, telefon)                     Supabase
  ├─ wykrywanie i rozmywanie twarzy  ──►    Edge Functions (wszystkie klucze API tylko tutaj)
  │  na urządzeniu (MediaPipe)                ├─ analyze  → OpenAI vision (structured outputs)
  ├─ GPS / EXIF / wybór na mapie              ├─ reports  → zapis, limit, duplikaty, e-mail (Resend)
  └─ Realtime: status na żywo                 ├─ auth     → logowanie numerem telefonu
                                              ├─ panel    → panel urzędu (hasło)
                                              └─ worker   → aplikacja pracownika
                                            Postgres · Storage (zdjęcia) · Realtime
```

- Aplikacja Next.js ma w zmiennych środowiskowych wyłącznie publiczne wartości (adres i klucz publishable Supabase). Klucze OpenAI, Resend i klucz serwisowy są w sekretach Supabase Edge Functions.
- Schemat bazy: `supabase/migrations/`, funkcje: `supabase/functions/`, dane przykładowe: `supabase/seed.sql`.
- Kategorie i jednostki miasta: `src/config/`.

## Prywatność

- Twarze są rozmywane na telefonie, zanim zdjęcie go opuści.
- Tablice rejestracyjne są dopuszczone tylko w zgłoszeniach dotyczących parkowania.
- Logowanie numerem telefonu zamiast konta z hasłem; zgoda przy pierwszym uruchomieniu.
- Limit zgłoszeń na numer i łączenie duplikatów (ta sama kategoria, 50 m, 72 h).
- Ocena pilności jest widoczna tylko dla urzędu.

## Uruchomienie lokalne

```bash
npm install
cp .env.example .env.local   # uzupełnij publiczny adres i klucz Supabase
npm run dev
```

## Ograniczenia prototypu

- Kod SMS jest symulowany (zawsze 123-123) – brak bramki SMS.
- E-maile do urzędów trafiają na adres testowy; adresy jednostek są fikcyjne.
- Przypisanie kategorii do jednostek to nasze założenie, do weryfikacji z miastem.
- Wykrywanie twarzy może pominąć bardzo małe twarze w tle; tablice nie są rozmywane automatycznie.
- Panel urzędu chroni wspólne hasło zamiast indywidualnych kont.
- AI może pomylić kategorię – dlatego mieszkaniec zatwierdza zgłoszenie, a urząd może je poprawić lub przekazać.

## Użyte narzędzia, API i biblioteki

- OpenAI API (model wizyjny, structured outputs) – analiza zdjęć i treść zgłoszeń
- Claude (Anthropic) – wsparcie przy kodzie, projektowaniu interfejsu (Claude Design) i dokumentacji
- MediaPipe Face Detector – wykrywanie twarzy na urządzeniu
- Supabase – Postgres, Storage, Realtime, Edge Functions
- Next.js, React, Tailwind CSS, Leaflet, exifr, zod
- OpenStreetMap i Nominatim – mapy i adresy (© współtwórcy OpenStreetMap)
- Resend – e-mail · Vercel – hosting

## Praca przed i w trakcie HackYeah

Przed oficjalnym startem (ok. 30 min, 3.10 ok. 10:20–10:51) powstały: szkielet Next.js, pierwszy schemat bazy i konfiguracja kategorii – pierwsze dwa commity w historii. Cała reszta powstała w trakcie HackYeah.
