# Zgłoszenie projektu – HackYeah 2026 (HackTribe)

> Draft do dziś 20:00, edycja do jutra 11:00. Pola w [NAWIASACH] do uzupełnienia.

## 1. Project Name
Halo Miasto

## 2. Published
Nie (na etapie draftu)

## 3. Problem
Zgłoszenie usterki w mieście wciąż oznacza telefon albo maila do właściwej jednostki – a mieszkaniec zwykle nie wie, do której. Sam Zarząd Dróg Miasta Krakowa przyjął w 2023 r. ponad 30 tys. zgłoszeń od mieszkańców (stan na koniec października), ok. 80% z nich telefonicznie, średnio ok. 3 tys. telefonów miesięcznie, przy średnim czasie oczekiwania na połączenie ok. 53 sekund. Najczęstsze dotyczyły usterek infrastruktury drogowej (3772), awarii sygnalizacji (3402) i uszkodzeń oznakowania (3003). To tylko jedna z kilku jednostek miasta – drogi, Straż Miejska, zieleń, wodociągi i odpady mają osobne kanały zgłoszeń.

Problem dotyczy obu stron: mieszkaniec rezygnuje, bo nie wie, gdzie i jak zgłosić (szczególnie osoby starsze, bez maila), a urząd dostaje zgłoszenia bez dokładnej lokalizacji, bez priorytetu i z duplikatami, które trzeba ręcznie przepisywać i sortować.

Źródło: Raport roczny ZDMK 2023, https://zdmk.krakow.pl/wp-content/uploads/2023/12/WEB_ZDMK_raport_roczny_2023.pdf

## 4. Solution
Halo Miasto to aplikacja (PWA na telefon), w której zgłoszenie problemu w mieście trwa tyle, co zrobienie zdjęcia. Łączy trzy role w jedną zamkniętą pętlę:

1. **Mieszkaniec** loguje się numerem telefonu (bez maila i hasła), robi zdjęcie – lokalizacja dołącza się sama (GPS, dane EXIF lub wskazanie na mapie). Dwa dotknięcia od zdjęcia do wysłania. Status śledzi na żywo: Nowe → Wysłane → Przyjęte, a po naprawie pojawia się etap „Rozwiązane” ze zdjęciem po naprawie.
2. **Urząd** dostaje zgłoszenia w panelu: mapa pilności i mapa cieplna, wskaźniki (nowe dziś, w realizacji, średni czas reakcji), filtry, duplikaty połączone w jedno („zgłosiło 5 osób”), przypisanie pracownika jednym kliknięciem.
3. **Pracownik w terenie** widzi przypisane zadania posortowane wg pilności, nawiguje na miejsce i zamyka zadanie obowiązkowym zdjęciem po naprawie.

**Rola AI.** Model wizyjny (OpenAI, structured outputs) z jednego zdjęcia zwraca ustrukturyzowany wynik: kategorię z zamkniętej listy 11, pilność 1–10 z uzasadnieniem, pewność rozpoznania, informację o danych osobowych na zdjęciu oraz gotowe formalne pismo do właściwej jednostki. Na tej podstawie zgłoszenie trafia automatycznie do jednej z 6 jednostek Krakowa.

**Kontrola użytkownika.** Mieszkaniec przed wysłaniem widzi podgląd: kategorię, adresata, miejsce na mapie i treść pisma, którą może edytować. Przy niskiej pewności AI aplikacja prosi o drugie zdjęcie zamiast wysyłać błędne zgłoszenie, a mieszkaniec może wybrać kategorię ręcznie. Ocenę pilności widzi tylko urząd, który może zmienić status, przekazać zgłoszenie innej jednostce albo przypisać pracownika.

**Prywatność.** Twarze są wykrywane i rozmywane na telefonie (MediaPipe), zanim zdjęcie opuści urządzenie. Tablice rejestracyjne są dopuszczone tylko w zgłoszeniach dotyczących parkowania. Wszystkie klucze API są wyłącznie po stronie serwera (Supabase Edge Functions). Ochrona przed nadużyciami: limit zgłoszeń na numer telefonu oraz łączenie duplikatów (ta sama kategoria, 50 m, 72 h).

**Ograniczenia prototypu.** Kod SMS jest symulowany (zawsze 123-123); e-maile do urzędów trafiają na adres testowy; przypisanie kategorii do jednostek to nasze założenie do weryfikacji z miastem; wykrywanie twarzy może pominąć bardzo małe twarze w tle; AI może pomylić kategorię (dlatego człowiek zatwierdza zgłoszenie, a urząd może je skorygować); panel urzędu chroni wspólne hasło zamiast kont pracowników.

## 5. Challenges
OPEN TASK: SMART CITY

