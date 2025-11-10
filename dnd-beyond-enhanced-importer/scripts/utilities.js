// D&D Beyond Enhanced Importer
// Utility Functions

/**
 * Convert a D&D Beyond item to Foundry VTT format
 * @param {object} ddbItem - The D&D Beyond item
 * @param {Array} sources - Array of source books
 * @returns {object} The Foundry VTT item
 */
export async function convertDDBItemToFoundry(ddbItem, sources) {
  // Base item properties
  const item = {
    name: ddbItem.name,
    type: mapItemType(ddbItem.type),
    img: ddbItem.avatarUrl || getDefaultItemImage(ddbItem.type),
    system: {
      description: {
        value: formatItemDescription(ddbItem),
        chat: '',
        unidentified: ''
      },
      source: getSourceName(ddbItem.sourceId, sources),
      quantity: 1,
      weight: ddbItem.weight || 0,
      price: ddbItem.cost || 0,
      attunement: ddbItem.attunementRequirements ? 1 : 0,
      rarity: mapRarity(ddbItem.rarity),
      identified: true
    }
  };
  
  // Add specific properties based on item type
  switch (item.type) {
    case 'weapon':
      enhanceWeapon(item, ddbItem);
      break;
    case 'equipment':
      enhanceEquipment(item, ddbItem);
      break;
    case 'consumable':
      enhanceConsumable(item, ddbItem);
      break;
    case 'tool':
      enhanceTool(item, ddbItem);
      break;
    case 'loot':
      enhanceLoot(item, ddbItem);
      break;
    case 'container':
      enhanceContainer(item, ddbItem);
      break;
  }
  
  // Add item flags
  item.flags = {
    'dnd-beyond-enhanced-importer': {
      ddbId: ddbItem.id,
      sourceId: ddbItem.sourceId,
      sourceName: getSourceName(ddbItem.sourceId, sources),
      importVersion: '1.0.0'
    }
  };
  
  return item;
}

/**
 * Convert a D&D Beyond spell to Foundry VTT format
 * @param {object} ddbSpell - The D&D Beyond spell
 * @param {Array} sources - Array of source books
 * @returns {object} The Foundry VTT spell
 */
export async function convertDDBSpellToFoundry(ddbSpell, sources) {
  // Base spell properties
  const spell = {
    name: ddbSpell.name,
    type: 'spell',
    img: ddbSpell.avatarUrl || getDefaultSpellImage(ddbSpell.school),
    system: {
      description: {
        value: formatSpellDescription(ddbSpell),
        chat: '',
        unidentified: ''
      },
      source: getSourceName(ddbSpell.sourceId, sources),
      level: ddbSpell.level,
      school: mapSpellSchool(ddbSpell.school),
      components: {
        vocal: ddbSpell.components.includes('V'),
        somatic: ddbSpell.components.includes('S'),
        material: ddbSpell.components.includes('M'),
        ritual: ddbSpell.ritual,
        concentration: ddbSpell.concentration
      },
      materials: {
        value: ddbSpell.componentsDescription || '',
        consumed: false,
        cost: 0,
        supply: 0
      },
      preparation: {
        mode: 'prepared',
        prepared: false
      },
      scaling: {
        mode: 'level',
        formula: ''
      }
    }
  };
  
  // Add casting time
  spell.system.activation = {
    type: mapCastingTime(ddbSpell.castingTime),
    cost: getCastingTimeCost(ddbSpell.castingTime),
    condition: ''
  };
  
  // Add duration
  spell.system.duration = {
    value: getDurationValue(ddbSpell.duration),
    units: getDurationUnits(ddbSpell.duration)
  };
  
  // Add target
  spell.system.target = {
    value: ddbSpell.targetDescription || '',
    width: null,
    units: '',
    type: mapTargetType(ddbSpell.targetDescription)
  };
  
  // Add range
  spell.system.range = {
    value: getRangeValue(ddbSpell.range),
    long: null,
    units: getRangeUnits(ddbSpell.range)
  };
  
  // Add save
  spell.system.save = {
    ability: mapSavingThrow(ddbSpell.saveDcAbility),
    dc: null,
    scaling: 'spell'
  };
  
  // Add damage
  if (ddbSpell.damage) {
    spell.system.damage = {
      parts: [[ddbSpell.damage.diceString, mapDamageType(ddbSpell.damage.type)]],
      versatile: ''
    };
  } else {
    spell.system.damage = {
      parts: [],
      versatile: ''
    };
  }
  
  // Add healing
  if (ddbSpell.healing) {
    spell.system.damage.parts.push([ddbSpell.healing.diceString, 'healing']);
  }
  
  // Add spell scaling
  if (ddbSpell.atHigherLevels) {
    spell.system.scaling = {
      mode: 'level',
      formula: getScalingFormula(ddbSpell)
    };
  }
  
  // Add template if applicable
  if (needsTemplate(ddbSpell)) {
    spell.system.target.type = getTemplateType(ddbSpell);
    spell.system.target.value = getTemplateSize(ddbSpell);
  }
  
  // Add spell flags
  spell.flags = {
    'dnd-beyond-enhanced-importer': {
      ddbId: ddbSpell.id,
      sourceId: ddbSpell.sourceId,
      sourceName: getSourceName(ddbSpell.sourceId, sources),
      importVersion: '1.0.0'
    }
  };
  
  return spell;
}

