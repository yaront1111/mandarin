# Production Deployment Guide for Flirtss

## Prerequisites

- Production server with Node.js (v18 or higher), MongoDB, and PM2 installed
- Nginx configured as reverse proxy
- SSL certificates for `flirtss.com`
- Resend API key configured in `.env.production`

## 1. Prepare the Server

### Update System Packages
```bash
sudo apt update && sudo apt upgrade -y
```

### Install Required Software
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MongoDB
sudo apt-get install -y mongodb-org

# Install PM2 globally
sudo npm install -g pm2

# Install nginx
sudo apt-get install -y nginx
```

## 2. Deploy the Application

### Clone the Repository
```bash
cd /var/www
git clone https://github.com/yourusername/mandarin.git
cd mandarin
```

### Copy Production Environment File
```bash
cp server/.env.production server/.env
```

### Install Dependencies
```bash
# Server dependencies
cd server
npm install

# Client dependencies and build
cd ../client
npm install
npm run build
```

## 3. Configure PM2

Create PM2 ecosystem file:

```bash
cd /var/www/mandarin
nano ecosystem.config.js
```

Add the following content:
```javascript
module.exports = {
  apps: [{
    name: 'mandarin-server',
    script: './server/server.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/pm2-err.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true
  }]
};
```

Start the application:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 4. Configure Nginx

Update nginx configuration:
```bash
sudo nano /etc/nginx/sites-available/flirtss
```

Use the configuration provided in `nginx-mandarin.conf`.

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/flirtss /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 5. Configure SSL with Certbot

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d flirtss.com -d www.flirtss.com
```

## 6. Set Up MongoDB

### Create Database User
```bash
mongosh
```

Inside MongoDB shell:
```javascript
use mandarin
db.createUser({
  user: "mandarinUser",
  pwd: "strongPasswordHere",
  roles: [{role: "readWrite", db: "mandarin"}]
})
```

Update the `MONGODB_URI` in your `.env.production` file:
```
MONGODB_URI=mongodb://mandarinUser:strongPasswordHere@localhost:27017/mandarin
```

## 7. Email Configuration (Resend)

The production environment is configured to use Resend automatically. Ensure your `.env.production` contains:

```
RESEND_API_KEY=re_7k4fkJua_N1aYoE2o8yNQvhTeuk32S5Ux
EMAIL_FROM=noreply@flirtss.com
EMAIL_FROM_NAME=Flirtss
```

## 8. Security Checklist

- [ ] Update all production secrets in `.env.production`
- [ ] Enable MongoDB authentication
- [ ] Set up firewall rules:
  ```bash
  sudo ufw allow 22/tcp      # SSH
  sudo ufw allow 80/tcp      # HTTP
  sudo ufw allow 443/tcp     # HTTPS
  sudo ufw enable
  ```
- [ ] Disable root SSH access
- [ ] Set up regular backups for MongoDB and uploaded files

## 9. Monitoring

### View Application Logs
```bash
# PM2 logs
pm2 logs

# Application logs
tail -f /var/www/mandarin/logs/server.log
tail -f /var/www/mandarin/logs/error.log
```

### Monitor Server Resources
```bash
pm2 monit
```

## 10. Maintenance Tasks

### Update the Application
```bash
cd /var/www/mandarin
git pull origin main

# Update server dependencies
cd server
npm install

# Rebuild client
cd ../client
npm install
npm run build

# Restart PM2
pm2 restart all
```

### Backup Database
```bash
mongodump --out /backup/$(date +%Y%m%d)
```

### Clear Old Logs
Add to crontab (`crontab -e`):
```
0 2 * * * find /var/www/mandarin/logs -type f -mtime +7 -delete
```

## 11. Environment Variables to Update

Before going live, update these production values in `.env.production`:

```
# Authentication Secrets (generate new ones)
JWT_SECRET=generate_new_secure_key
REFRESH_TOKEN_SECRET=generate_new_secure_key

# MongoDB (if using authentication)
MONGODB_URI=mongodb://user:password@localhost:27017/mandarin

# Redis (if using)
REDIS_PASSWORD=your_redis_password

# Push Notifications (if enabled)
VAPID_PUBLIC_KEY=generate_new_key
VAPID_PRIVATE_KEY=generate_new_key

# Email
RESEND_API_KEY=re_7k4fkJua_N1aYoE2o8yNQvhTeuk32S5Ux  # Already configured
```

## 12. Testing Production

1. Test email functionality:
   - User registration with email verification
   - Password reset emails
   - Notification emails

2. Test core features:
   - User login/logout
   - Photo uploads
   - Messaging
   - Photo permissions

3. Check logs for any errors:
   ```bash
   tail -f /var/www/mandarin/logs/error.log
   ```

## Troubleshooting

### Email Issues
- Check Resend dashboard for API logs
- Verify email addresses are configured correctly
- Check server logs for email sending errors

### Connection Issues
- Ensure ports are open in firewall
- Check nginx logs: `sudo tail -f /var/log/nginx/error.log`
- Verify SSL certificates are valid

### Database Issues
- Check MongoDB is running: `sudo systemctl status mongod`
- Verify database permissions
- Check connection string in `.env`