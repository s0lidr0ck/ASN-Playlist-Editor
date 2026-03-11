# easyPanel Deployment Troubleshooting Guide

## Common easyPanel Issues & Solutions

### Issue 1: Port Configuration
easyPanel often expects specific port configurations. Try these:

**In your easyPanel App Settings:**
- Set `PORT` environment variable to `5000`
- Make sure the exposed port matches your app's internal port

### Issue 2: Build Context
easyPanel might need the Dockerfile in root. Make sure:
- Dockerfile is in the root directory of your project
- All paths in Dockerfile are relative to root

### Issue 3: Resource Limits
easyPanel might have memory/CPU limits:
- Use the minimal Dockerfile (Dockerfile.minimal)
- Reduce worker count in production configs

### Issue 4: Health Checks
Some easyPanel setups fail with health checks:
- Use docker-compose.simple.yml (no health checks)
- Remove HEALTHCHECK from Dockerfile

## Alternative Deployment Methods

### Method 1: Direct Python (No Docker)
If Docker isn't working, try direct Python deployment:

1. Upload these files to your server:
   - app.py
   - templates/index.html
   - requirements.txt (or requirements.minimal.txt)

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run directly:
   ```bash
   python app.py
   ```

### Method 2: GitHub Integration
1. Push your code to a GitHub repository
2. Connect easyPanel to your GitHub repo
3. Use auto-deployment from Git

### Method 3: Railway/Render Alternative
If easyPanel continues to fail, consider these alternatives:
- Railway.app (very simple Flask deployment)
- Render.com (free tier available)
- Vercel (with serverless functions)

## Debug Commands for easyPanel

If you have SSH access to your easyPanel server:

```bash
# Check if Docker is running
docker --version
docker ps

# Check container logs
docker logs [container-name]

# Check if port is accessible
netstat -tlnp | grep 5000

# Test the app directly
curl http://localhost:5000
```

## Simplified Configuration Files

Use these minimal files if the full deployment package isn't working:

1. **Dockerfile.minimal** - Simplest possible Docker setup
2. **docker-compose.simple.yml** - No health checks or advanced features
3. **requirements.minimal.txt** - Only essential dependencies

## easyPanel-Specific Environment Variables

Set these in your easyPanel app configuration:
```
FLASK_ENV=production
PORT=5000
PYTHONUNBUFFERED=1
```

## Still Not Working?

Please provide:
1. Error messages from easyPanel dashboard
2. Container logs (if available)
3. Your easyPanel deployment method (Docker, Git, Upload)
4. Any specific easyPanel error codes

This will help identify the exact issue!