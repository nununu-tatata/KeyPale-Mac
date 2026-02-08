# Keypale - Mac: remove large files from history and push
# Run in this folder: .\fix-push.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Resetting history and pushing ===" -ForegroundColor Cyan
Write-Host ""

$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne "main" -and $branch -ne "master") {
    Write-Host "Current branch is not main/master: $branch" -ForegroundColor Yellow
    Write-Host "Run: git checkout main" -ForegroundColor Yellow
    exit 1
}

Write-Host "1. Creating new history..." -ForegroundColor Green
git checkout --orphan temp-main

git reset

git add .
$status = git status --short
if ($status -match 'node_modules|dist') {
    Write-Host "WARNING: node_modules or dist still staged. Check .gitignore" -ForegroundColor Red
    exit 1
}

Write-Host "2. Creating single commit..." -ForegroundColor Green
git commit -m "Initial commit (Mac build, no node_modules/dist)"

git branch -D main 2>$null
git branch -m main

Write-Host "3. Force pushing to origin..." -ForegroundColor Green
git push -f origin main

Write-Host ""
Write-Host "Done. Check GitHub Actions for Mac build." -ForegroundColor Cyan
