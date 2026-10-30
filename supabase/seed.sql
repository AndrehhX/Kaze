-- Deterministic seed data for local development.
-- Contains catalog/reference data only — never fake users, reviews or activity.

insert into public.achievements (id, name, description, category, threshold, icon) values
  ('first-steps',      'First Steps',        'Add your first title to the library.',            'milestone', 1,   'footprints'),
  ('first-finish',     'Credits Roll',       'Complete your first anime.',                      'milestone', 1,   'flag'),
  ('ten-complete',     'Marathoner',         'Complete 10 anime.',                              'milestone', 10,  'medal'),
  ('fifty-complete',   'Veteran Viewer',     'Complete 50 anime.',                              'milestone', 50,  'crown'),
  ('hundred-episodes', 'Century',            'Log 100 episodes of progress.',                   'milestone', 100, 'gauge'),
  ('genre-five',       'Genre Explorer',     'Complete anime across 5 different genres.',       'genre',     5,   'compass'),
  ('genre-ten',        'Genre Cartographer', 'Complete anime across 10 different genres.',      'genre',     10,  'map'),
  ('decades-three',    'Time Traveller',     'Complete anime from 3 different decades.',        'discovery', 3,   'hourglass'),
  ('hidden-gem',       'Gem Hunter',         'Complete an anime with under 30k AniList members.','discovery', 1,   'gem'),
  ('critic',           'Critic',             'Publish your first review.',                      'social',    1,   'pen'),
  ('party-host',       'Party Host',         'Host a watch party.',                             'social',    1,   'popcorn'),
  ('season-goal',      'On Schedule',        'Reach a seasonal watch goal.',                    'seasonal',  1,   'calendar')
on conflict (id) do update set name = excluded.name, description = excluded.description, threshold = excluded.threshold, icon = excluded.icon;

-- Demo catalog mirror (the app reads src/lib/media/demo-catalog.ts; this keeps the DB catalog consistent).
insert into public.media_assets (id, provider, series_id, episode_id, kind, src, markers, subtitles, duration_seconds, license) values
  ('bbb-mux',      'demo', 'open-cinema', '1', 'hls', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', '[{"kind":"intro","start":0,"end":24},{"kind":"outro","start":490,"end":596}]', '[{"lang":"en","src":"/demo/subtitles/big-buck-bunny.en.vtt"}]', 596, 'CC BY 3.0 — Blender Foundation'),
  ('tos-mux',      'demo', 'open-cinema', '2', 'hls', 'https://test-streams.mux.dev/tos_ismc/main.m3u8', '[{"kind":"intro","start":0,"end":15},{"kind":"outro","start":640,"end":734}]', '[]', 734, 'CC BY 3.0 — Blender Foundation'),
  ('tos-usp',      'demo', 'open-cinema', '3', 'hls', 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8', '[{"kind":"intro","start":0,"end":15},{"kind":"outro","start":640,"end":734}]', '[]', 734, 'CC BY 3.0 — Blender Foundation'),
  ('apple-bipbop', 'demo', 'open-cinema', '4', 'hls', 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8', '[]', '[]', 600, 'Apple HLS reference stream (test pattern)')
on conflict (id) do nothing;

insert into public.media_entitlements (user_id, provider, series_id, reason)
select null, 'demo', 'open-cinema', 'demo-open-license'
where not exists (select 1 from public.media_entitlements where provider = 'demo' and series_id = 'open-cinema' and user_id is null);
