# Ngrok in Production Deployment - Issue and Fix

## Problem

The GitLab CI/CD pipeline is configured to use an **ngrok URL** for the infrastructure orchestrator webhook, which is incorrect for cloud deployments.

### Error Message
```
❌ Webhook call failed with status 404: Not Found
   URL: https://b5cefeed5009.ngrok-free.app/webhooks/gitlab-deploy
   Error details: The endpoint b5cefeed5009.ngrok-free.app is offline.
ERR_NGROK_3200
```

## Why This Is Wrong

### What is ngrok?
- **ngrok** is a tunneling service for **local development**
- It creates temporary public URLs that tunnel to your local machine
- URLs are temporary and change when ngrok restarts
- Not suitable for production/cloud deployments

### Why It's Being Used
The `ORCHESTRATOR_URL` GitLab CI/CD variable is set to an ngrok URL, which was likely used during:
- Local development/testing
- Initial setup/testing of the orchestrator
- Development environment setup

### Why It Fails in Production
1. **Temporary URLs**: ngrok URLs expire when the tunnel is closed
2. **Not accessible from CI**: GitLab runners can't reach your local machine
3. **Unreliable**: ngrok free tier has limitations and downtime
4. **Security**: Exposes local development to the internet

## Solution

### Step 1: Identify the Correct Orchestrator URL

The infrastructure orchestrator should be deployed as an **Azure service**. Possible options:

1. **Azure Container Apps** (recommended)
   - URL format: `https://<app-name>.<region>.azurecontainerapps.io`
   - Example: `https://infra-orchestrator.eastus.azurecontainerapps.io`

2. **Azure App Service**
   - URL format: `https://<app-name>.azurewebsites.net`
   - Example: `https://infra-orchestrator.azurewebsites.net`

3. **Azure Kubernetes Service (AKS) with Ingress**
   - URL format: `https://<ingress-domain>`
   - Example: `https://orchestrator.yourdomain.com`

4. **Internal Azure Service** (if using private endpoints)
   - May require VPN or private network access
   - Use Azure Private Link or VNet integration

### Step 2: Update GitLab CI/CD Variable

1. Go to your GitLab project
2. Navigate to **Settings → CI/CD → Variables**
3. Find the `ORCHESTRATOR_URL` variable
4. Update it to the correct Azure service URL:
   ```
   https://your-orchestrator-service.azurecontainerapps.io
   ```
   or
   ```
   https://your-orchestrator-service.azurewebsites.net
   ```

5. **Remove or update** any ngrok-related variables

### Step 3: Verify the Orchestrator is Deployed

Ensure your infrastructure orchestrator service is:
- ✅ Deployed to Azure
- ✅ Accessible from the internet (or GitLab runners)
- ✅ Has the webhook endpoint: `/webhooks/gitlab-deploy`
- ✅ Running and healthy

### Step 4: Test the Webhook

Test the webhook manually:
```bash
curl -X POST https://your-orchestrator-service.azurecontainerapps.io/webhooks/gitlab-deploy \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "77122801",
    "project_name": "irmai-kg-v2-surrealdb",
    "image": "irmaiuatregistry.azurecr.io/irmai-kg-v2-surrealdb:latest",
    "cluster_name": "rg-irmai-uat-us-1-cluster",
    "namespace": "default",
    "resource_group": "rg-irmai-uat-us-1"
  }'
```

## Configuration Checklist

- [ ] Infrastructure orchestrator deployed to Azure
- [ ] Orchestrator has public endpoint (or accessible from GitLab runners)
- [ ] Webhook endpoint `/webhooks/gitlab-deploy` is implemented
- [ ] `ORCHESTRATOR_URL` GitLab variable updated to Azure service URL
- [ ] Removed any ngrok URLs from GitLab variables
- [ ] Tested webhook manually
- [ ] Verified deployment pipeline works

## Current Configuration (Wrong)

```yaml
# GitLab CI/CD Variable (WRONG)
ORCHESTRATOR_URL=https://b5cefeed5009.ngrok-free.app
```

## Correct Configuration

```yaml
# GitLab CI/CD Variable (CORRECT)
ORCHESTRATOR_URL=https://infra-orchestrator.eastus.azurecontainerapps.io
# OR
ORCHESTRATOR_URL=https://infra-orchestrator.azurewebsites.net
```

## Best Practices

1. **Never use ngrok in production**
   - Only for local development
   - Use proper cloud services for production

2. **Use environment-specific URLs**
   - Development: Local or dev Azure service
   - Staging: Staging Azure service
   - Production: Production Azure service

3. **Secure the webhook**
   - Use authentication tokens
   - Validate webhook signatures
   - Use HTTPS only

4. **Monitor the orchestrator**
   - Set up health checks
   - Monitor uptime
   - Alert on failures

## Troubleshooting

### If orchestrator is not deployed yet:

1. **Deploy the orchestrator first**
   - Deploy to Azure Container Apps or App Service
   - Ensure it's accessible from the internet

2. **Update GitLab variable after deployment**
   - Get the public URL from Azure Portal
   - Update `ORCHESTRATOR_URL` in GitLab

3. **Test the deployment**
   - Run the GitLab pipeline
   - Check orchestrator logs

### If you need to use ngrok temporarily:

⚠️ **Only for emergency/testing - NOT for production**

1. Start ngrok locally:
   ```bash
   ngrok http 8080
   ```

2. Update GitLab variable temporarily:
   ```
   ORCHESTRATOR_URL=https://<ngrok-url>.ngrok-free.app
   ```

3. **Remember to switch back** to Azure service URL!

## Related Files

- `.gitlab-ci.yml` - CI/CD pipeline configuration
- GitLab CI/CD Variables (Settings → CI/CD → Variables)

## Summary

**Problem**: Using ngrok (local dev tool) in cloud deployment  
**Solution**: Update `ORCHESTRATOR_URL` GitLab variable to point to Azure service  
**Action**: Deploy orchestrator to Azure and update the variable

