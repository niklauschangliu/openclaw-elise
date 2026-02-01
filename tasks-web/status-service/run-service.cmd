@echo off
setlocal

REM OpenClaw Tasks Web - Status Service (auto-start)

set PORT=8787
set GATEWAY_URL=ws://127.0.0.1:18789
set GATEWAY_TOKEN=b1093088093974424615f5d60971cd6eb37ee40849396ab4
set DASHBOARD_TOKEN=7a2ca866305a4767969ab1c93b7f7145

cd /d C:\Users\elise\.openclaw\workspace\tasks-web\status-service

node index.js
