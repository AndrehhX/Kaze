import dubbedSpanishList from './dubbed_spanish.json';

export const VERIFIED_LATINO_DUB_MAP: Record<string, { slug: string; episodes: number }> = {
  '20': { slug: 'naruto', episodes: 220 },
  '269': { slug: 'bleach', episodes: 366 },
  '1535': { slug: 'death-note', episodes: 37 },
  '16498': { slug: 'shingeki-no-kyojin', episodes: 25 },
  '25777': { slug: 'shingeki-no-kyojin-season-2', episodes: 12 },
  '29803': { slug: 'overlord', episodes: 13 },
  '30276': { slug: 'one-punch-man', episodes: 12 },
  '30694': { slug: 'dragon-ball-super', episodes: 131 },
  '31964': { slug: 'boku-no-hero-academia', episodes: 13 },
  '35247': { slug: 'boku-no-hero-academia-2nd-season', episodes: 25 },
  '35760': { slug: 'shingeki-no-kyojin-season-3', episodes: 12 },
  '36946': { slug: 'dragon-ball-super-broly', episodes: 1 },
  '37521': { slug: 'vinland-saga', episodes: 24 },
  '37999': { slug: 'kaguya-sama-season-1', episodes: 12 },
  '38000': { slug: 'kimetsu-no-yaiba', episodes: 26 },
  '38524': { slug: 'shingeki-no-kyojin-season-3-part-2', episodes: 10 },
  '38691': { slug: 'dr-stone', episodes: 24 },
  '39535': { slug: 'mushoku-tensei-isekai-ittara-honki-dasu', episodes: 23 },
  '39587': { slug: 'rezero-kara-hajimeru-isekai-seikatsu-2nd-season', episodes: 25 },
  '40028': { slug: 'shingeki-no-kyojin-the-final-season', episodes: 16 },
  '40356': { slug: 'kaguya-sama-season-2', episodes: 12 },
  '40748': { slug: 'jujutsu-kaisen', episodes: 24 },
  '42310': { slug: 'cyberpunk-edgerunners', episodes: 10 },
  '42897': { slug: 'horimiya', episodes: 13 },
  '43608': { slug: 'kaguya-sama-season-3', episodes: 13 },
  '44511': { slug: 'chainsaw-man', episodes: 12 },
  '47778': { slug: 'kimetsu-no-yaiba-yuukaku-hen', episodes: 11 },
  '48583': { slug: 'shingeki-no-kyojin-the-final-season-part-2', episodes: 12 },
  '48895': { slug: 'overlord-iv', episodes: 13 },
  '49387': { slug: 'vinland-saga-season-2', episodes: 24 },
  '50273': { slug: 'spy-x-family', episodes: 12 },
  '50602': { slug: 'spy-x-family-part-2', episodes: 13 },
  '51009': { slug: 'jujutsu-kaisen-2nd-season', episodes: 23 },
  '52211': { slug: 'mashle', episodes: 12 },
  '52299': { slug: 'ore-dake-level-up-na-ken', episodes: 12 },
  '52991': { slug: 'sousou-no-frieren', episodes: 28 },
};

export const VERIFIED_CASTELLANO_DUB_MAP: Record<string, { slug: string; episodes: number }> = {
  '1535': { slug: 'death-note-castellano', episodes: 37 },
  '16498': { slug: 'shingeki-no-kyojin-castellano', episodes: 25 },
  '31964': { slug: 'boku-no-hero-academia-castellano', episodes: 13 },
  '35247': { slug: 'boku-no-hero-academia-2nd-season-castellano', episodes: 25 },
  '38000': { slug: 'kimetsu-no-yaiba-castellano', episodes: 26 },
  '44511': { slug: 'chainsaw-man-castellano', episodes: 12 },
  '51009': { slug: 'jujutsu-kaisen-s2-castellano', episodes: 23 },
  '52299': { slug: 'solo-leveling-castellano', episodes: 12 },
  '52991': { slug: 'sousou-no-frieren-castellano', episodes: 28 },
};

export const EXCLUDED_DUB_MAL_IDS = new Set<string>([
  '431',
  '199',
  '164',
  '523',
  '512',
  '578',
  '2890',
  '10029',
  '16662',
  '32281',
  '28851',
  '22319',
  '14719',
  '20899',
  '26055',
  '31425',
  '37991',
  '48661',
  '50849',
  '53273',
]);

export const DUB_BATCH_RANGES: Record<string, { maxEpisode: number; label: string }> = {
  '21': { maxEpisode: 325, label: 'Eps. 1-325' },
  '1735': { maxEpisode: 112, label: 'Eps. 1-112' },
  '269': { maxEpisode: 229, label: 'Eps. 1-229' },
};

export const ANILIST_TO_MAL_MAP: Record<string, string> = {
  '113415': '40748',
  '145064': '51009',
  '108465': '39535',
  '127230': '44511',
  '154587': '52991',
  '11061': '16498',
  '20958': '25777',
  '99147': '35760',
  '104578': '38524',
  '110277': '40028',
  '131681': '48583',
  '101922': '38000',
  '129874': '47778',
  '20': '20',
  '269': '269',
  '1535': '1535',
  '21459': '31964',
  '21856': '35247',
  '10087': '30694',
  '103223': '36946',
  '101348': '37521',
  '136430': '49387',
  '102066': '37999',
  '112641': '40356',
  '125367': '43608',
  '105333': '38691',
  '108632': '39587',
  '126791': '42310',
  '124080': '42897',
  '140960': '50273',
  '142838': '50602',
  '151801': '52211',
  '151807': '52299',
  '21699': '29803',
  '133844': '48895',
  '21087': '30276',
};

export function resolveMalId(idOrMalId: number | string): string {
  const str = String(idOrMalId);
  return ANILIST_TO_MAL_MAP[str] || str;
}

export function isMalIdDubbedInSpanish(malId: number | string): boolean {
  if (!malId) return false;
  const resolved = resolveMalId(malId);
  if (EXCLUDED_DUB_MAL_IDS.has(resolved)) return false;
  if (VERIFIED_LATINO_DUB_MAP[resolved]) return true;
  if (VERIFIED_CASTELLANO_DUB_MAP[resolved]) return true;
  return Boolean((dubbedSpanishList as Record<string, any>)[resolved]);
}

export function isEpisodeInDubRange(malId: number | string, episodeNumber = 1): boolean {
  if (!malId) return true;
  const resolved = resolveMalId(malId);
  const batch = DUB_BATCH_RANGES[resolved];
  if (!batch) return true;
  return Number(episodeNumber) <= batch.maxEpisode;
}
