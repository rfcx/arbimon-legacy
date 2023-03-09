# Arbimon Release Notes

## v3.0.75 - March 10, 2023

Resolved issues:

- Improve the message for a count of uploaded files
- The timezone column is changed

Performance improvements:

- Add a background job to Export recordings, Occupancy models and Grouped detections

## v3.0.74 - March 09, 2023

Resolved issues:

- Fix permissions for export recordings
- Display the opus spectrogram file on the Visualizer page
- Change the description on Arbimon settings page

## v3.0.73 - February 03, 2023

Resolved issues:

- Add an ability to listen to the opus CNN sound

## v3.0.72 - February 01, 2023

Performance improvements:

- Add an error message directive to process all error messages on the new AED form
- Increase proxy-body-size to 200m
- Add env key to support logout url
- External users can run AED jobs of up to 2000 recordings

Resolved issues:

- Fix getting the total recording count in the AED jobs
- Decrease the min frequency range
- Fix getting the page recording results
- Fix pagination for the score per site filter
- Add an ability to listen to the opus templates sound
- Add an ability to listen to the opus PM sound
- Fix permission to manage AED and Clustering job
- Add auth0 logout link to reset the previous user settings
- Fix opus file upload
- Unable to create RFM classification when there is the model already exists
- Update message for empty clustering job
- External users can run AED jobs of up to 2000 recordings

## v3.0.71 - January 27, 2023

Performance improvements:

- Limit the non-RFCx user to only creating AED jobs on max 10k recordings in the last 24 hours
- Survicate survey support

## v3.0.70 - January 23, 2023

Performance improvements:

- Improve the score per site filter logic on the PM details page

Resolved issues:

- Fix pagination for the score per site filter
- Add an ability to listen to the opus templates sound
- Fix opus file upload. Fix audio play on the Pattern matching analysis

## v3.0.69 - January 09, 2023

Performance improvements:

- Improve web-uploader to be able upload long recordings

## v3.0.68 - January 05, 2023

New features:

- Make the private templates available to rfcx users

Resolved issues:

- Delete recording validation after removing the PM job

## v3.0.67 - December 22, 2022

New features:

- Add species name and songtype column associated with the template on the PM list page
- Show user email in project settings
- Remove jobs count from nav
- Hide upload recommend box on drag
- Change wording on the Grid View page
- Add ability to select recordings on different pages
- Create a playlist with selected recordings
- External users can run AED jobs of up to 1000 recordings

Resolved issues:

- Open new tab from Arbimon tabs appear error page

Performance improvements:

- Move Arbimon web frontend to Kubernetes
- Improve docker build caching
- Refactor sox usage, make sox function private

## v3.0.66 - November 22, 2022

New features:

- Add support links to AED/Clustering pages
- Show create button for the empty playlists list
- Move the playlist button to the Recordings page
- UI updates for an empty scatter plot
- Display the count of detected AEDs on the Audio Event Detection page
- Change homepage “analyses executed” stats from jobs to recordings

Resolved issues:

- Remove h-index from soundscape details
- User should not be able to create PM with an empty playlist
- Show the user’s first name, last name, and email when deleting the user from any project

Performance improvements:

- Update project country and state

## v3.0.65 - November 09, 2022

New features:

- Users with the user roles can be able to create and edit project sites
- Detect when playlist contains 500,000+, when creating PM job and show warning
- Limit number of uploading files (100 files)
- Update yellow bar size on the Upload page
- Change control inputs location on the Upload page
- Hide new AED job advanced parameters in dropdown
- Show only completed AED jobs on the AED list page
- A new parameter added to Clustering called "Max. Cluster Size"

Resolve issues:

- Fix long name of CNN shows over the details and alignment of selecting bars

Performance improvements:

- Switch to the Ingest Service support for uploading files

## v3.0.64 - October 24, 2022

New features:

