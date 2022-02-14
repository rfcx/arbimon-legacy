ALTER TABLE playlists ADD COLUMN `total_recordings` int(11) unsigned DEFAULT 0;

UPDATE playlists SET total_recordings = (
  SELECT COUNT(recording_id)
  FROM playlist_recordings
  WHERE playlist_recordings.playlist_id = playlists.playlist_id
  GROUP BY playlist_id
);
