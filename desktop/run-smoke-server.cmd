@echo off
set PORT=4380
set HOSTNAME=127.0.0.1
set NODE_ENV=production
set IRONZ_SQLITE=1
set APP_URL=http://127.0.0.1:4380
set DATABASE_URL=file:C:/Users/imadj/Desktop/app-ironz/application-ironz/desktop/template/smoke.db
set PRISMA_QUERY_ENGINE_LIBRARY=C:\Users\imadj\Desktop\app-ironz\application-ironz\src\generated\prisma-desktop\query_engine-windows.dll.node
cd /d C:\Users\imadj\Desktop\app-ironz\application-ironz\.next\standalone
start "ironz-smoke" /min node server.js
