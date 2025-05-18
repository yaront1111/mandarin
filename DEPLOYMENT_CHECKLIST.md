# Production Deployment Checklist for Flirtss

## Before Deployment

1. **Environment Variables** - Update `.env.production` with:
   ```bash
   # Must change these:
   JWT_SECRET=generate_secure_random_string
   REFRESH_TOKEN_SECRET=generate_secure_random_string
   
   # Already configured:
   RESEND_API_KEY=re_7k4fkJua_N1aYoE2o8yNQvhTeuk32S5Ux
   EMAIL_FROM=noreply@flirtss.com
   ```

2. **Install Dependencies**:
   ```bash
   cd /var/www/mandarin/server
   npm install
   ```

3. **Check Database Connection**:
   - Ensure MongoDB is running
   - Update `MONGODB_URI` if using authentication

## Deployment Steps

1. **Run deployment script**:
   ```bash
   cd /var/www/mandarin
   sudo ./deploy.sh
   ```

2. **Verify email service**:
   - Test user registration
   - Test password reset
   - Check Resend dashboard: https://resend.com/emails

3. **Check PM2 logs**:
   ```bash
   sudo -u www-data pm2 logs flirtss-server
   ```

## Fixed Issues

✅ **Mongoose duplicate index warnings** - Removed duplicate index definitions
✅ **Resend import error** - Fixed ES module import syntax
✅ **Photo permissions** - Fixed MongoDB queries and state updates
✅ **UserProfileModal loop** - Fixed infinite re-render issue

## Production Features

- Automatic email switching to Resend in production
- Professional HTML email templates
- Enhanced security settings
- PM2 process management
- Nginx reverse proxy

## Monitoring

- Check logs: `/var/www/mandarin/server/logs/`
- PM2 status: `pm2 status`
- Nginx logs: `/var/log/nginx/`

## Troubleshooting

If server won't start:
1. Check syntax: `node --check server.js`
2. Check dependencies: `npm ls`
3. Check environment: `node -e "console.log(process.env.NODE_ENV)"`
4. Check Resend import: The module should be imported as `{ Resend }` not `Resend`