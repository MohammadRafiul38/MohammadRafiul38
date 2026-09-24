$ErrorActionPreference = 'Stop'

# ------------------------------------------------------------
# Run from the root of the MohammadRafiul38 repository.
# ------------------------------------------------------------

if (-not (Test-Path '.git')) {
    throw 'Run this script from the root of the MohammadRafiul38 Git repository.'
}

$generatorPath = 'scripts/generate-stats.mjs'
$workflowPath = '.github/workflows/update-profile-readme.yml'

# ------------------------------------------------------------
# 1. Fix the known Git merge conflict in generate-stats.mjs
# ------------------------------------------------------------

if (-not (Test-Path $generatorPath)) {
    throw "Missing $generatorPath"
}

$generator = Get-Content -Raw -Path $generatorPath

$badConflict = @'
<<<<<<< HEAD
await fs.writeFile(path.join(OUT, 'activity.svg'), activitySvg);
=======
>>>>>>> b75a033 (Improve stats layout)
'@

$goodBlock = @'
await fs.writeFile(path.join(OUT, 'activity.svg'), activitySvg);
'@

if ($generator.Contains($badConflict)) {
    $generator = $generator.Replace($badConflict, $goodBlock)
}

# Remove any remaining merge-conflict markers if they exist.
$generator = $generator -replace '(?m)^<<<<<<< .*\r?\n', ''
$generator = $generator -replace '(?m)^=======\r?\n', ''
$generator = $generator -replace '(?m)^>>>>>>> .*\r?\n', ''

Set-Content -Path $generatorPath -Value $generator -Encoding utf8

# Make absolutely sure there are no conflict markers left.
$generatorCheck = Get-Content -Raw -Path $generatorPath

if ($generatorCheck -match '(?m)^<<<<<<< |(?m)^=======|(?m)^>>>>>>> ') {
    throw "Merge conflict markers still exist in $generatorPath. Fix the file manually before continuing."
}

# ------------------------------------------------------------
# 2. Write the README
# ------------------------------------------------------------

$readme = @'
![Profile Views](https://komarev.com/ghpvc/?username=MohammadRafiul38&style=flat-square&color=8b5cf6&label=PROFILE%20VIEWS)

| ![Panchiko typography](./assets/deathmetal-text.png) | **Mohammad Rafiul Chowdhury**<br><br>**Frontend Developer · Game Graphics Enthusiast**<br><br>I craft clean, optimized and interactive interfaces, and design visuals that bring games and applications to life.<br><br>[GitHub](https://github.com/MohammadRafiul38) · [Email](mailto:mrafiulchowdhury@gmail.com) |
| :---: | :--- |

---

### GitHub

![GitHub Statistics and Top Languages](./assets/overview.png)

### Activity

![GitHub Contribution Activity](./assets/activity.png)

---

### Contact

[![GitHub](./assets/github.svg)](https://github.com/MohammadRafiul38) [![Email](./assets/email.svg)](mailto:mrafiulchowdhury@gmail.com)
'@

Set-Content -Path 'README.md' -Value $readme -Encoding utf8

# ------------------------------------------------------------
# 3. Write the GitHub Actions workflow
# ------------------------------------------------------------

$workflow = @'
name: Refresh profile stats

on:
  schedule:
    - cron: '17 3 * * 1'
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: profile-stats
  cancel-in-progress: true

jobs:
  refresh:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Generate live profile cards
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITHUB_OWNER: MohammadRafiul38
        run: node scripts/generate-stats.mjs

      - name: Install SVG renderer
        run: |
          sudo apt-get update -qq
          sudo apt-get install -y -qq librsvg2-bin

      - name: Convert generated cards to PNG
        run: |
          rsvg-convert assets/overview.svg -o assets/overview.png
          rsvg-convert assets/activity.svg -o assets/activity.png

          test -s assets/overview.png
          test -s assets/activity.png

      - name: Commit generated cards
        run: |
          git config user.name 'github-actions[bot]'
          git config user.email '41898282+github-actions[bot]@users.noreply.github.com'

          git add assets/overview.png assets/activity.png

          if git diff --cached --quiet; then
            echo "No generated changes."
            exit 0
          fi

          git commit -m 'chore: refresh profile stats [skip ci]'
          git push
'@

Set-Content -Path $workflowPath -Value $workflow -Encoding utf8

# ------------------------------------------------------------
# 4. Show Git status before committing
# ------------------------------------------------------------

Write-Host ''
Write-Host 'Files updated:'
Write-Host "  $generatorPath"
Write-Host '  README.md'
Write-Host "  $workflowPath"
Write-Host ''

git status --short

# ------------------------------------------------------------
# 5. Commit the fixes
# ------------------------------------------------------------

git add README.md $workflowPath $generatorPath

git commit -m 'Fix profile README generator and layout'

# ------------------------------------------------------------
# 6. Sync with GitHub, then push
# ------------------------------------------------------------

git fetch origin
git rebase origin/main

git push

Write-Host ''
Write-Host 'Done.'
Write-Host 'Now open GitHub -> Actions -> Refresh profile stats -> Run workflow.'