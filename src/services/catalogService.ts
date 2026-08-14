import { getMeta, initLocalDb, replaceOfficialQuestions, setMeta } from '@/db/localDb';
import officialSeed from '@/data/official.seed.json';
import type { Question } from '@/types/question';

const META_VERSION_KEY = 'official_bundle_version';

export type OfficialBundle = {
  version: string;
  questions: Question[];
};

async function loadBundledOfficial(): Promise<OfficialBundle | null> {
  return officialSeed as OfficialBundle;
}

/** Catálogo oficial: tenta JSON remoto uma vez se versão mudar; senão mantém cache SQLite. */
export async function syncOfficialCatalog(remoteUrl?: string): Promise<{ loaded: number; source: string }> {
  await initLocalDb();
  const remote = remoteUrl ?? '/data/official.json';
  let bundle: OfficialBundle | null = null;
  let source = 'bundled';

  try {
    const res = await fetch(remote, { cache: 'no-store' });
    if (res.ok) {
      bundle = (await res.json()) as OfficialBundle;
      source = 'remote';
    }
  } catch {
    /* rede indisponível */
  }

  if (!bundle) bundle = await loadBundledOfficial();

  if (!bundle?.questions?.length) {
    return { loaded: 0, source: 'none' };
  }

  const prev = await getMeta(META_VERSION_KEY);
  if (prev === bundle.version) {
    return { loaded: bundle.questions.length, source: 'cache-unchanged' };
  }

  await replaceOfficialQuestions(bundle.questions);
  await setMeta(META_VERSION_KEY, bundle.version);
  return { loaded: bundle.questions.length, source };
}