- Add the learn more section for a new PM job
- Add the ability to delete AED/ Clustering job
- Display the note on the new AED form if the Max frequency more then Min frequency

## v3.0.63 - October 08, 2022

New features:

- Add Songmeter meta support
- Add an audio event detection and clustering toggle from the Admin page
- Add system status link to footer
- Run recording delete job from the Arbimon repo

Resolved issues:

- The downloaded file is able used to upload
- Update the desktop app panel to be full-width with yellow
- Fix the spinner problem on the Clustering's create form
- Remove species validation when the user removes any project species
- Update bucket for the AED/clustering assets
- Fix a tag popup window issue on the Visualizer page

## v3.0.62 - September 19, 2022

Resolve issues:

- Downloaded audio from visualizer cannot use to upload
- Clustering toggle should rely on AED toggle

Performance improvements:

- Keep deleted recording in the recordings_deleted table to sync this data with the Biodiversity website
- Added `deleted_at` column to the sites table to sync deleted sites with the Biodiversity website

## v3.0.61 - August 31, 2022

Resolved issues:

- Change NI to `0` in the Occupancy models format
- #1056 Make desktop app more prominent

## v3.0.60 - August 28, 2022

Resolved issues:

- Training sets/templates popup issue is fixed on the spectrogram visualizer
- Use cached metrics for highlighted projects on the homepage

## v3.0.59 - August 10, 2022

Resolved issues:

- Removed `UMAP` clustering visualization type
- Show 0 frequency in the AED pop-up, if the box frequency equals to 0
- Fixed the issue about long loading website metrics on the Homepage

## v3.0.56 - June 24, 2022

Resolved issues:

- Fixed an issue with searching templates
- Disable create pattern matching button when the saving process is in a progress

## v3.0.55 - June 22, 2022

Resolved issues:

- Fixed an issue with date range format to create a new playlist
- Fixed an issue with datetime format for lambda function

## v3.0.54 - June 03, 2022

Resolved issues:

- #991 Fixed an issue with export recordings tags
- Fixed the issue with deleting users from projects

## v3.0.53 - May 17, 2022

Resolved issues:

- Delete legacy part of the ingest endpoint which has been syncing GuardianSites
- Show error and rollback action if user role assignment is failed on Core API side
- #933 Use moment timezone instead of convert_tz to get local datetime
- Fixed the issue with blank ROI images which appearing when the user opened the cluster Grid View

## v3.0.52 - May 13, 2022

New features:

- #923 User has an ability to unvalidate audio event detections boxes on the Visualizer Page
- #928 An ability to export sites data is added
- #919 An ability to listen to recordings in a browser is added

## v3.0.51 - May 06, 2022

New features:

- #920 The pagination is added to the Templates page

Resolved issues:

- #958 Fixed an issue with getting thumbnails images for RFM's recordings uploaded with Uploader App

## v3.0.50 - April 29, 2022

New features:

- #926 User is able to invite and assign a role a new user who have never been registered in the system

## v3.0.49 - April 12, 2022

New features:

- #885 User is able to switch between square and original size images on the Grid View page

Resolved issues:

- #918 Display clusters names for View all clusters logic
- #913 Fixed parsing temperature issue from the meta column
- #918 Display clusters names for View all clusters logic
- Temporarily disable the Explorer button
- #917 Display validated species from the Grid View page on the Visualizer - Species Presence Validation
- #917 Display validated species from the Grid View page in the recordings filters on the Recording page

## v3.0.48 - March 04, 2022

New features:

- #886 The validation bar is pined on the Grid View page
- #886 Display validation icon after making a validation on the Grid View page
- #892 The user is able to search pattern matchings jobs by name and template
- #906 User is able to see all clusters with View All Clusters button on the Clustering detail page

Resolved issues:

- #886 Fixed the issue with removing selected clusters frequency in the filter
- #886 Fixed the issue with a chronological order of audio event detection jobs
- #886 Unselect selected boxes after making the validation on the Grid View page
- #892 Fixed the issue related with searching pattern matchings jobs by name and template

