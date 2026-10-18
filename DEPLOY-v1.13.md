# Meridian v1.13: reminder fix only

Your v1.12 app, unchanged, with the push system replaced. Ship this first and prove a
notification reaches your phone before deploying v2.0.

## What changed
- The phone now asks the server for the public key instead of using one hard-coded in
  the app. The server derives it from VAPID_PRIVATE_KEY, so the two can never disagree.
  (A mismatch between those keys is the most likely reason no notification ever arrived:
  Apple rejects the push silently and v1.12 only logged the failure in Netlify.)
- If the phone subscribed with an old key, it is replaced automatically.
- New function `push-test`: lets the app send a test now and report the exact result.
- `daily-reminder` now runs hourly and sends at 8pm in your phone's timezone, so it no
  longer drifts to 7pm in winter. Every run is logged where the app can read it.
- The bottom pill opens a checklist showing which link in the chain is broken. It stays
  until you tap "It arrived. Hide this."

## Deploy
1. Overwrite the whole repo folder with this one (GitHub Desktop preferred). The
   `netlify/functions` and `netlify/lib` folders must arrive nested exactly as they are.
   If the web uploader flattens them, the reminder service will not exist.
2. In Netlify: Site configuration, Environment variables. Check `VAPID_PRIVATE_KEY` exists.
   If the reminder checklist later says it is missing or invalid, set it to:

   `Y0kVko2i-KGLoxzHKIpNV8JOg2KOY7f5gbL4mSqMSQ8`

   (Any valid key works now. Changing it simply makes the phone re-register.)
3. Deploy, then open Meridian **from the home screen icon**. Footer reads **Meridian v1.13**.
4. Tap the pill, then Turn on reminders, then Send test notification. Lock the phone.

## What each failure means
- "Reminder service is not deployed": the functions folder did not upload. Re-upload with nesting intact.
- "VAPID_PRIVATE_KEY is not set" or "decodes to N bytes": fix the env var (step 2), redeploy.
- "Opened from the home screen icon" shows ✕: you are in Safari. Use the icon.
- Permission "denied": iPhone Settings, Notifications, Meridian, allow.
- Status 403 from the push service: key problem. Tap Re-register this phone.
- "Hourly scheduler has run" stays on … for more than an hour: scheduled functions are not
  running. Check Netlify, Logs, Functions, `daily-reminder`.
