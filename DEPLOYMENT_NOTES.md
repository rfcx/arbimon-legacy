# Arbimon Deployment Notes

## v3.0.44

- When it have to deploy you have to add this configuration into the environment variable:

BIO_ANALYTICS_URL=https://staging-ba.rfcx.org <- For staging
BIO_ANALYTICS_URL=https://ba.rfcx.org <- For production

## v3.0.43

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
