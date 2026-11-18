/**
 * A hooked fish: how hard it pulls right now, and where that sends it.
 *
 * Owns: the fish's runs and rests, its stamina, the force of each run, and the aim of a
 * fish on a line.
 * Does not own: the line, its length or its tension (line.js, lineOut.js), how fast line
 * comes in or when it runs out (haul.js), how a fish swims (src/fish/swim.js), when the
 * fish is hooked or landed (fishing.js).
 *
 * A fresh fish pulls harder than the reel holds, so its runs take line. Running tires
 * it, and so does being wound in. Left alone it gets its strength back. Tired enough, its
 * runs no longer take line and it can be brought in.
 *
 * The two halves must look different on the fish itself, before any haptics. A run is a
 * bolt for its life: it comes on at once, fast, darting from side to side and diving. A
 * rest is a sulk: it all but stops, hanging on the line near the top, and only comes in
 * because the line leads it. Now and then a rest is cut short and it bolts again.
 * No Three, no scene: it runs in Node. Rule: docs/FISHING-REQUIREMENTS.md sections 10, 11.
 * Design: docs/PLAY.md section 8.
 *
 * The fish is never moved by the line. It is told how far the line is stretched, and
 * swims to where the stretch would hold it: the distance at which the line pulls as hard
 * as it does. Further out than that it turns and comes in, nearer it heads away, and
 * there it swims across, round the rod on a tight line. So the line stays tight between
 * runs, and winding it in leads the fish in head first.
 *
 * It chases that place, it is not pushed by the difference in force. A short line is
 * stiff, and a fish answering the force itself overshoots and is snatched back, harder
 * the shorter the line. Chasing a place settles the same however stiff the line is.
 *
 * Units: metres, seconds, newtons. Level directions are (x, z).
 */

// How hard the fish pulls in a run, fresh and worn out, N. The first is above the point
// where line runs out (haul.js), the second below it.
export const RUN_FRESH = 9.5;
export const RUN_SPENT = 2.4;
// And between runs, N. This keeps the line tight after a run has stopped.
export const REST_FORCE = 1;
// Stamina runs from 1, fresh, to 0. What a second of running costs, what a metre of
// being wound in costs, and what a second left alone gives back.
const TIRE_RUNNING = 0.12;
const TIRE_PER_METRE = 0.03;
const RECOVER = 0.03;
// A run keeps most of its force until the fish is nearly spent, then it goes quickly:
// the force follows stamina to this power. 1 would fade evenly.
const RUN_FADE = 0.6;
// How fast the pull comes on at the start of a run and dies at the end, 1/s. On is a
// snatch: the rod goes into its deep bend at once.
const FORCE_ON = 14;
const FORCE_OFF = 3;
// A fresh run lasts between these, s. A spent one this share of that.
const RUN_FOR = [1.6, 3.2];
const RUN_SPENT_SHARE = 0.55;
// A rest lasts between these, s. Now and then, this often, it is cut short to between the
// second pair and the fish bolts again when it seemed done.
const REST_FOR = [1.8, 4.5];
const REST_SHORT = [0.35, 0.8];
const SHORT_CHANCE = 0.25;
// In a run that is taking line it darts: it changes side this often, s.
const DART_EVERY = [0.4, 0.9];

// The pull it takes to move the fish through the water, N per m/s. Line runs out at what
// its pull has over the reel's hold, divided by this. Winding it in, or swinging the rod
// away from it, costs this much tension per m/s.
const BODY_DRAG = 1.5;
// How soon it is where the line holds it, s. Lower follows the line more tightly and
// overshoots more at low frame rates. Higher, it gives way later to a rod swung against it.
const SETTLE_IN = 0.4;
// It may go this much faster than the line's hold lets its pull carry it, m/s.
const SLACK_SPEED = 0.3;
// The fastest the line can lead it in, m/s.
const LED_MAX = 1.6;
// How fast it swims across the line while running and while resting, m/s. Resting it
// barely moves.
const ACROSS_RUN = 1.2;
const ACROSS_REST = 0.07;
// Turning back the way it came, it slows to this share of its speed, and leans its turn
// toward the rod by this much, m/s. A fish cannot stop and reverse: it swings round, and
// swinging round on the far side would yank the line.
const TURNING = 0.2;
const TURN_INSIDE = 0.3;
// It stays within this angle of the cast's direction, radians, seen from the rod tip.
// Past it, it swims back across. This keeps it in the water in front of the angler.
const KEEP_WITHIN = 35 * Math.PI / 180;

// Depth it swims at in a run and at rest, and the shallowest it goes, m.
const RUN_DEPTH = -1.7;
const REST_DEPTH = -0.5;
const SHALLOWEST = -0.25;
// It only dives in a run when further than DIVE_FAR from under the tip, level metres, and
// not at all inside DIVE_NEAR. Close in the line runs steeply down to it, and a dive
// there is a straight pull on a short, stiff line.
const DIVE_NEAR = 3;
const DIVE_FAR = 9;
// How sharply it turns and speeds up, in a run and at rest, 1/s.
const TURN_RUN = 7;
const TURN_REST = 3.5;
const ACCEL_RUN = 14;
const ACCEL_REST = 5;
// How fast the line stops it, and how fast it changes depth diving and coming back up, 1/s.
const SLOW = 8;
const RISE_RUN = 2.2;
const RISE_REST = 0.9;

