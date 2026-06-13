// components/Icon.jsx — lucide 互換の最小アイコンセット（stroke / currentColor）
// 画面側は <Icon name="..." size={..} /> で使う。fill 対応（star/play は塗り）。

const ICON_PATHS = {
  'chevron-right': 'M9 18l6-6-6-6',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-up': 'M18 15l-6-6-6 6',
  'arrow-left': 'M19 12H5 M12 19l-7-7 7-7',
  check: 'M20 6L9 17l-5-5',
  x: 'M18 6L6 18 M6 6l12 12',
  info: 'M12 16v-4 M12 8h.01',
  lock: 'M7 11V7a5 5 0 0 1 10 0v4',
  flame:
    'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z',
  'rotate-ccw': 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8 M3 3v5h5',
  'book-open':
    'M12 7v14 M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  'alert-triangle':
    'M21.73 18l-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3 M12 9v4 M12 17h.01',
  eye: 'M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0',
  'check-circle': 'M21.8 10A10 10 0 1 1 17 3.34 M9 11l3 3L22 4',
  trophy:
    'M6 9H4.5a2.5 2.5 0 0 1 0-5H6 M18 9h1.5a2.5 2.5 0 0 0 0-5H18 M4 22h16 M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22 M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22 M18 2H6v7a6 6 0 0 0 12 0V2z',
  lightbulb:
    'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5 M9 18h6 M10 22h4',
  bookmark: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z',
  'bar-chart': 'M3 3v16a2 2 0 0 0 2 2h16 M18 17V9 M13 17V5 M8 17v-3',
  'volume-2': 'M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.59a1 1 0 0 1-.707.293H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.706a1 1 0 0 1 .707.293l3.384 3.385A.705.705 0 0 0 11 19.298z M16 9a5 5 0 0 1 0 6 M19.364 18.364a9 9 0 0 0 0-12.728',
  'volume-x': 'M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.59a1 1 0 0 1-.707.293H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.706a1 1 0 0 1 .707.293l3.384 3.385A.705.705 0 0 0 11 19.298z M22 9l-6 6 M16 9l6 6',
  sparkles:
    'M9.94 6.5 12 2l2.06 4.5L18.5 8.5 14.06 10.5 12 15l-2.06-4.5L5.5 8.5z M19 14l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z',
};

// 円・矩形が必要なアイコンの追加プリミティブ
const ICON_EXTRAS = {
  info: [{ tag: 'circle', attrs: { cx: 12, cy: 12, r: 10 } }],
  eye: [{ tag: 'circle', attrs: { cx: 12, cy: 12, r: 3 } }],
  lock: [{ tag: 'rect', attrs: { x: 3, y: 11, width: 18, height: 11, rx: 2 } }],
};

// 塗りで描くポリゴン系（fill で塗る）
const ICON_POLYGONS = {
  star: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26',
  play: '6 3 20 12 6 21',
};

// fill で塗る path 系（polygon より複雑な形状。Tagico タグ型など）
const ICON_FILL_PATHS = {
  // "Tag"ico ブランドモチーフ：Home.jsx の TAG_PATH と同一形状
  tag: 'M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z',
};

export default function Icon({ name, size = 20, color, strokeWidth = 2, fill, style, className }) {
  const d = ICON_PATHS[name];
  const extras = ICON_EXTRAS[name] || [];
  const poly = ICON_POLYGONS[name];
  const fillPath = ICON_FILL_PATHS[name];
  // fill系（polygon / fill path）はストロークなし。stroke系はストロークあり
  const isFillOnly = !!(poly || fillPath);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={isFillOnly ? 'none' : 'currentColor'}
      strokeWidth={isFillOnly ? 0 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ color: color || 'currentColor', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {extras.map((e, i) =>
        e.tag === 'circle' ? <circle key={i} {...e.attrs} /> : <rect key={i} {...e.attrs} />
      )}
      {poly && <polygon points={poly} fill={fill ? 'currentColor' : 'none'} />}
      {fillPath && (
        <path
          d={fillPath}
          fill={fill ? 'currentColor' : 'none'}
          stroke={fill ? 'none' : 'currentColor'}
          strokeWidth={fill ? 0 : strokeWidth}
        />
      )}
      {d &&
        d.split(' M').map((seg, i) => (
          <path key={'p' + i} d={i === 0 ? seg : 'M' + seg} fill="none" />
        ))}
    </svg>
  );
}
