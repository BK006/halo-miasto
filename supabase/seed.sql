-- Demo data for the city panel: ~40 realistic Kraków reports over the last two weeks.
-- Everything is flagged is_seed = true; wipe with:  delete from reports where is_seed;
-- Re-runnable: removes previous seed rows first.

delete from reports where is_seed;

do $$
declare
  r record;
  rid uuid;
  created timestamptz;
begin
  for r in
    select * from (values
      -- category, summary, priority, reason, lat, lng, address, unit, status, reporters, age_h, accept_after_h, resolve_after_h
      ('pothole', 'Zapadnięta studzienka kanalizacyjna na pasie ruchu, różnica poziomów ok. 10 cm.', 9, 'Bezpośrednie zagrożenie dla pojazdów na ruchliwym rondzie.', 50.0655, 19.9590, 'rondo Mogilskie, Kraków', 'zdmk', 'sent', 5, 3, null, null),
      ('pothole', 'Głęboki ubytek przy torowisku tramwajowym, odsłonięte krawędzie płyt.', 8, 'Ryzyko wypadku jednośladu przy torowisku.', 50.0442, 19.9468, 'ul. Kalwaryjska 40, Kraków', 'zdmk', 'sent', 6, 20, null, null),
      ('pothole', 'Ubytek w nawierzchni o średnicy ok. 40 cm przy prawej krawędzi pasa ruchu.', 7, 'Ryzyko uszkodzenia pojazdu i wypadku rowerzysty.', 50.0672, 19.9297, 'ul. Karmelicka 34, Kraków', 'zdmk', 'sent', 1, 1, null, null),
      ('pothole', 'Kilka ubytków w asfalcie na odcinku ok. 20 m, woda w zagłębieniach.', 6, 'Utrudnia jazdę, ryzyko pogłębienia po deszczach.', 50.0712, 19.9455, 'ul. Długa 50, Kraków', 'zdmk', 'accepted', 2, 70, 9, null),
      ('pothole', 'Wyrwa w jezdni przy przejściu dla pieszych.', 7, 'Zagrożenie dla pieszych i rowerzystów.', 50.0503, 19.9265, 'ul. Konopnickiej 12, Kraków', 'zdmk', 'resolved', 3, 220, 18, 96),
      ('pothole', 'Spękana nawierzchnia i ubytek przy krawężniku.', 5, 'Postępująca degradacja nawierzchni.', 50.0389, 19.9518, 'ul. Wielicka 28, Kraków', 'zdmk', 'accepted', 1, 120, 30, null),
      ('pothole', 'Ubytek w jezdni na zjeździe z mostu.', 8, 'Duża prędkość pojazdów w tym miejscu.', 50.0498, 19.9532, 'Most Powstańców Śląskich, Kraków', 'zdmk', 'resolved', 4, 300, 6, 48),
      ('damaged_sidewalk', 'Wypiętrzone płyty chodnikowe przez korzenie drzewa, różnica poziomów ok. 6 cm.', 5, 'Ryzyko potknięcia, utrudnienie dla wózków.', 50.0618, 19.9285, 'ul. Batorego 8, Kraków', 'zdmk', 'sent', 2, 30, null, null),
      ('damaged_sidewalk', 'Brak kilku kostek brukowych w chodniku przy przystanku.', 4, 'Ryzyko potknięcia w miejscu dużego ruchu pieszych.', 50.0587, 19.9461, 'ul. Westerplatte 15, Kraków', 'zdmk', 'accepted', 1, 160, 40, null),
      ('damaged_sidewalk', 'Zapadnięty fragment chodnika przy wjeździe do bramy.', 5, 'Ryzyko upadku, szczególnie po zmroku.', 50.0451, 19.9392, 'ul. Zamoyskiego 30, Kraków', 'zdmk', 'resolved', 1, 260, 25, 120),
      ('broken_streetlight', 'Latarnia przy przejściu dla pieszych nie świeci.', 5, 'Słaba widoczność pieszych na przejściu po zmroku.', 50.0660, 19.9230, 'al. Mickiewicza, przejście dla pieszych, Kraków', 'zdmk', 'sent', 2, 5, null, null),
      ('broken_streetlight', 'Dwie sąsiednie latarnie nie świecą na odcinku ok. 60 m chodnika.', 6, 'Ciemny odcinek chodnika przy ruchliwej ulicy.', 50.0545, 19.9440, 'ul. Dietla 50, Kraków', 'zdmk', 'accepted', 2, 62, 14, null),
      ('broken_streetlight', 'Migająca latarnia w parku przy alejce.', 3, 'Niewielki wpływ na bezpieczeństwo.', 50.0703, 19.9134, 'Park Jordana, Kraków', 'zdmk', 'resolved', 1, 190, 22, 70),
      ('broken_streetlight', 'Nie świeci latarnia przy przystanku tramwajowym.', 5, 'Ciemny przystanek po zmroku.', 50.0346, 19.9408, 'ul. Kalwaryjska, przystanek Łagiewniki, Kraków', 'zdmk', 'sent', 1, 26, null, null),
      ('traffic_sign', 'Przewrócony znak „ustąp pierwszeństwa” na skrzyżowaniu.', 8, 'Brak oznakowania pierwszeństwa na skrzyżowaniu.', 50.0758, 19.9301, 'ul. Kazimierza Wielkiego / Królewska, Kraków', 'zdmk', 'accepted', 1, 28, 2, null),
      ('traffic_sign', 'Sygnalizacja dla pieszych nie działa, miga na żółto.', 9, 'Bezpośrednie zagrożenie dla pieszych na przejściu.', 50.0571, 19.9600, 'ul. Grzegórzecka / Rondo Grzegórzeckie, Kraków', 'zdmk', 'resolved', 7, 140, 1, 6),
      ('illegal_dumping', 'Kilkanaście worków z odpadami i stare meble przy ogrodzeniu.', 4, 'Brak bezpośredniego zagrożenia, odpady mogą się rozprzestrzeniać.', 50.0475, 19.9615, 'ul. Lipowa, Kraków', 'sm', 'accepted', 3, 100, 20, null),
      ('illegal_dumping', 'Porzucone opony przy ścieżce rowerowej.', 3, 'Odpady przy ścieżce rowerowej, bez zagrożenia.', 50.0530, 19.9330, 'Bulwar Czerwieński, Kraków', 'sm', 'resolved', 2, 230, 30, 90),
      ('illegal_dumping', 'Gruz budowlany wysypany na trawnik przy garażach.', 5, 'Zanieczyszczenie terenu zielonego.', 50.0832, 19.9677, 'ul. Ugorek, Kraków', 'sm', 'sent', 1, 44, null, null),
      ('illegal_dumping', 'Porzucona lodówka i telewizor przy śmietniku.', 4, 'Odpady wielkogabarytowe poza wyznaczonym terminem.', 50.0289, 19.9302, 'ul. Zakopiańska 62, Kraków', 'sm', 'sent', 2, 12, null, null),
      ('illegal_parking', 'Samochód osobowy zaparkowany w poprzek bramy wjazdowej.', 6, 'Uniemożliwia wjazd i wyjazd z posesji, także pojazdom ratunkowym.', 50.0465, 19.9490, 'ul. Józefińska 8, Kraków', 'sm', 'sent', 1, 2, null, null),
      ('illegal_parking', 'Auto zaparkowane na chodniku przed bramą, blokuje przejście.', 7, 'Blokuje wyjazd z posesji i przejście pieszym z wózkami.', 50.0690, 19.9360, 'ul. Krowoderska 12, Kraków', 'sm', 'accepted', 1, 22, 1, null),
      ('illegal_parking', 'Pojazd na miejscu dla osób z niepełnosprawnościami bez karty.', 5, 'Utrudnia dostęp osobom z niepełnosprawnościami.', 50.0640, 19.9450, 'ul. Pawia 5, Kraków', 'sm', 'resolved', 1, 80, 1, 3),
      ('illegal_parking', 'Samochód dostawczy na przejściu dla pieszych.', 7, 'Zasłania widoczność pieszych na przejściu.', 50.0508, 19.9440, 'ul. Starowiślna 70, Kraków', 'sm', 'resolved', 2, 50, 1, 2),
      ('graffiti', 'Napis farbą w sprayu na elewacji kamienicy, ok. 2 m².', 2, 'Szkoda estetyczna, bez zagrożenia dla bezpieczeństwa.', 50.0634, 19.9405, 'ul. Floriańska 15, Kraków', 'sm', 'sent', 1, 4, null, null),
      ('graffiti', 'Niewielki napis na skrzynce elektrycznej.', 1, 'Szkoda estetyczna.', 50.0570, 19.9455, 'ul. Starowiślna 30, Kraków', 'sm', 'resolved', 1, 200, 48, 120),
      ('graffiti', 'Wulgarny napis na murze przy szkole.', 3, 'Treść nieodpowiednia w pobliżu szkoły.', 50.0756, 19.9534, 'ul. Rakowicka 20, Kraków', 'sm', 'accepted', 2, 90, 12, null),
      ('overflowing_bin', 'Przepełniony kosz na śmieci, odpady wokół.', 3, 'Nieprzyjemny zapach, przyciąga zwierzęta.', 50.0612, 19.9372, 'Rynek Główny, Kraków', 'mpo', 'resolved', 3, 30, 2, 6),
      ('overflowing_bin', 'Kosze przy przystanku przepełnione od kilku dni.', 4, 'Odpady rozwiewane na jezdnię.', 50.0626, 19.9497, 'ul. Lubicz, Dworzec Główny, Kraków', 'mpo', 'sent', 2, 8, null, null),
      ('overflowing_bin', 'Przepełnione pojemniki na segregację przy blokach.', 3, 'Odpady poza pojemnikami.', 50.0901, 19.9871, 'os. Dywizjonu 303, Kraków', 'mpo', 'accepted', 1, 54, 10, null),
      ('flooding', 'Woda wybija ze studzienki, zalana jezdnia na odcinku ok. 30 m.', 9, 'Prawdopodobna awaria sieci, ryzyko podmycia nawierzchni.', 50.0398, 19.9220, 'ul. Monte Cassino 20, Kraków', 'mpwik', 'accepted', 4, 6, 1, null),
      ('flooding', 'Zalana piwnica po nawalnym deszczu, woda z kanalizacji.', 7, 'Cofka kanalizacji, ryzyko szkód w budynku.', 50.0821, 19.9118, 'ul. Wrocławska 40, Kraków', 'mpwik', 'resolved', 2, 170, 3, 30),
      ('flooding', 'Wyciek wody z hydrantu na chodnik.', 6, 'Straty wody, oblodzenie przy spadku temperatury.', 50.0583, 19.9171, 'ul. Kraszewskiego 10, Kraków', 'mpwik', 'sent', 1, 15, null, null),
      ('greenery', 'Złamany konar zwisa nad alejką spacerową.', 8, 'Ryzyko spadnięcia konaru na przechodniów.', 50.0640, 19.9330, 'Planty, przy ul. Podwale, Kraków', 'zzm', 'accepted', 3, 18, 2, null),
      ('greenery', 'Przewrócone drzewo częściowo blokuje ścieżkę rowerową.', 7, 'Utrudnienie ruchu rowerowego, ryzyko kolizji.', 50.0490, 19.9010, 'Bulwar Wołyński, Kraków', 'zzm', 'resolved', 2, 120, 4, 26),
      ('greenery', 'Zarośnięty znak drogowy, gałęzie zasłaniają widoczność.', 5, 'Ograniczona widoczność znaku dla kierowców.', 50.0727, 19.8985, 'ul. Królowej Jadwigi 50, Kraków', 'zzm', 'sent', 1, 36, null, null),
      ('other', 'Uszkodzona ławka z wystającymi gwoździami.', 4, 'Ryzyko skaleczenia.', 50.0548, 19.9365, 'Plac Wolnica, Kraków', 'um', 'sent', 1, 10, null, null),
      ('other', 'Zniszczona wiata przystankowa, rozbita szyba.', 6, 'Odłamki szkła na chodniku.', 50.0711, 19.9612, 'ul. Mogilska 20, przystanek, Kraków', 'um', 'accepted', 2, 40, 6, null),
      ('pothole', 'Ubytek w nawierzchni ścieżki rowerowej.', 5, 'Ryzyko upadku rowerzysty.', 50.0471, 19.9260, 'Bulwar Kurlandzki, Kraków', 'zdmk', 'sent', 1, 50, null, null),
      ('pothole', 'Kilkucentymetrowy uskok na łączeniu nawierzchni.', 4, 'Dyskomfort jazdy, ryzyko dla jednośladów.', 50.0868, 19.9350, 'ul. Opolska 15, Kraków', 'zdmk', 'sent', 1, 100, null, null)
    ) as t(category, summary, priority, reason, lat, lng, address, unit_id, status, reporters, age_h, accept_h, resolve_h)
  loop
    created := now() - make_interval(hours => r.age_h);

    insert into reports (category, summary, priority, priority_reason, confidence, lat, lng, address, unit_id,
                         report_text, status, reporters_count, created_at, updated_at, is_seed)
    values (
      r.category, r.summary, r.priority, r.reason, 0.9, r.lat, r.lng, r.address, r.unit_id,
      format(E'Szanowni Państwo,\n\nuprzejmie zgłaszam: %s Miejsce: %s (%s, %s). Proszę o interwencję. Zdjęcie w załączeniu.\n\nZ poważaniem,\nMieszkaniec (zgłoszenie przez aplikację Zgłoś to)',
             r.summary, r.address, r.lat, r.lng),
      r.status::report_status, r.reporters, created, created, true
    )
    returning id into rid;

    -- Replace the trigger's "now" history row with a realistic timeline.
    delete from status_history where report_id = rid;
    insert into status_history (report_id, status, changed_at) values (rid, 'new', created);
    insert into status_history (report_id, status, changed_at, note)
      values (rid, 'sent', created + interval '1 minute', 'demo: dane przykładowe');
    if r.accept_h is not null then
      insert into status_history (report_id, status, changed_at)
        values (rid, 'accepted', created + make_interval(hours => r.accept_h));
    end if;
    if r.resolve_h is not null then
      insert into status_history (report_id, status, changed_at)
        values (rid, 'resolved', created + make_interval(hours => r.resolve_h));
    end if;
  end loop;
end $$;
