# 1.9.1

  * Fixed the save file not being monitored in offline mode.
  * Fixed stray API requests being made to the server while in offline mode. The only API request made while offline is the initial version check, in case an update contains critical bug or security fixes. The startup routine will continue if this request fails.
  * Fixed the compass in the 3D map not always pointing north.

# 1.9.0

  * Several improvements to the 3D map:
    - Added a compass.
    - Added an optional sky box.
    - Added LOD adjustment.
    - Star points are more visible from long distances, and increase in size the further away from the camera they are.
    - Made the colors of the stars points more consistent with the 2D map's scheme. Friends' locations now show up as a light green color, favorites are purple, and manual locations are dark blue.
    - Fixed the selected location color not being shown.
    - Fixed the camera duplicating a movement when re-selecting the same sector, or systems in the same sector.
    - Fixed inability to select systems from the HUD.
    - Fixed HUD elements getting stuck when switching to the 2D map.
  * Fixed the error notification popup not showing the error details modal when clicked.
  * Fixed the username protection value not changing when toggled in Settings.
  * Fixed various rendering errors.

# 1.8.4

  * Fixed the default stats view showing "Past Week" in the dropdown, but showing data from the past day.
  * Fixed a rendering issue with visible items in the stored list when the selected location box size changes.
  * Fixed incomplete base restoration occurring due to filtering base objects against an old product list. Note: the base restoration feature is only meant to be used to backup and restore bases in their original locations.

# 1.8.3

  * Added per-user discovery stats.
  * Added missing minerals discovery type to profile stats.
  * Added 15, 30 second polling rate options.
  * Improved handling of rendering errors.
  * Optimized server-side processing of stats queries, which are now updated hourly.
  * Sorting options are now applied to search queries.
  * Fixed an issue with locations from discovery data on profiles attempting to be synced with the server as normal locations (resulting in a 400 error). These locations don't have precise player position data, and when teleported to, are handled as manual locations.
  * Fixed various errors occurring on the server.
  * Fixed existing name and description values not populating fields in the Edit Details location view.
  * Fixed an issue with duplicate screenshots being uploaded with Steam's capturer. This is caused by holding shift (sprint) while the app triggers a screenshot with an F12 key event.
  * Upgraded Electron, which fixes an issue with the app flashing a white background when being restored.

# 1.8.2

  * Added keyboard navigation to the tag suggestions dropdown.
  * Fixed a bug causing new users to get stuck in the initial loading step.
  * Fixed inability to set recovery email.
  * Fixed an issue with the stored location list not updating after registering a manual location.

# 1.8.1

  * Fixed an error causing the map to not load correctly.

