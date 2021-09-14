# Arbimon Test Notes
Test Notes are used to list what pages / components / features / user flows are affected by each update.

## v3.0.37

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