/**
 * Format an item description with proper HTML
 * @param {object} item - The D&D Beyond item
 * @returns {string} Formatted HTML description
 */
function formatItemDescription(item) {
  let description = '';
  
  // Add name and type
  description += `<h1>${item.name}</h1>`;
  description += `<p><em>${mapItemTypeToText(item.type)}`;
  
  // Add rarity if applicable
  if (item.rarity) {
    description += `, ${item.rarity}`;
  }
  
  // Add attunement if required
  if (item.attunementRequirements) {
    description += ` (requires attunement${item.attunementRequirements !== true ? ` ${item.attunementRequirements}` : ''})`;
  }
  
  description += `</em></p>`;
  
  // Add description
  if (item.description) {
    description += `<p>${item.description.replace(/\\n/g, '</p><p>')}</p>`;
  }
  
  // Add source
  description += `<p class="source">Source: ${item.sourceFullName}</p>`;
  
  return description;
}

/**
 * Format a spell description with proper HTML
 * @param {object} spell - The D&D Beyond spell
 * @returns {string} Formatted HTML description
 */
function formatSpellDescription(spell) {
  let description = '';
  
  // Add name and metadata
  description += `<h1>${spell.name}</h1>`;
  description += `<p><em>${spell.level > 0 ? `Level ${spell.level}` : 'Cantrip'} ${spell.school}</em></p>`;
  
  // Add casting time
  description += `<p><strong>Casting Time:</strong> ${spell.castingTime}</p>`;
  
  // Add range
  description += `<p><strong>Range:</strong> ${spell.range}</p>`;
  
  // Add components
  description += `<p><strong>Components:</strong> ${spell.components}`;
  if (spell.componentsDescription) {
    description += ` (${spell.componentsDescription})`;
  }
  description += `</p>`;
  
  // Add duration
  description += `<p><strong>Duration:</strong> ${spell.concentration ? 'Concentration, ' : ''}${spell.duration}</p>`;
  
  // Add description
  if (spell.description) {
    description += `<p>${spell.description.replace(/\\n/g, '</p><p>')}</p>`;
  }
  
  // Add higher level casting
  if (spell.atHigherLevels) {
    description += `<p><strong>At Higher Levels:</strong> ${spell.atHigherLevels}</p>`;
  }
  
  // Add source
  description += `<p class="source">Source: ${spell.sourceFullName}</p>`;
  
  return description;
}

/**
 * Map D&D Beyond item type to Foundry type
 * @param {string} ddbType - The D&D Beyond item type
 * @returns {string} Foundry item type
 */
