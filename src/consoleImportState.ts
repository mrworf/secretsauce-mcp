import type {ManagedConfiguration} from './consoleServices.js';

/** Legacy mapping records are provenance, never fresh grant authority. */
export function hasLegacyImportMappings(managed:ManagedConfiguration|undefined):boolean {
 return Object.values(managed?.services??{}).some(s=>s.draft&&(s.draft.missingMappings!==undefined||s.draft.importedIdentities!==undefined));
}
export function retireLegacyImportMappings(managed:ManagedConfiguration):void {
 for(const service of Object.values(managed.services)){
  const draft=service.draft;if(!draft||(draft.missingMappings===undefined&&draft.importedIdentities===undefined))continue;
  // Old writers did not distinguish an ordinary selection from mapping-derived access.
  // Never infer its origin from equal labels, identifiers or journal retention.
  draft.content.access={users:service.applied?[...service.assignments]:[]};
  if(!service.applied)service.importAccessReset=true;
  delete draft.missingMappings;delete draft.importedIdentities;delete service.review;
  draft.generation=Math.max(draft.generation,service.proposalGeneration??0)+1;
  service.proposalGeneration=draft.generation;draft.base=managed.revision;
 }
}
