/**
 * Settings overlay generated from the settings schema (SPEC §17.4). Every change is saved at once;
 * the game rebuilds its effective config when the panel closes.
 */
export class SettingsMenu {
  constructor(settings, { onClose, onCustom }) {
    this.settings = settings; this.onClose = onClose; this.onCustom = onCustom;
    this.inputs = new Map();
    this.el = document.createElement('div');
    this.el.className = 'overlay settings hidden';
    document.body.appendChild(this.el);
    this.build();
  }

  build() {
    const s = this.settings, el = this.el;
    el.innerHTML = '';
    const h1 = document.createElement('h1'); h1.textContent = 'Settings'; el.appendChild(h1);
    const intro = document.createElement('p');
    intro.innerHTML = 'Everything is tunable: physics, every driver, rules, scoring, graphics — and a custom road. '
      + 'Changed values glow and are remembered; they take effect on the next start.';
    el.appendChild(intro);

    for (const g of s.schema) {
      const d = document.createElement('details');
      const sum = document.createElement('summary');
      sum.textContent = g.title;
      if (g.colorHex !== undefined) sum.style.color = `#${g.colorHex.toString(16).padStart(6, '0')}`;
      d.appendChild(sum);
      const grid = document.createElement('div'); grid.className = 'grid';
      for (const f of g.fields) grid.appendChild(this.field(f));
      d.appendChild(grid);
      const reset = document.createElement('button'); reset.className = 'small'; reset.textContent = 'Reset group';
      reset.addEventListener('click', () => { s.reset(g.fields); s.save(); this.refresh(); });
      d.appendChild(reset);
      el.appendChild(d);
    }

    const row = document.createElement('div'); row.className = 'actions';
    const actions = [
      ['Start custom game', () => this.onCustom()],
      ['Reset all', () => { s.reset(); s.save(); this.refresh(); }],
      ['Back', () => this.onClose()],
    ];
    for (const [label, fn] of actions) {
      const b = document.createElement('button'); b.textContent = label;
      b.addEventListener('click', () => { b.blur(); fn(); });
      row.appendChild(b);
    }
    el.appendChild(row);
  }

  field(f) {
    const s = this.settings;
    const wrap = document.createElement('label'); wrap.className = 'field';
    if (f.hint) wrap.title = f.hint;
    const span = document.createElement('span'); span.textContent = f.label; wrap.appendChild(span);
    const input = document.createElement('input');
    if (f.type === 'boolean') input.type = 'checkbox';
    else { input.type = 'number'; input.min = String(f.min); input.max = String(f.max); input.step = String(f.step); }
    input.addEventListener('change', () => {
      if (f.type === 'boolean') s.set(f.path, input.checked);
      else { const v = Number(input.value); if (Number.isFinite(v)) s.set(f.path, v); }
      s.save(); this.sync(f, input);
    });
    wrap.appendChild(input);
    this.inputs.set(f.path, { f, input });
    this.sync(f, input);
    return wrap;
  }

  sync(f, input) {
    const v = this.settings.get(f.path);
    if (f.type === 'boolean') input.checked = !!v; else input.value = String(v);
    input.classList.toggle('changed', this.settings.isOverridden(f.path));
  }

  refresh() { for (const { f, input } of this.inputs.values()) this.sync(f, input); }
  show() { this.refresh(); this.el.classList.remove('hidden'); }
  hide() { this.el.classList.add('hidden'); }
  get visible() { return !this.el.classList.contains('hidden'); }
}