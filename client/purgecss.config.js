module.exports = {
  content: [
    './src/**/*.{jsx,js,tsx,ts}',
    './index.html',
    './public/**/*.{js,html}'
  ],
  css: ['./src/styles/**/*.css'],
  safelist: [
    // Add classes that must never be removed here
    /^rtl-/,
    'dark-mode',
    'light-mode',
    'direction-changing',
    /^toast/,
    /^Toastify/,
    /^swiper/,
    /^gradient-/,
    /^loading-/,
    /^modal-/,
    // Dynamic classes
    /^h\d-/,
    /^bg-/,
    /^text-/,
    /^btn-/,
    /^card-/,
    // Fraction-based classes - instead of regex, use explicit class names
    'translate-x-1/2', 'translate-x-1/3', 'translate-x-2/3', 'translate-x-1/4', 'translate-x-3/4',
    'translate-y-1/2', 'translate-y-1/3', 'translate-y-2/3', 'translate-y-1/4', 'translate-y-3/4',
    'translate-x-n1/2', 'translate-x-n1/3', 'translate-x-n2/3', 'translate-x-n1/4', 'translate-x-n3/4',
    'translate-y-n1/2', 'translate-y-n1/3', 'translate-y-n2/3', 'translate-y-n1/4', 'translate-y-n3/4',
    // State-based classes
    'active',
    'disabled',
    'show',
    'hide',
    'open',
    'closed',
    'expanded',
    'collapsed',
    'visible',
    'invisible',
    'visually-hidden'
  ],
  keyframes: true,
  fontFace: true,
  variables: true,
  rejected: true,
  // Escape special characters in selectors
  defaultExtractor: content => content.match(/[A-Za-z0-9-_:/\\]+/g) || []
};