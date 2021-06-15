ALTER TABLE recording_tags
  ADD COLUMN site_id int(10) unsigned DEFAULT NULL,
  ADD FOREIGN KEY fk_recording_tags_site_id(site_id) REFERENCES sites(site_id) ON DELETE CASCADE;

CREATE INDEX site_id ON recording_tags(site_id);

UPDATE recording_tags RT JOIN recordings R ON RT.recording_id = R.recording_id SET RT.site_id = R.site_id;