function mapItemType(ddbType) {
  const typeMap = {
    'Weapon': 'weapon',
    'Armor': 'equipment',
    'Wondrous item': 'equipment',
    'Ring': 'equipment',
    'Rod': 'equipment',
    'Staff': 'equipment',
    'Wand': 'equipment',
    'Potion': 'consumable',
    'Scroll': 'consumable',
    'Ammunition': 'consumable',
    'Wondrous Item': 'equipment',
    'Adventuring Gear': 'loot',
    'Tool': 'tool',
    'Mount': 'loot',
    'Vehicle': 'loot',
    'Container': 'container'
  };
  
  return typeMap[ddbType] || 'loot';
}

/**
 * Map D&D Beyond item type to descriptive text
 * @param {string} ddbType - The D&D Beyond item type
 * @returns {string} Descriptive text
 */
function mapItemTypeToText(ddbType) {
  return ddbType || 'Item';
}

/**
 * Map D&D Beyond rarity to Foundry rarity
 * @param {string} ddbRarity - The D&D Beyond rarity
 * @returns {string} Foundry rarity
 */
function mapRarity(ddbRarity) {
  const rarityMap = {
    'Common': 'common',
    'Uncommon': 'uncommon',
    'Rare': 'rare',
    'Very Rare': 'very rare',
    'Legendary': 'legendary',
    'Artifact': 'artifact'
  };
  
  return rarityMap[ddbRarity] || '';
}

/**
 * Get the source book name
 * @param {number} sourceId - The source book ID
 * @param {Array} sources - Array of source books
 * @returns {string} The source book name
 */
export function getSourceName(sourceId, sources) {
  const source = sources.find(s => s.id === sourceId);
  return source ? source.name : 'Unknown Source';
}

/**
 * Create a folder if it doesn't exist
 * @param {string} name - The folder name
 * @param {string|null} parent - The parent folder ID
 * @param {string} type - The folder type
 * @returns {Promise<Folder>} The created or existing folder
 */
export async function createFolder(name, parent, type) {
  // Check if folder already exists
  const folder = game.folders.find(f => 
    f.name === name && f.type === type && f.parent === parent
  );
  
  if (folder) return folder;
  
  // Create the folder
  return await Folder.create({
    name,
    type,
    parent
  });
}

/**
 * Get the default image for an item type
 * @param {string} type - The item type
 * @returns {string} Image path
 */
function getDefaultItemImage(type) {
  const typeMap = {
    'Weapon': 'icons/svg/sword.svg',
    'Armor': 'icons/svg/shield.svg',
    'Wondrous item': 'icons/svg/aura.svg',
    'Ring': 'icons/svg/ring.svg',
    'Rod': 'icons/svg/rod.svg',
    'Staff': 'icons/svg/staff.svg',
    'Wand': 'icons/svg/wand.svg',
    'Potion': 'icons/svg/potion.svg',
    'Scroll': 'icons/svg/scroll.svg',
    'Ammunition': 'icons/svg/bullet.svg',
    'Wondrous Item': 'icons/svg/aura.svg',
    'Adventuring Gear': 'icons/svg/backpack.svg',
    'Tool': 'icons/svg/tools.svg',
    'Mount': 'icons/svg/horse.svg',
    'Vehicle': 'icons/svg/ship.svg',
    'Container': 'icons/svg/chest.svg'
  };
  
  return typeMap[type] || 'icons/svg/item-bag.svg';
}

/**
 * Get the default image for a spell school
 * @param {string} school - The spell school
 * @returns {string} Image path
 */
function getDefaultSpellImage(school) {
  const schoolMap = {
    'Abjuration': 'icons/svg/abjuration.svg',
    'Conjuration': 'icons/svg/conjuration.svg',
    'Divination': 'icons/svg/divination.svg',
    'Enchantment': 'icons/svg/enchantment.svg',
    'Evocation': 'icons/svg/evocation.svg',
    'Illusion': 'icons/svg/illusion.svg',
    'Necromancy': 'icons/svg/necromancy.svg',
    'Transmutation': 'icons/svg/transmutation.svg'
  };
  
  return schoolMap[school] || 'icons/svg/spell.svg';
}

/**
 * Enhance a weapon item with weapon-specific data
 * @param {object} item - The Foundry item
 * @param {object} ddbItem - The D&D Beyond item
 */
