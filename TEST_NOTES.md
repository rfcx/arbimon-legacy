# Arbimon Test Notes
Test Notes are used to list what pages / components / features / user flows are affected by each update.

- CE-1185 The issue with the end date in the datepicker is fixed
  - When a user selects a date range, the start and end dates are selected as picked, after pressing "Apply filters". The end date does not select as the next day.

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
