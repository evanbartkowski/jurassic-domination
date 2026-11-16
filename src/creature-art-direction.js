// Authored silhouette and pigment families. Mythic forms retain their fantasy anatomy.
export function creatureArtDirection(species) {
  const id=species.id;
  const family=/spino|baryonyx|suchomimus|croc|sarco|deino(suchus)/.test(id) ? 'river-hunter'
    : /tricer|protocer|styrac|pachyrhino|psittaco/.test(id) ? 'ceratopsian'
    : /brachio|apato|diplo|amarga|argentino|dreadnought/.test(id) ? 'sauropod'
    : /raptor|deinonychus|compsognathus|ornithomimus|heterodonto/.test(id) ? 'cursorial'
    : /parasauro|edmonto|maiasaura|iguanodon|shantungo/.test(id) ? 'browser'
    : /ankylo|euoplo|minmi/.test(id) ? 'armored'
    : species.body;
  let hash=0;for(const c of id)hash=(hash*31+c.charCodeAt(0))>>>0;
  return {
    family,
    headLength: family==='river-hunter' ? 1.25 : family==='ceratopsian' ? .60 : family==='browser' ? .85 : null,
    muzzleDepth: family==='river-hunter' ? .64 : family==='browser' ? .72 : 1,
    torsoWidth: family==='cursorial' ? .84 : family==='armored' ? 1.12 : 1,
    pattern: ['skin','banded','speckled'][hash%3],
  };
}
