// Nine different animals stand in for the digits 1-9. Each differs in silhouette AND colour.
const INK = '#2B2118';
const S = `stroke="${INK}" stroke-width="2" stroke-linejoin="round"`;
const mir = (x) => 64 - x;
const eyes = (y = 34, r = 2.9, dx = 8.5) => [32 - dx, 32 + dx].map((x) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}"/><circle cx="${x + 1}" cy="${y - 1.1}" r="1" fill="#fff"/>`).join('');
const head = (fill, cy = 36, rx = 23, ry = 18) => `<ellipse cx="32" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${S}/>`;

export const ANIMALS = [
  { n: 'Cat', svg: () => `
    ${[0, 1].map((f) => `<path d="M${f ? mir(11) : 11} 27 L${f ? mir(13) : 13} 6 L${f ? mir(29) : 29} 17Z" fill="#EE9A4D" ${S}/><path d="M${f ? mir(15.5) : 15.5} 22 L${f ? mir(16) : 16} 11.5 L${f ? mir(24) : 24} 17Z" fill="#F6B7A8"/>`).join('')}
    ${head('#EE9A4D')}
    <path d="M32 17 v6 M26 18.5 l1.6 4.5 M38 18.5 l-1.6 4.5" stroke="#C9742A" stroke-width="2.2" stroke-linecap="round" fill="none"/>
    ${[23.5, 40.5].map((x) => `<ellipse cx="${x}" cy="34" rx="3.5" ry="3.9" fill="#9BC53D"/><ellipse cx="${x}" cy="34" rx="1.5" ry="3.1" fill="${INK}"/><circle cx="${x + 1.1}" cy="32.6" r="1" fill="#fff"/>`).join('')}
    <path d="M29.6 38.6 h4.8 l-2.4 2.8z" fill="#D9748A"/>
    <path d="M32 41.3 v1.4 M32 42.7 q-2.6 2.6 -5 .4 M32 42.7 q2.6 2.6 5 .4" fill="none" stroke="${INK}" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M13 39 l-9 -2 M13 42 l-9 2 M51 39 l9 -2 M51 42 l9 2" stroke="${INK}" stroke-opacity=".5" stroke-width="1" stroke-linecap="round"/>` },

  { n: 'Dog', svg: () => `
    <ellipse cx="12" cy="31" rx="8" ry="15" transform="rotate(14 12 31)" fill="#8D5B3E" ${S}/><ellipse cx="52" cy="31" rx="8" ry="15" transform="rotate(-14 52 31)" fill="#8D5B3E" ${S}/>
    ${head('#DDAA70', 34)}
    <clipPath id="pd1"><ellipse cx="32" cy="34" rx="23" ry="18"/></clipPath><ellipse cx="42" cy="28" rx="8" ry="8" fill="#8D5B3E" clip-path="url(#pd1)"/>
    <ellipse cx="32" cy="44" rx="12" ry="9" fill="#F8EAD3" ${S}/>
    ${eyes(31, 3)}
    <ellipse cx="32" cy="40" rx="5" ry="3.4" fill="${INK}"/><path d="M32 43 v3 M32 46 q-4 3 -7 -.5 M32 46 q4 3 7 -.5" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M29.6 48 q2.4 7 4.8 0z" fill="#EC7C8E" ${S.replace('2', '1.2')}/>` },

  { n: 'Rabbit', svg: () => `
    ${[22, 42].map((x) => `<ellipse cx="${x}" cy="13" rx="6.5" ry="14" fill="#FBF6EE" ${S}/><ellipse cx="${x}" cy="14" rx="3" ry="9" fill="#F4B6C2"/>`).join('')}
    ${head('#FBF6EE', 39, 22, 17)}
    ${eyes(36, 2.8, 9)}
    <ellipse cx="17" cy="43" rx="4" ry="2.6" fill="#F7C3CC"/><ellipse cx="47" cy="43" rx="4" ry="2.6" fill="#F7C3CC"/>
    <path d="M29.8 40.5 h4.4 l-2.2 2.6z" fill="#E58AA0"/>
    <path d="M32 43 v1.5 M32 44.5 q-3 2.6 -5.5 0 M32 44.5 q3 2.6 5.5 0" fill="none" stroke="${INK}" stroke-width="1.2" stroke-linecap="round"/>
    <rect x="29.6" y="46" width="2.4" height="4.5" rx="1" fill="#fff" stroke="${INK}" stroke-width="1"/><rect x="32" y="46" width="2.4" height="4.5" rx="1" fill="#fff" stroke="${INK}" stroke-width="1"/>` },

  { n: 'Fox', svg: () => `
    ${[0, 1].map((f) => `<path d="M${f ? mir(9) : 9} 30 L${f ? mir(11) : 11} 4 L${f ? mir(30) : 30} 19Z" fill="#E8702A" ${S}/><path d="M${f ? mir(11) : 11} 4 L${f ? mir(12.4) : 12.4} 14 L${f ? mir(20) : 20} 11Z" fill="#3A2A22"/>`).join('')}
    ${head('#E8702A')}
    <clipPath id="pd3"><ellipse cx="32" cy="36" rx="23" ry="18"/></clipPath>
    <path clip-path="url(#pd3)" d="M6 38 Q20 36 32 47 Q44 36 58 38 L58 60 L6 60Z" fill="#FFF6EA"/>
    ${[[23.5, -12], [40.5, 12]].map(([x, r]) => `<ellipse cx="${x}" cy="33" rx="3.3" ry="2.5" transform="rotate(${r} ${x} 33)" fill="${INK}"/>`).join('')}
    <ellipse cx="32" cy="44.5" rx="3.4" ry="2.5" fill="${INK}"/><path d="M32 47 q-3 3 -6 .5 M32 47 q3 3 6 .5" fill="none" stroke="${INK}" stroke-width="1.2" stroke-linecap="round"/>` },

  { n: 'Panda', svg: () => `
    ${[14, 50].map((x) => `<circle cx="${x}" cy="15" r="8.5" fill="${INK}" ${S}/>`).join('')}
    ${head('#FFFFFF', 36, 23, 20)}
    ${[[22.5, -22], [41.5, 22]].map(([x, r]) => `<ellipse cx="${x}" cy="34" rx="5.5" ry="7.2" transform="rotate(${r} ${x} 34)" fill="${INK}"/>`).join('')}
    ${[23, 41].map((x) => `<circle cx="${x}" cy="34" r="2.2" fill="#fff"/><circle cx="${x + .4}" cy="34.2" r="1.1" fill="${INK}"/>`).join('')}
    <ellipse cx="32" cy="43" rx="4" ry="2.8" fill="${INK}"/><path d="M32 45.5 v1.5 M32 47 q-3.4 3 -6.5 0 M32 47 q3.4 3 6.5 0" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"/>` },

  { n: 'Bear', svg: () => `
    ${[14, 50].map((x) => `<circle cx="${x}" cy="17" r="8" fill="#6B4A3A" ${S}/><circle cx="${x}" cy="17" r="4" fill="#C79A7A"/>`).join('')}
    ${head('#6B4A3A', 37, 23, 19)}
    <ellipse cx="32" cy="43.5" rx="11" ry="8.5" fill="#D9B48F" ${S}/>
    ${eyes(32, 2.6, 9.5)}
    <ellipse cx="32" cy="40.5" rx="4.4" ry="3" fill="${INK}"/><path d="M32 43.5 v2 M32 45.5 q-3.4 3 -6 0 M32 45.5 q3.4 3 6 0" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"/>` },

  { n: 'Pig', svg: () => `
    ${[0, 1].map((f) => `<path d="M${f ? mir(11) : 11} 30 L${f ? mir(13) : 13} 9 L${f ? mir(29) : 29} 19Z" fill="#F08CA2" ${S}/>`).join('')}
    ${head('#F8B4C2', 36, 23, 19)}
    ${eyes(31, 2.8, 10)}
    <ellipse cx="32" cy="42.5" rx="10.5" ry="7.5" fill="#F4929F" ${S}/>
    <ellipse cx="28" cy="42.5" rx="1.8" ry="2.8" fill="#9C3F58"/><ellipse cx="36" cy="42.5" rx="1.8" ry="2.8" fill="#9C3F58"/>
    <ellipse cx="14.5" cy="40" rx="3.4" ry="2.3" fill="#F2879A" opacity=".8"/><ellipse cx="49.5" cy="40" rx="3.4" ry="2.3" fill="#F2879A" opacity=".8"/>` },

  { n: 'Mouse', svg: () => `
    ${[13, 51].map((x) => `<circle cx="${x}" cy="17" r="10.5" fill="#A9AFB8" ${S}/><circle cx="${x}" cy="17" r="6.2" fill="#F4B6C2"/>`).join('')}
    ${head('#B9BEC6', 38, 22, 17)}
    ${eyes(35, 2.7, 9)}
    <circle cx="32" cy="41" r="3" fill="#E58AA0" ${S.replace('2', '1.2')}/>
    <path d="M32 44 q-3 3 -5.5 .4 M32 44 q3 3 5.5 .4" fill="none" stroke="${INK}" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M16 41 l-12 -3 M16 44 l-12 2 M48 41 l12 -3 M48 44 l12 2" stroke="${INK}" stroke-opacity=".5" stroke-width="1" stroke-linecap="round"/>` },

  { n: 'Frog', svg: () => `
    ${head('#6DBE5A', 40, 24, 16)}
    ${[21, 43].map((x) => `<circle cx="${x}" cy="26" r="8.5" fill="#6DBE5A" ${S}/><circle cx="${x}" cy="26" r="5.4" fill="#fff"/><circle cx="${x + .6}" cy="26.4" r="2.8" fill="${INK}"/><circle cx="${x + 1.5}" cy="25.2" r="1" fill="#fff"/>`).join('')}
    <path d="M14 43 Q32 57 50 43" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
    <circle cx="29" cy="37" r="1" fill="${INK}"/><circle cx="35" cy="37" r="1" fill="${INK}"/>
    <ellipse cx="14" cy="45" rx="3.6" ry="2.4" fill="#F4A6A0" opacity=".85"/><ellipse cx="50" cy="45" rx="3.6" ry="2.4" fill="#F4A6A0" opacity=".85"/>` },
];

export function mountSprite() {
  if (document.getElementById('pet-sprite')) return;
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.id = 'pet-sprite'; s.setAttribute('width', 0); s.setAttribute('height', 0);
  s.setAttribute('aria-hidden', 'true'); s.style.position = 'absolute';
  s.innerHTML = ANIMALS.map((a, i) => `<symbol id="pet-${i}" viewBox="0 0 64 64">${a.svg()}</symbol>`).join('');
  document.body.prepend(s);
}
// i is the 0-based animal index
export const pet = (i, cls = '') =>
  `<svg class="cat ${cls}" viewBox="0 0 64 64" aria-hidden="true"><use href="#pet-${i}"/></svg>`;
