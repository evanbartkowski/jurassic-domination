# Steam release preparation

Jurassic Domination can be packaged as a standalone Windows desktop application.
The current build is playable offline. It does not contain Steamworks SDK calls,
Steam achievements, Steam Cloud integration, Steam networking, or a configured
Steam App ID. Those features are future integration work, not existing promises.

## Validate the game with players

- Have new players complete the tutorial without developer guidance. Observe
  whether they understand hunger, food collection, attack telegraphs, the dash,
  and the evolution threshold.
- Playtest all species and every ability, mutation, permanent upgrade, biome,
  difficulty, boss encounter, death transition, and final-tier continuation.
- Tune the difficulty curve with recorded runs. Check early runs, low-health
  recovery, edge-of-map encounters, long runs, and repeated deaths.
- Conduct long-duration stability and performance tests. Check low and high
  graphics quality, multiple monitor sizes, fullscreen transitions, focus loss,
  alt-tab, audio devices, and high-DPI displays.
- Test on actual minimum-spec and recommended-spec Windows hardware, including
  integrated graphics. Establish requirements from measurements, not guesses.
- Review color contrast, readable text, keyboard navigation, motion settings,
  volume controls, and tutorial clarity. Validate remapped controls, UI scaling,
  reduced motion and the standard-controller gameplay adapter on physical devices;
  controller menu navigation, localization and broader accessibility work remain.
- Test saves across application updates and corrupted storage. Back up existing
  profiles before changing storage formats.

## Package a candidate

1. Work from the intended Git commit with a clean checkout and Node.js 24 LTS.
2. Run `npm ci`, `npm test`, `npm run build`, and `npm run package`.
3. Launch the packaged executable on a clean Windows machine without Node.js or
   the source tree. Verify that the title art, audio, tutorial, gameplay, settings,
   progression, fullscreen controls, and quit behavior work offline.
4. Use the complete `release/win-unpacked/` directory for a Steam depot. Its
   executable and all adjacent runtime files are required.
5. Set a release version and record the exact commit, build tools, known issues,
   and measured system requirements.
6. Sign the Windows executable and installer with the publisher's appropriate
   code-signing identity before broad distribution.

## Configure Steamworks

The publisher must supply its own Steamworks account and application. Follow the
current official [Steamworks onboarding documentation](https://partner.steamgames.com/doc/gettingstarted/onboarding)
and [platform configuration documentation](https://partner.steamgames.com/doc/store/application/platforms).

- Configure the Windows platform, launch executable, depots, packages, and test
  branches. Use your own App ID; never ship another game's ID or SDK credentials.
- Add Steamworks features only where they improve the game. Local achievements
  are separate from Steam achievements. Steam Cloud requires an explicit save
  location and migration plan; browser local storage is not an automatic cloud
  integration.
- Test installation, updates, offline mode, the overlay, clean shutdown, and
  multiple Steam accounts. Steam Deck support requires separate performance and
  controller validation and should not be claimed without it.
- Follow Steam's review and release process for the store page and game build.

## Store, legal, and content work

- Clear the final game name and branding with the appropriate rights checks.
- Prepare actual gameplay screenshots, trailer footage, capsule art, library
  artwork, and a description that matches the shipped product.
- Complete Steam's current content and age-rating questionnaires. Disclose the
  AI-generated title illustration wherever the current submission process
  requires it. The soundtrack and 3D meshes are procedurally authored in code.
- Review the ownership and license of every shipped file, including generated
  artwork, dependencies, and fonts. Preserve required third-party notices.
- Prepare support contact details, a privacy statement that matches actual
  behavior, patch notes, a bug-report process, and a tested update strategy.
- Decide on a release schedule only after testing the candidate and completing
  the platform's applicable requirements.

The definitive requirements are the current Steamworks rules shown in the
publisher's account. This repository does not perform store submission or
publish a Steam release.
