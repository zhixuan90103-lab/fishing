/**
 * The landing net's path, and the fish dropping into it.
 *
 * Owns: where the net's hoop is over time, the moment the fish comes off the hook, its
 * fall into the bag, how the net gives under it, and carrying it away.
 * Does not own: the net's model (src/shore/net.js), how a fish thrashes (src/fish/flock.js),
 * the lure or the line, when the net is called for, or what its leaving means (catch.js).
 * No Three, no scene: it runs in Node. Design: docs/NET.md.
 *
 * The net comes in under the hanging fish and waits. The fish comes off the hook and
 * falls, tail first, into the bag. The net dips under the weight and springs back, the
 * bag is pulled longer and rocks. The net is lifted a little to show it, and after a
 * moment carries it out.
 *
 * Every leg of the path is a place written as a function of time, eased at both ends.
 * While the fish still hangs on the line the legs are measured from where its mouth is
 * that frame, so the net follows a swinging fish. The fall is exact for the frame, and
 * the dip runs on a fixed small step, so neither depends on the frame rate.
 *
 * Units: metres, seconds. The hoop lies level, opening upward.
 */

const GRAVITY = 9.81;

// The net waits and leaves this far to the side of the fish, level metres, and this far
// below its mouth. Far enough to be out of the picture.
const OFF_SIDE = 1.7;
const OFF_BELOW = 1.1;
// It comes to rest with the hoop this far under the fish's mouth: just below the tail.
const UNDER = 0.56;
// In the bag, the fish's mouth lies this far below the hoop.
const REST_BELOW = 0.13;
// How long the net takes to come in, how long it waits under the fish before the fish
// drops, how long the fish is shown in the net once it has landed, and how long the net
// takes to leave.
const IN_FOR = 0.75;
const WAIT_FOR = 0.18;
const CATCH_FOR = 1.1;
const OUT_FOR = 0.85;
// With the fish in it, the net is lifted this much, m, over this long, s: brought up to
// be looked at, and clear of the bottom of the picture.
const RAISE = 0.34;
const RAISE_FOR = 0.6;
// Falling, the fish drifts to the middle of the hoop this fast, 1/s.
const CENTRE_RATE = 9;

// The net gives under the fish: this share of the speed it lands at goes into the hoop,
// which then springs back at this rate, rad/s, with this damping. 1 would not bounce.
const DIP_SHARE = 0.3;
const DIP_RATE = 15;
const DIP_DAMPING = 0.3;
const DIP_DT = 1 / 240;
// The bag is pulled this much longer by the weight, as a share of its depth, and by this
// much more for every metre the hoop is dipped.
const BAG_STRETCH = 0.1;
const BAG_PER_DIP = 1.6;
// How fast that stretch comes on, 1/s.
const STRETCH_RATE = 14;
// The bag rocks as the fish lands and thrashes: this far each way at first, radians, this
// fast, rad/s, dying away at this rate, 1/s, down to this share that stays while it thrashes.
const ROCK = 0.2;
const ROCK_BEAT = 10;
const ROCK_FADE = 2.2;
const ROCK_STAYS = 0.3;

function smooth(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
}

