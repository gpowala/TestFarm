py -m pip install -r requirements.txt

rem Register pywin32's DLLs for whichever Python this installed into (global or venv)
for /f "delims=" %%i in ('py -c "import sysconfig; print(sysconfig.get_path('scripts'))"') do set PY_SCRIPTS=%%i
py "%PY_SCRIPTS%\pywin32_postinstall.py" -install