export function createFight(random = Math.random) {
  let running = false;
  let left = 0;
  // Which way it swims across the line: 1 or -1. And seconds until it darts the other way.
  let side = 1;
  let dartIn = 0;
  // Whether the run in hand was taking line when last steered.
  let taking = false;

  const between = (range) => range[0] + random() * (range[1] - range[0]);

  function beginRun() {
    running = true;
    left = between(RUN_FOR) * (RUN_SPENT_SHARE + (1 - RUN_SPENT_SHARE) * fight.stamina);
    side = random() < 0.5 ? -1 : 1;
    dartIn = between(DART_EVERY);
  }

  const fight = {
    // How hard the fish is pulling right now, N.
    force: 0,
    // 1 fresh, 0 worn out.
    stamina: 1,
    // Whether it is in a run.
    get running() {
      return running;
    },

    // Just hooked: it runs at once.
    begin() {
      fight.force = REST_FORCE;
      fight.stamina = 1;
      beginRun();
    },

    // Once a frame: the runs and rests, stamina, and the pull following them.
    // wound: metres of line wound in this frame.
    step(dt, wound) {
      if (!(dt > 0)) return;
      if (running) fight.stamina -= TIRE_RUNNING * dt;
      else if (wound > 0) fight.stamina -= TIRE_PER_METRE * wound;
      else fight.stamina += RECOVER * dt;
      fight.stamina = Math.min(1, Math.max(0, fight.stamina));
      left -= dt;
      if (left <= 0) {
        if (running) {
          running = false;
          left = between(random() < SHORT_CHANCE ? REST_SHORT : REST_FOR);
        } else {
          beginRun();
        }
      }
      // Darting needs room ahead: only while it is taking line. On a held line a change
      // of side is a full turn about, and that is a tired fish, not a bolting one.
      if (running && taking) {
        dartIn -= dt;
        if (dartIn <= 0) {
          side = -side;
          dartIn = between(DART_EVERY);
        }
      }
      const to = running ? RUN_SPENT + (RUN_FRESH - RUN_SPENT) * fight.stamina ** RUN_FADE : REST_FORCE;
      const rate = to > fight.force ? FORCE_ON : FORCE_OFF;
      fight.force += (to - fight.force) * (1 - Math.exp(-rate * dt));
    },

    /**
     * Write the aim of the hooked fish.
     * fish: x, z, yaw. tip: the rod tip, x, z.
     * stretch: how much further the hook is from the tip than there is line, m. Below
     * zero the line is loose by that much. stiffness: the line's, N per metre stretched.
     * winding: how fast line is coming in, m/s. holds: the most tension the reel holds
     * before it gives line, N.
     * (homeX, homeZ): the level direction the cast went, a unit vector.
     */
    steer(fish, aim, tip, stretch, stiffness, winding, holds, homeX, homeZ) {
      let ox = fish.x - tip.x;
      let oz = fish.z - tip.z;
      const far = Math.hypot(ox, oz);
      if (far > 1e-6) {
        ox /= far;
        oz /= far;
      } else {
        ox = homeX;
        oz = homeZ;
      }
      // Too far round to one side: swim back across.
      const off = Math.atan2(homeX * oz - homeZ * ox, homeX * ox + homeZ * oz);
      if (off > KEEP_WITHIN) side = -1;
      else if (off < -KEEP_WITHIN) side = 1;
      // The stretch that holds it: its own pull, plus what it takes to drag it in as fast
      // as the line is coming. It swims to there, and comes in with the line meanwhile.
      const held = (fight.force + BODY_DRAG * winding) / stiffness;
      // It cannot outrun what its pull has over the line's.
      const spare = Math.max(0, fight.force - stiffness * Math.max(0, stretch));
      // Pulling harder than the reel holds, there is no such place: it takes line, as
      // fast as what its pull has over the reel's hold can drive it through the water.
      const bolt = Math.max(0, fight.force - holds) / BODY_DRAG;
      taking = bolt > ACROSS_RUN;
      const settling = (held - stretch) / SETTLE_IN - winding;
      let away = Math.max(-LED_MAX, Math.min(spare / BODY_DRAG + SLACK_SPEED, bolt > 0 ? Math.max(bolt, settling) : settling));
      const across = (running ? ACROSS_RUN : ACROSS_REST) * side;
      const nx = Math.sin(fish.yaw);
      const nz = Math.cos(fish.yaw);
      // More than a quarter turn to make: it goes round on the rod's side.
      if ((ox * away - oz * across) * nx + (oz * away + ox * across) * nz < 0) away -= TURN_INSIDE;
      const vx = ox * away - oz * across;
      const vz = oz * away + ox * across;
      const speed = Math.hypot(vx, vz);
      const facing = speed > 1e-6 ? Math.max(0, (vx * nx + vz * nz) / speed) : 1;
      aim.yaw = Math.atan2(vx, vz);
      aim.speed = speed * (TURNING + (1 - TURNING) * facing);
      const dive = Math.min(1, Math.max(0, (far - DIVE_NEAR) / (DIVE_FAR - DIVE_NEAR)));
      aim.y = running ? REST_DEPTH + (RUN_DEPTH - REST_DEPTH) * dive * dive * (3 - 2 * dive) : REST_DEPTH;
      aim.top = SHALLOWEST;
      aim.turn = running ? TURN_RUN : TURN_REST;
      aim.accel = running ? ACCEL_RUN : ACCEL_REST;
      aim.slow = SLOW;
      aim.rise = running ? RISE_RUN : RISE_REST;
    },
  };
  return fight;
}
