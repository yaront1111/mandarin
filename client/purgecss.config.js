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
    // Translate utility classes with fractions
    /^translate-x-\d\/\d/,
    /^translate-y-\d\/\d/,
    /^translate-x-n\d\/\d/,
    /^translate-y-n\d\/\d/,
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