/**
 * Vibrations from the rod, the line running out, and the reel.
 * Payout is its own continuous. It does not use the shared bed.
 * The empty reel is its own curve. A fish on the line still uses the shared bed.
 * Design: docs/PLAY.md section 14.
 */

import { SPEED_FULL, SPEED_MIN } from './swing.js';

export function createHand(haptics, feel) {
  let flown = 0;
  let reeled = 0;
  let reelArm = false;
  let pebbles = 0;
  // Where the fine ticks are in the reel's weak-strong-weak turn, m.
  let tickAt = 0;
  let reelKick = false;
  let reelOn = false;
  let reelFor = 0.5;
  let reelLeft = 0;
  let flightFor = 0;
  let flightFast = 0;
  let flightSung = false;
  let payoutLeft = 0;
  let flightLine0 = 0;
  let bedAt = 0;
  let bedSharp = 0;
  let stroke = 0;
  let strokeKind = '';
  let crest = 0;
  let ringReady = false;
  let ringQuiet = 0;

  function seat() {
    const dur = 0.12;
    haptics?.playPattern?.(
      [{
        type: 'continuous',
        relativeTime: 0,
        duration: dur,
        intensity: 0.62,
        sharpness: 0.74,
        attackTime: 0,
      }],
      [{
        parameterID: 'hapticIntensity',
        relativeTime: 0,
        controlPoints: [
          { relativeTime: 0, parameterValue: 1 },
          { relativeTime: dur * 0.18, parameterValue: 0.42 },
          { relativeTime: dur * 0.5, parameterValue: 0.12 },
          { relativeTime: dur, parameterValue: 0 },
        ],
      }],
    );
  }

    function step(dt, view) {
      const {
        stage, finger, holding, reeling, stowed, room, coming, going, length,
        castFar, released, effort, retrieveSpeed, forward: tipForward, moving: tipMoving,
        lifted, hookIn,
      } = view;
      const forward = tipForward;
      const moving = tipMoving;
      let level = 0;
      let sharp = 0.22;
      const waving = holding;
      const casting = forward >= SPEED_MIN;
      const loading = !casting && moving >= 2.4 && forward < moving * 0.45;
      // One falling continuous. A cast is longer and sharper. A load is short and dull,
      // so the hand can tell the wind-up from the throw.
      const whoosh = (kind, peak) => {
        const heft = Math.min(1, peak / SPEED_FULL);
        const cast = kind === 'cast';
        // Squared, so a light tip stays light and only a full swing gets strong.
        // The old line started at 0.55, so a gentle cast and a hard one were both loud.
        const heft2 = heft * heft;
        const ring = kind === 'ring';
        // A faster tip passes quicker, so the throw itself is shorter. A bounce of
        // the tip is measured against a few metres a second, not a full cast.
        const wobble = Math.min(1, peak / 4);
        const dur = cast ? 0.26 - heft * 0.12 : ring ? 0.08 + wobble * 0.06 : 0.16;
        const strong = cast ? 0.14 + heft2 * 0.48 : ring ? 0.07 + wobble * 0.2 : 0.1 + heft * 0.1;
        haptics?.playPattern?.(
          [{
            type: 'continuous',
            relativeTime: 0,
            duration: dur,
            intensity: strong,
            sharpness: cast ? 0.2 + heft * 0.22 : 0.12,
          }],
          [
            {
              parameterID: 'hapticIntensity',
              relativeTime: 0,
              controlPoints: [
                { relativeTime: 0, parameterValue: 1 },
                { relativeTime: dur * 0.2, parameterValue: cast ? 0.62 : 0.4 },
                { relativeTime: dur * 0.55, parameterValue: 0.22 },
                { relativeTime: dur, parameterValue: 0 },
              ],
            },
            {
              parameterID: 'hapticSharpness',
              relativeTime: 0,
              controlPoints: [
                { relativeTime: 0, parameterValue: 0 },
                { relativeTime: dur, parameterValue: cast ? -0.18 : -0.08 },
              ],
            },
          ],
        );
      };
      const held = waving || stage === 'flight';
      if (!held && strokeKind !== 'ring' && strokeKind !== 'cast') {
        stroke = 0;
        strokeKind = '';
        crest = 0;
        ringReady = false;
        ringQuiet = 0;
      } else if (casting && waving && strokeKind !== 'cast') {
        // The throw. It starts even if a load was still fading, so the cast is heard.
        strokeKind = 'cast';
        stroke = 1;
        crest = forward;
        ringReady = false;
      } else if (stroke === 1) {
        const v = strokeKind === 'cast' ? forward : moving;
        if (v > crest) crest = v;
        else {
          const kind = strokeKind;
          whoosh(kind, crest);
          stroke = 0;
          crest = 0;
          // A throw is followed by the tip. A bounce can be followed by another.
          if (kind === 'cast' || kind === 'ring') {
            strokeKind = 'ring';
            ringReady = false;
            ringQuiet = 0;
          } else strokeKind = '';
        }
      } else if (strokeKind === 'ring' && stage !== 'flight') {
        // The hand can be still. What counts is the tip still moving, which is
        // often only about a metre a second, under the old 2.4 gate.
        if (!ringReady) {
          if (moving < 1.2) ringReady = true;
        } else if (moving >= 0.45) {
          stroke = 1;
          crest = moving;
          ringQuiet = 0;
        } else if (moving < 0.3) {
          ringQuiet += dt;
          if (ringQuiet > 0.45) {
            strokeKind = '';
            ringReady = false;
            ringQuiet = 0;
          }
        } else ringQuiet = 0;
      } else if (waving && loading) {
        strokeKind = 'load';
        stroke = 1;
        crest = moving;
      }
      if (stage === 'flight') {
        // Weaker as more line is out. At the water the line is at its longest, so
        // this is nearly gone and the stop is not a cut. A longer cast takes longer
        // to get there, so the vibration lasts longer too.
        if (!flightSung) {
          flightSung = true;
          flightLine0 = length;
        }
        const gone = Math.max(0, length - flightLine0);
        const share = Math.min(1, gone / castFar);
        const left = 1 - share;
        const heft = Math.min(1, released / SPEED_FULL);
        // Its own continuous, not the shared bed. A full cast starts at 0.23
        // and the next piece is quieter as more line is out.
        const pay = (0.05 + heft * 0.18) * left * left;
        if (pay > 0.02 && payoutLeft <= 0) {
          const dur = 0.28;
          payoutLeft = dur;
          haptics?.playPattern?.(
            [{
              type: 'continuous',
              relativeTime: 0,
              duration: dur,
              intensity: pay,
              sharpness: 0.62,
            }],
            [{
              parameterID: 'hapticIntensity',
              relativeTime: 0,
              controlPoints: [
                { relativeTime: 0, parameterValue: 1 },
                { relativeTime: dur, parameterValue: 1 },
              ],
            }],
          );
        }
        if (payoutLeft > 0) payoutLeft -= dt;
        const outSpeed = Math.max(0, going);
        if (outSpeed > 0.8 && left > 0.08) {
          flown += outSpeed * dt;
          const gap = 0.012 + share * 0.07;
          const step = gap / Math.max(outSpeed, 1);
          const grains = [];
          let at = 0;
          while (flown >= gap && at < dt && grains.length < 14) {
            grains.push({
              type: 'transient',
              relativeTime: at,
              intensity: (0.008 + heft * 0.011) * left,
              sharpness: 0.78,
            });
            flown -= gap;
            at += step;
          }
          if (grains.length) haptics?.playPattern?.(grains);
        }
      } else if (stage === 'water' && hookIn) {
        level = 0;
      } else if (
        finger && reeling && !stowed && room > 0.02 && coming > 0.08
        && (stage !== 'water' || effort >= 0.12 || retrieveSpeed > 0.05)
      ) {
        reelOn = true;
        // One continuous, and it belongs to the reel. Only while line is actually
        // coming in. An empty lure is one strong-to-weak beat per half turn of the
        // rotor. A fish uses the same continuous, held steady by the pull on the line.
        const load = Math.min(1, effort);
        const empty = load < 0.12;
        if (empty) {
          // One turn per half turn of the rotor (two arms). Weak, then strong, then
          // weak. The rise is in the curve, because the shared bed only turns down.
          // Handle is 0.72 m per turn (reel.js LINE_PER_TURN), rotor is 5.2 times that.
          const turn = 0.72 / 5.2 / 2;
          const peak = lifted ? 0.16 : 0.23;
          const low = (lifted ? 0.06 : 0.05) / peak;
          const swell = () => {
            const dur = Math.min(0.6, Math.max(0.05, turn / Math.max(coming, 0.25)));
            haptics?.playPattern?.(
              [{
                type: 'continuous',
                relativeTime: 0,
                duration: dur,
                intensity: peak,
                sharpness: 0.66,
              }],
              [{
                parameterID: 'hapticIntensity',
                relativeTime: 0,
                controlPoints: [
                  { relativeTime: 0, parameterValue: low },
                  { relativeTime: dur * 0.5, parameterValue: 1 },
                  { relativeTime: dur, parameterValue: low },
                ],
              }],
            );
          };
          if (!reelArm) {
            reelArm = true;
            swell();
          }
          reeled += coming * dt;
          while (reeled >= turn) {
            reeled -= turn;
            swell();
          }
          // The swell is its own curve. The shared bed stays quiet.
          level = 0;
          reelOn = false;
        } else {
          reeled = 0;
          level = 0.06 + load * 0.32;
          sharp = 0.34;
          reelFor = 1.2;
        }
        reelLeft -= dt;
        if (reelLeft < 0.12) {
          reelKick = true;
          reelLeft = reelFor;
        }
        // A light tick each half-centimetre. Same turn as the reel: weak, strong,
        // weak, but only a small step between them. Clear of the water, lighter.
        pebbles += coming * dt;
        const stoneTurn = 0.72 / 5.2 / 2;
        if (empty) tickAt = reeled;
        else {
          tickAt += coming * dt;
          while (tickAt >= stoneTurn) tickAt -= stoneTurn;
        }
        const around = Math.sin((tickAt / stoneTurn) * Math.PI);
        const stones = [];
        let at = 0;
        const step = 0.005 / Math.max(coming, 0.2);
        const stone = (lifted ? 0.02 : 0.024) * (0.84 + 0.16 * around);
        while (pebbles >= 0.005 && at < dt && stones.length < 12) {
          stones.push({
            type: 'transient',
            relativeTime: at,
            intensity: stone,
            sharpness: 0.86,
          });
          pebbles -= 0.005;
          at += step;
        }
        if (stones.length) haptics?.playPattern?.(stones);
      } else {
        reeled = 0;
        reelArm = false;
        reelOn = false;
        reelLeft = 0;
        pebbles = 0;
        tickAt = 0;
      }
      if (stage !== 'flight') {
        flown = 0;
        flightFor = 0;
        flightFast = 0;
        flightSung = false;
        payoutLeft = 0;
        // The lure is down, or the cast is over. Tip-ring from the throw stops with the line.
        if (stage !== 'ready' && (strokeKind === 'ring' || strokeKind === 'cast')) {
          stroke = 0;
          strokeKind = '';
          crest = 0;
          ringReady = false;
          ringQuiet = 0;
        }
      }
      feel.bed(level);
      const felt = feel.step(dt);
      if (felt.knock) haptics?.playTransient(felt.knock.intensity, felt.knock.sharpness);
      if (felt.bed > 0.02) {
        // A falling level starts again quieter. The dynamic control only turns a
        // playing one down, and a cast's line must be heard getting lighter even
        // when that control is not installed. Flight is short, so a missed stop
        // cannot hold for most of a minute.
        if (reelKick || !(bedAt > 0) || felt.bed > bedAt * 1.08 || sharp !== bedSharp) {
          reelKick = false;
          haptics?.startContinuous?.({
            intensity: felt.bed,
            sharpness: sharp,
            duration: reelOn ? reelFor : 45,
          });
          bedAt = felt.bed;
          bedSharp = sharp;
        } else haptics?.updateContinuous?.({ intensity: felt.bed / bedAt });
      } else if (bedAt > 0) {
        haptics?.stopContinuous?.();
        bedAt = 0;
        bedSharp = 0;
      }
    }


  return { step, seat };
}