function enhanceWeapon(item, ddbItem) {
  item.system.weaponType = mapWeaponType(ddbItem.weaponType || '');
  item.system.properties = mapWeaponProperties(ddbItem);
  
  // Add damage
  item.system.damage = {
    parts: [],
    versatile: ''
  };
  
  if (ddbItem.damage) {
    item.system.damage.parts.push([ddbItem.damage.diceString, mapDamageType(ddbItem.damage.type)]);
  }
  
  if (ddbItem.versatileDamage) {
    item.system.damage.versatile = ddbItem.versatileDamage.diceString;
  }
  
  // Add range
  item.system.range = {
    value: ddbItem.range || 5,
    long: ddbItem.longRange || null,
    units: 'ft'
  };
  
  // Add equipped status
  item.system.equipped = false;
  
  // Add proficiency
  item.system.proficient = true;
  
  // Add attunement
  item.system.attunement = ddbItem.attunementRequirements ? 1 : 0;
  
  // Add activation
  item.system.activation = {
    type: 'action',
    cost: 1,
    condition: ''
  };
}

/**
 * Enhance equipment with armor-specific data
 * @param {object} item - The Foundry item
 * @param {object} ddbItem - The D&D Beyond item
 */
function enhanceEquipment(item, ddbItem) {
  // Check if this is armor
  if (ddbItem.armorType) {
    item.system.armor = {
      type: mapArmorType(ddbItem.armorType),
      value: ddbItem.armorClass || 0,
      dex: getArmorDexBonus(ddbItem.armorType)
    };
    
    // Add strength requirement
    item.system.strength = ddbItem.strengthRequirement || 0;
    
    // Add stealth disadvantage
    item.system.stealth = ddbItem.stealthDisadvantage || false;
  }
  
  // Add equipped status
  item.system.equipped = false;
  
  // Add attunement
  item.system.attunement = ddbItem.attunementRequirements ? 1 : 0;
}

/**
 * Enhance a consumable with consumable-specific data
 * @param {object} item - The Foundry item
 * @param {object} ddbItem - The D&D Beyond item
 */
function enhanceConsumable(item, ddbItem) {
  // Set consumable type
  item.system.consumableType = mapConsumableType(ddbItem.type);
  
  // Add uses
  item.system.uses = {
    value: 1,
    max: 1,
    per: 'charges',
    autoDestroy: true
  };
  
  // Add activation
  item.system.activation = {
    type: mapConsumableActivationType(ddbItem.type),
    cost: 1,
    condition: ''
  };
  
  // Add duration
  item.system.duration = {
    value: null,
    units: ''
  };
  
  // Add target
  item.system.target = {
    value: null,
    width: null,
    units: '',
    type: ''
  };
  
  // Add range
  item.system.range = {
    value: null,
    long: null,
    units: ''
  };
}

/**
 * Enhance a tool with tool-specific data
 * @param {object} item - The Foundry item
 * @param {object} ddbItem - The D&D Beyond item
 */
function enhanceTool(item, ddbItem) {
  // Set tool type
  item.system.toolType = mapToolType(ddbItem.toolType || ddbItem.type);
  
  // Add proficiency
  item.system.proficient = false;
  
  // Add ability
  item.system.ability = 'int';
}

/**
 * Enhance loot with loot-specific data
 * @param {object} item - The Foundry item
 * @param {object} ddbItem - The D&D Beyond item
 */
function enhanceLoot(item, ddbItem) {
  // Nothing special needed for loot
}

/**
 * Enhance a container with container-specific data
 * @param {object} item - The Foundry item
 * @param {object} ddbItem - The D&D Beyond item
 */
function enhanceContainer(item, ddbItem) {
  // Add capacity
  item.system.capacity = {
    type: 'weight',
    value: ddbItem.carrying || 0,
    weightless: false
  };
}

/**
 * Map D&D Beyond weapon type to Foundry weapon type
 * @param {string} ddbType - The D&D Beyond weapon type
 * @returns {string} Foundry weapon type
 */
