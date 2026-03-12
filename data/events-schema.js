/**
 * Normalized event schema for the Hormuz Crisis Intelligence Platform.
 * All data adapters output events conforming to this schema.
 */

/**
 * @typedef {'ship_position' | 'incident' | 'infrastructure_damage' | 'military_sighting' | 'vessel_attack' | 'mine_report' | 'transit_count' | 'oil_spill' | 'news' | 'port_status'} EventType
 *
 * @typedef {'verified' | 'high' | 'medium' | 'low' | 'unverified'} Confidence
 *
 * @typedef {'aisstream' | 'marinetraffic_har' | 'liveuamap' | 'reddit' | 'fleetleaks' | 'news_rss' | 'manual' | 'satellite' | 'twitter'} SourceType
 *
 * @typedef {Object} DataEvent
 * @property {string} id - Unique event ID (source:type:hash)
 * @property {EventType} type
 * @property {number} lat
 * @property {number} lon
 * @property {number} timestamp - Unix ms
 * @property {SourceType} source
 * @property {Confidence} confidence
 * @property {string} [title] - Short description
 * @property {string} [description] - Detailed description
 * @property {string} [url] - Source URL
 * @property {string} [icon] - Map icon identifier
 * @property {Object} [data] - Source-specific payload
 */

/**
 * Incident severity levels
 */
export const SEVERITY = {
  CRITICAL: 5,   // Major infrastructure destroyed, port inoperable
  HIGH: 4,       // Significant damage, ship sunk/on fire
  MEDIUM: 3,     // Moderate damage, ship disabled
  LOW: 2,        // Minor incident, warning shot
  INFO: 1        // Report, sighting, intelligence
};

/**
 * Infrastructure status
 */
export const INFRA_STATUS = {
  OPERATIONAL: 'operational',
  DEGRADED: 'degraded',       // Partially damaged, reduced capacity
  DAMAGED: 'damaged',          // Significantly damaged
  DESTROYED: 'destroyed',      // Inoperable
  UNKNOWN: 'unknown'
};

/**
 * Port status tracking
 */
export const PORT_STATUS = {
  OPEN: 'open',
  RESTRICTED: 'restricted',    // Limited operations
  CLOSED: 'closed',            // No operations
  BLOCKADED: 'blockaded',      // Military blockade
  UNKNOWN: 'unknown'
};
