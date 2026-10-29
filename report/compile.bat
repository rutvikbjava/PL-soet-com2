@echo off
REM Batch file to compile LaTeX report on Windows

echo ================================================
echo  EduSphere AI - Final Project Report Compiler
echo ================================================
echo.

REM Check if pdflatex is available
where pdflatex >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: pdflatex not found!
    echo.
    echo Please install MiKTeX from: https://miktex.org/download
    echo Or use Overleaf online: https://www.overleaf.com
    echo.
    pause
    exit /b 1
)

echo Compiling LaTeX document...
echo.

REM First compilation
echo [1/4] First pdflatex run...
pdflatex -interaction=nonstopmode main.tex
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Compilation failed!
    pause
    exit /b 1
)

REM Generate bibliography (if bibtex is used)
REM echo [2/4] Running bibtex...
REM bibtex main

REM Second compilation for references
echo [2/4] Second pdflatex run...
pdflatex -interaction=nonstopmode main.tex

REM Third compilation for TOC
echo [3/4] Third pdflatex run...
pdflatex -interaction=nonstopmode main.tex

REM Final compilation
echo [4/4] Final pdflatex run...
pdflatex -interaction=nonstopmode main.tex

echo.
echo ================================================
echo  Compilation Complete!
echo ================================================
echo.
echo Output file: main.pdf
echo.

REM Open the PDF
if exist main.pdf (
    echo Opening PDF...
    start main.pdf
) else (
    echo ERROR: PDF file not generated!
)

echo.
pause
