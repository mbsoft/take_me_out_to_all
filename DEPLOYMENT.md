# GCP Deployment Guide

## Overview

This guide explains how to deploy the MLB Ballpark Itinerary Planner to Google Cloud Platform using Cloud Run (serverless containers) with Terraform for infrastructure management. The deployment is optimized to stay within GCP's free tier limits.

## Architecture

- **Compute:** Cloud Run (serverless, 2M requests/month free)
- **Database:** Supabase PostgreSQL (external, 500MB free tier)
- **Storage:** Supabase Storage (external, 1GB free tier)
- **Container Registry:** Artifact Registry (0.5GB free)
- **Secrets:** Secret Manager (6 secret versions free)
- **IaC:** Terraform modules
- **CI/CD:** Cloud Build (120 build-minutes/day free)

**Estimated Monthly Cost:** $0 (within free tier limits for moderate traffic)

## Prerequisites

### Required Tools

1. **gcloud CLI** - [Install Guide](https://cloud.google.com/sdk/docs/install)
   ```bash
   # Verify installation
   gcloud --version
   ```

2. **Terraform >= 1.5.0** - [Install Guide](https://terraform.io/downloads)
   ```bash
   # Verify installation
   terraform --version
   ```

3. **Docker Desktop** - [Install Guide](https://docker.com/get-started)
   ```bash
   # Verify installation
   docker --version
   ```

4. **Node.js 18+** - [Install Guide](https://nodejs.org/)
   ```bash
   # Verify installation
   node --version
   npm --version
   ```

### GCP Account Setup

1. Create a GCP account at [cloud.google.com](https://cloud.google.com)
2. Create a new project or select an existing one
3. Enable billing (required even for free tier resources)
4. Note your Project ID (you'll need this)

### Supabase Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Navigate to SQL Editor and run [src/lib/schema.sql](src/lib/schema.sql)
3. Run the OAuth support migration: [scripts/migrations/add_oauth_support.sql](scripts/migrations/add_oauth_support.sql)
   - This makes `password_hash` nullable for Google OAuth users
4. Copy your project URL and service role key from Settings > API

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select your existing GCP project
3. Enable the Google+ API:
   - Navigate to "APIs & Services" → "Library"
   - Search for "Google+ API" and enable it
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client ID"
   - Application type: "Web application"
   - Name: "MLB Itinerary Planner"
   - Authorized redirect URIs:
     - Development: `http://localhost:3000/api/auth/callback/google`
     - Production: `https://your-domain.com/api/auth/callback/google`
   - Click "Create"
5. Copy the Client ID and Client Secret (you'll need these for `.env.local`)

### Environment Variables

Create a [.env.local](.env.local) file in the project root with your credentials:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# NextAuth (generate a random 64-char string for production)
NEXTAUTH_SECRET=your-random-64-character-secret
NEXTAUTH_URL=http://localhost:3000

# Google OAuth (for SSO authentication)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# External APIs
SEATGEEK_CLIENT_ID=your-seatgeek-client-id
SEATGEEK_CLIENT_SECRET=your-seatgeek-client-secret
NEXT_PUBLIC_NBAI_API_KEY=your-nextbillion-ai-api-key
```

Generate a secure NextAuth secret:
```bash
openssl rand -base64 64
```

## Initial Deployment

### Step 1: Install Dependencies

```bash
npm install
```

This will install the updated dependencies including the `@types/three` package needed for the build.

### Step 2: Seed Database

Ensure your Supabase database is set up with the schema, then seed the data:

```bash
npm run seed
```

This will populate the `teams` and `games` tables with MLB data.

### Step 3: GCP Project Setup

Run the setup script to enable required APIs and create infrastructure:

```bash
./scripts/gcp-setup.sh
```

This script will:
- Enable Cloud Run, Artifact Registry, Secret Manager, Cloud Build APIs
- Create an Artifact Registry repository for Docker images
- Configure Docker authentication for GCP

Enter your GCP Project ID when prompted.

### Step 4: Create Secrets

Upload your environment variables to Google Secret Manager:

```bash
./scripts/create-secrets.sh
```

This reads your [.env.local](.env.local) file and creates secrets in Secret Manager.

### Step 5: Build and Push Docker Image

Build your Docker image and push it to Artifact Registry:

```bash
./scripts/build-and-push.sh
```

This uses the optimized multi-stage Dockerfile to create a production image (~150MB).

### Step 6: Deploy with Terraform

Deploy the Cloud Run service and configure all resources:

```bash
cd terraform

# Copy example variables
cp terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars with your actual values
# At minimum, update:
# - project_id
# - region (default: us-central1)
# - container_image (get from previous step output)
# - All secret values (from .env.local)

# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Deploy
terraform apply
```

Type `yes` when prompted to confirm deployment.

### Step 7: Verify Deployment

Get your Cloud Run URL:

```bash
terraform output cloud_run_url
```

Test the deployment:

```bash
# Check health
curl -I https://your-service-url.run.app

# Test API endpoint
curl https://your-service-url.run.app/api/teams
```

Visit the URL in your browser to access the application.

### Step 8: Update NEXTAUTH_URL

Update the `nextauth-secret` in Secret Manager with your actual Cloud Run URL:

```bash
# Get your Cloud Run URL from terraform output
CLOUD_RUN_URL=$(cd terraform && terraform output -raw cloud_run_url)

# Update the secret (note: this is a workaround, you should update terraform.tfvars and reapply)
echo "You'll need to update terraform.tfvars with the Cloud Run URL and reapply"
```

**Better approach:** Update [terraform/terraform.tfvars](terraform/terraform.tfvars) with a variable for `nextauth_url` or handle this in the Cloud Run module.

## Subsequent Deployments

### Quick Update

When you make code changes:

```bash
# Build and push new image
# Note: This reads NEXT_PUBLIC_* variables from .env.local and passes them at build time
./scripts/build-and-push.sh v1.0.1

# Update Cloud Run service (if using Terraform)
cd terraform
terraform apply -var="container_image=NEW_IMAGE_URL"
```

**Important:** The build script requires `.env.local` to contain `NEXT_PUBLIC_NBAI_API_KEY` and `NEXT_PUBLIC_SUPABASE_URL` because Next.js inlines these into the JavaScript bundle at build time. Runtime secrets won't work for `NEXT_PUBLIC_*` variables.

### Using CI/CD (Optional)

Set up Cloud Build trigger for automatic deployments:

```bash
gcloud builds triggers create github \
  --name="deploy-mlb-itinerary" \
  --repo-name="take_me_out_to_all" \
  --repo-owner="YOUR_GITHUB_USERNAME" \
  --branch-pattern="^main$" \
  --build-config="cloudbuild.yaml" \
  --region="us-central1"
```

Now every push to `main` branch will automatically build and deploy!

## Local Testing with Docker

Test your Docker build locally before deploying:

```bash
./scripts/test-local-docker.sh
```

Visit [http://localhost:3000](http://localhost:3000) to test the containerized app.

## Monitoring and Cost Management

### View Logs

```bash
gcloud run logs read mlb-itinerary-prod \
  --region us-central1 \
  --limit 50 \
  --format=json
```

### Monitor Metrics

Visit the Cloud Run console:
```bash
gcloud run services describe mlb-itinerary-prod \
  --region us-central1 \
  --format=yaml
```

Or use the web console: [Cloud Run Services](https://console.cloud.google.com/run)

### Free Tier Limits

Monitor your usage to stay within free tier:

| Service | Free Tier | Monitoring |
|---------|-----------|-----------|
| Cloud Run | 2M requests/month | [Cloud Run Metrics](https://console.cloud.google.com/run) |
| Cloud Run | 360k GB-seconds | Check "Memory usage" in metrics |
| Artifact Registry | 0.5GB storage | [Artifact Registry](https://console.cloud.google.com/artifacts) |
| Secret Manager | 6 secret versions | [Secret Manager](https://console.cloud.google.com/security/secret-manager) |
| Cloud Build | 120 minutes/day | [Cloud Build History](https://console.cloud.google.com/cloud-build/builds) |

### Cost Optimization Tips

1. **Keep min_instances at 0** - Allows service to scale to zero when not in use
2. **Set appropriate memory limits** - 512Mi is sufficient for Next.js
3. **Enable CPU throttling** - `cpu_idle = true` in Terraform config
4. **Use Artifact Registry cleanup policy** - Automatically removes old images
5. **Monitor Cloud Build usage** - Stay within 120 minutes/day limit

## Troubleshooting

### Build Failures

**Issue:** Docker build fails with "Cannot find module"

**Solution:** Ensure all dependencies are installed locally first:
```bash
npm install
```

**Issue:** Build exceeds free tier time limit

**Solution:** Use `--cache-from` flag (already configured in [build-and-push.sh](scripts/build-and-push.sh))

### Deployment Issues

**Issue:** "Permission denied" error

**Solution:** Ensure your gcloud account has necessary permissions:
```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

**Issue:** Cloud Run service fails to start

**Solution:** Check logs for errors:
```bash
gcloud run logs read mlb-itinerary-prod --region us-central1 --limit 50
```

Common causes:
- Missing environment variables
- Database connection issues (check Supabase URL/key)
- Port configuration (ensure app listens on port 3000)

### Secret Manager Issues

**Issue:** "Secret not found" error

**Solution:** Verify secrets exist:
```bash
gcloud secrets list
```

Recreate secrets if needed:
```bash
./scripts/create-secrets.sh
```

**Issue:** "Permission denied to access secret"

**Solution:** Grant Cloud Run service account access:
```bash
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding SECRET_NAME \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Database Connection Issues

**Issue:** "Connection refused" or "Database error"

**Solution:** Verify Supabase credentials:
1. Check [.env.local](.env.local) has correct Supabase URL and key
2. Verify secrets were created: `gcloud secrets versions list supabase-url`
3. Test Supabase connection locally: `npm run dev`

**Issue:** "Table does not exist"

**Solution:** Run database schema and migrations:
```bash
# In Supabase SQL Editor, run:
# 1. src/lib/schema.sql
# 2. scripts/migrations/*.sql

# Then seed data:
npm run seed
```

### Terraform Issues

**Issue:** "Backend configuration changed"

**Solution:** Reinitialize Terraform:
```bash
cd terraform
terraform init -reconfigure
```

**Issue:** "Resource already exists"

**Solution:** Import existing resource:
```bash
terraform import MODULE.RESOURCE RESOURCE_ID
```

Or destroy and recreate:
```bash
terraform destroy
terraform apply
```

## Rollback Procedure

If a deployment fails or causes issues:

### Rollback Cloud Run Deployment

```bash
# List revisions
gcloud run revisions list \
  --service mlb-itinerary-prod \
  --region us-central1

# Rollback to previous revision
gcloud run services update-traffic mlb-itinerary-prod \
  --to-revisions PREVIOUS_REVISION=100 \
  --region us-central1
```

### Rollback with Terraform

```bash
cd terraform

# Revert to previous image
terraform apply -var="container_image=OLD_IMAGE_URL"
```

## Production Checklist

Before going to production, ensure:

- [ ] Supabase database schema deployed
- [ ] Database seeded with teams and games data
- [ ] All secrets created in Secret Manager with production values
- [ ] NextAuth secret is a cryptographically secure random string
- [ ] NEXTAUTH_URL matches actual Cloud Run URL
- [ ] Docker image built and pushed successfully
- [ ] Terraform applied without errors
- [ ] Health checks passing (curl test succeeds)
- [ ] Can login and create test itinerary
- [ ] External APIs working (SeatGeek, NextBillion.ai)
- [ ] Custom domain configured (optional)
- [ ] Monitoring alerts set up (optional)
- [ ] Backup strategy defined (optional)

## Advanced Configuration

### Custom Domain

To use a custom domain:

1. Verify domain ownership in GCP
2. Update [terraform/terraform.tfvars](terraform/terraform.tfvars):
   ```hcl
   domain_name = "yourdomain.com"
   ```
3. Apply Terraform:
   ```bash
   cd terraform && terraform apply
   ```
4. Configure DNS records as shown in Cloud Run console

### Multi-Environment Setup

Create separate environments:

```bash
# Development
terraform workspace new dev
terraform apply -var-file="environments/dev.tfvars"

# Production
terraform workspace new prod
terraform apply -var-file="environments/prod.tfvars"
```

### Automated Backups

Set up Supabase automated backups or implement your own:

```bash
# Example: Export database via Supabase CLI
supabase db dump --db-url "postgresql://..."
```

### Monitoring Alerts

Set up Cloud Monitoring alerts:

```bash
# Example: Alert on high error rate
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="High Error Rate" \
  --condition-display-name="Error rate > 5%" \
  --condition-threshold-value=5 \
  --condition-threshold-duration=300s
```

## Security Best Practices

1. **Never commit secrets** - Use `.env.local` (gitignored) or Secret Manager
2. **Rotate secrets regularly** - Update secrets in Secret Manager periodically
3. **Use service accounts** - Grant minimum necessary permissions
4. **Enable Artifact Registry scanning** - Scan images for vulnerabilities
5. **Restrict Cloud Run access** - Set `allow_unauthenticated = false` if needed
6. **Use VPC connector** - For private database connections (not needed with Supabase)
7. **Enable audit logging** - Track all API calls and changes

## Support and Resources

- **GCP Documentation:** [cloud.google.com/docs](https://cloud.google.com/docs)
- **Terraform GCP Provider:** [registry.terraform.io/providers/hashicorp/google](https://registry.terraform.io/providers/hashicorp/google/latest/docs)
- **Cloud Run Docs:** [cloud.google.com/run/docs](https://cloud.google.com/run/docs)
- **Next.js Deployment:** [nextjs.org/docs/deployment](https://nextjs.org/docs/deployment)
- **Supabase Docs:** [supabase.com/docs](https://supabase.com/docs)

## Contributing

When making infrastructure changes:

1. Test locally with `./scripts/test-local-docker.sh`
2. Update Terraform configurations
3. Run `terraform plan` to preview changes
4. Document changes in this file
5. Create a pull request

## License

This deployment configuration is part of the Take Me Out to the Ballparks project. See [LICENSE](LICENSE) for details.
