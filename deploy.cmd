@echo off
chcp 65001 >nul
cd /d "%~dp0"

rem 把 web 目录里的内容传到云开发静态网站托管
rem 首次使用前需要先授权一次：
rem   .deploy\node_modules\.bin\tcb.cmd login

set ENV_ID=cloud1-d5genhgf2b9f44de6
set HOME=%~dp0.deploy\home
set USERPROFILE=%~dp0.deploy\home
set XDG_CONFIG_HOME=%~dp0.deploy\home\.config

echo.
echo   正在上传 web 目录到环境 %ENV_ID% ...
echo.

.deploy\node_modules\.bin\tcb.cmd hosting deploy .\web -e %ENV_ID%

echo.
echo   站点地址： https://%ENV_ID%-1538086108.tcloudbaseapp.com/
echo   校验命令： npm run probe:site
echo.
pause
