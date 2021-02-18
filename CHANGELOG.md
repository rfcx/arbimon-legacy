# Arbimon Release Notes

## v3.0.10 - Feb XX, 2021

New features:
- CS-494 Request spectrogram tiles from Media API for audios from RFCx streams
- PI-270 Add settings to invoke a Kubernetes job for Clustering jobs

Resolved issues:
- PI-545 Improve the quality of the spectrogram image
- PI-504 Can not filter more than one tag
- CS-474 Drop unique constraint on `projects` `name` column

## v3.0.9 - Feb 15, 2021

New features:
- PI-263 Admin can enable Audio-event-detection and Clustering pages
- PI-478 Add Score per Species/Site filters to the CNN details page

Resolved issues:
- PI-375 Take user to the Visualizer page when prompted to create a new template
- PI-434 Fix infinite scroll functionality on the Visualizer page
- PI-424 Fix after changed soundscape color returns user to top of thumbnails list
- PI-552 Fix issue with loading the recording after redirecting to the Visualizer page

## v3.0.8 - Feb 08, 2021

New features:
- PI-184 Implement global navigation bar

Resolved issues:
- PI-482 Fix save playlist issue
- PI-351 Hot fix the Page Footer on the Pattern Matching page

Other:
- PI-275 Hide the “link” button and “status” tab on the Site page
- PI-436 Update PM results default sort list to “Score”
- PI-441 Update RFCX logo icon

## v3.0.7 - Jan 29, 2021

New features:
- PI-352 Change place of “Login with RFCx account” in the Arbimon’s Page

Resolved issues:
- PI-423 Disable code that checks for storage limit
- PI-435 Fix view in visualizer button in data templates
- PI-351 Fix the Page Footer
- PI-208 Fix Playlist Name Select

## v3.0.6 - Jan 27, 2021

Resolved issues:
- Fix spectrogram service issue related to incorrect sample rate for opus files

## v3.0.5 - Jan 25, 2021

New features:
- PI-171 Create playlist from selection of audio events

Resolved issues:
- PI-340 Fix user id is required error contributing to Arbimon 503
- PI-306 Hide the chat icon on the Visualizer page
- PI-131 Remove view soundscape region
- PI-341 Investigate putting object in bucket error contributing to Arbimon 503
- PI-401 Fix typo in Import site feature
- PI-368 Remove “Saved threshold” and “Suggested threshold” in RFM details
- PI-370 Change the wording in deleting a playlist window
- PI-265 Fix all places in platform where cursor needs to be changed to the hand
- PI-132 Fix font color on soundscape pop up
- PI-353 Patterns are fuzzy in Chrome but clear in Firefox

## v3.0.4 - Jan 14, 2021

Resolved issues:
- PI-280 Fix Uncompleted Jobs for Pattern Matching in Analysis
- PI-276 Disable infinite scroll for the Visualizer to apply fix later.

## v3.0.3 - Jan 14, 2021

New features:
- PI-276 Infinite scroll on visualizer recording list to speed up loading
- PI-240 Create admin page for total user info
- PI-172 Tool to select cluster manually
- PI-4 Add pattern matching and CNN jobs to active jobs key

Resolved issues:
- PI-287 Show error when the RFM doesn't have enough validations to complete the job
- PI-305 Support resource should redirect to https://support.rfcx.org
- PI-272 Some timezone when selected a date on filter recordings it doesn't always show the correct date in the box
- PI-271 Fix cursor issues on visualizer page
- PI-247 Change default sort in list to most recent
- PI-217 Fix the gap in creating a new Classification
- PI-211 Fix Save & Close button in Create Playlist
- PI-209 Fix Create Template Button In Pattern Matching
- PI-155 Pop up colors do NOT match the visualizer site image or thumbnail (soundscapes)
- PI-280 Fix Uncompleted Jobs for Pattern Matching in Analysis
- PI-308 Delete user's playlist related with DELETED Pattern Matching or PM job
- PI-318 Fix typo when site created
- PI-121 Search of soundscape project doesn't bring up project on 1st page of search results

## v3.0.2 - Dec 28, 2020