export function createScoop() {
  let t = 0;
  // Where it comes from and goes back to, as a level direction from the fish.
  let sideX = 1;
  let sideZ = 0;
  // The hoop without the dip.
  let pathX = 0, pathY = 0, pathZ = 0;
  // The fish falling: how fast, and where it is relative to the middle of the hoop.
  let fallSpeed = 0;
  let offX = 0, offZ = 0;
  // When it landed, on the path's clock, and how high the path was then. The dip and how
  // fast it is moving.
  let landedAt = -1;
  let landedY = 0;
  let dip = 0;
  let dipSpeed = 0;
  // Where the hoop was when it set off out, and when.
  let leftX = 0, leftY = 0, leftZ = 0;
  let leftAt = -1;

  const scoop = {
    // The middle of the hoop, world space.
    x: 0, y: 0, z: 0,
    // 'away': not in use. 'in', 'wait', 'fall', 'catch', 'out': the legs.
    phase: 'away',
    // The fish is off the hook: from here it is where fishX, fishY, fishZ say.
    dropped: false,
    // Its mouth, world space, once dropped.
    fishX: 0, fishY: 0, fishZ: 0,
    // True on the one frame it lands in the bag, and how fast it was falling, m/s.
    landing: false,
    landedSpeed: 0,
    // It is lying in the bag.
    get caught() {
      return landedAt >= 0;
    },
    // The bag: how long it is pulled, 1 at rest, and how far it rocks, radians.
    stretch: 1,
    rock: 0,
    // The level direction the handle runs, away from the hoop.
    get handleX() {
      return sideX;
    },
    get handleZ() {
      return sideZ;
    },

    // Call the net in. (fx, fy, fz): the fish's mouth. (sx, sz): the level direction, a
    // unit vector, off to the side it comes from.
    begin(fx, fy, fz, sx, sz) {
      t = 0;
      sideX = sx;
      sideZ = sz;
      scoop.phase = 'in';
      scoop.dropped = false;
      scoop.landing = false;
      scoop.stretch = 1;
      scoop.rock = 0;
      landedAt = -1;
      leftAt = -1;
      dip = 0;
      dipSpeed = 0;
      fallSpeed = 0;
      scoop.x = pathX = fx + sx * OFF_SIDE;
      scoop.y = pathY = fy - OFF_BELOW;
      scoop.z = pathZ = fz + sz * OFF_SIDE;
    },

    // Put it away without finishing.
    stop() {
      scoop.phase = 'away';
      scoop.dropped = false;
    },

    // Once a frame while in use, with the mouth of the fish on the line: only read until
    // the fish drops. Returns true on the frame the net has gone.
    step(dt, fx, fy, fz) {
      if (scoop.phase === 'away' || !(dt > 0)) return false;
      t += dt;
      scoop.landing = false;
      if (!scoop.dropped) {
        // Under the fish, following it.
        const k = smooth(t / IN_FOR);
        scoop.phase = t < IN_FOR ? 'in' : 'wait';
        pathX = fx + sideX * OFF_SIDE * (1 - k);
        pathY = fy - OFF_BELOW + (OFF_BELOW - UNDER) * k;
        pathZ = fz + sideZ * OFF_SIDE * (1 - k);
        if (t >= IN_FOR + WAIT_FOR) {
          // Off the hook. The net stays where it is now.
          scoop.dropped = true;
          scoop.phase = 'fall';
          scoop.fishX = fx; scoop.fishY = fy; scoop.fishZ = fz;
          offX = fx - pathX;
          offZ = fz - pathZ;
          fallSpeed = 0;
        }
      } else if (landedAt < 0) {
        // Falling into the bag, drifting to its middle.
        const rest = pathY - REST_BELOW;
        const keep = Math.exp(-CENTRE_RATE * dt);
        offX *= keep;
        offZ *= keep;
        const drop = fallSpeed * dt + 0.5 * GRAVITY * dt * dt;
        if (scoop.fishY - drop <= rest) {
          // Lands inside this frame, at the speed it has reached by then.
          scoop.landedSpeed = Math.sqrt(fallSpeed * fallSpeed + 2 * GRAVITY * Math.max(0, scoop.fishY - rest));
          landedAt = t;
          landedY = pathY;
          scoop.landing = true;
          scoop.phase = 'catch';
          dipSpeed = -scoop.landedSpeed * DIP_SHARE;
        } else {
          scoop.fishY -= drop;
          fallSpeed += GRAVITY * dt;
        }
      }
      if (landedAt >= 0) {
        // The hoop gives and springs back.
        let done = 0;
        while (done < dt - 1e-9) {
          const h = Math.min(DIP_DT, dt - done);
          done += h;
          dipSpeed += (-DIP_RATE * DIP_RATE * dip - 2 * DIP_DAMPING * DIP_RATE * dipSpeed) * h;
          dip += dipSpeed * h;
        }
        const since = t - landedAt;
        scoop.stretch = 1 + BAG_STRETCH * (1 - Math.exp(-STRETCH_RATE * since)) + BAG_PER_DIP * Math.max(0, -dip);
        scoop.rock = Math.sin(since * ROCK_BEAT) * ROCK * (ROCK_STAYS + (1 - ROCK_STAYS) * Math.exp(-ROCK_FADE * since));
        if (leftAt < 0) pathY = landedY + RAISE * smooth(since / RAISE_FOR);
        if (since >= CATCH_FOR) {
          if (leftAt < 0) {
            leftAt = t;
            leftX = pathX; leftY = pathY; leftZ = pathZ;
          }
          const k = smooth((t - leftAt) / OUT_FOR);
          scoop.phase = 'out';
          pathX = leftX + sideX * OFF_SIDE * k;
          pathY = leftY - OFF_BELOW * k;
          pathZ = leftZ + sideZ * OFF_SIDE * k;
          if (t - leftAt >= OUT_FOR) {
            scoop.phase = 'away';
            scoop.dropped = false;
            return true;
          }
        }
      }
      scoop.x = pathX;
      scoop.y = pathY + dip;
      scoop.z = pathZ;
      if (scoop.dropped) {
        scoop.fishX = pathX + offX;
        scoop.fishZ = pathZ + offZ;
        // In the bag it rides the hoop, lower the more the bag is pulled.
        if (landedAt >= 0) scoop.fishY = scoop.y - REST_BELOW * scoop.stretch - (scoop.stretch - 1) * 0.3;
      }
      return false;
    },
  };
  return scoop;
}
