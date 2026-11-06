# Local validation - November 6, 2026

The first playable Windows release passed the following local checks:

| Scope | Result |
| --- | --- |
| Node gameplay, audio and persistence tests | 30 passed |
| Chrome browser integration checks | 15 passed, zero renderer errors |
| Actual packaged Windows executable integration checks | 10 passed, zero renderer errors |
| Production Vite build and Windows portable packaging | Passed |
| npm dependency audit after updating and locking dependencies | Zero reported vulnerabilities |

Browser integration exercised the title illustration, tutorial, all 35 field-guide entries, live settings, egg hatching, real keyboard movement, ability and dash cooldowns, pause/settings/resume, evolution choices, combat and edible remains, all eight tiers and final-tier ascension, alpha boss tracking, death rewards, reload persistence, permanent upgrade purchases and 800 x 600 layout. Controlled development-only simulation access accelerated late-game transitions; those checks are not claims of an unaided full playthrough.

The desktop checks launched `release/win-unpacked/Jurassic Domination.exe`, verified an isolated temporary save profile, tested the production sandbox and limited desktop bridge, exercised gameplay controls and fullscreen, confirmed clean quit, and observed no external HTTP requests. The tests did not modify an existing player profile.

Screenshots and machine-readable local reports are in the ignored `artifacts/` folder. Reproduce with `npm test`, `npm run qa` while the development server is running, and `npm run qa:desktop` after building. To test a packaged executable in PowerShell:

```powershell
$env:JD_QA_EXE = (Resolve-Path 'release/win-unpacked/Jurassic Domination.exe').Path
npm run qa:desktop
Remove-Item Env:JD_QA_EXE
```

Browser and desktop automation used software graphics rendering for portable test execution. These checks establish local functionality; they do not establish minimum hardware requirements, broad device compatibility, human difficulty balance or Steam release approval. See `STEAM_RELEASE.md` for the remaining release work.
