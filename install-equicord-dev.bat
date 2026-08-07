@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Installation Equicord (dev) + plugin Boby
cd /d "%~dp0"

set "INSTALL_DIR=%USERPROFILE%\Desktop\Equicord"
set "EQUICORD_REPO=https://github.com/Equicord/Equicord.git"
set "PLUGIN_REPO=https://github.com/jahsohsaniOFF/Boby.git"
set "PLUGIN_DIR=%INSTALL_DIR%\src\userplugins\bobyEasterEggs"
set "PNPM_VERSION=11.17.0"
set "DISCORD_BRANCH=auto"

echo(
echo ================================================
echo   Installation d'Equicord (dev) + plugin Boby
echo ================================================
echo(
echo Dossier d'installation : %INSTALL_DIR%
echo(

echo Fermeture de Discord s'il est ouvert...
taskkill /IM Discord.exe /F >nul 2>nul
echo(

call :refresh_path

echo [1/7] Verification de Git...
where git >nul 2>nul
if errorlevel 1 (
    echo       Git manquant, installation via winget...
    where winget >nul 2>nul
    if errorlevel 1 goto :winget_missing
    winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements --silent
    if errorlevel 1 goto :fail
    call :refresh_path
    where git >nul 2>nul
    if errorlevel 1 (
        echo       Git installe mais introuvable dans cette fenetre.
        echo       Ferme cette fenetre et relance le script une deuxieme fois.
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
    if errorlevel 1 goto :fail
    call :refresh_path
    where node >nul 2>nul
    if errorlevel 1 (
        echo       Node.js installe mais introuvable dans cette fenetre.
        echo       Ferme cette fenetre et relance le script une deuxieme fois.
        goto :fail
    )
) else (
    echo       OK.
)

echo [3/7] Activation de pnpm ^(corepack^)...
call corepack enable >nul 2>nul
call corepack prepare pnpm@%PNPM_VERSION% --activate
if errorlevel 1 (
    echo       Echec de l'activation de pnpm.
    goto :fail
)

echo [4/7] Recuperation d'Equicord...
if exist "%INSTALL_DIR%\.git" (
    pushd "%INSTALL_DIR%"
    git pull --ff-only
    set "GIT_ERR=!errorlevel!"
    popd
    if not "!GIT_ERR!"=="0" goto :fail
) else (
    git clone --depth 1 "%EQUICORD_REPO%" "%INSTALL_DIR%"
    if errorlevel 1 goto :fail
)

echo [5/7] Recuperation du plugin Boby...
if exist "%PLUGIN_DIR%\.git" (
    pushd "%PLUGIN_DIR%"
    git pull --ff-only
    set "GIT_ERR=!errorlevel!"
    popd
    if not "!GIT_ERR!"=="0" goto :fail
) else (
    if exist "%PLUGIN_DIR%" rmdir /s /q "%PLUGIN_DIR%"
    git clone "%PLUGIN_REPO%" "%PLUGIN_DIR%"
    if errorlevel 1 goto :fail
)

pushd "%INSTALL_DIR%"

echo [6/7] Installation des dependances ^(pnpm install^)...
call pnpm install
if errorlevel 1 goto :fail_popd

echo       Compilation d'Equicord ^(pnpm build^)...
call pnpm build
if errorlevel 1 goto :fail_popd

echo [7/7] Injection dans le client Discord ^(branche: %DISCORD_BRANCH%^)...
taskkill /IM Discord.exe /F >nul 2>nul
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

:refresh_path
for /f "tokens=2,*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYS_PATH=%%B"
for /f "tokens=2,*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USR_PATH=%%B"
set "PATH=%SYS_PATH%;%USR_PATH%"
call set "PATH=%PATH%"
exit /b 0