## v3.0.47 - February 17, 2022

New features:

- #882 Added button to validate species from the Grid View page
- #868 Users are able view playlist in the public projects
- Area Threshold parameter is added to a new audio event detection job

Performance improvements:

- Total recordings count for each playlist is calculated and saved on create or combine action

## v3.0.46 - January 31, 2022

New features:

- #852 User can validate audio event detection boxes with all species from Arbimon DB from the Grid View page
- #852 Changed the selection boxes logic on the Grid View page: selected boxes are saved in a playlist

Resolved issues:

- #867 Display audio event detection boxes in the original size
- #883 Fixed the issue with the clustering filter

## v3.0.45 - January 21, 2022

New features:

- #849 Detections boxes have different colors on the spectrogram
- #852 The species form is added to add a new species to the Grid View page
- #848 Display audio event jobs parameters on Visualizer page

Resolved issues:

- #864 Display all project tags in the new tag dropdown for the initial state
- #850 Fixed the issue with selection of filtered clusters by top right selector
- #850 Fixed the issue with a long time uploading of the playlist audio events detections on the Visualizer page
- #850 Get audio events detections frequency data from storage s3 side for the Clustering detail page
- #850 Duration Threshold and Bandwidth Threshold parameters are added to the new audio event detection job form

## v3.0.44 - January 05, 2022

New features:

- Pagination component is added to the Grid View page
- Provide more details for each parameters in the new AED form
- Definitions are added for main buttons/function in the cluster details page

Resolved issues:

- #829 Fixed a style issue with a long job's name which broke UI
- #829 Fixed a style issue with an indent on the Jobs page
- #829 Display the title for the name cell into tables on the Analysis, Data, Jobs, Citizen Scientist tabs
- Hotfix total pattern matchings count

Other:

- #418 Arbimon link to point to bio.rfcx.org instead of ba.rfcx.org ia updated

## v3.0.43 - December XX, 2021

New features:

- Add biodiversity analytics link to nav bar menu
- Pagination component is added to the PM list page

Resolved issues:

- Use a pagination for a temporary clustering playlist selected with the Context View menu
- Clear recordings data when the user selects the next playlist after a temporary clustering playlist
- Display the cluster name for the one selected cluster
- The greyed-out boxes should be the ones left out of the clustering playlist
- The issue with displaying audio events boxes after one cluster selection is fixed
- Spinner is added to the recordings list in the playlist state
- Fixed the issue with getting a new playlist id on the Clustering: Grid View page
- Use a pagination for a temporary clustering playlist selected with the Context View menu
- Clear recordings data when the user selects the next playlist after a temporary clustering playlist
- Display the cluster name for the one selected cluster
- The greyed-out boxes should be the ones left out of the clustering playlist
- When creating a site send project's "private" attribute as stream visibility type

Performance improvements:

- Requests types are changed from get to post to support getting a big data for the clustering jobs
- Do not include unnecessary attributes to query to get audio events boxes for playlist view on the Visualizer page

## v3.0.42 - November 26, 2021

New features:

- CE-1454 Species and Song type are added in the Pattern Matching export report
- CE-1343 Frequency is added in the Pattern Matching export report

Resolved issues:

- Display recordings uploaded time with timezone offset
- CE-1487 The issue with a count of recordings validations is fixed in the CSV export report
- CE-1487 Do not show the label `Select all species` in the empty validations list of the Export recording form
- CE-1510 Fixed total validations RFM
- CE-1521 The logic is updated for the grouping species report by including all existing dates/hours
- CE-1534 Fixed location of controls buttons in the player on the visualizer page
- CE-1495 The issue with showing up correct recordings is fixed when the user changes the date in the calendar on the Visualizer page

Performance improvements:

- #798 Use WebGL for clustering tool rendering

