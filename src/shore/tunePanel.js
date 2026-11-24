/**
 * The settings panel: sliders for trying the scene out, the view recentre button, and a
 * line of numbers from the cast.
 *
 * Owns: the panel's DOM and writing slider values into the `tune` object it is given.
 * Does not own: what any value does. It calls back and startShore.js applies it.
 * Defaults live in code and their tables in the docs: what is tried here is not written
 * back. See docs/CONVENTIONS.md section 6.
 *
 * The haptics test block from index.html is moved into the bottom of the panel.
 */

/**
 * container: the stage, holding #ui-root. tune: the values, read for the starting
 * positions and written on every slide.
 * hooks: onWave, onCamera, onRod, onRecenter are called after the matching values change.
 * Returns showView(), which moves the camera's two sliders to what `tune` holds now (a
 * drag on the view changes it), and showCast(fishing), which writes the cast's readouts.
 */
export function mountTunePanel(container, tune, hooks) {
  const root = container.querySelector('#ui-root') || container;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'tune-toggle';
  toggle.textContent = '设置';
  const panel = document.createElement('section');
  panel.className = 'tune-panel';
  panel.hidden = true;
  let yawInput = null;
  let pitchInput = null;
  const fields = [
    ['雾', [
      ['起始', 'fogNear', 0, 80, 1],
      ['结束', 'fogFar', 10, 200, 1],
    ]],
    ['水', [
      ['风速', 'windSpeed', 0.4, 8, 0.1, true],
      ['涌浪', 'swellHeight', 0, 0.4, 0.01, true],
      ['翻卷', 'choppiness', 0, 1.2, 0.01, true],
      ['白沫', 'foamStrength', 0, 1.5, 0.01],
      ['粗糙', 'roughness', 0.02, 0.4, 0.01],
      ['透光', 'sss', 0, 1, 0.01],
      ['折射', 'refract', 0, 1.5, 0.01],
      ['曝光', 'exposure', 0.2, 1.6, 0.01],
      ['太阳', 'sunScale', 0.2, 1.6, 0.01],
    ]],
    ['鱼', [
      ['游速', 'swimRate', 0.2, 2.5, 0.05],
    ]],
    ['鱼竿', [
      ['位置 X', 'rodX', -1, 1, 0.01],
      ['位置 Y', 'rodY', -2, 0.5, 0.01],
      ['位置 Z', 'rodZ', -5, -0.15, 0.01],
      ['抬起', 'rodAimUp', -30, 70, 0.5],
      ['侧偏', 'rodAimSide', -45, 45, 0.5],
      ['滚转', 'rodRoll', -180, 180, 1],
      ['竿尖负重 g', 'rodLoad', 0, 2400, 30],
    ]],
    ['摄像机', [
      ['位置 X', 'x', -30, 30, 0.1],
      ['位置 Y', 'y', 0.3, 8, 0.1],
      ['位置 Z', 'z', -20, 40, 0.1],
      ['朝向', 'yaw', -180, 180, 1],
      ['俯仰', 'pitch', -70, 70, 1],
    ]],
  ];
  panel.innerHTML = `<div class="tune-head"><span>场景参数</span><button type="button" class="tune-close tune-recenter">镜头回正</button><button type="button" class="tune-close tune-shut">关闭</button></div>`;
  const colorRow = document.createElement('label');
  colorRow.className = 'tune-row';
  colorRow.innerHTML = `<span>雾色</span><input type="color" value="${tune.fogColor}">`;
  for (const [title, rows] of fields) {
    const block = document.createElement('div');
    block.className = 'tune-block';
    block.innerHTML = `<p class="tune-title">${title}</p>`;
    if (title === '雾') block.appendChild(colorRow);
    for (const [label, key, min, max, step, wave] of rows) {
      const row = document.createElement('label');
      row.className = 'tune-row';
      const value = document.createElement('b');
      value.textContent = formatTune(tune[key]);
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.value = String(tune[key]);
      if (key === 'yaw') yawInput = input;
      if (key === 'pitch') pitchInput = input;
      input.addEventListener('input', () => {
        tune[key] = Number(input.value);
        value.textContent = formatTune(tune[key]);
        if (wave) hooks.onWave();
        if (title === '摄像机') hooks.onCamera();
        if (title === '鱼竿') hooks.onRod();
      });
      row.append(Object.assign(document.createElement('span'), { textContent: label }), input, value);
      block.appendChild(row);
    }
    panel.appendChild(block);
  }
  colorRow.querySelector('input').addEventListener('input', (e) => {
    tune.fogColor = e.target.value;
  });
  // What the cast is reading, for tuning it against a real hand. Not a player hint.
  const cast = document.createElement('div');
  cast.className = 'tune-block';
  cast.innerHTML = '<p class="tune-title">这一竿</p><p class="tune-cast"></p>';
  panel.appendChild(cast);
  const castText = cast.querySelector('.tune-cast');
  const haptic = root.querySelector('.panel');
  if (haptic) panel.appendChild(haptic);
  toggle.addEventListener('click', () => { panel.hidden = !panel.hidden; });
  panel.querySelector('.tune-shut').addEventListener('click', () => { panel.hidden = true; });
  // Takes the phone as it is held now for the default view. Without a sensor it only
  // re-applies the panel's camera.
  panel.querySelector('.tune-recenter').addEventListener('click', () => { hooks.onRecenter(); });
  root.append(toggle, panel);
  return {
    get open() { return !panel.hidden; },
    showView() {
      if (yawInput) yawInput.value = String(Math.round(tune.yaw));
      if (pitchInput) pitchInput.value = String(Math.round(tune.pitch));
    },
    // fishing: the cast's read-only numbers (src/play/fishing.js).
    showCast(f) {
      castText.textContent = `${f.stage} · 线 ${f.lineOut.toFixed(1)} 米 · 竿尖 ${f.swing.toFixed(1)} 米/秒 · 上次松手 ${f.lastRelease.toFixed(1)} 米/秒 仰角 ${Math.round(f.lastAngle)}°`
        + ` · 鱼 ${f.fish} ${f.mood}${f.around ? ` 饵边 ${f.around} 条` : ''}${f.interest ? ` 想吃 ${Math.round(f.interest * 100)}` : ''}${f.bite ? ` 咬口 ${f.bite}${f.hookIn ? ' 钩在嘴里' : ''}` : ''}${f.hunger ? ` 饿 ${Math.round(f.hunger * 100)}` : ''}${f.fright ? ` 惊 ${Math.round(f.fright * 100)}` : ''}${f.size ? ` ${f.big ? '大' : '小'} ${f.size.toFixed(2)}` : ''} · 张力 ${f.tension.toFixed(1)} 牛 · 鱼的力 ${f.pull.toFixed(1)} 牛 · 硬顶 ${f.press.toFixed(1)} 牛 · 手上 ${Math.round(f.effort * 100)} · 出线 ${f.running.toFixed(1)} 米/秒 · 气力 ${Math.round(f.stamina * 100)} · 带竿刹住 ${Math.round(f.held * 100)} · 钩松 ${Math.round(f.hookLoose * 100)} · 钓到 ${f.landed}${f.lost ? ` · ${f.lost}` : ''}`;
    },
    remove() { toggle.remove(); panel.remove(); },
  };
}

function formatTune(n) {
  return Math.abs(n) >= 10 ? String(Math.round(n)) : String(Math.round(n * 100) / 100);
}
