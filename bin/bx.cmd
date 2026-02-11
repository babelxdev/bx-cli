@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "VENDOR_DIR=%SCRIPT_DIR%..\vendor"

:: Detect architecture
if "%PROCESSOR_ARCHITECTURE%"=="AMD64" (
    set "ARCH=x64"
) else (
    echo Unsupported architecture: %PROCESSOR_ARCHITECTURE%
    exit /b 1
)

set "PLATFORM=windows-%ARCH%"
set "BINARY_PATH=%VENDOR_DIR%\%PLATFORM%\bx.exe"

if not exist "%BINARY_PATH%" (
    echo BabelX CLI binary not found: %BINARY_PATH%
    echo Please run: npm install @babelx/cli
    exit /b 1
)

"%BINARY_PATH%" %*
