// Test script for Resend email functionality
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Resend } from 'resend';

// Get directory name for ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Test function
async function testResend() {
  console.log('Testing Resend API connection...');
  
  // Get the API key from environment
  const apiKey = process.env.RESEND_API_KEY;
  
  if (!apiKey) {
    console.error('Error: RESEND_API_KEY is not defined in .env file');
    process.exit(1);
  }
  
  console.log('API Key found:', apiKey.substring(0, 5) + '...' + apiKey.substring(apiKey.length - 4));
  
  // Initialize Resend
  const resend = new Resend(apiKey);
  
  try {
    // Send a test email
    console.log('Sending test email...');
    
    const result = await resend.emails.send({
      from: 'onboarding@resend.dev', // Use Resend's testing domain
      to: ['test@example.com'], // Replace with your email for testing
      subject: 'Test Email from Resend',
      text: 'This is a test email sent using Resend from the test script.',
      html: '<p>This is a test email sent using <strong>Resend</strong> from the test script.</p>',
    });
    
    if (result.error) {
      console.error('Error from Resend API:', result.error);
      process.exit(1);
    }
    
    console.log('Success! Email sent with ID:', result.data.id);
    console.log('Full response:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Exception while sending email:', error);
    process.exit(1);
  }
}

// Run the test
testResend().catch(err => {
  console.error('Unhandled error in test script:', err);
  process.exit(1);
});