import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Copy scraped photos to server uploads directory
const copyScrapedPhotos = async () => {
  const sourceDir = path.join(__dirname, '../scraper/scraped_data_zbeng_full_refactor/photos');
  const targetDir = path.join(__dirname, 'uploads/images');
  
  try {
    // Create target directory if it doesn't exist
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
      console.log(`Created directory: ${targetDir}`);
    }
    
    // Check if source directory exists
    if (!fs.existsSync(sourceDir)) {
      console.error(`Source directory does not exist: ${sourceDir}`);
      return;
    }
    
    // Read all files from source directory
    const files = fs.readdirSync(sourceDir);
    console.log(`Found ${files.length} files in source directory`);
    
    let copiedCount = 0;
    let skippedCount = 0;
    
    for (const file of files) {
      const sourcePath = path.join(sourceDir, file);
      const targetPath = path.join(targetDir, file);
      
      // Check if it's a file
      const stats = fs.statSync(sourcePath);
      if (!stats.isFile()) {
        console.log(`Skipping directory: ${file}`);
        continue;
      }
      
      // Only copy if file doesn't exist in target
      if (!fs.existsSync(targetPath)) {
        fs.copyFileSync(sourcePath, targetPath);
        copiedCount++;
        console.log(`Copied: ${file}`);
      } else {
        skippedCount++;
      }
    }
    
    console.log(`\nCopied ${copiedCount} photos to uploads directory.`);
    console.log(`Skipped ${skippedCount} photos (already exist).`);
    console.log(`Total photos in uploads directory: ${fs.readdirSync(targetDir).filter(f => fs.statSync(path.join(targetDir, f)).isFile()).length}`);
    
  } catch (error) {
    console.error('Error copying photos:', error);
  }
};

copyScrapedPhotos();