## v3.0.41 - November 17, 2021

Resolved issues:

- CE-1455 Fixed issue with moving of the navigation bar when there is a long project name
- CE-1488 Fixed recordings' names in the pattern matchings export file

Other:

- CE-1502 Display 10 items per page in the pagination of Visualizer playlists

## v3.0.40 - October 19, 2021

Resolved issues:

- CE-1425 Do not update project_id for site if the value is not changed
- CE-1468 Fix issue with deleting a site

Known issues:

- The project owner can't change imported site's data

## v3.0.39 - October 07, 2021

Resolved issues:

- The issue with getting all species grouped detections is fixed
- CE-1398 Regex logic is updated for audio path
- CE-1398 The inability to hear recordings is fixed in the Visualizer page via Safari browser

## v3.0.38 - October 01, 2021

New feature:

- CE-1380 Support open project with RFCx project id

Resolved issues:

- The label is wrapping to the next strings for the final box on the spectrogram
- Fixed the issue with changing the position of a recording
- CE-1371 The migration popup is deleted
- CE-1342 ROI template issue is fixed
- The Longitude issue is fixed
- CE-1414 The issue with updating projects is fixed

## v3.0.37 - September 16, 2021

Resolved issues:

- CE-1370 Present validations using PM results are visible in the Training Sets
- CE-1378 Save recordings with validated species to the playlist
- CE-1375 Cases of auto-generated filename are removed

## v3.0.36 - September 10, 2021

New features:

- CE-1225 The URL Column is added to the export record sheet
- CE-1267 The URL Column is added to the Pattern Matching Export CSV sheet
- CE-1219 Users can reset validation on the spectrogram boxes

Resolved issues:

- CE-1266 Fixed the date and time columns issues in the Pattern Matching Export CSV sheet
- CE-1257 User role permissions are changes. The Citizen Scientist role is removed.
- CE-1251 Minor homepage updates in the Summary section
- CE-1321 Users is able to delete sites in Arbimon
- CE-1312 Fixed filters for hours section on the Recordings page
- CE-1267 The recording name is fixed in the Pattern Matching Export CSV sheet
- CE-1309 Download the recording with the original frequency from the Visualizer page

## v3.0.35 - August 25, 2021

New features:

- CE-1224 An UI for the job/template information is updated in the Pattern matching details page

Resolved issues:

- CE-1183 Fixed filter in the recordings page. The user is able to select the month of January
- CE-1221 The login page is disabled
- CE-1230 Fix the issue with filtered recordings by species
- CE-1185 The issue with the end date in the datepicker is fixed
- CE-834 Fixed issue with the cluster audio frequency filter
- CE-1231 Check the logic to add a new species/song to the project_classes table when the user validate PM box from the PM page

## v3.0.34 - August XX, 2021

New features:

- CE-1101 A search bar is updated for projects across Arbimon
- CE-1136 A Summary stats data is added to the Home page
- CE-1105 The project list is updated on the Home page

Resolved issues:

- CE-1197 Change wording when choosing filename format in the uploads page
- CE-1183 Fixed filter in the recordings page. The user is able to select the month of January

## v3.0.33-hotfix.0 - August 03, 2021

Resolved issues:
- Update "Present", "Not present" filters on Pattern Matching details page to request results for all sites
- Fix pagination total count calculation for "Present", "Not present", "Score" filters

## v3.0.33 - August 03, 2021

New features:

- CE-1109 User can open Explorer from Arbimon Visualizer (only recordings uploaded with Uploader App)
- CE-1110 User can scale spectrogram in Visualizer to standard frequencies

Performance improvements:

- CE-988 The datime_local column is removed
- CE-1143 Update "Unvalidated", "All", "Present", "Not present", "200 top scores per site", "Score per site" filters on Pattern Matching details page to return results per site
- CE-1158 update PM filters logic so "Best per Site" and "Best per Site, Day" return results by 20 sites batches
- CE-1067 Speed up recordings queries which search by selected sites on Recordings and Visualizer pages
- CE-1070 Speed up recordings total count endpoint
- CE-1063 Delete project stats bar from Summary page
- CE-1066 Add database index for soundscape composition classes annotations table

## v3.0.32 - June 26, 2021

Performance improvements:

- CE-1065 Patten Matching list loads quicker
- CE-1068 CNN list page loads quicker
- CE-1069 CNN job details loads quicker
- CE-323 When user creates/edits/deletes a project role for another user in Arbimon it's synced with Core API in transactions
- CE-1046 The synchronization to work in transactions between Arbimon and RFCx is updated

Resolved issues:

- CE-1160 The opacity of PM' results is decreased on the Visualizer page
- CE-1004 Fixed issue with pixelated ROI boxes in Safari browser

## v3.0.31 - July 14, 2021

New features:

- CE-791 Changed export attributes for the recording data
- CE-791 Added item `Select all species` to the validations dropdown
- The ability to export Occupancy Model Format is added for each species
- CE-790 Add pattern matching filter to view top 200 scores per each site
- CE-856 Add feature to export names/emails of all users
- CE-753 Pattern Matching results are saved as species validations
- The ability to export Detections grouped by site, date, hour
- The Date attribute is included in the Recording data
- CE-987 Add the number of species validated on the Summary page
- Display the name of species on the spectrogram
- CE-1035 Loading filename in visualizer still shows funky code
- CE-1095 Heavy exports are only possible by super admins
- CE-1093 The color of Species boxes is changed on the spectrogram

Resolved issues:

- CE-791 Fixed MySQL issue to process more than 61 validations in the user selection
- CE-791 Fixed MySQL issue with ordering from the default site to datetime if the site attribute is excluded
- CE-981 Combine user data from firstname and lastname on the RFM page
- CE-971 Update regex function to parsing AudioMoth data in different cases

Performance improvements:

- CE-1062 Site list on PM details page shows only those sites which have ROIs
- CE-1062 Load only one site per page for "Best per Site" filter
- CE-1062 Load only one site per page for "Best per Site, Day" filter
- CE-1064 Update Pattern Matching query for Citizen Scientist PM list page

## v3.0.30 - June XX, 2021

Other:

- The columns order is changed on the recording page
- Show "Unknown" if the recording hasn't in the file name data
- CE-940 Update the text for the Recordings data in the Summary page
- CE-792 Save validated rois in the recording validations table

Resolved issues:

- CE-689 Map should default back to showing all pins for all sites
- Fix sort per cluster not working
- CE-928 Do not cut templates in half or displaying other regions of the spectrogram
- CE-851 Hotfix parsing filename from the meta column
- Display the original filenames in models
- CE-785 Spinner in recordings filter not stop when have 0 recording
- CE-751 Display selected recording if the site has many recordings with the similar datetime
- Hotfix displaying the original filename in the export recordings report

## v3.0.29-hotfix.0 - June 16, 2021

Performance improvements:

- Improve project tags query
- Load full list of sites for Pattern Matching ROIs list instead of playlist-related sites
- Re-implement Pattern Matching Best Per Site and Best Per site Day queries

Other:

- CE-880 Beta tag on CNN, AE & clustering

Other:

- CE-880 Beta tag on CNN, AE & clustering

## v3.0.29 - June 14, 2021

New features:

- CE-715 Add tool tip over recording column name
- CE-884 Remove monster profile picture on Project Users page

Resolved issues:

- CE-853 Display featured projects on the My Projects tab if the user has the role in this project
- CE-837 Use pagination instead of dropdown on Pattern Matching details page
- Show correct year in the footer (now based on js code)

## v3.0.28-hotfix.0 - June 14, 2021

Resolved issues:

- CE-935 Disable denorm-* calculation for pattern matching rois on best per site / best per day queries

