# Arbimon Test Notes
Test Notes are used to list what pages / components / features / user flows are affected by each update.

## v3.0.80

- Check for duplicate stream name when creating/updating or moving stream to another project
  - Try to create stream with existing name in the projet - app should return an error
  - Try to rename existing stream to existing name in the project - app should return an error
  - Try to move existing stream to another project where there is another stream with the same name - app should return an error
  - Try to move existing stream with a different name + rename it to another project where there is another stream with the same name - app should return an error

## v3.0.69

- Improve web-uploader to be able upload long recordings
  - The user can upload long recordings.


## v3.0.68
- Remove stream segment and the file from s3 side when deleting core recordings
  - The user uploads new recordings to stream. The user remove these recordings from the Arbimon: Recordings page. The user can upload the same recordings again.
  - The user uploads new recordings to stream. The user makes any recording validations on the Visualizer page. The user remove these recordings from the Arbimon: Recordings page. The user can upload the same recordings again.
  - We can not remove the recordings which are used in the analysis jobs.
  - Please check the same test case for the tags.

## v3.0.67

- Remove some logic from upload process
  - Test that flac and wav are uploaded successfully, and show correctly in Recordings page

## v3.0.63

- Add SongMeter file type support
  - When user uploads a file from SongMeter, the "recorder" field is set to "SongMeter" for this file
  - Comments field on Recordings page shows SongMeter id and gain value
  - AudioMoth comments still show correct info

## v3.0.53

- Delete legacy part of the ingest endpoint which has been syncing GuardianSites
  - Test that files upload works fine for existing sites
  - Test that files upload works fine for newly creates project and site
- Show error and rollback action if user role assignment is failed on Core API side
  - Check that user can access a project which I have shared with him on Settings page
  - Check that user role change works fine

## v3.0.50
- #926 User is able to invite and assign a role a new user who have never been registered in the system
  - Test that user can still add a role to existing user
  - Test that user can invite completely new user
    - This new user has access to a shared project

## v3.0.49

- #917 Display validated species from the Grid View page on the Visualizer - Species Presence Validation
  - Grid View page: the user validates any box. The user goes to the Visualizer page. The user sees the Present value in the Species Presence Validation section. The user check the count of validated species near with Species Presence Validation label. The count is include a new species which the user just validated. The user clicks on eye icon near with Species Presence Validation label and sees the box on the spectrogram.
  - Grid View page: the user validates the same box with the same species/songtype like in the previous case. The user goes to the Visualizer page. The user sees the Present value in the Species Presence Validation section. The user check the count of validated species near with Species Presence Validation label. The count is NOT include the species which the user just validated.
- #917 Display validated species from the Grid View page in the recordings filters on the Recording page
  - Grid View page: the user validates any box. The user goes to the Recordings page and opens filters. The user finds validated species. The user selects that species and gets all related recording/s. The user navigates to the Visualizer page from the Recordings page. The user checks the step above related with Species Presence Validation menu.

## v3.0.48

- #886 The validation bar is pined on the Grid View page
  - Grid View page: Pin the validation bar so that when the user is looking at a large grid view page, it would be easy to validate species ( users will not need to scroll all their way back to validate species).
- #886 Display validation icon after making a validation on the Grid View page
  - Grid View page: Automatically include a checkmark on validated ROIs.
- #886 Fixed the issue with removing selected clusters frequency in the filter
  - Grid View page: The user adds a filter frequency. The user can to remove the filter and see the original plot without refreshing the page.
- #886 Fixed the issue with a chronological order of audio event detection jobs
 - AED page: organize AED jobs in chronological order by date and hour.
- #886 Unselect selected boxes after making the validation on the Grid View page
  - Grid View page: Automatically deselect ROIs that have been validated.
