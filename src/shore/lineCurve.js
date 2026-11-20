/**
 * The shape of the line between the rod tip and its far end. No Three and no scene, so it
 * runs in Node.
 *
 * Owns: where the points of the line are. They are simulated: a string of points, each
 * with its own place and speed, falling through the air, slowed and all but floating in
 * the water, and kept a fixed distance from its neighbours. So the shape has a past.
 * Does not own: drawing (line.js), where the ends are, how much line is out, or how hard
 * the line pulls. The pull is not simulated. It comes from the length and the two ends
 * alone (line.js, rodFlex.js), and nothing here feeds back into it: this is only what the
 * line looks like.
 *
 * Nothing here is told whether the line is loose or tight, and nothing goes by a clock.
 * The line is as tight as what has happened to it has left it:
 *   flying     the lure carries it out. It is all but straight, bellied a little by the air.
 *   landing    the lure stops dead and the line does not: a little more of it has come
 *              off than the straight way needs. That is all the slack there is, and the
 *              harder the lure hit, the more.
 *   sinking    nothing pulls on the line as a whole, so the slack stays. The lure draws
 *              the wet line after it, and that small pull spreads the bend by the lure
 *              back along the line: no corner at the surface, no drop from it.
 *   pulling    a fish, or the reel. A line under pull straightens itself: every bend in
 *              it is drawn flatter, the faster the harder the pull, against what it has
 *              to move through, the water more than the air. Coming tight is therefore
 *              always a passage from loose to straight, quick under a hard pull and slow
 *              under a light one. The slack is used up as the line comes straight, not
 *              by any count of time. And a line that pulls sags only by its own weight.
 * It does not know a fish from a lure: only where the far end is and how hard the line pulls.
 *
 * The line is nylon: it all but floats. The water does not hold it up and does not stop
 * it. It only slows it.
 *
 * Units: metres, seconds, newtons. World +Y is up, the water is at y = 0.
 */

// The step the points are moved by, s. A frame is cut into steps of about this.
const STEP = 1 / 240;
// Times the spacing of the points is put right in each step. More holds the string's
// length more exactly when its ends move fast.
const PASSES = 80;
const GRAVITY = 9.8;
// In the air a line this thin falls no faster than this, m/s.
const AIR_FALL = 3;
// In the water it sinks at this, m/s: nylon, which all but floats. Zero would float it,
// as braid does. Several times this is fluorocarbon.
const SINK = 0.015;
// How fast the water takes the speed off it, 1/s. Higher and a line falling onto the
// water goes less far under before it is stopped: at this, a hand's breadth.
const WATER_DRAG = 60;
// A point in the water is this many times harder for the string to move than one in the
// air. When the string shortens, what is in the air gives first and the belly in the
// water is drawn out last.
const WET_HOLDS = 6;
// The lure stopping on the water leaves this much line over for each m/s it was doing, m.
// A full cast lands at about 14 m/s. Larger and a landed line lies looser.
const OVERRUN = 0.0015;
// What holds a line back as a pull straightens it, N for each m/s for each metre of
// line: the water it is dragged through, and its own inertia in the air, taken as one.
// A pull flattens a bend at a rate that goes as the pull over this, and over the square
// of the bend's length. Ten metres of line pulled at 4.5 N are down to a third in about a
// thirtieth of a second, at 0.5 N in a third of one: a few frames at the least, never
// one. Lower and a line comes tight sooner under the same pull. Higher, and a fish
// running across bows the line more: at this, a few centimetres.
const LINE_DRAG = 0.015;
// A line that is pulling does not drop through the air as a loose one does: the pull
// holds it up, and it sags only by its own small weight. This is how fast it would fall
// against what the pull has to drag it through, m/s: it sets that sag, a centimetre or
// two on 16 m at a resting fish's pull, less under a harder one. And the pull, N, by
// which the change from one to the other is all but made.
const PULLED_FALL = 0.04;
const PULL_HOLDS = 0.05;
// A change in the pull runs along the line at about this speed, m/s, so the line as a
// whole feels it over the time that takes: a fifteenth of a second on 16 m. A pull that
// drops out for a frame or two, as it does when a rod kicks back at the strike, is hardly
// felt at all.
const PULL_TRAVELS = 250;
// A line does not come through the water for nothing. Whatever is on its far end and
// going away has to draw the line after it, along its own length, and the line in the
// water holds back: this many N for each m/s it is drawn at, for each metre of it that is
// wet. It is a small pull, a few hundredths of a newton under a sinking lure, and the rod
// never feels it: this is the drawn shape only, and only the wet part of it. But it is
// what spreads the bend by the lure along the line. With none,
// only the last metre of line went down with the lure and the rest lay where it was, a
// corner at the surface and a drop from it. Higher and the line under a sinking lure
// runs flatter and bends further back; lower and it hangs steeper by the lure.
const DRAWN_DRAG = 0.006;
// Slack much smaller than this, m, hardly shows. A line sags by the square root of its
// slack, so the first centimetre of it would drop the middle of ten metres of line by a
// hand's breadth at once. It is let in gently. Slack well past this is drawn as it is.
const SLACK_SOFT = 0.08;
// An end that moves further than this in one frame, m, has been put somewhere else, not
// carried there: the string starts again straight.
const MOVED_NOT_CARRIED = 6;

