# Quick Setup Guide - Separate Deployment

## Step 1: Deploy Backend on Render

1. **Go to Render.com** and sign up/login
2. **Click "New +" → "Web Service"**
3. **Connect your GitHub repository** (`zia_connector`)
4. **Configure:**
   - **Name:** `zia-amplifi-backend`
   - **Region:** Choose closest to you
   - **Branch:** `main`
   - **Root Directory:** (leave empty - root of repo)
   - **Environment:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Plan:** Free (or paid if you want)

5. **Add Environment Variables** (in Render dashboard):
   - `MONGODB_URL` - Your MongoDB connection string
   - `SECRET_KEY` - Generate with: `python -c "import secrets; print(secrets.token_urlsafe(32))"`
   - `AMPLIFI_API_URL` - Your Amplifi API URL
   - `AMPLIFI_USERNAME` - Amplifi username
   - `AMPLIFI_PASSWORD` - Amplifi password
   - `AMPLIFI_CHAT_APP_ID` - Amplifi chat app ID
   - `AMPLIFI_CHAT_SESSION_ID` - Amplifi chat session ID
   - `DATABASE_NAME` - `zia_amplifi_db` (optional)
   - `FRONTEND_URL` - Leave empty for now, add after frontend is deployed

6. **Click "Create Web Service"**
7. **Wait for deployment** (takes 2-5 minutes)
8. **Copy your backend URL** (e.g., `https://zia-amplifi-backend.onrender.com`)

## Step 2: Update Backend CORS

1. **Go back to Render dashboard**
2. **Environment tab**
3. **Add/Update:** `FRONTEND_URL` = `https://your-frontend.vercel.app` (you'll get this in step 3)

## Step 3: Deploy Frontend on Vercel

1. **Go to Vercel Dashboard**
2. **Import your GitHub repository** (if not already imported)
3. **Go to Project Settings → Environment Variables**
4. **Add:**
   - `REACT_APP_API_URL` = `https://your-backend.onrender.com` (from Step 1)
5. **Redeploy** (or push a commit to trigger deployment)

## Step 4: Update Backend with Frontend URL

1. **Go back to Render**
2. **Update `FRONTEND_URL`** environment variable with your Vercel frontend URL
3. **Redeploy** (or it will auto-redeploy)

## Step 5: Test

1. Visit your Vercel frontend URL
2. Try to sign up/login
3. Check Render logs if there are any issues

## Troubleshooting

### Backend not starting?
- Check Render logs for errors
- Verify all environment variables are set
- Make sure `requirements.txt` is in the root directory

### CORS errors?
- Make sure `FRONTEND_URL` in Render matches your Vercel URL exactly
- Check that `REACT_APP_API_URL` in Vercel matches your Render URL

### 500 errors?
- Check Render logs
- Verify MongoDB connection string is correct
- Check that all Amplifi credentials are correct

## Notes

- Render free tier spins down after 15 minutes of inactivity (cold start ~30 seconds)
- For production, consider Render paid tier or Railway/Fly.io
- Both services auto-deploy on git push to main branch