## 6. Cover image
[DO DODANIA – np. zrzut: telefon z ekranem „Sprawdź zgłoszenie” + panel urzędu z mapą]

## 7. Idea stage
Nowy pomysł

## 8. What's done so far and goal of your project
**Przed oficjalnym startem (ok. 30 min, 3.10 ok. 10:20–10:51):** pomysł i plan, szkielet aplikacji Next.js (konfiguracja projektu, pusty ekran startowy), pierwsza wersja schematu bazy danych oraz pliki konfiguracyjne z listą kategorii i jednostek miasta. Widać to w historii repozytorium (pierwsze dwa commity).

**W trakcie HackYeah:** design system i ekrany (Claude Design), cała aplikacja mieszkańca (zgoda RODO, logowanie numerem telefonu, aparat, analiza AI, podgląd i edycja zgłoszenia, wybór miejsca na mapie, status na żywo, „Moje zgłoszenia”), rozmywanie twarzy na urządzeniu, analiza zdjęć przez AI w Supabase Edge Functions, zapis zgłoszeń z wykrywaniem duplikatów i limitem, wysyłka e-maili, panel urzędu (mapa, mapa cieplna, KPI, filtry, statusy, przekazywanie, przypisywanie pracowników), aplikacja pracownika w terenie ze zdjęciem po naprawie, dane demonstracyjne dla Krakowa i wdrożenie na Vercel.

**Cel:** pilot w jednej dzielnicy Krakowa z integracją z miejskim systemem zgłoszeń zamiast e-maila; mierzymy czas od zgłoszenia do przyjęcia, odsetek zgłoszeń bez telefonu i liczbę automatycznie połączonych duplikatów.

## 9. Team status
Full team

## 10. Current team size
[2 lub 3]

## 11. Needed skills
– (nie szukamy osób)

## 12. Skills comment
–

## 13. Your video presentation
[LINK DO YOUTUBE – wideo niepubliczne]

## 14. Website
https://halo-miasto.vercel.app

## 15. Code Repository
[LINK DO REPO]

## 16. Instructions on how to open project
Demo działa w przeglądarce, najlepiej na telefonie (aparat i GPS wymagają HTTPS – link poniżej je zapewnia). Na komputerze zamiast aparatu można wybrać zdjęcie z dysku.

**Mieszkaniec – https://halo-miasto.vercel.app**
1. Zaakceptuj zgodę i zaloguj się dowolnym numerem telefonu. Kod z SMS (symulowany): **123-123**.
2. Zrób zdjęcie problemu (dziura, latarnia, śmieci, auto pod bramą) lub wybierz je z galerii.
3. Sprawdź wynik AI, ewentualnie popraw treść pisma, kliknij „Wyślij zgłoszenie”.
4. „Śledź status” – status zmienia się na żywo, gdy urząd go zaktualizuje.

**Urząd – https://halo-miasto.vercel.app/panel** (najlepiej na komputerze)
Hasło: **[HASŁO DO PANELU]**. Mapa z pinezkami i mapą cieplną, lista z filtrami, szczegóły zgłoszenia, zmiana statusu, przypisanie pracownika. Panel zawiera dane demonstracyjne (ok. 40 przykładowych zgłoszeń w Krakowie).

**Pracownik w terenie – https://halo-miasto.vercel.app/pracownik**
Numer **500 100 100** (Jan Kowalski, Zarząd Dróg), kod **123-123**. Zadanie przypisane w panelu pojawia się od razu; zamknięcie wymaga zdjęcia po naprawie. Inne konta: 500 200 200 (Straż Miejska), 500 300 300 (MPO).

**Uruchomienie lokalne:** `npm install`, skopiować `.env.example` do `.env.local` (publiczny adres i klucz Supabase), `npm run dev`. Funkcje backendu i schemat bazy: `supabase/functions/`, `supabase/migrations/`.

**Użyte narzędzia AI, API, modele i biblioteki:**
- OpenAI API (model wizyjny, structured outputs) – analiza zdjęć i przygotowanie treści zgłoszenia
- Claude (Anthropic) – wsparcie przy pisaniu kodu, projektowaniu interfejsu (Claude Design) i dokumentacji
- MediaPipe Face Detector (Google) – wykrywanie twarzy na urządzeniu
- Supabase – Postgres, Storage, Realtime, Edge Functions
- Next.js, React, Tailwind CSS, Leaflet, exifr, zod
- OpenStreetMap i Nominatim – mapy i adresy (© współtwórcy OpenStreetMap)
- Resend – wysyłka e-maili
- Vercel – hosting

## 17. Presentation
[PDF – maks. 10 slajdów, maks. 10 MB]
