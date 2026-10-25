// One saved accent, shared across all views. Answer green/red remain semantic.
window.Theme = (() => {
  const { getThemeColor, DEFAULT_THEME_COLOR, onChange } = window.State;
  const rgb = (hex) => hex.match(/[0-9a-f]{2}/gi).map((part) => parseInt(part, 16));
  const hex = (values) => '#' + values.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const mix = (color, target, amount) => hex(rgb(color).map((v, i) => v + (rgb(target)[i] - v) * amount));
  const luminance = (color) => rgb(color).reduce((sum, v, i) => {
    const c = v / 255;
    return sum + (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][i];
  }, 0);
  const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
  const readable = (color, background, minimum = 4.5) => {
    for (let i = 0; i <= 100; i++) {
      const candidate = mix(color, '#000000', i / 100);
      if (contrast(candidate, background) >= minimum) return candidate;
    }
    return '#000000';
  };
  const palette = (color) => {
    const values = {
      '--bg': mix(color, '#ffffff', 0.91),
      '--border': mix(color, '#ffffff', 0.78),
      '--hover': mix(color, '#ffffff', 0.85),
      '--accent': readable(color, mix(color, '#ffffff', 0.91)),
      '--pastel-blue-line': color,
    };
    [0.92, 0.80, 0.65].forEach((amount, i) => {
      const bg = mix(color, '#ffffff', amount);
      values[`--band-${i + 1}-bg`] = bg;
      values[`--band-${i + 1}-border`] = i === 2 ? readable(readable(color, '#ffffff'), bg, 3) : readable(mix(color, '#ffffff', [0.50, 0.22][i]), bg, [1.6, 2.4][i]);
      values[`--band-${i + 1}-ink`] = readable(color, bg);
    });
    return values;
  };
  const apply = () => {
    const color = getThemeColor();
    const values = palette(color);
    for (const [key, value] of Object.entries(values)) {
      // Reset preserves the original blue scale; links now share its hue too.
      if (color === DEFAULT_THEME_COLOR) document.documentElement.style.removeProperty(key);
      else document.documentElement.style.setProperty(key, value);
    }
  };
  apply();
  onChange(apply);
  return { palette, contrast };
})();
