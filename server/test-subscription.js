// Test script to verify automatic subscription on registration
import config from './config.js';

console.log('Current subscription configuration:');
console.log(`ENABLE_DEFAULT_SUBSCRIPTION: ${config.ENABLE_DEFAULT_SUBSCRIPTION}`);
console.log(`DEFAULT_SUBSCRIPTION_DAYS: ${config.DEFAULT_SUBSCRIPTION_DAYS}`);

// To test with different values, set environment variables:
// ENABLE_DEFAULT_SUBSCRIPTION=false node test-subscription.js
// DEFAULT_SUBSCRIPTION_DAYS=30 node test-subscription.js

const testDate = new Date();
const expiryDate = new Date(testDate.getTime() + config.DEFAULT_SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000);

console.log('\nIf a user registers now:');
console.log(`Current date: ${testDate.toDateString()}`);
console.log(`Subscription would expire: ${expiryDate.toDateString()}`);
console.log(`Days until expiry: ${config.DEFAULT_SUBSCRIPTION_DAYS}`);