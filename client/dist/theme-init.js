// Immediate theme initialization script
// This runs before any React code to prevent flash of incorrect theme
(function() {
  // Function to apply theme
  function applyTheme(isDark) {
    // Clean up all theme classes
    document.documentElement.classList.remove('dark', 'light');
    
    if (isDark) {
      // Apply dark theme
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      
      // Force dark mode colors to body and html
      document.body.style.color = '#f9fafb';
      document.body.style.backgroundColor = '#111827';
      document.documentElement.style.colorScheme = 'dark';
    } else {
      // Apply light theme
      document.documentElement.classList.add('light');
      document.documentElement.setAttribute('data-theme', 'light');
      
      // Force light mode colors to body and html
      document.body.style.color = '#111827';
      document.body.style.backgroundColor = '#ffffff';
      document.documentElement.style.colorScheme = 'light';
    }
  }
  
  // Get theme settings
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // Set theme based on saved preference or system preference
  const isDarkMode = savedTheme === 'dark' || (!savedTheme && prefersDark);
  applyTheme(isDarkMode);
  
  // Add explicit classes to ensure CSS specificity doesn't override our settings
  if (isDarkMode) {
    document.addEventListener('DOMContentLoaded', function() {
      document.body.classList.add('theme-dark-body');
    });
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      document.body.classList.add('theme-light-body');
    });
  }
  
  // For good measure, add a small delay to reapply after React might have mounted
  setTimeout(function() {
    applyTheme(isDarkMode);
  }, 100);
  
  // Listen for system preference changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('theme')) { // Only auto-switch if user hasn't set preference
      applyTheme(e.matches);
    }
  });
})();