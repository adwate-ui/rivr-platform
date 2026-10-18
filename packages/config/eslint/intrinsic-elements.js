// @ts-check
/** Every lowercase JSX element React renders as HTML or SVG. Apps may use none of them. */

const HTML = `a abbr address area article aside audio b base bdi bdo big blockquote body br button
  canvas caption center cite code col colgroup data datalist dd del details dfn dialog div dl dt em
  embed fieldset figcaption figure font footer form h1 h2 h3 h4 h5 h6 head header hgroup hr html i
  iframe img input ins kbd label legend li link main map mark marquee menu meta meter nav noscript
  object ol optgroup option output p picture portal pre progress q rp rt ruby s samp script search
  section select slot small source span strong style sub summary sup table tbody td template
  textarea tfoot th thead time title tr track u ul var video wbr`;

const SVG = `svg g path circle ellipse line polyline polygon rect text tspan textPath defs use symbol
  clipPath mask pattern linearGradient radialGradient stop filter feBlend feColorMatrix
  feComposite feFlood feGaussianBlur feMerge feMergeNode feOffset image foreignObject marker desc
  switch animate animateMotion animateTransform set view`;

/** @type {string[]} */
export const INTRINSIC_ELEMENTS = [...HTML.split(/\s+/), ...SVG.split(/\s+/)].filter(Boolean);