- #892 The user is able to search pattern matchings jobs by name and template
- #892 Fixed the issue related with searching pattern matchings jobs by name and template
  - Pattern Matchings page: the user sees the search area above the table. The user is able serch jobs by PM name or templates. The uses sees the searching results or the message: No pattern matchings found. There is the pagination component if the count of results is more than 10 items. The impotant thing: the total pages are different for each serching result.

## v3.0.47

- Total recordings count for each playlist is calculated and saved on create or combine action
  - Check that playlist creation still works fine
  - Check that playlists union still works fine

## v3.0.45

- #845 Fixed the issue with selection of filtered clusters by top right selector
  - Clustering details page: the user filtered data by frequency filter. The user selects any shape by clustering selector on the top right corner. The user navigates to the Grid View page. The user sees only selected dots, not all dots in the original shape.
  - Clustering details page: the user returns to the clustering details page. The user selects any shape by clustering selector on the top right corner without filtering the data. The user navigates to the Grid View page. The user sees all dots in the original shape.

## v3.0.44

- Pagination component is added to the Grid View page
  - Clustering page: The user selects less than 100 dots on the Clustering details page. The user navigates to the Grid View page. The user can't see the pagination component on the bottom of the page.
  - Clustering page: The user selects more than 100 dots on the Clustering details page. The user navigates to the Grid View page. The user sees the pagination component on the bottom of the page. The user can exclude some of the boxes from the page. The user navigates to the next page. When the user returns to the first page the user still sees selected boxes.
  - Clustering page: The user selects more than 100 dots on the Clustering details page. The user navigates to the Grid View page. The user sees the pagination component on the bottom of the page. The user can exclude some of the boxes from the page. The user navigates to the next page. The user excludes any boxes from the second page (It takes to exclude most of the boxes to facilitate calculation of the boxes on the Visualizer page. The count of not selected boxes should be equal to the count of all boxes in the future playlist on the Visualizer page). The user creates a new playlist with all non selected boxes through all pagination pages. the user navigates to the Visualizer page. The user sees all boxes, which are not selected on the Grid View page.

## v3.0.43

- Use a pagination for a temporary clustering playlist selected with the Context View menu
  - Clustering page: The user selects any clustering job. The user selects an one any big cluster/shape on the scatter plot. The user sees a selected shape. The user sees the toggle menu with two buttons on the right side. The user clicks on the Context View button. The user navigates to the Visualizer page. The user sees a temporary playlist in the playlist name area. The user sees the pagination component under the playlist name. The user can click on the pages and the list will be updated.
- Do not include unnecessary attributes to query to get audio events boxes for playlist view on the Visualizer page
  - The audio events endpoint gets the response without a user data and parameters in the details.
- Clear recordings data when the user selects the next playlist after a temporary clustering playlist
  - The request for a playlist data does not include the recordings from the clustering playlist.
- The issue with displaying audio events boxes after one cluster selection is fixed
  - Clustering page: The user selects any clustering job. The user selects an one any cluster on the scatter plot. The user sees a selected shape. The user sees the toggle menu with two buttons on the right side. The user clicks on the Grid View button. The user navigates to the Grid View page. The user sees the audio events boxes and the name of the cluster under the boxes.
  - Clustering page: The user selects any clustering job. The user selects an one any cluster on the clusters selection form. The user sees a selected shape. The user sees that selected cluster has color and name on the legend side. The user sees the toggle menu with two buttons on the right side. The user clicks on the Grid View button. The user navigates to the Grid View page. The user sees the audio events boxes and the name of the cluster under the boxes. The name is the same as user sees on the legend side.
  - #3 Clustering page: The user selects any clustering job. The user selects an one any cluster on the scatter plot. The user sees a selected shape. The user sees the toggle menu with two buttons on the right side. The user clicks on the Grid View button. The user navigates to the Grid View page. The user sees the audio events boxes and the name of the cluster under the boxes. The user can exclude some boxes by clicking on them. The user can create a new playlist with selected boxes. The user goes to the Visualizer page and selects the playlist. The user enables the clusters playlist in the Audio Events area on the left bar. The user will see the boxes which were selected before on the Grid View page.
  - #4 Clustering page: The user selects any clustering job. The user selects an one any cluster on the scatter plot. The user sees a selected shape. The user sees the toggle menu with two buttons on the right side. The user clicks on the Grid Context button. The user navigates to the Visualizer page. The user sees the temporary playlist in the name of playlists. The user sees the audio events boxes on the spectrogram. The user clicks on any recording in the temporary playlist and sees the boxes. Also, the user sees the Audio Events menu on the left bar and can enable different clustering boxes if they exist. The user can create a new playlist by clicking on '+' button. The user navigates to the Playlists page. The user sees the new playlist in the list. The user navigates to the Visualizer page, reloads the page and selects the playlist. The user enables the Cluster playlist. The user sees the boxes.
  - Clustering page: The user selects any clustering job. The user selects a big one cluster on the scatter plot. The user sees a selected big shape. The user sees the toggle menu with two buttons on the right side. The user clicks on the Context View button. The user navigates to the Visualizer page. The user sees temporary playlist name. The user sees the spinner. It takes some time to get the recording. The user clicks om the recording. The user sees the audio events box/boxes.
  - Check any places where the user navigates to the Visualizer playlist.

