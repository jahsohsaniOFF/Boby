@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion
title Installation Equicord (dev) + plugin Boby
cd /d "%~dp0"

rem Beaucoup d'installations Node.js sont "machine-wide" (Program Files) : corepack et
rem npm -g ont besoin des droits admin pour y ecrire leurs shims. On s'auto-elève une
rem bonne fois pour toutes pour eviter des echecs a moitie chemin.
net session >nul 2>nul
if not "%errorlevel%"=="0" (
    echo Ce script a besoin des droits administrateur ^(pour installer Node.js/Git et pnpm^).
    echo Une fenetre de confirmation Windows va s'ouvrir...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -ArgumentList '%*' -WorkingDirectory '%~dp0' -Verb RunAs" 2>nul
    if errorlevel 1 (
        echo(
        echo Elevation annulee ou impossible.
        echo Relance ce script via clic droit - "Executer en tant qu'administrateur".
        pause
    )
    exit /b
)

set "INSTALL_DIR=%USERPROFILE%\Desktop\Equicord"
set "EQUICORD_REPO=https://github.com/Equicord/Equicord.git"
set "PLUGIN_REPO=https://github.com/jahsohsaniOFF/Boby.git"
set "PLUGIN_DIR=%INSTALL_DIR%\src\userplugins\bobyEasterEggs"
set "DISCORD_BRANCH=auto"
if not "%~1"=="" set "DISCORD_BRANCH=%~1"
rem Corepack demande confirmation avant de telecharger une nouvelle version de pnpm ;
rem on la desactive pour rester 100% non-interactif.
set "COREPACK_ENABLE_DOWNLOAD_PROMPT=0"

echo(
echo ================================================
echo   Installation d'Equicord (dev) + plugin Boby
echo ================================================
echo(
echo Dossier d'installation : %INSTALL_DIR%
echo Branche Discord ciblee : %DISCORD_BRANCH%
echo(

call :kill_discord
echo(

call :refresh_path

echo [1/7] Verification de Git...
where git >nul 2>nul
if errorlevel 1 (
    echo       Git manquant, installation via winget...
    where winget >nul 2>nul
    if errorlevel 1 goto :winget_missing
    winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements --silent
    call :refresh_path
    where git >nul 2>nul
    if errorlevel 1 (
        echo       Git introuvable meme apres installation.
        echo       Ferme cette fenetre et relance le script une deuxieme fois
        echo       ^(le PATH de Windows a parfois besoin d'une nouvelle session^).
        goto :fail
    )
) else (
    echo       OK.
)

echo [2/7] Verification de Node.js ^(^>=22^)...
set "NEED_NODE=0"
where node >nul 2>nul
if errorlevel 1 (
    set "NEED_NODE=1"
) else (
    node -e "process.exit(Number(process.versions.node.split('.')[0])>=22?0:1)" >nul 2>nul
    if errorlevel 1 set "NEED_NODE=1"
)
if "%NEED_NODE%"=="1" (
    echo       Node.js manquant ou trop ancien, installation via winget...
    where winget >nul 2>nul
    if errorlevel 1 goto :winget_missing
    winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements --silent
    call :refresh_path
    where node >nul 2>nul
    if errorlevel 1 (
        echo       Node.js introuvable meme apres installation.
        echo       Ferme cette fenetre et relance le script une deuxieme fois
        echo       ^(le PATH de Windows a parfois besoin d'une nouvelle session^).
        goto :fail
    )
) else (
    echo       OK.
)

for /f "delims=" %%v in ('git --version') do echo       %%v
for /f "delims=" %%v in ('node -v') do echo       Node.js %%v

echo [3/7] Activation de pnpm ^(corepack^)...
call corepack enable >nul 2>nul
if errorlevel 1 (
    echo       corepack enable a echoue, tentative via npm...
    call npm install -g corepack >nul 2>nul
    call corepack enable
    if errorlevel 1 (
        echo       Impossible d'activer pnpm. Verifie que Node.js est bien installe.
        goto :fail
    )
)

echo [4/7] Recuperation d'Equicord...
if exist "%INSTALL_DIR%\.git" (
    pushd "%INSTALL_DIR%"
    git pull --ff-only
    set "GIT_ERR=!errorlevel!"
    popd
    if not "!GIT_ERR!"=="0" goto :fail
) else if exist "%INSTALL_DIR%" (
    echo(
    echo Le dossier %INSTALL_DIR% existe deja mais n'est pas un depot Equicord valide.
    echo Renomme-le ou deplace-le, puis relance ce script.
    goto :fail
) else (
    call :retry 3 git clone --depth 1 "%EQUICORD_REPO%" "%INSTALL_DIR%"
    if errorlevel 1 goto :fail
)

echo [5/7] Recuperation du plugin Boby...
if exist "%PLUGIN_DIR%\.git" (
    pushd "%PLUGIN_DIR%"
    git pull --ff-only
    set "GIT_ERR=!errorlevel!"
    popd
    if not "!GIT_ERR!"=="0" goto :fail
) else if exist "%PLUGIN_DIR%" (
    echo(
    echo Le dossier %PLUGIN_DIR% existe deja mais n'est pas un depot git valide.
    echo Renomme-le ou deplace-le manuellement, puis relance ce script.
    goto :fail
) else (
    call :retry 3 git clone "%PLUGIN_REPO%" "%PLUGIN_DIR%"
    if errorlevel 1 goto :fail
)

pushd "%INSTALL_DIR%"

echo [6/7] Installation des dependances ^(pnpm install^)...
call :retry 3 pnpm install
if errorlevel 1 goto :fail_popd

echo       Compilation d'Equicord ^(pnpm build^)...
call pnpm build
if errorlevel 1 goto :fail_popd

echo [7/7] Injection dans le client Discord ^(branche: %DISCORD_BRANCH%^)...
call :kill_discord
call node scripts\runInstaller.mjs -- --install --branch %DISCORD_BRANCH%
if errorlevel 1 goto :fail_popd

popd

echo(
echo ================================================
echo   Termine ! Relance Discord, le plugin Boby
echo   est dans Parametres - Equicord - Plugins.
echo ================================================
pause
exit /b 0

:fail_popd
popd
:fail
echo(
echo Un probleme est survenu, regarde le message d'erreur ci-dessus.
pause
exit /b 1

:winget_missing
echo(
echo winget est introuvable sur ce PC ^(necessite Windows 10 recent ou Windows 11^).
echo Installe "App Installer" depuis le Microsoft Store, ou installe Git et Node.js ^(^>=22^)
echo manuellement depuis git-scm.com et nodejs.org, puis relance ce script.
pause
exit /b 1

:kill_discord
echo Fermeture de Discord s'il est ouvert...
for %%D in (Discord.exe DiscordPTB.exe DiscordCanary.exe DiscordDevelopment.exe) do (
    taskkill /IM %%D /F >nul 2>nul
)
exit /b 0

:refresh_path
set "SYS_PATH="
set "USR_PATH="
for /f "tokens=2,*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYS_PATH=%%B"
for /f "tokens=2,*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USR_PATH=%%B"
set "PATH=%SYS_PATH%;%USR_PATH%"
call set "PATH=%PATH%"
exit /b 0

rem Reessaie une commande en cas d'echec (utile contre les erreurs reseau ponctuelles).
rem Usage : call :retry <nb_essais> <commande...>
:retry
setlocal EnableDelayedExpansion
set "ALL_ARGS=%*"
for /f "tokens=1*" %%A in ("!ALL_ARGS!") do (
    set "MAX_TRIES=%%A"
    set "CMD=%%B"
)
set "CMD_TRIES=0"
:retry_loop
set /a CMD_TRIES+=1
call !CMD!
if not errorlevel 1 (
    endlocal
    exit /b 0
)
if !CMD_TRIES! GEQ !MAX_TRIES! (
    endlocal
    exit /b 1
)
echo       Echec ^(tentative !CMD_TRIES!/!MAX_TRIES!^), nouvel essai dans 5s...
timeout /t 5 /nobreak >nul
goto :retry_loop
