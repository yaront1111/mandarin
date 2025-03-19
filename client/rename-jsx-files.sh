#!/bin/bash
# Script to rename .js files containing JSX to .jsx

# Component directories to search in
DIRS_TO_SEARCH=(
  "src/components"
  "src/pages"
  "src/context"
)

# Find all .js files in the specified directories
for dir in "${DIRS_TO_SEARCH[@]}"; do
  # Skip if directory doesn't exist
  if [ ! -d "$dir" ]; then
    echo "Directory $dir doesn't exist, skipping..."
    continue
  fi

  echo "Checking directory: $dir"

  # Find .js files containing JSX patterns
  find "$dir" -name "*.js" -type f -exec grep -l -E '(<[A-Za-z][A-Za-z0-9]*|<>|</>)' {} \; | while read -r file; do
    # Rename file to .jsx
    newfile="${file%.js}.jsx"
    echo "Renaming $file to $newfile"
    mv "$file" "$newfile"
  done
done

echo "Renaming complete!"
echo "Remember to update import statements if they include explicit .js extensions"