- #798 Use WebGL for clustering tool rendering
  - User can see the chart with dots and shapes
  - User can zoom in / out using mouse wheel, zoom in / out buttons
  - User can select set of dots using either box selection tool or lasso tool
  - User can open Grid view or Context view with selected set of dots

## v3.0.42

- CE-1487 The issue with a count of recordings validations is fixed in the CSV export report
  - Recordings page: Click on the Export button. Select any validations. Click on the Export Data button. The count of total validations data should be equal the data in the Export form.

## v3.0.42

- CE-1495 The issue with showing up correct recordings is fixed when the user changes the date in the calendar on the Visualizer page
  - Recordings page: Click on the View in Vizualizer button. Navigates to the Visualizer page. Check a correct site and a date in the calendar. The spectrogram display the recording. Select another date. Check that all recordings in the list have the same date.
  - Pattern Matchings details page: Click on the View in Vizualizer button. Navigates to the Visualizer page. Check a correct site and a date in the calendar. The spectrogram display the recording. Select another date. Check that all recordings in the list have the same date.
  - Visualizer page: Select any site and date. Open any recording. Check a correct site and a date in the calendar. The spectrogram display the recording. Select another date. Check that all recordings in the list have the same date.
  - Check all places with View in Vizualizer button. Select another date. Check that all recordings in the list have the same date.
- CE-1510 Fixed total validations RFM
  - Analysis tab: RFM page: Create a new model: The user selects Classifier, Training Set and enters a new model name. The user sees the total value as the present and absent together.

## v3.0.41

- CE-1502 Display 10 items per page in the pagination of Visualizer playlists
  - Visualizer page: Open any recordings playlist. Check that list show 10 items in the playlist. Move to different pagination pages. Select any recording in the playlist. Reload the page. Check the pagination state.
  - Visualizer page: Open any soundscapes playlist. Click on the soundscape box/ or create any test box. Click on the view button to navigate to the related recordings playlist. Check that list show 10 items in the playlist. Move to different pagination pages. Select any recording in the playlist. Reload the page. Check the pagination state.
  -

## v3.0.40

- CE-1425 Do not update project_id for site if the value is not changed
  - Site page in the own project: Edit any data except the project. Check a new data in the Companion/Uploader/Ranger apps
  - Site page in the own project: Edit the project. Check a new data in the Companion/Uploader/Ranger apps
  - Site page in the own project: Edit all rows. Check a new data in the Companion/Uploader/Ranger apps
  - Site page in any project with the Amin role: Edit any data except the project. Check a new data in the Companion/Uploader/Ranger apps
  - Site page in any project with the Amin role: Edit the project. Check a new data in the Companion/Uploader/Ranger apps
  - Site page in any project with the Amin role: Edit all rows. Check a new data in the Companion/Uploader/Ranger apps
  - Known issues: The project owner can't change imported site's data