function mapWeaponType(ddbType) {
  const typeMap = {
    'Simple Melee Weapons': 'simpleM',
    'Simple Ranged Weapons': 'simpleR',
    'Martial Melee Weapons': 'martialM',
    'Martial Ranged Weapons': 'martialR',
    'Simple Melee': 'simpleM',
    'Simple Ranged': 'simpleR',
    'Martial Melee': 'martialM',
    'Martial Ranged': 'martialR'
  };
  
  return typeMap[ddbType] || 'simpleM';
}

/**
 * Map D&D Beyond weapon properties to Foundry weapon properties
 * @param {object} ddbItem - The D&D Beyond item
 * @returns {object} Foundry weapon properties
 */
function mapWeaponProperties(ddbItem) {
  const properties = {
    ada: false,
    amm: false,
    fin: false,
    fir: false,
    foc: false,
    hvy: false,
    lgt: false,
    lod: false,
    mgc: false,
    rch: false,
    rel: false,
    ret: false,
    sil: false,
    spc: false,
    thr: false,
    two: false,
    ver: false
  };
  
  // Parse properties from D&D Beyond item
  if (ddbItem.properties) {
    for (const property of ddbItem.properties) {
      switch (property) {
        case 'Ammunition': properties.amm = true; break;
        case 'Finesse': properties.fin = true; break;
        case 'Heavy': properties.hvy = true; break;
        case 'Light': properties.lgt = true; break;
        case 'Loading': properties.lod = true; break;
        case 'Reach': properties.rch = true; break;
        case 'Special': properties.spc = true; break;
        case 'Thrown': properties.thr = true; break;
        case 'Two-Handed': properties.two = true; break;
        case 'Versatile': properties.ver = true; break;
      }
    }
  }
  
  // Add magic property if magical
  if (ddbItem.magical) {
    properties.mgc = true;
  }
  
  // Add silvered property if silvered
  if (ddbItem.silvered) {
    properties.sil = true;
  }
  
  // Add adamantine property if adamantine
  if (ddbItem.adamantine) {
    properties.ada = true;
  }
  
  return properties;
}

/**
 * Map D&D Beyond damage type to Foundry damage type
 * @param {string} ddbType - The D&D Beyond damage type
 * @returns {string} Foundry damage type
 */
function mapDamageType(ddbType) {
  const typeMap = {
    'Acid': 'acid',
    'Bludgeoning': 'bludgeoning',
    'Cold': 'cold',
    'Fire': 'fire',
    'Force': 'force',
    'Lightning': 'lightning',
    'Necrotic': 'necrotic',
    'Piercing': 'piercing',
    'Poison': 'poison',
    'Psychic': 'psychic',
    'Radiant': 'radiant',
    'Slashing': 'slashing',
    'Thunder': 'thunder'
  };
  
  return typeMap[ddbType] || '';
}

/**
 * Map D&D Beyond armor type to Foundry armor type
 * @param {string} ddbType - The D&D Beyond armor type
 * @returns {string} Foundry armor type
 */
function mapArmorType(ddbType) {
  const typeMap = {
    'Light Armor': 'light',
    'Medium Armor': 'medium',
    'Heavy Armor': 'heavy',
    'Shield': 'shield',
    'Clothing': 'clothing'
  };
  
  return typeMap[ddbType] || 'light';
}

/**
 * Get the DEX bonus allowed for an armor type
 * @param {string} armorType - The armor type
 * @returns {number|null} The maximum DEX bonus allowed, or null for no limit
 */
function getArmorDexBonus(armorType) {
  switch (armorType) {
    case 'Light Armor': return null;
    case 'Medium Armor': return 2;
    case 'Heavy Armor': return 0;
    case 'Shield': return null;
    case 'Clothing': return null;
    default: return null;
  }
}

/**
 * Map D&D Beyond consumable type to Foundry consumable type
 * @param {string} ddbType - The D&D Beyond consumable type
 * @returns {string} Foundry consumable type
 */
function mapConsumableType(ddbType) {
  const typeMap = {
    'Potion': 'potion',
    'Poison': 'poison',
    'Scroll': 'scroll',
    'Wand': 'wand',
    'Rod': 'rod',
    'Trinket': 'trinket',
    'Ammunition': 'ammo',
    'Food': 'food'
  };
  
  return typeMap[ddbType] || 'other';
}

