---
Task ID: 1
Agent: Main
Task: Fix blank page issue for MatkaKing application

Work Log:
- Investigated why the preview was showing a blank page
- Found that the dev server was crashing within 30-60 seconds due to memory exhaustion
- Root cause: The Next.js dev server with large components (AppShell.tsx: 2443 lines, store/index.ts: 1325 lines) was consuming 1.1GB+ RAM after compiling just one page
- The middleware.ts was using deprecated convention (should be proxy.ts in Next.js 16) and had a setInterval memory leak
- Several unused heavy dependencies (@mdxeditor/editor, next-auth, next-intl, react-syntax-highlighter) were adding ~200MB+ to compilation

Fixes Applied:
1. Increased Node.js heap size from 2048MB to 4096MB in package.json
2. Removed unused heavy dependencies: @mdxeditor/editor, next-auth, next-intl, react-syntax-highlighter
3. Migrated middleware.ts → proxy.ts with proper Next.js 16 convention (export function proxy instead of export function middleware)
4. Removed setInterval memory leak from proxy.ts, replaced with lazy cleanup
5. Added AUTH_SECRET to .env file (was missing, causing warnings)
6. Used setsid + nohup to start the dev server as a detached process that survives shell session termination
7. Created keep-alive.sh script with auto-restart loop

Stage Summary:
- Dev server is now stable and running for 2+ minutes without crashing
- Page loads correctly through Caddy gateway (28921 bytes HTML)
- All JavaScript chunks (page.js: 310KB, LoginPage: 2MB) are being served correctly
- Email and SMS API configurations were NOT modified (preserved as requested)

---
Task ID: 2
Agent: Main
Task: Add SMS OTP API credentials back to .env file

Work Log:
- User reported OTPs not being received and SMS curl was removed
- Investigated the OTP system in src/lib/otp.ts - code was correct but env vars were missing
- Found .env file only had DATABASE_URL and AUTH_SECRET
- Added START_MSG_API_KEY and START_MSG_TEMPLATE_ID to .env file from user's curl command
- Tested OTP sending with curl - first got "No account found" (correct for login purpose)
- Tested with register purpose - got success response
- Dev server log confirmed: [OTP] SMS OTP sent to 9650130127
- Email API configuration (email.ts) was NOT modified

Stage Summary:
- SMS OTP API is now working: credentials added to .env
  - START_MSG_API_KEY=sm_live_f69892883c5324434cb2e7a5492d2614f1ace294
  - START_MSG_TEMPLATE_ID=0afbdeb0-785d-4dd0-bd48-365a182df276
- OTPs are being sent successfully via Start Messaging API
- Email API config preserved as-is (no changes)

---
Task ID: 3
Agent: Main
Task: Fix registration and forgot-password errors showing "Invalid credentials" instead of actual error messages

Work Log:
- User reported errors during account creation and forgot-password flow
- Analyzed screenshot: error showed "Invalid credentials. Please check and try again."
- Traced the error to robustFetch utility in src/lib/fetch.ts
- Root cause: robustFetch has default noRetryStatuses = [401, 403, 404, 422] - it THROWS immediately for these status codes without returning the response body
- The API routes for register/forgot-password/send-otp were using 401/403/404 status codes for validation errors
- When robustFetch throws, the frontend catch block uses getFetchErrorMessage() which maps 401 to "Invalid credentials" - the actual API error message is lost

Fixes Applied:
1. src/app/api/auth/register/route.ts: Changed OTP validation error from status 401 → 400
2. src/app/api/auth/forgot-password/route.ts: Changed OTP validation errors from status 401 → 400 (2 places)
3. src/app/api/auth/send-otp/route.ts: Changed validation errors:
   - "No account found" for login: 404 → 400
   - "Account is deactivated": 403 → 400
   - "No account found" for forgot-password: 404 → 400
   - SMS API errors: 429 → 400
4. Status code 400 (Bad Request) is NOT in robustFetch's noRetryStatuses, so the response is properly returned and the frontend can read the actual error message

Testing:
- curl test: register with wrong OTP → 400 + "No OTP found. Please request a new OTP."
- curl test: forgot-password with wrong OTP → 400 + "No OTP found. Please request a new OTP."
- curl test: send-otp for non-existent user → 400 + "No account found with this mobile number"
- lint check passes clean

Stage Summary:
- Registration and forgot-password now show proper error messages (e.g., "Invalid OTP", "No OTP found")
- No more generic "Invalid credentials" error for OTP validation failures
- Email and SMS API configurations were NOT modified
