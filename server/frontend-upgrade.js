// This script will help upgrade the backend packages
// Run this in your server directory

const { execSync } = require("child_process")
const fs = require("fs")
const path = require("path")

// Read the current package.json
const packageJsonPath = path.join(process.cwd(), "package.json")
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))

// Define packages to upgrade
const expressUpgrades = [
  "express@4.18.2",
  "mongoose@7.6.3",
  "socket.io@4.7.2",
  "jsonwebtoken@9.0.2",
  "bcryptjs@2.4.3",
  "multer@1.4.5-lts.1",
  "sharp@0.32.6",
  "cors@2.8.5",
  "dotenv@16.3.1",
  "winston@3.11.0",
  "express-rate-limit@7.1.4",
  "file-type@18.7.0",
  "sanitize-html@2.11.0",
  "rate-limiter-flexible@3.0.0",
]

// Execute the upgrade
console.log("Upgrading Express and related packages...")
try {
  execSync(`npm install ${expressUpgrades.join(" ")}`, { stdio: "inherit" })
  console.log("Express packages upgraded successfully!")
} catch (error) {
  console.error("Error upgrading Express packages:", error.message)
}

// Additional dev dependencies
const devDeps = ["nodemon@3.0.1", "@faker-js/faker@8.3.1"]

console.log("Upgrading dev dependencies...")
try {
  execSync(`npm install ${devDeps.join(" ")} --save-dev`, { stdio: "inherit" })
  console.log("Dev dependencies upgraded successfully!")
} catch (error) {
  console.error("Error upgrading dev dependencies:", error.message)
}

console.log("Backend packages upgrade completed!")
