/**
 * The states a fish can be in. Who decides its aim depends on this and nothing else.
 */

// In the water, its own master (behaviors.js).
export const FREE = 'free';
// In the water, taken by someone outside: their brain writes its aim.
export const HELD = 'held';
// Out of the water on someone's line. It does not swim (hung.js).
export const HUNG = 'hung';
// Not in the water at all: a spare fish nobody has brought in, or one sent away again.
// It is not swum, not drawn, and no other fish can tell it is there.
export const AWAY = 'away';
