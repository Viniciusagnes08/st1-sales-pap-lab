@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo ERRO: Node.js nao encontrado.
  echo Instale Node.js 22.16 ou mais recente em https://nodejs.org/
  echo Depois feche e abra este arquivo novamente.
  pause
  exit /b 1
)
node --experimental-sqlite -e "require('node:sqlite').DatabaseSync" >nul 2>&1
if errorlevel 1 (
  echo ERRO: Esta versao do Node.js nao suporta SQLite nativo.
  echo Instale a versao LTS recente em https://nodejs.org/
  pause
  exit /b 1
)
echo.
echo ============================================
echo    ST1 SALES - PAP LAB    [AMBIENTE LOCAL]
echo ============================================
echo.
echo Abra no navegador: http://127.0.0.1:4173
echo Para encerrar, pressione CTRL+C nesta janela.
echo.
start "" /min cmd /c "timeout /t 3 /nobreak >nul & start http://127.0.0.1:4173"
node --experimental-sqlite server\index.mjs
if errorlevel 1 (
  echo.
  echo Nao foi possivel iniciar. Verifique se a porta 4173 esta disponivel.
  pause
)