## v3.0.28 - June 07, 2021

Resolved issues:

- CE-875 Hotfix creating a new playlist after filtering species with presence validations

## v3.0.27 - June 07, 2021

New features:

- CE-731 Add button to select Clustering Visualization Type
- CE-824 Replace monster profile picture with RFCx profile pic if available
- CE-724 Can view results from specific AED job if multiple have been run on the same playlist

Resolved issues:

- CE-788 Fix export data in the Data Recordings tab
- Hotfix styles in the home page
- Hotfix creating a new playlist after filtering species with presence validations

## v3.0.26 - June 01, 2021

New features:

- CE-504 Revamp Arbimon homepage
- CE-763 Add info to top highlighted project cards

Resolved issues:
- CE-827 Set the limit to the number of boxes show on one Grid View page

## v3.0.25 - May 28, 2021

New features:

- CE-742 The user can only add users to a project who are RFCx-connected

Resolved issues:

- CE-697 Convert datetime with timezone offsets for browser AudioMoth recordings
- CE-683 Fix creating soundscape composition classes
- CE-683 Display system classes with project soundscape composition classes
- CE-730 Don't show coordinates of points in Clustering scatter plot when hovering over
- CE-729 Remove redundant icon in cluster selector
- Fix sorting issue on the Grid View page
- CE-723 Selected visualizer link in Grid View opens ROI in the Visualizer

Performance improvements:

- CE-623 Extend amount of time users can stay logged into Arbimon
- CE-686 Save source file name from Core API into recordings
- CE-639 Optimize query which gets list if sites on Pattern Matching ROIs list page
- CE-740 Optimize query which gets all project jobs progress
- CE-740 Optimize query which gets cnn rois by adding missing index

## v3.0.24 - May 21, 2021

New features:

- CE-694 Change migration banner to popup

Performance improvements:

- CE-639 Optimize recordings tags query to use proper indexes
- CE-639 Optimize recordings count query for sites list; do not request counts when they are not needed
- CE-639 Recordings page filters: do not request time bounds and recordings count separately - get them from main recordings query result.
- CE-639 Refactor playlist creation to support large playlists (up to 1 million recordings)

Resolved issues:

- Show spinner while search is processing on Projects page; Hide "Add project" button on Explore projects page. Do not show search form for guests.
- CE-639 Fix recordings query for project which does not have any sites
- CE-639 Disable filter buttons on Recordings page while recordings are loading from server

Other:

- CE-686 Save source file name from Core API into recordings

## v3.0.23 - May 14, 2021

New features:

- CE-501 Ability to delete project
- CE-499 Display top projects in the Explore Projects tab
- CE-503 Users added to arbimon needs to access project site list throughout platform

Resolved issues:

- Fix site name and coordinates not updated in Arbimon when edited in the Companion app
- CE-696 Hotfix Arbimon only badge in the batch info popup
- Hotfix scrolling down for the recordings list with several items
- CE-520 Fix font color in soundscapes pop-up scale value

## v3.0.22-hotfix.0 - May 09, 2021

Resolved issues:

- CE-673 Add timezone offsets to recordings datetime ingested from Companion/Uploader apps
- CE-673 Add datetime_utc column and use it for assets
- Hotfix adding external_id in async function for imported sites

## v3.0.22 - May 04, 2021

New features:

- CE-523 User is able to scroll through nearby recordings when clicking thru to visualizer page
- CE-496 Move the Last updated column to the right in the sites table. Add default site sort by Last updated
- CE-507 My projects should include projects where you have been added as a user
- CE-529 Change pattern matching threshold default value
- CE-495 Add files metadata to the Recordings page

Resolved issues:

- Do not convert recordings datetime with timezone on the Visualizer page

Other:

- Update ingest recordings create endpoint to receive multiple recordings
- Display recordings datetime without offsets on the Visualizer page