/** count: how many points the string has, both ends included. */
export function createLineCurve(count) {
  const last = count - 1;
  // Where each point is and where it was a step ago.
  const x = new Float64Array(count);
  const y = new Float64Array(count);
  const z = new Float64Array(count);
  const wasX = new Float64Array(count);
  const wasY = new Float64Array(count);
  const wasZ = new Float64Array(count);
  // Scratch: how easily each point moves, and the rows of the straightening.
  const ease = new Float64Array(count);
  const stiff = new Float64Array(count);
  const lower = new Float64Array(count);
  // The ends as of the last frame, and how much of the line's real slack was drawn then.
  const from = [0, 0, 0];
  const to = [0, 0, 0];
  let spare = 0;
  // What the landing left over, m: the slack that stays until something pulls it out.
  let over = 0;
  // How fast the far end moved in the last frame, m/s.
  let flew = 0;
  // The pull as the whole line feels it, N.
  let felt = 0;
  // The pull the far end puts into the wet line by drawing it after itself, N.
  let drawn = 0;
  let started = false;

  function straight(ax, ay, az, bx, by, bz) {
    for (let i = 0; i <= last; i += 1) {
      const t = i / last;
      x[i] = wasX[i] = ax + (bx - ax) * t;
      y[i] = wasY[i] = ay + (by - ay) * t;
      z[i] = wasZ[i] = az + (bz - az) * t;
    }
  }

  // One pass along the string, from one end or the other: each pair of neighbours further
  // than `rest` apart is drawn back to it, each giving by how easily it moves. The ends do
  // not move, and a point in the water gives less than one in the air.
  // Neighbours nearer than that are left alone: a line can be pulled, not pushed. Pushed
  // apart, a line with slack suddenly in it took the slack up as a saw's edge, every other
  // point thrown the opposite way, twenty bends along it, where a real one hangs in one
  // belly as it falls.
  function fit(rest, forward) {
    for (let n = 0; n < last; n += 1) {
      const i = forward ? n : last - 1 - n;
      const dx = x[i + 1] - x[i];
      const dy = y[i + 1] - y[i];
      const dz = z[i + 1] - z[i];
      const far = Math.hypot(dx, dy, dz);
      const a = ease[i];
      const b = ease[i + 1];
      if (far <= rest || a + b === 0) continue;
      const by = (far - rest) / (far * (a + b));
      x[i] += dx * by * a;
      y[i] += dy * by * a;
      z[i] += dz * by * a;
      x[i + 1] -= dx * by * b;
      y[i + 1] -= dy * by * b;
      z[i + 1] -= dz * by * b;
    }
  }

  // No point of a string this long between these ends can be further from the straight
  // way between them than this. It is geometry, not a rule: the passes above leave the
  // string a hair long, and this is what makes a line with no slack left exactly straight.
  // The slack goes as the pull straightens the line, so the room closes with the line,
  // never ahead of it.
  function holdIn(length) {
    const ux = x[last] - x[0];
    const uy = y[last] - y[0];
    const uz = z[last] - z[0];
    const gap = Math.hypot(ux, uy, uz);
    const most = Math.sqrt(Math.max(0, length * length - gap * gap)) / 2;
    for (let i = 1; i < last; i += 1) {
      const along = gap > 1e-9 ? ((x[i] - x[0]) * ux + (y[i] - y[0]) * uy + (z[i] - z[0]) * uz) / (gap * gap) : 0;
      const ox = x[i] - x[0] - ux * along;
      const oy = y[i] - y[0] - uy * along;
      const oz = z[i] - z[0] - uz * along;
      const far = Math.hypot(ox, oy, oz);
      if (far <= most) continue;
      const keep = most / far;
      x[i] -= ox * (1 - keep);
      y[i] -= oy * (1 - keep);
      z[i] -= oz * (1 - keep);
    }
  }

  // How easily each point is moved by its neighbours: not at all at the ends.
  function weigh() {
    for (let i = 1; i < last; i += 1) ease[i] = y[i] < 0 ? 1 / (1 + WET_HOLDS) : 1;
    ease[0] = 0;
    ease[last] = 0;
  }

  // The pull straightens the string for one step. Each point is drawn toward the middle
  // of its two neighbours, by the pull over what holds it where it is: the bends flatten
  // and spread, as they do in a string under tension moving through something thick. It
  // is solved along the whole string at once, so no size of pull can make it overshoot.
  // Every point is pulled by what the whole line carries, `felt`. A point in the water
  // carries what the far end puts in by drawing the wet line after it as well, `drawn`,
  // when that is more: the line in the air does not feel that one.
  function straighten(h, spacing) {
    const by = h / (LINE_DRAG * spacing * spacing);
    for (let i = 1; i < last; i += 1) stiff[i] = (y[i] < 0 ? Math.max(felt, drawn) : felt) * by;
    for (const p of [x, y, z]) {
      // (1 + 2k) p[i] - k p[i-1] - k p[i+1] = what it was. The ends are given.
      let was = p[0];
      lower[0] = 0;
      for (let i = 1; i < last; i += 1) {
        const k = stiff[i];
        const d = 1 + 2 * k + k * lower[i - 1];
        lower[i] = -k / d;
        was = (p[i] + k * was) / d;
        p[i] = was;
      }
      for (let i = last - 1; i >= 1; i -= 1) p[i] -= lower[i] * p[i + 1];
    }
  }

  // How long the string is as it lies.
  function lies() {
    let sum = 0;
    for (let i = 0; i < last; i += 1) sum += Math.hypot(x[i + 1] - x[i], y[i + 1] - y[i], z[i + 1] - z[i]);
    return sum;
  }

  function move(h, pull) {
    const fall = PULLED_FALL + (AIR_FALL - PULLED_FALL) * Math.exp(-Math.max(0, pull) / PULL_HOLDS);
    const airKeep = Math.exp(-(GRAVITY / AIR_FALL) * h);
    const waterKeep = Math.exp(-WATER_DRAG * h);
    for (let i = 1; i < last; i += 1) {
      let vx = (x[i] - wasX[i]) / h;
      let vy = (y[i] - wasY[i]) / h;
      let vz = (z[i] - wasZ[i]) / h;
      if (y[i] > 0) {
        // Falling, against the air: it closes on its falling speed.
        vx *= airKeep;
        vz *= airKeep;
        vy = -fall + (vy + fall) * airKeep;
      } else {
        // In the water: stopped by it, all but a slow sinking.
        vx *= waterKeep;
        vz *= waterKeep;
        vy = -SINK + (vy + SINK) * waterKeep;
      }
      wasX[i] = x[i];
      wasY[i] = y[i];
      wasZ[i] = z[i];
      x[i] += vx * h;
      y[i] += vy * h;
      z[i] += vz * h;
    }
  }

  return {
    // The next step starts from a straight line with no slack: the line has been wound
    // right in, or put somewhere else.
    reset() {
      started = false;
    },

    /**
     * Once a frame. The line runs from (ax, ay, az), the rod tip, to (bx, by, bz), with
     * `length` of it out. pull: how hard the line is pulling on the rod now, N, as worked
     * out elsewhere. It is only read. Writes the points into `out`, three numbers each
     * from index `at`, evenly spaced along the line. Returns the slack: length minus the
     * straight gap.
     */
    step(dt, ax, ay, az, bx, by, bz, length, pull, out, at) {
      const gap = Math.hypot(bx - ax, by - ay, bz - az);
      const slack = length - gap;
      const carried = started && dt > 0
        && Math.hypot(ax - from[0], ay - from[1], az - from[2]) < MOVED_NOT_CARRIED
        && Math.hypot(bx - to[0], by - to[1], bz - to[2]) < MOVED_NOT_CARRIED;
      if (carried) {
        // The far end has gone into the water this frame: it stops, the line overruns.
        // How fast it was going is taken from the frame before as well: in the frame it
        // lands it has already been slowed.
        const speed = Math.hypot(bx - to[0], by - to[1], bz - to[2]) / dt;
        // Only a line with nothing pulling on it: one under pull cannot run on.
        if (to[1] > 0 && by <= 0 && !(pull > 0)) over = Math.max(over, OVERRUN * Math.max(speed, flew));
        flew = speed;
        // How fast the far end is drawing the line after it: its speed along the last of
        // the line, away from the rest. And how much line is in the water to be drawn.
        let wet = 0;
        for (let i = 1; i < last; i += 1) if (y[i] < 0) wet += 1;
        const lx = x[last] - x[last - 1], ly = y[last] - y[last - 1], lz = z[last] - z[last - 1];
        const along = ((bx - to[0]) * lx + (by - to[1]) * ly + (bz - to[2]) * lz) / (dt * Math.max(Math.hypot(lx, ly, lz), 1e-6));
        drawn = by <= 0 ? DRAWN_DRAG * Math.max(0, along) * wet * (gap / last) : 0;
        felt += (Math.max(0, pull) - felt) * (1 - Math.exp(-dt * PULL_TRAVELS / Math.max(gap, 0.5)));
      } else {
        over = 0;
        flew = 0;
        felt = 0;
        drawn = 0;
      }
      const soft = slack > 0 ? (slack * slack) / (slack + SLACK_SOFT) : 0;
      if (!carried) {
        straight(ax, ay, az, bx, by, bz);
      } else {
        const steps = Math.max(1, Math.round(dt / STEP));
        const h = dt / steps;
        for (let k = 1; k <= steps; k += 1) {
          // The ends are carried evenly through the frame, and the string's spare with them.
          const t = k / steps;
          x[0] = from[0] + (ax - from[0]) * t;
          y[0] = from[1] + (ay - from[1]) * t;
          z[0] = from[2] + (az - from[2]) * t;
          const ex = to[0] + (bx - to[0]) * t;
          const ey = to[1] + (by - to[1]) * t;
          const ez = to[2] + (bz - to[2]) * t;
          const between = Math.hypot(ex - x[0], ey - y[0], ez - z[0]);
          const real = spare + (soft - spare) * t;
          move(h, felt);
          x[last] = ex;
          y[last] = ey;
          z[last] = ez;
          if (felt > 0 || drawn > 0) {
            // What a pull on the whole line has straightened is slack used up. It does not
            // come back. Only what brings it under its own length counts: a string lying
            // too long for a moment, or one its slack has not reached yet, has used none.
            // A far end drawing the wet line after it uses none either: it is taking line,
            // not taking slack up.
            const rest = between + real + over;
            const lay = Math.min(lies(), rest);
            straighten(h, Math.max(between / last, 1e-4));
            if (felt > 0) over = Math.max(0, over - Math.max(0, lay - Math.min(lies(), rest)));
          }
          weigh();
          for (let n = 0; n < PASSES; n += 1) fit((between + real + over) / last, n % 2 === 0);
          holdIn(between + real + over);
        }
      }
      spare = carried ? soft : 0;
      started = true;
      from[0] = ax;
      from[1] = ay;
      from[2] = az;
      to[0] = bx;
      to[1] = by;
      to[2] = bz;
      for (let i = 0; i <= last; i += 1) {
        out[at + i * 3] = x[i];
        out[at + i * 3 + 1] = y[i];
        out[at + i * 3 + 2] = z[i];
      }
      return slack;
    },
  };
}