/**
 * Map D&D Beyond consumable type to Foundry activation type
 * @param {string} ddbType - The D&D Beyond consumable type
 * @returns {string} Foundry activation type
 */
function mapConsumableActivationType(ddbType) {
  const typeMap = {
    'Potion': 'action',
    'Poison': 'action',
    'Scroll': 'action',
    'Wand': 'action',
    'Rod': 'action',
    'Trinket': 'special',
    'Ammunition': 'special',
    'Food': 'minute'
  };
  
  return typeMap[ddbType] || 'special';
}

/**
 * Map D&D Beyond tool type to Foundry tool type
 * @param {string} ddbType - The D&D Beyond tool type
 * @returns {string} Foundry tool type
 */
function mapToolType(ddbType) {
  const typeMap = {
    'Artisan\'s Tools': 'artisan',
    'Gaming Set': 'game',
    'Musical Instrument': 'music',
    'Navigator\'s Tools': 'navigation',
    'Thieves\' Tools': 'thieves',
    'Herbalism Kit': 'herb',
    'Forgery Kit': 'forgery',
    'Disguise Kit': 'disguise',
    'Poisoner\'s Kit': 'poisoner'
  };
  
  return typeMap[ddbType] || '';
}

/**
 * Map D&D Beyond spell school to Foundry spell school
 * @param {string} ddbSchool - The D&D Beyond spell school
 * @returns {string} Foundry spell school
 */
function mapSpellSchool(ddbSchool) {
  const schoolMap = {
    'Abjuration': 'abj',
    'Conjuration': 'con',
    'Divination': 'div',
    'Enchantment': 'enc',
    'Evocation': 'evo',
    'Illusion': 'ill',
    'Necromancy': 'nec',
    'Transmutation': 'trs'
  };
  
  return schoolMap[ddbSchool] || 'abj';
}

/**
 * Map D&D Beyond casting time to Foundry activation type
 * @param {string} ddbCastingTime - The D&D Beyond casting time
 * @returns {string} Foundry activation type
 */
function mapCastingTime(ddbCastingTime) {
  if (ddbCastingTime.includes('Action')) return 'action';
  if (ddbCastingTime.includes('Bonus Action')) return 'bonus';
  if (ddbCastingTime.includes('Reaction')) return 'reaction';
  if (ddbCastingTime.includes('Minute')) return 'minute';
  if (ddbCastingTime.includes('Hour')) return 'hour';
  if (ddbCastingTime.includes('Day')) return 'day';
  
  return 'special';
}

/**
 * Get the casting time cost
 * @param {string} ddbCastingTime - The D&D Beyond casting time
 * @returns {number} The casting time cost
 */
function getCastingTimeCost(ddbCastingTime) {
  const match = ddbCastingTime.match(/^(\d+)/);
  return match ? parseInt(match[1]) : 1;
}

/**
 * Get the duration value
 * @param {string} ddbDuration - The D&D Beyond duration
 * @returns {number|null} The duration value
 */
function getDurationValue(ddbDuration) {
  const match = ddbDuration.match(/^(\d+)/);
  return match ? parseInt(match[1]) : null;
}

/**
 * Get the duration units
 * @param {string} ddbDuration - The D&D Beyond duration
 * @returns {string} The duration units
 */
function getDurationUnits(ddbDuration) {
  if (ddbDuration.includes('Instantaneous')) return 'inst';
  if (ddbDuration.includes('Round')) return 'round';
  if (ddbDuration.includes('Minute')) return 'minute';
  if (ddbDuration.includes('Hour')) return 'hour';
  if (ddbDuration.includes('Day')) return 'day';
  if (ddbDuration.includes('Month')) return 'month';
  if (ddbDuration.includes('Year')) return 'year';
  if (ddbDuration.includes('Permanent')) return 'perm';
  
  return 'special';
}

/**
 * Map target type from description
 * @param {string} targetDesc - The target description
 * @returns {string} The target type
 */
