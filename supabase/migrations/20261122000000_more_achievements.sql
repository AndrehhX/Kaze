-- Nuevos logros (22/11/2026) y textos en español de los existentes.
-- Solo añade o actualiza definiciones de la tabla public.achievements; no toca los logros ganados.
insert into public.achievements (id, name, description, category, threshold, icon) values
  ('hundred-complete',      'Sensei del anime',      'Completa 100 animes.',                                   'milestone', 100, 'scroll'),
  ('five-hundred-episodes', 'Leyenda',               'Registra 500 episodios vistos.',                         'milestone', 500, 'flame'),
  ('favorites-ten',         'Corazón otaku',         'Marca 10 animes como favoritos.',                        'milestone', 10,  'heart'),
  ('rated-twenty',          'Ojo crítico',           'Puntúa 20 animes de tu biblioteca.',                     'social',    20,  'star'),
  ('classic-fan',           'Amante de los clásicos','Completa un anime anterior a 1990.',                     'discovery', 1,   'gem'),
  ('movie-buff',            'Cinéfilo',              'Completa 10 películas de anime.',                        'discovery', 10,  'film'),
  ('night-owl',             'Noctámbulo',            'Mira 10 episodios entre la medianoche y las 6 de la mañana.', 'milestone', 10, 'moon'),
  ('binge-day',             'Maratón de un día',     'Mira 12 episodios en un mismo día.',                     'milestone', 12,  'zap')
on conflict (id) do nothing;

update public.achievements set name = v.name, description = v.description from (values
  ('first-steps',      'Primeros pasos',         'Añade tu primer anime a la biblioteca.'),
  ('first-finish',     'Créditos finales',       'Completa tu primer anime.'),
  ('ten-complete',     'Maratonista',            'Completa 10 animes.'),
  ('fifty-complete',   'Veterano',               'Completa 50 animes.'),
  ('hundred-episodes', 'Centenario',             'Registra 100 episodios vistos.'),
  ('genre-five',       'Explorador de géneros',  'Completa animes de 5 géneros distintos.'),
  ('genre-ten',        'Cartógrafo de géneros',  'Completa animes de 10 géneros distintos.'),
  ('decades-three',    'Viajero del tiempo',     'Completa animes de 3 décadas distintas.'),
  ('hidden-gem',       'Cazador de joyas',       'Completa un anime con menos de 30 000 miembros en AniList.'),
  ('critic',           'Crítico',                'Publica tu primera reseña.'),
  ('party-host',       'Anfitrión',              'Organiza una sala de cine.'),
  ('season-goal',      'Al día',                 'Cumple tu meta de la temporada.')
) as v(id, name, description)
where public.achievements.id = v.id;
