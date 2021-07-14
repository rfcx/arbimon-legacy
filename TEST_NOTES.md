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