## v3.0.39
- The issue with getting all species grouped detections is fixed
  - Recordings page: check all types of exports in the Export reports filter
- CE-1398 The inability to hear recordings is fixed in the Visualizer page via Safari browser
  - Visualizer page: the user can select any site and date in the calendar in the Safari/Chrome
  - Visualizer page: the user is able to hear the sound in the Safari/Chrome
  - Visualizer page: the user is able to move on the recording in the Safari/Chrome
  - Visualizer page: the user can select any playlist in the Safari/Chrome
  - Visualizer page: the user is able to hear the recording sound in the playlist in Safari/Chrome
  - Visualizer page: the user is able to move on the recording in the playlist in the Safari/Chrome
  - Recording page: the user can navigates to the Visualizer page in the Safari/Chrome
  - Pattern Matching page: the user can navigates to the Visualizer page in the Safari/Chrome

## v3.0.37

- CE-1370 Present validations using PM results are visible in the Training Sets
 - the test cases here: https://jira.rfcx.org/secure/Tests.jspa#/testCase/WB-T257
- CE-1378 Save recordings with validated species to the playlist
 - the test cases here: https://jira.rfcx.org/secure/Tests.jspa#/project/10700/testCase?folderId=76
- CE-1375 Cases of auto-generated filename are removed
  - The test case: https://jira.rfcx.org/secure/Tests.jspa#/project/10700/testCase?folderId=76

## v3.0.36

 - CE-1266 Fixed the date and time columns issues in the Pattern Matching Export CSV sheet
 - Pattern Matching details page: Export CSV: The user can see different columns in the report, like a year, month, day, hour, minute
 - CE-1219 Users can reset validation on the spectrogram boxes
  - Visualizer page: The user hovers on the blue box. The user will see the deleting icon. The user can click on the icon. The user will see the popup window with the suggestion to remove the species on the spectrogram. The user can confirm or reject the suggestion.
  - The user validates any box on the Pattern Matching details page. The user navigates to the Visualizer page. The user will see the validated box on the spectrogram. The user can click on the icon. The user will see the popup window with the suggestion to remove the species on the spectrogram. The user confirms the suggestion. The box is hidden. The original Pattern Matching box is not validated on the Pettern Matching details page.
- CE-1266 Fixed the date and time columns issues in the Pattern Matching Export CSV sheet
  - Pattern Matching details page: Export CSV: The user can see different columns in the report, like a year, month, day, hour, minute
- CE-1225 The URL Column is added to the export record sheet
  - Recordings page: Export: Select url as parameter in the recording data: The user can downloads any recording from the export record sheet
- CE-1309 Download the recording with the original frequency from the Visualizer page
  - Visualizer page: The downloaded recording should be with the original frequency.

## v3.0.35

- CE-1183 Fixed filter in the recordings page. The user is able to select the month of January
  -  The user selects "Date and Time" filter for month of January. The user sees the recordings with the selected date.
  -  The user selects "Range", "Date and Time" filters for month of January. The user sees the recordings with the selected date.
  -  The user selects "Date and Time" filter for month of February. The user sees the recordings with the selected date.
  -  Setting the "Range" filter in February, while keeping January in "Date and Time" filter. The result supposed to be zero records, because January is outside the range.
  - Setting the "Range" filter in February, while setting month of March in "Date and Time" filter. The result is no records, because March is outside the Range.
 - CE-1224 An UI for the job/template information is updated in the Pattern matching details page
    - Check the UI part with the design document, here: "www.figma.com/file/ZysU4lDTupV2O1ngysKTfL/Arbimon---PM-Result?node-id=0%3A1"
- CE-1221 The login page is disabled
  - The not logged-in user navigates to /login page. The user will see the Homepage.
  - The logged-in user navigates to /login page. The user will see the Projects page.
