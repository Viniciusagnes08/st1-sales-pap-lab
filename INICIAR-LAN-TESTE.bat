@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo ERRO: Instale Node.js 22.16+ em https://nodejs.org/
  pause
  exit /b 1
)
node --experimental-sqlite -e "require('node:sqlite').DatabaseSync" >nul 2>&1
if errorlevel 1 (
  echo ERRO: Node.js sem suporte ao SQLite nativo.
  pause
  exit /b 1
)
set PAP_MOBILE_LAN=1
set PAP_MOBILE_PORT=4174
echo ===============================================
echo ST1 SALES PAP ^| HOMOLOGACAO - WEB + CELULAR
 echo WEB ADMIN:  http://127.0.0.1:4173 (somente PC)
echo API MOBILE: http://IP-DESTE-PC:4174 (rede local)
echo ===============================================
echo.
echo ATENCAO: MODO LAN HTTP PARA TESTES CONTROLADOS.
echo NAO use com dados pessoais reais sem uma conexao HTTPS adequada.
echo NAO crie redirecionamento de portas para a internet.
echo.
echo Execute ^"ipconfig^" em outro terminal e procure Endereco IPv4.
echo Verifique se o Firewall permite a porta 4174 apenas em rede privada.
echo.
echo O painel Web nao sera exposto a outros computadores.
echo Pressione CTRL+C para encerrar.
echo.
start "" /min cmd /c "timeout /t 3 /nobreak >nul & start http://127.0.0.1:4173"
node --experimental-sqlite server\index.mjs
if errorlevel 1 pause
