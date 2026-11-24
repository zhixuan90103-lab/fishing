/**
 * How far the hand on the rod falls behind the phone when a line is pulling.
 *
 * Owns: what the hand owes. The phone's aim is where the hand is trying to take the rod.
 * Against a pulling line the hand cannot keep up: of every turn that carries the rod away
 * from the pull it makes only a share, and owes the rest.
 * Does not own: the aim itself (aim.js, which takes what is owed off the rod's share and
 * part of it off the view's), how hard the line pulls or from where (handed in), the look
 * of a working hand (rodHand.js), or any fishing rule.
 * No Three, no scene: it runs in Node. Design: docs/CHAIN.md section 7.
 *
 *   no pull                     1 to 1.
 *   turning with the pull       1 to 1: giving way costs nothing.
 *   turning against the pull    less than 1 to 1, less the harder the pull.
 *   holding still under a pull  what is owed is slowly made up, slower the harder the pull.
 *   the pull easing             what is owed goes with it, as fast as the pull goes: a fish
 *                               that turns and comes, or a line that parts, and the rod
 *                               sweeps across to where the phone points.
 * The rod is never carried past where the phone points, and a hand that is not moving is
 * not dragged anywhere: this is a debt run up by the hand's own turning, nothing else.
 * Nothing here goes by a clock but the slow making-up, and that goes by the pull.
 *
 * Degrees and newtons. Yaw is positive to the left, pitch positive upward.
 */

// The pull at which the hand is as hard pressed as it gets, N. The same number the hand's
// effort is measured against (src/play/strain.js).
const FULL_AT = 54;
// How much harder the pull is than the hand at that: against a pull of FULL_AT the hand
// makes 1 part in (1 + this) of a turn away from it, at half of FULL_AT about 6 in 10
// Higher and a fish holds the rod harder.
const HEAVY = 2.2;
// How fast what is owed is made up while the pull holds, 1/s, for a pull that is a match
// for the hand. A harder pull, slower in proportion.
const MAKES_UP = 0.45;
// The most the hand can owe, degrees. It eases into this.
const OWES_MOST = 30;
// How fast the pull the hand goes by follows the line's, 1/s. The line's pull drops out
// for a frame or two when a rod kicks back, and the hand does not let go for that.
const FEELS = 14;
// A rod within this of pointing along the pull, degrees, has no side to be turned away to.
const ALONG = 2;

export function createHandLag() {
  // The pull as the hand feels it, as a share of FULL_AT.
  let felt = 0;
  const lag = {
    // What the hand owes, degrees: the rod points this far short of the phone's aim.
    yaw: 0,
    pitch: 0,

    reset() {
      felt = 0;
      lag.yaw = 0;
      lag.pitch = 0;
    },

    /**
     * Once a frame. turnYaw, turnPitch: how far the phone's aim has turned this frame.
     * aimYaw, aimPitch: where it points now. pull: how hard the line pulls, N. pullYaw,
     * pullPitch: the direction the pull comes from, seen from the angler. With no pull
     * the last two are not read.
     */
    step(dt, turnYaw, turnPitch, aimYaw, aimPitch, pull, pullYaw, pullPitch) {
      const before = felt;
      const now = Math.min(1, Math.max(0, pull) / FULL_AT);
      felt += (now - felt) * (1 - Math.exp(-FEELS * dt));
      if (felt < 1e-4) felt = 0;
      // The pull easing takes what is owed with it, in the same proportion.
      if (felt < before) {
        const keep = before > 0 ? felt / before : 0;
        lag.yaw *= keep;
        lag.pitch *= keep;
      }
      if (!(felt > 0)) {
        lag.yaw = 0;
        lag.pitch = 0;
        return;
      }
      const hold = felt * HEAVY;
      // Held still, the hand slowly wins what it owes back.
      const made = Math.exp(-(MAKES_UP / hold) * dt);
      lag.yaw *= made;
      lag.pitch *= made;
      // Which way is away from the pull, from where the rod points now.
      let offYaw = pullYaw - (aimYaw - lag.yaw);
      offYaw -= 360 * Math.round(offYaw / 360);
      const offPitch = pullPitch - (aimPitch - lag.pitch);
      const off = Math.hypot(offYaw, offPitch);
      if (off < 1e-6) return;
      // Only the part of the turn that carries the rod away from the pull is heavy.
      const against = -(turnYaw * offYaw + turnPitch * offPitch) / off;
      if (!(against > 0)) return;
      // It cannot owe without end: the nearer the most it can owe, the less it adds.
      const room = Math.max(0, 1 - (Math.hypot(lag.yaw, lag.pitch) / OWES_MOST) ** 2);
      const short = against * (hold / (1 + hold)) * Math.min(1, off / ALONG) * room;
      // What was run up during the frame has been making itself up for half of it.
      const fresh = short * Math.sqrt(made);
      lag.yaw -= (offYaw / off) * fresh;
      lag.pitch -= (offPitch / off) * fresh;
    },
  };
  return lag;
}