- CE-1230 Fix the issue with filtered recordings by species
  - Recordings page: Filers: The user selects any type of Validations with present and absent species count. The User selects Present value. The user clicks on the Apply filters button. The User see the count of Present recordings for selected species type. The count of total recordings equal the count of present value in the filter.
  - Recordings page: Filers: The user selects any type of Validations with present and absent species count. The User selects Absent value. The user clicks on the Apply filters button. The User see the count of Absent recordings for selected species type. The count of total recordings equal the count of absent value in the filter.
  - Recordings page: Filers: The user selects any type of Validations with present and absent species count. The User does not select Present or Absent value. The user clicks on the Apply filters button. The User see the count of all Present and Absent recordings for selected species type.
- CE-1185 The issue with the end date in the datepicker is fixed
  - When a user selects a date range, the start and end dates are selected as picked, after pressing "Apply filters". The end date does not select as the next day.
  - The date sending to the API should be, like that: range: {"from":"2015-10-01T00:00:00.000Z","to":"2015-10-02T23:59:59.999Z"}
- CE-834 Fixed issue with the cluster audio frequency filter
  - Analysis tab: Clustering tab: Clustering job page: The user asks for events between 1 and 9 kHz. The filter is returning events with requirement frequency. The user selects the dots and navigates to the Visualizer page. The user sees all selected boxes with the right frequency.
- CE-1231 Check the logic to add a new species/song to the project_classes table when the user validate PM box from the PM page
  - Select Pattern Matching and it should not have the species/song on visualizer page
  (Ex. In PM page is the "Contopus virens, Common Song" but it should not have "Contopus virens, Common Song" in species list on visualizer page)
  - Validate "Present" on PM box from the PM page
  - Open visualizer page, it will see the species/song (Contopus virens, Common Song) in species list

## v3.0.34

- CE-1101 A search bar is updated for projects across Arbimon
  - Test that user sees the the search input in navbar and can search all projects across Arbimon. Any public projects or ones the user has access to.
  - The search input text should say “Search projects”
  - The user can see scroll bar to see other projects
  - The mobile works correct for different headers/pages. The search bar changes to the search icon for mobile styles. When the user clicks on the search icon it will display the search row below the navbar bar
- CE-1136 A Summary stats data is added to the homepage
  - The spinner is showing while the data is uploading.
  - The summary stats area the same as in the design doc here:  https://docs.google.com/presentation/d/1QT0oqrvQIqYLuB9TvBwm9nVhnHtIuefgx2N42X0rxiI/edit#slide=id.p
  - Supports the mobile styles
- CE-1105 The project list is updated on the Home page
  - Instead of having 3 top tiles, we will feature 9 total projects under Project showcase.
  - The new 6 tiles should be the same format as the top 3.
  - The other projects that were originally small tiles are removed from this page.
  - Supports the mobile styles
- CE-1183 Fixed filter in the recordings page. The user is able to select the month of January
  -  The user selects "Date and Time" filter for month of January. The user sees the recordings with the selected date.
  -  The user selects "Range", "Date and Time" filters for month of January. The user sees the recordings with the selected date.
  -  The user selects "Date and Time" filter for month of February. The user sees the recordings with the selected date.
  -  Setting the "Range" filter in February, while keeping January in "Date and Time" filter. The result supposed to be zero records, because January is outside the range.
  - Setting the "Range" filter in February, while setting month of March in "Date and Time" filter. The result is no records, because March is outside the Range.

## v3.0.33

- CE-1143 Update "Unvalidated", "All", "Present", "Not present", "200 top scores per site", "Score per site" filters on Pattern Matching details page to return results per site
  - Check that all filters still return correct data
  - Check that pagination works correctly for every filter
  - Check that selecting a site with Site List dropdown (icon with map pin) works fine
  - Check that switching between filters does not break any logic
  - Check that you validation feature still works correctly
