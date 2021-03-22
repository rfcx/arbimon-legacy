# Arbimon Deployment Notes

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

## v3.0.10

_None_

## v3.0.9

- Run migration 006-project-table-add-aed-clustering-enabled-colums.sql

## v3.0.8

- Install `serve-favicon` library

## v3.0.7

_None_

## v3.0.6

_None_

## v3.0.5

- Run migration 005-remove-recordings-uri-unique.sql

## v3.0.4

_None_
