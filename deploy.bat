@echo off
REM 깃허브 푸시까지 자동
cd /d %~dp0
npm run deploy
pause