- CE-1158 update PM filters logic so "Best per Site" and "Best per Site, Day" return results by 20 sites batches
  - Check that these two filters return 20 sites per page (or less if project is small)
  - Check that pagination works correctly for these two filters
  - Check that other filters still work correctly
  - Check that switching between filters, pages, sites, etc works correctly
- CE-1067 Speed up recordings queries which search by selected sites on Recordings and Visualizer pages
  - Check that filters on Recordings page still work correctly
  - Check that pagination on Recordings page still work correctly
  - Check that site list and recordings list on Visualizer page still works correctly
- CE-1070 Speed up recordings total count endpoint
  - Check that total recordings count is still correctly calculated on the homepage
  - Check that total recordings count is still correctly calculated on Project summary page
- CE-1063 Delete project stats bar from Summary page
  - Check that summary page still works correctly
- CE-1066 Add database index for soundscape composition classes annotations table
  - Check that Data -> Soundscape composition classes page works relatively fast

## v3.0.32

- CE-1065 Patten Matching list loads quicker
  - Pattern Matching list page: all data is still shown correctly and table loads quickly
  - Patten Matching details page: all details are still shown correctly (especially total recordings list)
  - Citizen Scientist Pattern Matching list page: all data is still shown correctly
  - Citizen Scientist Pattern Matching details page: all details are still shown correctly
- CE-1068 CNN list page loads quicker
  - CNN list page: all data is still shown correctly and table loads quickly
- CE-1069 CNN job details loads quicker
  - CNN details page: all data is still shown correctly and default filter works quicker
- CE-1004 Fixed issue with pixelated ROI boxes in Safari browser
 - PM details page: all boxes are not pixelated in Safari browser
- CE-1046 The synchronization to work in transactions between Arbimon and RFCx is updated
  - Projects page/Sites page: When the user creates/edits/deleted a new project/site and the issue (authentication, validation issues, etc) is happened it is not add/change the db data in the Arbimon/Core API side.
  - Test that user is still able to create / update / delete projects and create / update / delete sites.

## v3.0.31

- CE-1062 Site list on PM details page shows only those sites which have ROIs
  - Patten Matching details page: dropdown with sites list (button with map pin icon)
  - Patten Matching details page: a list of ROIs which are shown when item from dropdown is selected.
- CE-1062 Load only one site per page for "Best per Site" filter
  - Patten Matching details page: "Best per Site" filter results
  - Patten Matching details page: Pagination when "Best per Site" filter is selected switches sites
  - Patten Matching details page: When site from sites list (button with map pin icon) is selected, it loads results for selected site
- CE-1062 Load only one site per page for "Best per Site, Day" filter
  - Patten Matching details page: "Best per Site, Day" filter results
  - Patten Matching details page: Pagination when "Best per Site, Day" filter is selected switches sites
  - Patten Matching details page: When site from sites list (button with map pin icon) is selected, it loads results for selected site
- CE-1064 Update Pattern Matching query for Citizen Scientist PM list page
  - Citizen Scientist section: Patten Matching page: the list with pattern matchings should load relatively quick
- CE-1110 User can scale spectrogram in Visualizer to standard frequencies
  - Visualizer page: ability of choosing the original Y-scale or 24 Khz scale
  - When the user is switching between frequencies detection boxes are still shown correctly
  - When the user reloads the page it keeps the selected Y-scale so the user does not have to change it on every recording
  - When the recording frequency is 24 kHz or more it shows original Y-scale and the one button with the active state
  - When the user selects 24 Khz scale and the recording frequencies are less than 24 kHz spectrogram is resized and the background has a gray-darker color from the Arbimon color scheme
- CE-323 When user creates/edits/deletes a project role for another user in Arbimon it's synced with Core API in transactions
  - Settings section: Users page: When the user creates/edits/deleted a project role for another user and the issue (authentication, validation issues, etc) is happened it is not change the db data the action in the Arbimon/Core API side
