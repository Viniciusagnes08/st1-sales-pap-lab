@echo off
setlocal
cd /d "%~dp0"
echo ST1 Sales PAP Lab ^| Verificacao de sistema
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js nao foi encontrado.
  echo Instale Node 22.16+ em nodejs.org
  pause
  exit /b 1
)
node --version
node --experimental-sqlite -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE t(a INTEGER)');db.close();console.log('SQLite: OK')"
if errorlevel 1 (
  echo Falha no SQLite nativo.
  pause
  exit /b 1
)
call npm test
if errorlevel 1 (
  echo Testes com erro. Nao prossiga para celulares.
  pause
  exit /b 1
)
call npm run smoke
if errorlevel 1 (
  echo Teste integrado HTTP falhou.
  pause
  exit /b 1
)
echo.
echo Web, SQLite e testes da API prontos. App nativo precisa de npm install na pasta mobile.
pause
