<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# AstroAI — Intelligent Astrology System

This repository contains everything you need to run the app locally and deploy it.

Access the deployed project: https://astroai-intelligent-astrology-syste.vercel.app/

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy On A Different Firebase Account

1. Re-authenticate to the target Firebase account:
   `npm run firebase:login`

2. Select the target Firebase project ID:
   `npm run firebase:use`

3. Copy the selected project's web app config from Firebase Console:
   Project settings -> General -> Your apps -> SDK setup and configuration -> Config

4. Replace values in `firebase-applet-config.json` with the target project's config.

5. Update `.firebaserc` so `projects.default` matches the target project ID.

6. Deploy hosting and Firestore rules:
   `npm run firebase:deploy`

If Firestore rules deploy fails due billing/default database constraints, deploy Hosting only:
`npm run firebase:deploy:hosting`

For full-stack deployment (frontend + /api endpoints via Firebase Functions):
`npm run firebase:deploy:full`

## Deploy On Vercel (Frontend + API)

This project is configured for Vercel with:
- Static frontend output from Vite (`dist`)
- Serverless API endpoints under `/api/*`

Steps:
1. Login to Vercel:
   `npx vercel login`
2. Deploy to production:
   `npm run vercel:deploy`

Environment variables on Vercel:
- `GEMINI_API_KEY` (required for live Gemini responses)

If `GEMINI_API_KEY` is not set, API routes return safe fallback astrology responses so the app remains functional for demos.

Notes:
- If you have not created a web app in the target Firebase project yet, create one first in Firebase Console.
- Keep `firebase-applet-config.json` consistent with `.firebaserc` to avoid auth/database mismatches.