function mapTargetType(targetDesc) {
  if (!targetDesc) return '';
  
  if (targetDesc.includes('creature')) return 'creature';
  if (targetDesc.includes('object')) return 'object';
  if (targetDesc.includes('space')) return 'space';
  if (targetDesc.includes('radius') || targetDesc.includes('sphere')) return 'sphere';
  if (targetDesc.includes('cylinder')) return 'cylinder';
  if (targetDesc.includes('cone')) return 'cone';
  if (targetDesc.includes('cube')) return 'cube';
  if (targetDesc.includes('line')) return 'line';
  if (targetDesc.includes('wall')) return 'wall';
  
  return '';
}

/**
 * Get the range value
 * @param {string} ddbRange - The D&D Beyond range
 * @returns {number|null} The range value
 */
function getRangeValue(ddbRange) {
  if (ddbRange.includes('Self')) return null;
  if (ddbRange.includes('Touch')) return null;
  
  const match = ddbRange.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

/**
 * Get the range units
 * @param {string} ddbRange - The D&D Beyond range
 * @returns {string} The range units
 */
function getRangeUnits(ddbRange) {
  if (ddbRange.includes('Self')) return 'self';
  if (ddbRange.includes('Touch')) return 'touch';
  if (ddbRange.includes('feet') || ddbRange.includes('ft')) return 'ft';
  if (ddbRange.includes('mile')) return 'mi';
  
  return 'ft';
}

/**
 * Map saving throw ability
 * @param {string} ddbAbility - The D&D Beyond ability
 * @returns {string} The Foundry ability
 */
function mapSavingThrow(ddbAbility) {
  const abilityMap = {
    'Strength': 'str',
    'Dexterity': 'dex',
    'Constitution': 'con',
    'Intelligence': 'int',
    'Wisdom': 'wis',
    'Charisma': 'cha'
  };
  
  return abilityMap[ddbAbility] || '';
}

/**
 * Get the scaling formula for higher level casting
 * @param {object} ddbSpell - The D&D Beyond spell
 * @returns {string} The scaling formula
 */
function getScalingFormula(ddbSpell) {
  // This would need to parse the atHigherLevels text to extract formula
  // For now, return an empty string
  return '';
}

/**
 * Check if a spell needs a template
 * @param {object} ddbSpell - The D&D Beyond spell
 * @returns {boolean} Whether the spell needs a template
 */
function needsTemplate(ddbSpell) {
  if (!ddbSpell.targetDescription) return false;
  
  return ddbSpell.targetDescription.includes('radius') ||
    ddbSpell.targetDescription.includes('sphere') ||
    ddbSpell.targetDescription.includes('cylinder') ||
    ddbSpell.targetDescription.includes('cone') ||
    ddbSpell.targetDescription.includes('cube') ||
    ddbSpell.targetDescription.includes('line') ||
    ddbSpell.targetDescription.includes('wall');
}

/**
 * Get the template type for a spell
 * @param {object} ddbSpell - The D&D Beyond spell
 * @returns {string} The template type
 */
function getTemplateType(ddbSpell) {
  if (!ddbSpell.targetDescription) return '';
  
  if (ddbSpell.targetDescription.includes('radius') || ddbSpell.targetDescription.includes('sphere')) return 'circle';
  if (ddbSpell.targetDescription.includes('cylinder')) return 'cylinder';
  if (ddbSpell.targetDescription.includes('cone')) return 'cone';
  if (ddbSpell.targetDescription.includes('cube')) return 'rect';
  if (ddbSpell.targetDescription.includes('line')) return 'ray';
  if (ddbSpell.targetDescription.includes('wall')) return 'wall';
  
  return '';
}

/**
 * Get the template size for a spell
 * @param {object} ddbSpell - The D&D Beyond spell
 * @returns {number} The template size in feet
 */
function getTemplateSize(ddbSpell) {
  if (!ddbSpell.targetDescription) return 0;
  
  const match = ddbSpell.targetDescription.match(/(\d+)(-| )foot/);
  return match ? parseInt(match[1]) : 0;
}