Resolved issues:
- PI-224 Small/Big grid button is not function anymore in the CNN page
- PI-225 ROIs are not being highlighted when clicking on them in the CNN page
- PI-216 Fix Playlist Delete Bug
- PI-220 Login box disappears on small/narrow screen
- PI-228 Source column is too narrow on Templates list
- PI-206 Newrelic monitoring and analytics
- PI-233 Remove paid plan text in Change Plan popup
- PI-245 Display first and last name instead of username in Settings User page
- PI-235 Fix Pattern Matching Validation in Citizen Scientist
- PI-264 Fix pattern matching visualizer button in Citizen Scientist
- PI-205 Fix species loading
- PI-180 Lost of parameters field in CNN details page
- PI-215 Fix Random Forest Models in Analysis tab

## v3.0.1 - Nov 24, 2020

## v3.0.0 - Oct 14, 2020
- Arbimon II becomes RFCx Arbimon

---

## v1.18.4
- added user names to cs expert validations

## v1.18.3
- fixed cs stats
- made user stats fix script

## v1.18.2
- cs pm layout and functionality improvements

## v1.18.1
- Added x20, x25, x30 and x50 gain

## v1.18.0
- added audio bar component

## v1.17.2
- fixed broken registration page

## v1.17.1
- Updated/cleaned layout functionality.
- Fixed some layout bugs.
- Separated normal/expert CS publishing
- Added per user CS PM validations export
- Updated Random Forest model labeling

## v1.17.0
- Adding Convolutional Neural Network module.

## v1.16.9
- optimizing pattern matching best scored per site / per site per day queries

## v1.16.8
- making pattern matching details ux more uniform
- fixing per site / per site per day queries

## v1.16.7
- adding expert and admin cs ui and route permissions
- removing cs pm validated rois to prevent double voting
- adding best per site, beest per site/day filters to analytics/pm

## v1.16.6
- Filtering consensus and expert validated rois from cs pm ui
- Fixing stats multiple counting bug

## v1.16.5
- Changed to pattern matching details page
- Added pattern matching enable flag, with disabled message
- Updated dashboard layout
- Added site indexing to pm details
- unneeded code removal
- css and whitespace fixes

## v1.16.4
- bugfix in pattern matching details set page control

## v1.16.3
- pattern matchings:
    - changing roi datetime display to utc (e.g. no timezone correction)
    - replacing # of # page caption with a ui select for selecting current page
    - adding roi and template audio play button to details page
    - moving visualizer link to the bottom right
    - removing broken/unneeded variables in delete controller
    - removing delete button click-through

## visualizer
    - using ui select in playlist dropdown
    - using ui select in sites dropdown


## v1.16.2
- Fixed breaking a2-scroll bug


## v1.16.1
- Completed and integrated citizen scientist module


## v1.16.0
- Added citizen scientist modules


## v1.15.0
- Can now delete templates and pattern matchings
- Layout changes to Pattern Matchings page
- Pattern Matching jobs are now shown.
- Add Pattern Matching correlation score to rois


## v1.14.1
- upload processing lambda is optional
- added datetime to pm rois


## v1.14.0
- Added templates and pattern matching
- Can now call upload processing lambda


## v1.13.0
- updated python requirements
- added python dependencies install section in README
- added upload queue configuration on/off switch (default is off)


## v1.12.1
- alive route now hits the database


## v1.12.0
- Reverted to Google maps
- Removed Forum Links
- Removed audio event detection links as well


## v1.11.0
- now using here maps api instead of google, which turned to the dark side now.


## v1.10.1
- fixed bug: jimp.crop is not async


## v1.10.0
- replaced lwip with jimp


## v1.9.13
- fixed bug in recording filter + export


## v1.9.12
- soundscape regions now consider the current soundscape threshold.


## v1.9.11
- fixing user login bugs
- adding content types to routes
- Adding Cornell recording filename format


## v1.9.10
- Fixed aed playlist getting code
- Adding admin plots feature


## v1.9.9
- Removed autogain protection from sox calls (was ruining some mp3 reproductions)


## v1.9.8
- fixed bug training models
- added playlists functionality (arithmetic and details)
- can now filter by playlists
- added recording details
- code refactors


