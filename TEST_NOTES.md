# Arbimon Test Notes
Test Notes are used to list what pages / components / features / user flows are affected by each update.

## v3.0.32

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
