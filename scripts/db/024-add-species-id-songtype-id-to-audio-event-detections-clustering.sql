ALTER TABLE audio_event_detections_clustering
ADD COLUMN `species_id` int(11) DEFAULT NULL,
ADD FOREIGN KEY fk_audio_event_detections_clustering_species_id(species_id) REFERENCES species(species_id) ON DELETE SET NULL ON UPDATE CASCADE,
ADD COLUMN `songtype_id` int(11) DEFAULT NULL,
ADD FOREIGN KEY fk_audio_event_detections_clustering_songtype_id(songtype_id) REFERENCES songtypes(songtype_id) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX species_id ON audio_event_detections_clustering(species_id);
CREATE INDEX songtype_id ON audio_event_detections_clustering(songtype_id);
