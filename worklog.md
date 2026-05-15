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