Performance improvements:

- CE-614 Fix slow basic recordings query by sorting by site_id additionally
- CE-614 Fix playlist creation for large projects; Support playlist creation for large amount of recordings (300k tested); Update UI form to show spinner and disable buttons.

## v3.0.21 - Apr 16, 2021

New features:

- PI-520 Modify the Arbimon upload page

Resolved issues:
- PI-714 Fix timezone issue for calendar on the Visualizer page
- PI-731 Bounding box is no longer visible in the Pattern Matching for Citizen Scientist users
- PI-732 User unable to create PM template
- PI-730 Fix blank Visualizer page in Pattern Matching - Expert's View part in Citizen Scientist
- Support for Core API v1.1.x changes
- PI-739 The Visualizer page not loading before switching tabs
- CE-537 Fix the location of the legend for the scatter plot
- CE-538 Change the type of the request for getting recordings by aed ids

Performance improvements:

- CE-438 Do not request counts for proj where sites > 100 and recs > 100000
- CE-451 Update code logic for determining recordings "legacy" attribute

## v3.0.20 - Mar 30, 2021

New features:

- CE-336 Display the Visualizer page for Citizen Scientist users

Other:

- Disable buttons on Recordings page while data is loading

## v3.0.19 - Mar 27, 2021

Resolved issues:

- CE-416 Not being able to filter recordings by sites date time

## v3.0.18 - Mar 26, 2021

Resolved issues:

- CE-416 Not being able to filter recordings by sites date time


## v3.0.18 - Mar 25, 2021

Resolved issues:

- PI-639 PI-689 Fix users unable to open spectrograms in visualizer page
- DB query tuning
- Hotfix displaying AED boxes on the Visualizer page

Other:

- Summary page is updated

## v3.0.17 - Mar 22, 2021

Resolved issues:
- PI-524 Users shouldn't see auth0 format for usernames
- PI-583 Fix error getting soundscape annotation classes
- PI-680 Fix inability to create playlists for recordings with tags

## v3.0.16-hotfix.0 - Mar 18, 2021

Performance improvements:
- Do not check for duplicates in the recordings ingest endpoint

## v3.0.15 - Mar 08, 2021

New features:
- PI-548 Display the site updated date on the Site page
- PI-503 Change the ordering of pages on Analysis tab

Resolved issues:
- PI-622 PI-433 Fix issue with displaying related playlist, duplicated AED jobs
- PI-546 Fix Pattern Matching results that do not play

## v3.0.14 - Mar 05, 2021

Resolved issues:
- Delete `minimum` constraint from altitude parameter
- Add `external_id` into attributes of project creation function

## v3.0.13 - Mar 02, 2021

New features:
- CE-174 rework streams-sites unification

## v3.0.12 - Feb 27, 2021

New features:
- PI-574 Default map on the sites page should display sites
- PI-609/PI-252 Get Companions' images and show them for a current site
- PI-563 Fix timezone issue where AudioMoth UTC timezone is not translated
- CE-203 add endpoint for site update from Core API

Resolved issues:
- PI-495 Fix fuzzy images for Pattern Matching boxes in Chrome browser

## v3.0.11 - Feb 22, 2021

New features:
- CS-494 Request spectrogram tiles from Media API for audios from RFCx streams
- PI-270 Add settings to invoke a Kubernetes job for Clustering jobs

Resolved issues:
- PI-545 Improve the quality of the spectrogram image
- PI-504 Can not filter more than one tag
- CS-474 Drop unique constraint on `projects` `name` column

Other:
- PI-496 Change Pattern Matching Sort Options "rois" to "Region of Interest"
- PI-425 Change The Red Font to White Font in "Change Plan"

## v3.0.10 - Feb 18, 2021

Resolved issues:
- PI-495 Hot fix pixelated styles for Pattern Matching boxes
- PI-215 Fix the Random Forest Models (RFM) creation error

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
