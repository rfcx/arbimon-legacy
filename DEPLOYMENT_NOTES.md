# Arbimon Deployment Notes

## v3.0.74
- Run 040-create-recordings-export-parameters-table.sql on staging/production

## v3.0.68
- Run 039-add-upload-url-to-uploads-processing.sql on the production

## v3.0.66

- Run 036-add-aeds-clusters-detected-to-job-params-audio-event-clustering.sql on the production

## v3.0.65

- Install `sha1-file` library (^1.0.4)
- Add `ingestBaseUrl` in `config/rfcx.local.json` file:
    - For staging: https://staging-ingest.rfcx.org
    - For production: https://ingest.rfcx.org
- Remove `process_uploaded_recording` from the `config/rfcx.local.json` and `clustering_jobs` from `config/lambdas.local.json`
- Run 035-update-user-role-permissions.sql on the production

## v3.0.64

- Run 034-add-deleted-to-aed-and-clustering.sql on the production

## v3.0.62

- Run 032-create-recordings-deleted-table.sql on the production
- Run 033-add-deleted-at-to-sites.sql on the production


## v3.0.58

- Run 031-cached-metrics-table.sql on the production

## v3.0.55

- Run 028-add-created-at-updated-at-to-projects.sql on the staging/production sides

## v3.0.50

- Run 027-add-present-aed-to-recording-validations.sql on the production side

## v3.0.46

- Run 026-add-index-for-name-to-pattern-matchings.sql on the production side

## v3.0.46

- Run 024-add-species-id-songtype-id-to-audio-event-detections-clustering.sql on the production side

## v3.0.44

- You have to update `bioAnalyticsBaseUrl` in `config/rfcx.local.json` file:
    - For staging: https://staging-bio.rfcx.org
    - For production: https://bio.rfcx.org

- Run 023-project-reports-enabled.sql on the production side

## v3.0.43

- You have to add `bioAnalyticsBaseUrl` in `config/rfcx.local.json` file:
    - For staging: https://staging-bio.rfcx.org
    - For production: https://bio.rfcx.org

- Run `bower install` to update `plotly.js` version

## v3.0.39

- Install `mime` library (^2.5.2)

## v3.0.36

- Run 021-update-role-permissions.sql on the production side

## v3.0.34

- Projects list: Change the values in featured=2 projects to 1. Keep 9 projects as featured=1. Add the projects' images for all 9 projects. Add Tembe project to be one of the highlighted tiles that show up.

## v3.0.33

- Add `explorerBaseUrl` in `config/rfcx.local.json` file
- Update the "upload" lambda to not save datetime_local
- Run sql migration 018-remove-datetime-local-column-from-recordings-table.sql

## v3.0.25

- Run migration 014-projects-table-add-image-column.sql
- Run query to add featured=2 and add the images for 3 top projects
- Add `"expiration": 604800000` to `config/session.json`

## v3.0.23

- Run migration 012-projects-table-add-deleted-column.sql
- Run migration 011-projects-table-add-featured-column.sql
- Run query to add featured=true for top projects

## v3.0.22-hotfix.0

- Run migration 013-recordings-table-add-datetime-utc-column.sql

## v3.0.22

- Run migration 010-recordings-table-add-meta-column.sql

## v3.0.21

- Run migration 009-recordings-table-add-datetime-local-column.sql
- Run query to updating all recordings datetime_local
- Add datetime_local parameter to model.py file into uploader Lambda function
- Ensure that `config/rfcx.local.json` has the correct value for `apiBaseUrl` and `mediaBaseUrl` (default value in rfcx.json was changed)

## v3.0.16

- Ensure that `config/job-queue.local.json` has a value for `instanceId` because the default was changed to `"none"`.

## v3.0.15

- Run migration 008-sites-table-add-updated-at-column.sql
- Run script to updating all sites updated_at

## v3.0.13

- Run migration 008-add-external-id-to-projects.sql
- Add missing `external_id` to projects and sites

## v3.0.12

- Run migration 007-sites-table-add-timezone-column.sql
- Run script to updating all sites timezone

## v3.0.11

- Add `config/k8s.json` file

## v3.0.9

- Run migration 006-project-table-add-aed-clustering-enabled-colums.sql

## v3.0.8

- Install `serve-favicon` library

## v3.0.5

- Run migration 005-remove-recordings-uri-unique.sql

## v3.0.4

_None_