# 1.8.0

  * The auto screenshot capturer now uses Steam's built-in screenshot capturing utility by default, and the game no longer needs to be in borderless window mode while the capturing method is set to Steam in Settings. (#120)
  * The map can now be toggled on or off in Settings. (#108)
  * Pressing the Insert key no longer focuses NMC by default. To restore the old behavior, it can be enabled in Settings. (#121)
  * Fixed tags clipping out of the screen during editing. (#123)
  * Fixed toggling favorites causing a location to be removed from the stored list. (#124)

# 1.7.1

  * Fixed a bug preventing new users from creating profiles.

# 1.7.0

  * Added tags to locations. Editable via the "Edit Details" view in the selected location box. Clicking a tag will filter locations with the same tag. Tags can also be queried from the Search field in the toolbar with the `tag:` prefix, e.g. `tag:lush`.
  * Improved offline location editing. Changes made to names, descriptions, and tags in offline mode will now sync with the server when in online mode.
  * Current location is now excluded from the "Show My Locations" filter in the stored location list.
  * Selected location box will now expand more vertically when editing, or to accomodate screenshots.
  * Friends' locations are now synced automatically.
  * Moved the "Popular" and "Favorites" sort buttons to the Registered Locations dropdown menu.
  * Fixed incomplete results displaying when sorting by favorites or teleports.
  * Fixed a bug preventing stored locations from being removed after an NMC restart.
  * Fixed search results not getting cached.

# 1.6.0

  * Added global stats. Accessible from the toolbar. It shows the total uploaded locations and discoveries from a select time period, and breaks it down by galaxies, users, and discovery types. The stats refresh once every three hours.
  * Added a "Copy Portal Address" option to the location menu. (#109)
  * Improved sync behavior when stored locations become out of sync after the app has already started.
  * Fixed inability to type in the manual location registration modal.
  * Fixed incorrect location counts for a user's own locations in the stored list.
  * Fixed a couple bugs related to logging and error handling.
  * Reduced inline styles in components, which are less efficient for the renderer.
  * Replaced the donation page with a [Patreon page](https://www.patreon.com/jaszhix) for the project as a trial run. The goal is set to $50 USD/month, which covers the VPS plan on Linode with backups - this is the cheapest plan that can handle the bandwidth demands during peak hours. All previous supporters via Paypal will continue to be credited in the About dialog. Like NMC, the Patreon page may evolve over time, and I'm always open to suggestions. Thanks for your consideration.

# 1.5.10

  * Reduced discovery sync time during startup. Only 500 discoveries are synced within a single request unless the new "Sync discoveries" option in Settings is used. (#114)
  * Fixed a regression in 1.5.9 that prevented the log from being written.
  * Improved API error messaging.

# 1.5.9

  * Fixed inability to manually upload screenshots.
  * Fixed screenshots being uploaded not updating the corresponding location in the remote list.
  * Fixed map rendering becoming out of sync with selections.
  * Addressed issue #114: No Man's Connect startup is stuck in 'syncing discoveries'
  * Updated dependencies.
  * Various code quality improvements.

# 1.5.8

  * Added option to unmark base locations. If the base location still exists in the save data then this will not do anything.
  * Fixed the galaxy list not rendering in the 2D map.
  * Fixed screenshots still rendering after server-side deletion.

# 1.5.7

  * Fixed an error occurring in the 2D map worker thread.
  * Fixed images in the selected location box not updating when there is a network error.
  * Fixed stale name and description edit data persisting when toggling location editing.
  * Reduced the minimum window size to 1280x720.
  * Misc. state management fixes.

# 1.5.6

  * Clarified requirements for the screenshot capturer feature.
  * Misc. code improvements.
  * Updated dependencies.

# 1.5.5

  * Fixed dropdowns clipping the window area.

# 1.5.4

  * Fixed save file handling for the NMS experimental branch.

# 1.5.3

  * Fixed the profile badge not updating in the selected location box.
  * Fixed various errors captured by Sentry.

# 1.5.2

  * Fixed an issue preventing the profile from loading and causing the current username to be set randomly from location data being loaded.
  * Fixed images not updating in the selected location box.
  * Fixed an issue causing locations to stop updating.
  * Fixed an issue that can prevent manual location registration from completing.
  * Fixed various error scenarios caught via Sentry.

# 1.5.1

  * Fixed incorrect ordering when viewing recent explorations.
  * Fixed several uncaught errors occurring on both the client and server.
  * Added option to clear all stored locations. Select this option if you are unable to select certain locations.
  * Fixed a bug that can cause NMC to stop checking for new locations.
  * Fixed a server bug that was preventing an announcement about API compatibility from being sent to users on NMC <1.5.
  * Added an option to disable automatic backups of the currently loaded save file.
  * Fixed "Filter by PC Locations" filtering all locations.
  * Fixed error occurring when filtering by screenshots.

# 1.5.0

  * Server-side improvements.
    * Some duplicates were found and corrected in a migration.
    * Better location validation.
  * Locations that are re-visited can now have screenshots auto-captured and saved.
  * Improved start-up time and general responsiveness.
  * Fixed clicking the search button not starting a search.
  * Fixed manual location entry false positive occurring when entering a location that exists in another galaxy.
  * Fixed inability to teleport to manual locations.
  * Added automatic backups of save files. This will create a directory inside the save folder called "nmcBackup", and will generated zip files inside it before the save file is written.

# 1.4.0

  * Fixed an issue with old discoveries getting re-uploaded on intitialization.
  * Fixed the first glyph in the portal address being incorrect.
  * Adjusted the distance to center calculation to be more accurate.
    * Distances are calculated at the time of location creation and stay cached. Old locations have been corrected on the server, but you may need to clear the contents of AppData/Roaming/NoMansConnect for the changes to propagate.
  * Cleaned up the profile view, and made the discovery timeline more readable. Discoveries are now grouped by location, and discovery data that is unidentified by NMC can now be teleported to, and registered as a result.
  * Added an option to disable automatic screenshot capturing of space stations, atlas stations, and freighters.
  * Added a close button to the image modal.
  * Added a shortcut to one's own profile. Select the tool drop-down menu, and select the first option, "Profile".
  * Fixed an issue with closing image modals opened from the profile causing the profile to close as well.
  * Fixed tooltips not rendering in the settings modal.
  * The cheat menu is now deprecated to prevent encouraging multiplayer cheating. It can still be accessed by using the Konami code, but is now limited to one use per-day. Dedicated save editors are available on modding sites.
  * Performance improvements.
  * Fixed teleporting and other save file operations toggling the loading state before nmssavetool writes the save file. The current location is also updated more quickly after teleporting.
  * Fixed teleport stats not incrementing.
  * Fixed inability to click through to an associated profile from a selected location.
  * Fixed offline mode not working when the server is unavailable.
    * Client will now switch to offline mode automatically if the server is unavailable.

# 1.3.3

  * Fixed version compatibility changes to a location not propagating to the cache.
  * Fixed the Upload/Delete screenshot options not appearing in the selected location dropdown menu.
  * Fixed the settings modal clipping outside of the viewport on lower resolutions.
  * Fixed selected locations not always being reflected on the map.
  * Fixed an issue that can cause stored locations to become unselectable when the remote cache gets stale.
  * Fixed an issue with the stored location list scroll position jumping after selecting from it.
  * Fixed a rendering issue with the stored location list not updating correctly after deselecting a location.
  * Fixed screenshot capturing on Linux.

# 1.3.2

  * Fixed being unable to toggle username protection in the new settings modal.
  * Fixed being unable to teleport when the Windows username contains spaces.
  * Fixed friend requests not deleting.
  * Fixed map paths not showing.
  * Fixed map not resizing in some cases.
  * Addressed an issue with discoveries not being uploaded for some users.

# 1.3.1

  * Fixed an issue preventing the app from starting for Windows 7 and Linux users.
  * Fixed all new locations showing as PS4 locations on the map.
  * Fixed offline mode.
  * Added a log modal that displays the contents of NMC.log. Accessible from the tool menu.
  * Moved all settings menu items in the tool menu to their own modal.

# 1.3.0

  * Improved sorting and filtration options for stored locations.
  * Fixed an issue with the selected location dropdown menu clipping the viewport.
  * Added zoom functionality to the 2D map. To use, drag a rectangle over the region you would like to zoom in on. Press the right mouse button to zoom out.
  * Added a waypoint option. If teleporting isn't your cup of tea, you can now select "Set waypoint" from any location's dropdown menu, and it will be added to the galactic map's custom waypoint selection. Note this will override the custom waypoint if its already set.
  * Added saving of multiple positions on a single planet. Normally the client will ignore changes to the save file if it already has the current location in its cache, but now all unique positions are saved and uploaded. The teleport button now switches to a menu selection of available places. The names of these can be edited by clicking "Edit Places". This can also be useful if a location was previously incompatible and spawned the player in mid-air.

# 1.2.1

  * Fixed friend location scatter points not adjusting to galaxy change.
  * Fixed favorite location scatter points not disappearing on toggle.
  * Fixed invalid coordinates being re-submitted through the location sync functionality.
    * All invalid coordinates have been deleted from the server, and should be prevented from being uploaded again. If the map's scale is off, please delete the contents of AppData/Roaming/NoMansConnect. Server will re-sync all locations.
  * Implemented server synchronization of favorite locations. Favorites will now always be up to date on the client, and will be automatically re-added to the stored location list. The only way to remove them is by un-favoriting them.
  * Added a bit more polish to the profile view.
    * Locations can now be favorited from the profile.
  * Fixed an issue with discoveries not uploading correctly for some users.
  * Fixed an issue with the cached remote location list becoming corrupt and resetting.
  * Fixed a rendering error that could occur when loading locations with the friends filter enabled.

# 1.2.0

  * Added user profiles. Accessible by clicking a user's badge.
    * All discoveries are now uploaded to the server - this includes flora, fauna, planets, and systems. These are then associated with registered locations. The only way to uniquely identify a discovery in the save file this way is by manually naming it in-game.
    * More indepth statistics are shown, showing a break-down of the types of discoveries.
    * You can now send friend requests to others and filter locations by friends-only. This system, along with profiles is still beta-quality and may contain bugs. Please report them to the Github repository.
      * Locations can be filtered to only show locations from friends.
      * Friends will get their own legend marker on the 2D map.
    * Fixed an issue with map scatter points switching to another applicable legend color instead of disappearing when toggled off.
  * Added support for multiple bases per save file. Multiple base icons can now show up in the stored location list.
    * Since bases can be built anywhere in NEXT, importing a base from another location into a new one is no longer accurate, but still works for restoring a base that was originally built in the location its being imported into. For now it is best to use this feature as a backup tool rather than a migration one.
  * Repaired corrupted star textures in the 3D map.

# 1.1.3

  * Fixed an error occurring on manual location entry.
  * Fixed an issue with un-maximizing the window causing it to move it to the primary monitor instead of the window's current monitor.
  * Implemented a simple notification system for server announcements, e.g. scheduled maintenance.
  * Upgraded dependencies.

# 1.1.2

  * Username protection has been changed so users now need to associate an email with their profile before it can be enabled. This is needed because there is no way to recover a protected profile without manual intervention, otherwise. **All users without a recovery email have had protection removed from their profiles, and need to set one to continue using protection mode.**
  * Addressed an issue that could cause the username to change when teleporting (#72).

# 1.1.1

  * Fixed a few bugs.
  * Upgraded dependencies.

# 1.1.0

  * Addressed issues with the recent explorations panel not updating.
  * Added an exploration count badge next to usernames.
  * Decreased location sync time.
  * Upgraded dependencies.

# 1.0.2

  * Corrected an issue with the app getting stuck on location validation if the cache hasn't been updated for a while.
  * Upgraded dependencies.

# 1.0.1

  * Fixed the search view getting stuck when selecting a map location with multiple planets.
  * Fixed a regression causing location box inputs to show the wrong location data while editing.

# 1.0.0

  * Fixed a bug preventing the 2D map from displaying scatter points in some situations.
  * Fixed the Load More Locations button not always loading more locations.
  * Added a loading status indicator to the top navigation pane.
  * Added the ability to hide one's own locations from the stored location list.
  * Added an option to copy the Universe Address to the clipboard.
  * The info tooltip that shows when hovering over the Teleport option now lists the currently detected save file. If this is incorrect, you need to save the file you want NMC to modify in the game. NMC looks for the last modified save file.
  * Performance improvements.
  * Improved validation of manually entered coordinates, and added more thorough checks of locations periodically.
  * NMC will now attempt to gracefully wind down its file I/O before terminating, which should prevent settings/cache JSON files from getting corrupt.
  * Reverted to the one-click installer due to complaints over Windows permissions confusion.

# 0.19.0

  * Fixed a bug preventing NMC from reading the correct save file name because Hello Games changed the save file naming scheme a day before releasing from experimental. I was busy travelling and didn't have a working Windows installation for a couple weeks, so I apologize for the delay.
  * Added some optimizations.
  * Side note: macOS builds are discontinued as I no longer have a Macbook.

# 0.18.0

  * Updated location syncing and teleporting for NMS 1.38 with help from nmssavetool author Matthew Humphrey.
  * Added several QOL enhancements for the 3D map.
  * Added an indicator for the current location in the stored location list.
  * Added toggle icons to the location filtering menu.
  * Added periodic purging of 25% of the remote location cache every 1-3 days depending on the amount of locations cached. Locations that are favorited will not be purged. This needs to be done until a better solution is in place for the performance issues caused by loading thousands of data points on the map.
  * Fixed images not being cached correctly after they're uploaded manually.e?count=25&after=t3_7a2qyy
  * Fixed a false positive username protection error when users with NMS save data use PS4 mode.

# 0.17.1

  * Corrected the portal calculation.
  * Updated dependencies.

# 0.17.0

  * Added portal glyph addresses to locations.
  * Addressed some issues affecting stability.
  * The mods list in each location can now be seen by hovering over the mods item.

# 0.16.0

  * Fixed screenshots not changing when selecting different locations in the stored list.
  * Fixed the app not loading when the mods directory isn't created in some scenarios.
  * Added progress information when the app is loading.
  * Optimized the location syncing process.
  * Improved performance.

# 0.15.1

  * Added game version metadata to locations. This will appear as "Version Compatibility" in each location's details list.
    * Added ability to sort by compatible locations in the remote locations list.
    * If an old location works with the current version of the game, you can mark it as compatible by selecting it from the stored locations list.
  * Changed "Voxel Address" labeling to "Universe Address".
  * Fixed screenshots not appearing when selecting a stored location.

# 0.15.0

  * Experimental macOS support. Like the Linux version, you will need Wine installed for full functionality.
  * Added username recovery via email. Set the email address to be associated with your username in the tool menu. When getting locked out of a profile with protection enabled on a different computer, recovery options will now appear.
  * Settings are now backed up automatically. If the settings.json file becomes corrupt, the app will attempt to load the backup version.
    * Fixed a server side bug preventing the profile from being restored when this happens.
  * Fixed a bug preventing write access to save files when spaces are in the save directory path.
  * Fixed unmaximizing the app shrinking the window into a tiny square.

# 0.14.0

  * Rewrote the handling of the 2D map scatter points and tool tips, so they show all the planets at each sector on the map.
  * Fixed the favorite icons on remote location boxes not updating.
  * Added more error logging.
  * Added several more checks inside the save data parsing functions to prevent save file errors when teleporting to manually entered locations in offline mode.
  * Fixed a bug preventing the app from watching the save file state.
  * Added an option to show only PC locations in the remote list.
  * Remote location filter options are now persistent and saved to settings.json.
  * Performance improvements.

# 0.13.0

  * Added an offline mode.
  * Added Linux support.
  * Images are now cached in AppData/Roaming/NoMansConnect, and only download once.
  * Added a compact view for the remote location list.
  * Added more accurate clustering of dense hub areas on the 3D map using SolarSystemIndex.
  * Added a Travel to Current Location 3D map menu option.
  * Fixed the sluggishness of the remote location list.
  * Fixed a regression causing fields to not be pre-filled when editing existing location names and descriptions.

# 0.12.1

  * PC players can now teleport to manually registered locations!
    * You will spawn in space inside your ship at these locations. They are marked in blue.
    * Thanks to monkeyman192 for helping me figure it out.

# 0.12.0

  * Added support for PS4 players.
    * This works by manually registering coordinates in hex format.
    * While voxel coordinates are created from a conversion, these locations cannot be teleported to.
    * Older versions of NMC cannot distinguish PS4 locations from PC locations, and teleporting to them will crash your game. It is recommended to *upgrade immediately*.
    * Improved the accuracy of the hex address conversion for PC locations.
  * The settings are now stored in a JSON file named settings.json in AppData/Roaming/NoMansConnect. This makes it easier to change faulty settings, and to report bugs. The app will migrate the old settings format to the new format.
  * The 3D map now only renders systems and lists the planets inside them on the HUD.
  * Added helpful information to the options menu.

# 0.11.0

  * Fixed the map scaling becoming unbalanced.
  * Fixed the auto screenshot feature capturing all monitors. It now only captures the primary monitor.
  * Performance improvements.
  * Minor style fixes.

# 0.10.0

  * Added a 3D map option. Enable from the map options menu in the top left corner of the map.
    * Includes three locations to travel to: Galactic Hub, Pilgrim Star, and Pathfinder Hub. You can also travel to any location by clicking a star, or selecting a location in the UI.
    * Two draw distance options are available. Default is medium. A rotating core is rendered in the center of the galaxy on high draw distance mode.
  * Changed the behavior of the protected username dialog so it doesn't boot users out of the app.

# 0.9.0

  * Improved CPU and RAM usage.
  * Fixed storing of other people's bases (for importation into your own game) not working.
  * Fixed cached remote location metadata not updating when they're edited.
  * Fixed the search functionality breaking on large remote location lists.
  * Reorganized the layout to optimize the best use of available space.
  * Added an option to toggle between 1-2 columns for remote locations.
  * Added an option to show locations' galactic addresses in the stored location list.
  * Added several new sorting options for locations. You can now drill down locations by:
    * Galaxy
    * Screenshots
    * Names
    * Descriptions
    * Distance to center
    * Least modded
    * Bases
  * Improved location loading.
  * Added an option to change how often the app checks for new locations.
  * Fixed the location name and description fields not showing their current values when updating them.

# 0.8.0

  * Added a new base backup and restore feature!
    * This allows you to save your current base to the app's storage, and restore it and all of its building objects at another location, or in another game mode save.
    * In base locations, a new menu item is added allowing you to store other people's bases.
    * Only building objects from the vanilla game will be saved. This prevents the game from crashing for other players.
    * This feature was made possible thanks to monkeyman192, who wrote the algorithm that makes base object position matrices compatible in new locations.
  * Added username overriding.
  * Added a Copy Address to Clipboard option.
  * Added ability to sort stored locations chronologically.
  * Added galaxies 135-257 ct. NMS Wiki.
  * Fixed the scaling of enlarged screenshots.
  * Fixed a bug causing the window to become invisible if DWM is disabled.
  * Fixed a time stamp bug with locations.
  * Fixed a bug that can cause the install directory to not be set by the user's preference.
  * Fixed a bug causing the "Remove From Storage" option on selected locations appearing when the location is not stored.
  * Fixed a bug that can cause the stored locations list to clear when switching modes from the menu and then teleporting.
  * Fixed search queries getting reset prematurely.

# 0.7.1

  * Added markdown support to descriptions.
  * Fixed a regression with manual screenshot uploads not working.
  * Fixed the app window not being able to be repositioned correctly, and added window position state saving.
  * Fixed a bug causing the remote location cache to reset when resetting a search query.
  * Added galaxies 120-134 ct. NMS Wiki.

# 0.7.0

  * Added multi-threading: Moved some of the renderer work to worker threads for a performance boost.
  * Fixed a bug preventing Windows 7 users from using the app.
  * Fixed the name and description fields not resetting when a location is updated.
  * Fixed teleporting to stored locations not working for users with save data in non-default locations.
  * Widened the stored locations column.
  * Added ability to select locations directly from the shared location list.
  * Added galaxies 80-119 ct. NMS Wiki.

# 0.6.1

  * Fixed a bug related to filtering stored locations.
  * Fixed a regression with the extra columns not rendering correctly.
  * Fixed a bug causing duplicate locations to be uploaded for some players.
  * The app now checks your NMS settings for whether or not fullscreen is enabled, and if so it will disable auto capturing on init.

# 0.6.0

  * Added local caching for shared locations
  * Added username protection. This will associate your username with your computer to prevent impersonation. Please read the information before enabling this option.
  * Added a cheat menu unlockable by exploring
  * Current location indicator on the map now shows up for base locations
  * Moved the location buttons to their own dropdown menu to conserve space
  * Added base and space station indicator icons to locations
  * Fixed a bug that could prevent bases from being recognized
  * Fixed the screenshot capture setting not being stored correctly
  * Fixed the "Explored by" row not appearing when a location name is set
  * Fixed the scroll box not resetting when selecting a new selected location
  * Fixed non-pak files being listed with mods
  * Style overhaul

# 0.5.2

  * Fixed save data not being found for GOG users
  * Fixed a bug preventing users from getting past the NMS install path selection prompt on a fresh install

# 0.5.1

  * Fixed a critical bug preventing the app from correctly identifying the newest save slot
  * Fixed logging, the log file can be found at AppData/Roaming/NoMansConnect/NMC.log
  * Added names for galaxies 66-72 courtesy of NMS Wiki and parsec on Nexus Mods

# 0.5.0

  * The app will now ask for your NMS install and save file directories on init if they can't be found
  * Implemented native parsing of NMS save files
  * Fixed the galaxy list not updating as locations change
  * Fixed the current location being inaccurate, and set the current location's galaxy as the initial galaxy seen on the map
  * Optimizations

# 0.4.2

  * Fixed location order becoming inaccurate when switching sort options

# 0.4.1

  * Fixed the screenshot in the selected location changing when switching sort options
  * Optimized how images are loaded
  * Increased the image quality of automatic screenshots

# 0.4.0

  * Added an enlarged map layout
  * Added an option to show coordinate paths
  * Added ability to toggle types of coordinates by clicking their icon on the legend
  * Added missing galaxy names 63-65
  * Added error logging
  * Fixed a bug causing the selected location name and screenshot states to not update
  * Fixed stored location screenshot, name, and description fields not syncing with its related remote location on update
  * Fixed a regression causing the remote location list to not update
  * Fixed the selected location box clipping on lower resolutions
  * Experimental fix in place for users not getting past the loading screen
  * Reformatted the Voxel ID to include the RealityIndex and migrated old data

# 0.3.1

  * Fixed a bug preventing locations from uploading

# 0.3.0

  * Added ability to disable automatic screenshots in the main menu, and upload screenshots
  * Each galaxy now has its own map
  * Improved NMS install detection for the mod listing feature
  * Made it easier to reset search queries
  * Remote locations are now synced if they are missing from the locally stored locations cache
  * Screenshots are now only taken automatically if the game is running
  * Style fixes

# 0.2.0

  * Switched to more efficient method of watching save file changes
  * Added naming of locations
  * Added transparency overlay. Trigger with the Insert key.
  * Added screenshots
  * Added favorites
  * Added naming
  * Style changes
  * Fixed the stored locations list not scrolling
  * Fixed teleports stat getting stuck at 1
  * Installed mods are now listed with uploaded locations
  * Expanded the remote locations list to multiple columns for higher resolutions.

# 0.1.0

  * Updated fonts on text boxes
  * Added search
  * Added tracking of teleport stats
  * Added sorting by recent and popular (number of teleports)

# 0.0.3

  * Fixed incorrect coordinates being stored. Old data will be migrated to the correct formatting
  * Fixed teleporting to shared locations not working
  * Added tracking of galaxies

# 0.0.2

  * Fixed scroll pagination
  * Added an upgrade notifier

# 0.0.1

  * Initial version.