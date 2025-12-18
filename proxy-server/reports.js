/**
 * Reports Module
 *
 * Generates combined import reports showing items and spells together
 * with accurate ownership detection.
 */

/**
 * Generate combined import report from items and spells data
 * @param {object} itemsData - Data from fetchAllItems() { items, sourceStats, ownershipBySourceId, allSources }
 * @param {object} spellsData - Data from fetchAllSpells() { spells, sourceStats, ownershipBySourceId, allSources }
 */
export function generateCombinedReport(itemsData, spellsData) {
  console.log('\n========================================');
  console.log('COMBINED IMPORT REPORT');
  console.log('========================================\n');

  // Merge ownership data from both items and spells
  // A source is owned if it appears in EITHER items OR spells API response
  const combinedOwnership = new Map();

  // Add ownership from items
  for (const [sourceId, owned] of itemsData.ownershipBySourceId.entries()) {
    combinedOwnership.set(sourceId, owned);
  }

  // Add ownership from spells (OR operation - owned if in either)
  for (const [sourceId, owned] of spellsData.ownershipBySourceId.entries()) {
    const currentOwned = combinedOwnership.get(sourceId) || false;
    combinedOwnership.set(sourceId, currentOwned || owned);
  }

  // Build source book report data
  const sourceReportMap = new Map();

  for (const source of itemsData.allSources) {
    const itemCount = itemsData.sourceStats[source.name] || 0;
    const spellCount = spellsData.sourceStats[source.name] || 0;
    const owned = combinedOwnership.get(source.id) || false;

    sourceReportMap.set(source.name, {
      name: source.name,
      itemCount,
      spellCount,
      owned,
      sourceId: source.id
    });
  }

  // Sort by total content (items + spells) descending, then alphabetically
  const sortedSources = Array.from(sourceReportMap.values())
    .sort((a, b) => {
      const totalA = a.itemCount + a.spellCount;
      const totalB = b.itemCount + b.spellCount;

      if (totalB !== totalA) {
        return totalB - totalA; // Sort by total content descending
      }
      return a.name.localeCompare(b.name); // Then alphabetically
    });

  // Display combined report
  for (const source of sortedSources) {
    const ownership = source.owned ? '(Owned)    ' : '(Not Owned)';
    const itemCount = source.itemCount.toString().padStart(4, ' ');
    const spellCount = source.spellCount.toString().padStart(4, ' ');

    console.log(`${source.name.padEnd(50)} ${ownership} ${itemCount} Items ${spellCount} Spells`);
  }

  console.log('\n========================================');
  console.log(`Total Sources: ${sortedSources.length}`);
  console.log(`Owned Sources: ${sortedSources.filter(s => s.owned).length}`);
  console.log(`Total Items: ${itemsData.items.length}`);
  console.log(`Total Spells: ${spellsData.spells.length}`);
  console.log('========================================\n');
}

export default {
  generateCombinedReport
};
