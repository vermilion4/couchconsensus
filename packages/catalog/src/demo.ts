import {CatalogFile} from './schema';
import demo from '../data/demo-deck.json';

/** The invented demo catalog (SV-6). Validated on load so a bad edit fails fast. */
export function loadDemoCatalog(): CatalogFile {
  return CatalogFile.parse(demo);
}