## v1.9.7
- fixed bug in Users.getProjectList (for reals, I swear)


## v1.9.6
- fixed bug in Users.getProjectList (for reals)


## v1.9.5
- fixed bug in Users.getProjectList
- testing++
- docs++


## v1.9.4
- plugged db connection leak when creating projects
- plugged db connection leak when creating jobs
- fixed testing (some are still skipped, but none fail)
- added `models.jobs` tests


## v1.9.3
- added default default plot to aeds.


## v1.9.2
- fixed bug in counting a projects scc tallys


## v1.9.1
- fixed bug preventing add species


## v1.9.0
- added Audio event detections.


## v1.8.9
- Fixing bug in axis parameters hash computation.


## v1.8.8
- recording name in recording thumbnail urls is now escaped.


## v1.8.7 (belated version bump)
- fixed Playlist creation bug


## v1.8.6
- Fixing broken uploader stuff
- file structure is more organized
- fixed recording time-date format in recordings export
- updated npm dependencies
- improving visualizer responsive layout
- misc.


## v1.8.5
- Support for listing of associated apps.
- Adding uploader desktop app links for download.


## v1.8.4
- Fixing recording query bug with using id only.


## v1.8.3
- Fixing site count query scalability.


## v1.8.2
- Fixed soundscape export bug.


## v1.8.1
- Fixed soundscape image drawing bug.
- Fixed soundscape matrix export not using amplitude reference bug.
- Added amplitude reference to soundscape details.


## v1.8.0
- Added maximum-relative thresholds to soundscapes.


## v1.7.0
- Changed layout in soundscape composition tool
- Fixed Soundscape export not setting content disposition header
- Soundscape matrix is now promisified, no longer runs uninterrupted.


## v1.6.0
- Fixed deleting recordings in audiodata bug


## v1.6.0
- Added soundscape composition tool
- Soundscapes are now exported as raw data (previous export format) and the matrix as a csv (new default).
- Recording-associated data can now be exported to a csv file.


## v1.5.0
- Added access token support and primary routes for uploading using access tokens.


## v1.4.1
- fixed upload bug.


## v1.4.0
- added admin activity plot


## v1.3.1
- fixed crashing bug with getProjectSites on a project without sites. (again)


## v1.3.0
- Added login with facebook and google buttons
- Added activation codes for creating Projects
- fixed crashing bug with getProjectSites on a project without sites.


## v1.2.7
- Fixed double counting for storage usage


## v1.2.6
- Fixed uploaded recordings double counting


## v1.2.5
- 1 free project limit is now waived for super users


## v1.2.4
- Fixed breaking bug in uploader.

## v1.2.3
- removed uninformative highly repeating console log from uploader code

## v1.2.2
- uploader now uploads in random order, uses db as queue holder and uses promise-based job scheduler.
- recordings are no longer required to have mic, software and recorder metadata (initializes to '').

## v1.2.1
- battery status labels are now correct

## v1.2.0
- Fixed double counting bug in `getProjectSites` recording counting
- Added two more site status plots + improved UI

## v1.1.0
- Added changelog
- Added more visual emphasis on selected layer
- Added recording tagging:
    - Added new `recording-tags-layer` layer
    - Added `a2.srv.tags.a2Tags` service
    - recordings are now searchable by tags
    - Added tag routes and model
- Modified `Arbimon` time format to allow for seconds.
- Added missing .map files to copy task in grunt
- blobs for generated content URL are now of image/png content type.
- layers now recieve an injected reference to the `VisualizerCtrl` instance
- `VisualizerCtrl` now throws `visobject` event when a `visobject` is set
- Bugs:
    - Fixed infinite digest bug in spectrogram
- Misc:
    - Added `a2.srv.api.a2APIService` for managing the basic API I/O
    - promisified `getProjectSites()`
    - `layer_type` is now a provider instead of a factory.
    - `options` argument is now passed to `connection.query` in to `dbpool.queryHandler`
    - Added debug output for options in `dbpool.queryHandler`

## v1.0.0 - Sep 30, 2015
- Arbimon II launched
