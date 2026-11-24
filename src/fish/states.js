/**
 * The states a fish can be in. Who decides its aim depends on this and nothing else.
 */

// In the water, its own master (behaviors.js).
export const FREE = 'free';
// In the water, taken by someone outside: their brain writes its aim.
export const HELD = 'held';
// Out of the water on someone's line. It does not swim (hung.js).
export const HUNG = 'hung';
