create table if not exists activation_codes
(
    activation_code_id int auto_increment
        primary key,
    hash               varchar(255) not null,
    created            datetime     not null,
    creator            int          not null,
    payload            text         not null,
    consumed           tinyint(1)   not null,
    consumer           int          null,
    project            int          null
)
    charset = utf8;

create table if not exists audio_event_detection_algorithms
(
    id          int auto_increment
        primary key,
    name        varchar(64) not null,
    description text        not null,
    defaults    text        not null
)
    charset = utf8;

create table if not exists audio_event_detection_algorithm_configurations
(
    aedc_id      int auto_increment
        primary key,
    algorithm_id int          not null,
    parameters   text         not null,
    hash         varchar(255) not null,
    constraint hash
        unique (hash),
    constraint audio_event_detection_algorithm_configurations_ibfk_1
        foreign key (algorithm_id) references audio_event_detection_algorithms (id)
)
    charset = utf8;

create index algorithm_id
    on audio_event_detection_algorithm_configurations (algorithm_id);

create table if not exists audio_event_detection_statistics
(
    id          varchar(255) not null
        primary key,
    name        text         not null,
    description text         not null
)
    charset = utf8;

create table if not exists audio_event_detections
(
    aed_id           int unsigned auto_increment
        primary key,
    configuration_id int          not null,
    project_id       int          not null,
    name             varchar(255) not null,
    playlist_id      int          not null,
    statistics       text         not null,
    date_created     datetime     not null,
    plot_params      text         null
)
    charset = utf8;

create table if not exists classification_stats
(
    job_id     int                 not null,
    json_stats text charset latin1 not null
)
    charset = utf8;

create table if not exists cnn_models
(
    cnn_id      int(11) unsigned auto_increment,
    name        varchar(45)        null,
    uri         varchar(45)        null,
    stats       varchar(45)        null,
    sample_rate mediumint unsigned not null,
    info        text               not null,
    arn         text               not null,
    constraint cnn_id_UNIQUE
        unique (cnn_id),
    constraint uri_UNIQUE
        unique (uri)
);

alter table cnn_models
    add primary key (cnn_id);

create table if not exists invalid_logins
(
    ip     varchar(40)                         not null,
    time   timestamp default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP,
    user   varchar(32)                         not null,
    reason varchar(50)                         not null,
    primary key (ip, time)
)
    charset = utf8;

create table if not exists job_execution_task_steps
(
    job_task_id int                                                  not null,
    `index`     int                                                  not null,
    status      enum ('waiting', 'processing', 'completed', 'error') not null,
    remark      text                                                 null,
    primary key (job_task_id, `index`)
);

create table if not exists job_execution_task_types
(
    step_type_id smallint auto_increment
        primary key,
    job_type_id  int          null,
    name         varchar(255) not null,
    typedef      text         not null
);

create index job_type_id
    on job_execution_task_types (job_type_id);

create table if not exists job_execution_tasks
(
    job_id       int     not null,
    idx          int     not null,
    task_type_id int     not null,
    completed    tinyint not null,
    primary key (job_id, idx)
);

create table if not exists job_params_audio_event_detection
(
    job_id           bigint unsigned not null
        primary key,
    name             text            not null,
    playlist_id      int unsigned    not null,
    configuration_id int             not null,
    statistics       text            not null
)
    charset = utf8;

create table if not exists job_queues
(
    job_queue_id int auto_increment
        primary key,
    pid          int                                              not null,
    host         varchar(256)                                     not null,
    platform     varchar(255)                                     not null,
    arch         varchar(255)                                     not null,
    cpus         int                                              not null,
    freemem      int                                              not null,
    heartbeat    timestamp              default CURRENT_TIMESTAMP not null,
    is_alive     tinyint(1)                                       not null,
    run_types    set ('script', 'task') default 'script'          not null comment 'Run type of jobs handled by this job queue '
)
    charset = utf8;

create table if not exists job_task_types
(
    type_id    int auto_increment
        primary key,
    identifier varchar(255) not null,
    name       varchar(255) not null,
    typedef    text         not null
);

create table if not exists job_types
(
    job_type_id int unsigned auto_increment
        primary key,
    name        varchar(255)                                           not null,
    identifier  varchar(255)                                           not null,
    description text                                                   not null,
    enabled     int                                                    not null,
    script      varchar(255)                                           not null,
    run_type    enum ('script', 'task', 'manual', '') default 'script' not null comment 'Manner in which the job is executed:\n- script - the job is executed buy running a script (path is in script, relative to job queue’s script path)\n- task - the job is executed by issuing a task into the job tasks system (task is in script, arguments are the job’s id)\n- manual - the job is run manually'
)
    charset = utf8;

create table if not exists permissions
(
    permission_id  int unsigned auto_increment
        primary key,
    name           varchar(255) not null,
    description    text         not null,
    security_level int unsigned not null,
    constraint name
        unique (name)
)
    charset = utf8;

create table if not exists playlist_types
(
    playlist_type_id int(11) unsigned auto_increment
        primary key,
    name             varchar(255) not null
)
    charset = utf8;

create table if not exists playlists
(
    playlist_id      int unsigned auto_increment
        primary key,
    project_id       int unsigned not null,
    name             varchar(255) not null,
    playlist_type_id int unsigned not null,
    uri              varchar(255) null,
    metadata         text         null,
    constraint project_id_2
        unique (project_id, name)
)
    charset = utf8;

create index playlist_type_id
    on playlists (playlist_type_id);

create index project_id
    on playlists (project_id);

create table if not exists project_imported_models
(
    model_id   int unsigned not null,
    project_id int unsigned not null,
    primary key (model_id, project_id)
);

create table if not exists project_news_types
(
    news_type_id   int auto_increment
        primary key,
    name           varchar(30) not null,
    description    text        not null,
    message_format text        not null,
    constraint name
        unique (name)
)
    charset = utf8;

create table if not exists project_plans
(
    plan_id           int unsigned auto_increment
        primary key,
    project_id        int unsigned           not null,
    created_on        date                   null,
    activation        date                   null comment 'project activation date - this is when the first upload was done or after 30 days of the project creation',
    storage           int unsigned           not null comment 'storage capacity',
    processing        int unsigned           not null comment 'processing capacity',
    duration_period   int unsigned           null comment 'plan duration in years',
    tier              varchar(10)            null,
    credits_purchased int unsigned default 0 not null,
    credits_used      int unsigned default 0 not null,
    recs_purchased    int unsigned default 0 not null,
    recs_used         int unsigned default 0 not null
)
    charset = utf8;

create index fk_plans_1_idx
    on project_plans (project_id);

create index index3
    on project_plans (activation);

create table if not exists project_soundscape_composition_classes
(
    projectId int unsigned not null,
    scclassId int          not null,
    `order`   int          not null,
    primary key (projectId, scclassId)
)
    charset = utf8;

create table if not exists project_types
(
    project_type_id int unsigned auto_increment
        primary key,
    name            varchar(255) not null,
    description     text         not null
)
    charset = utf8;

create table if not exists projects
(
    project_id                int unsigned auto_increment
        primary key,
    name                      varchar(255)         not null,
    url                       varchar(255)         not null,
    description               text                 not null,
    project_type_id           int unsigned         not null,
    is_private                tinyint(1)           not null,
    is_enabled                tinyint    default 1 not null,
    current_plan              int unsigned         null,
    storage_usage             float                null,
    processing_usage          float                null,
    pattern_matching_enabled  tinyint(1) default 0 not null,
    citizen_scientist_enabled tinyint(1) default 0 not null,
    cnn_enabled               tinyint(1) default 0 not null,
    constraint name
        unique (name),
    constraint url
        unique (url),
    constraint projects_ibfk_2
        foreign key (project_type_id) references project_types (project_type_id),
    constraint projects_ibfk_3
        foreign key (current_plan) references project_plans (plan_id)
            on delete set null
)
    charset = utf8;

alter table project_plans
    add constraint fk_plans_1
        foreign key (project_id) references projects (project_id)
            on update cascade on delete cascade;

create index current_plan
    on projects (current_plan);

create index project_type_id
    on projects (project_type_id);

create table if not exists recanalizer_stats
(
    job_id    int   not null,
    rec_id    int   not null,
    exec_time float not null,
    id        int auto_increment,
    constraint id
        unique (id)
)
    charset = utf8;

create table if not exists recording_soundscape_composition_annotations
(
    recordingId bigint unsigned not null,
    scclassId   int             not null,
    present     tinyint(1)      not null,
    primary key (recordingId, scclassId)
)
    charset = utf8;

create table if not exists recordings_errors
(
    recording_id int  not null,
    job_id       int  not null,
    error        text null
)
    charset = utf8;

create table if not exists roles
(
    role_id     int unsigned auto_increment
        primary key,
    name        varchar(255) not null,
    description text         not null,
    icon        varchar(64)  not null,
    level       int          not null,
    constraint name
        unique (name)
)
    charset = utf8;

create table if not exists role_permissions
(
    role_id       int unsigned not null,
    permission_id int unsigned not null,
    primary key (role_id, permission_id),
    constraint role_permissions_ibfk_1
        foreign key (role_id) references roles (role_id)
            on delete cascade,
    constraint role_permissions_ibfk_2
        foreign key (permission_id) references permissions (permission_id)
            on delete cascade
)
    charset = utf8;

create index permission_id
    on role_permissions (permission_id);

create table if not exists sessions
(
    session_id varchar(255)     not null
        primary key,
    expires    int(11) unsigned not null,
    data       text             null
)
    collate = utf8_bin;

create table if not exists site_connection_types
(
    type_id tinyint auto_increment
        primary key,
    type    varchar(256) not null
);

create table if not exists site_data_log_health_types
(
    health_type_id tinyint auto_increment
        primary key,
    type           varchar(256) not null
)
    charset = utf8;

create table if not exists site_data_log_plug_types
(
    plug_type_id tinyint auto_increment
        primary key,
    type         varchar(256) not null
)
    charset = utf8;

create table if not exists site_data_log_tech_types
(
    tech_type_id tinyint auto_increment
        primary key,
    type         varchar(256) not null
)
    charset = utf8;

create table if not exists site_log_files
(
    site_log_file_id int auto_increment
        primary key,
    site_id          int unsigned not null,
    log_start        datetime     not null,
    log_end          datetime     not null,
    uri              varchar(256) not null
)
    charset = utf8;

create table if not exists site_types
(
    site_type_id int(11) unsigned auto_increment
        primary key,
    name         varchar(40) not null,
    description  text        not null
)
    charset = utf8;

create index type
    on site_types (name);

create table if not exists sites
(
    site_id          int unsigned auto_increment
        primary key,
    site_type_id     int unsigned         not null,
    project_id       int unsigned         not null,
    name             varchar(255)         not null,
    lat              double               not null,
    lon              double               not null,
    alt              double               not null,
    published        tinyint(1) default 0 not null,
    token_created_on bigint unsigned      null,
    constraint sites_ibfk_1
        foreign key (project_id) references projects (project_id)
            on delete cascade,
    constraint sites_ibfk_2
        foreign key (site_type_id) references site_types (site_type_id)
)
    charset = utf8;

create table if not exists project_imported_sites
(
    site_id    int unsigned not null,
    project_id int unsigned not null,
    primary key (site_id, project_id),
    constraint fk_project_published_site_1
        foreign key (site_id) references sites (site_id),
    constraint fk_project_published_site_2
        foreign key (project_id) references projects (project_id)
)
    comment 'published sites added to projects (DEPRECATED))' charset = utf8;

create index fk_project_published_site_2_idx
    on project_imported_sites (project_id);

create table if not exists recordings
(
    recording_id    bigint unsigned auto_increment
        primary key,
    site_id         int unsigned       not null,
    uri             varchar(255)       not null,
    datetime        datetime           not null,
    mic             varchar(255)       not null,
    recorder        varchar(255)       not null,
    version         varchar(255)       not null,
    sample_rate     mediumint unsigned null,
    `precision`     tinyint unsigned   null,
    duration        float              null,
    samples         bigint unsigned    null,
    file_size       bigint(45)         null,
    bit_rate        varchar(45)        null,
    sample_encoding varchar(45)        null,
    upload_time     datetime           null,
    constraint unique_uri
        unique (uri),
    constraint recordings_ibfk_1
        foreign key (site_id) references sites (site_id)
)
    charset = utf8;

create table if not exists cnn_results_presence
(
    cnn_presence_id   int auto_increment
        primary key,
    job_id            bigint unsigned     not null,
    recording_id      bigint unsigned     not null,
    species_id        int                 not null,
    songtype_id       int                 not null,
    present           tinyint(4) unsigned not null,
    max_score         float               not null,
    cnn_result_roi_id int default -1      not null,
    constraint cnn_results_presence_ibfk_1
        foreign key (recording_id) references recordings (recording_id)
);

create index cnn_results_pres_ibfk_1_idx
    on cnn_results_presence (recording_id);

create index cnn_results_presence_ibfk_2_idx
    on cnn_results_presence (cnn_result_roi_id);

create table if not exists playlist_recordings
(
    playlist_id  int unsigned    not null,
    recording_id bigint unsigned not null,
    primary key (playlist_id, recording_id),
    constraint playlist_recordings_ibfk_1
        foreign key (playlist_id) references playlists (playlist_id)
            on delete cascade,
    constraint playlist_recordings_ibfk_2
        foreign key (recording_id) references recordings (recording_id)
            on delete cascade
)
    charset = utf8;

create index recording_id
    on playlist_recordings (recording_id);

create index recs_by_upload_time
    on recordings (upload_time, site_id);

create index site_id
    on recordings (site_id);

create table if not exists site_connection_log
(
    log_entry_id bigint auto_increment
        primary key,
    site_id      int(11) unsigned not null,
    datetime     datetime         not null,
    connection   tinyint          null,
    constraint site_connection_log_ibfk_1
        foreign key (connection) references site_connection_types (type_id),
    constraint site_connection_log_ibfk_2
        foreign key (site_id) references sites (site_id)
);

create index connection
    on site_connection_log (connection);

create index site_id
    on site_connection_log (site_id);

create table if not exists site_data_log
(
    log_entry_id bigint auto_increment
        primary key,
    site_id      int(11) unsigned                                     not null,
    datetime     datetime                                             not null,
    power        tinyint                                              not null,
    temp         float                                                not null,
    voltage      int                                                  not null,
    battery      tinyint                                              not null,
    status       enum ('unknown', 'charging', 'not charging', 'full') not null,
    plug_type    tinyint                                              not null,
    health       tinyint                                              not null,
    bat_tech     tinyint                                              null,
    constraint site_data_log_ibfk_1
        foreign key (site_id) references sites (site_id)
            on delete cascade,
    constraint site_data_log_ibfk_2
        foreign key (plug_type) references site_data_log_plug_types (plug_type_id),
    constraint site_data_log_ibfk_3
        foreign key (health) references site_data_log_health_types (health_type_id),
    constraint site_data_log_ibfk_4
        foreign key (bat_tech) references site_data_log_tech_types (tech_type_id)
)
    charset = utf8;

create index bat_tech
    on site_data_log (bat_tech);

create index health
    on site_data_log (health);

create index plug_type
    on site_data_log (plug_type);

create index site_id
    on site_data_log (site_id, datetime);

create table if not exists site_event_log
(
    log_entry_id bigint auto_increment
        primary key,
    site_id      int unsigned                           not null,
    datetime     datetime                               not null,
    type         enum ('notice', 'config', 'alarm', '') not null,
    message      varchar(256)                           null,
    constraint site_event_log_ibfk_1
        foreign key (site_id) references sites (site_id)
)
    charset = utf8;

create index site_id
    on site_event_log (site_id, datetime);

create index name
    on sites (name);

create index project_id
    on sites (project_id);

create index site_type_id
    on sites (site_type_id);

create table if not exists songtypes
(
    songtype_id int auto_increment
        primary key,
    songtype    varchar(20)  not null,
    description varchar(255) not null,
    constraint songtype
        unique (songtype)
)
    charset = utf8;

create table if not exists soundscape_aggregation_types
(
    soundscape_aggregation_type_id int(11) unsigned auto_increment
        primary key,
    identifier                     varchar(255) not null,
    name                           text         not null,
    scale                          varchar(50)  not null comment 'json array',
    description                    text         not null
)
    charset = utf8;

create table if not exists soundscape_composition_class_types
(
    id   int auto_increment
        primary key,
    type varchar(255) not null
)
    charset = utf8;

create table if not exists soundscape_composition_classes
(
    id            int auto_increment
        primary key,
    typeId        int               not null,
    name          varchar(255)      not null,
    isSystemClass tinyint default 0 not null,
    constraint soundscape_composition_classes_ibfk_1
        foreign key (typeId) references soundscape_composition_class_types (id)
)
    charset = utf8;

create index typeId
    on soundscape_composition_classes (typeId);

create table if not exists soundscape_tags
(
    soundscape_tag_id int unsigned auto_increment
        primary key,
    tag               varchar(256)                             not null,
    type              enum ('normal', 'species_sound', '', '') not null
)
    charset = utf8;

create table if not exists soundscapes
(
    soundscape_id                  int unsigned auto_increment
        primary key,
    name                           varchar(255)                                                     not null,
    project_id                     int unsigned                                                     not null,
    user_id                        int unsigned                                                     not null,
    soundscape_aggregation_type_id int unsigned                                                     not null,
    bin_size                       int                                                              not null,
    uri                            text                                                             null,
    min_t                          int                                                              not null,
    max_t                          int                                                              not null,
    min_f                          int                                                              not null,
    max_f                          int                                                              not null,
    min_value                      int                                                              not null,
    max_value                      int                                                              not null,
    visual_max_value               int                                                              null,
    visual_palette                 int                                           default 1          not null comment 'integer representing the color palette for the soundscape',
    date_created                   datetime                                                         not null,
    playlist_id                    int unsigned                                                     not null,
    frequency                      int                                           default 0          null,
    threshold                      float                                         default 0          null,
    threshold_type                 enum ('absolute', 'relative-to-peak-maximum') default 'absolute' not null,
    normalized                     tinyint(1)                                    default 0          not null,
    constraint soundscapes_ibfk_1
        foreign key (soundscape_aggregation_type_id) references soundscape_aggregation_types (soundscape_aggregation_type_id)
)
    charset = utf8;

create table if not exists soundscape_regions
(
    soundscape_region_id int unsigned auto_increment
        primary key,
    soundscape_id        int(11) unsigned                              not null,
    name                 varchar(256)                                  not null,
    x1                   int                                           not null,
    y1                   int                                           not null,
    x2                   int                                           not null,
    y2                   int                                           not null,
    count                int(11) unsigned                              not null,
    sample_playlist_id   int unsigned                                  null,
    threshold            float                                         null,
    threshold_type       enum ('absolute', 'relative-to-peak-maximum') null,
    constraint sample_playlist_id
        unique (sample_playlist_id),
    constraint soundscape_regions_ibfk_1
        foreign key (soundscape_id) references soundscapes (soundscape_id)
            on delete cascade,
    constraint soundscape_regions_ibfk_2
        foreign key (sample_playlist_id) references playlists (playlist_id)
            on delete set null
)
    charset = utf8;

create index soundscape_id
    on soundscape_regions (soundscape_id);

create index `	soundscape_aggregation_type_id`
    on soundscapes (soundscape_aggregation_type_id);

create table if not exists species_taxons
(
    taxon_id    int auto_increment
        primary key,
    taxon       varchar(30) not null,
    image       varchar(30) not null,
    taxon_order int         not null,
    enabled     tinyint(11) not null
)
    charset = utf8;

create table if not exists species_families
(
    family_id int auto_increment
        primary key,
    family    varchar(300) not null,
    taxon_id  int          not null,
    constraint species_families_ibfk_1
        foreign key (taxon_id) references species_taxons (taxon_id)
            on delete cascade
)
    charset = utf8;

create index taxon_id
    on species_families (taxon_id);

create table if not exists system_settings
(
    `key` varchar(20) not null
        primary key,
    value text        not null comment 'global system configuration shared accross servers'
)
    comment 'global system settings shared across servers' charset = utf8;

create table if not exists tags
(
    tag_id int unsigned auto_increment
        primary key,
    tag    varchar(256) not null
)
    charset = utf8;

create index tag
    on tags (tag);

create table if not exists test
(
    id       int auto_increment
        primary key,
    username varchar(30)          not null,
    password varchar(32)          not null,
    status   tinyint(1) default 0 null,
    constraint password_UNIQUE
        unique (password),
    constraint username_UNIQUE
        unique (username)
);

create table if not exists training_set_types
(
    training_set_type_id int unsigned auto_increment
        primary key,
    name                 varchar(255) not null,
    identifier           varchar(255) not null,
    description          text         not null
)
    charset = utf8;

create table if not exists model_types
(
    model_type_id        int unsigned auto_increment
        primary key,
    name                 varchar(255)         not null,
    description          text                 not null,
    training_set_type_id int unsigned         not null,
    usesSsim             tinyint    default 0 not null,
    usesRansac           tinyint(1) default 0 not null,
    enabled              tinyint(1) default 1 not null,
    constraint model_types_ibfk_1
        foreign key (training_set_type_id) references training_set_types (training_set_type_id)
)
    charset = utf8;

create index training_set_type
    on model_types (training_set_type_id);

create table if not exists training_sets
(
    training_set_id      bigint unsigned auto_increment
        primary key,
    project_id           int unsigned not null,
    name                 varchar(255) not null,
    date_created         date         not null,
    training_set_type_id int unsigned not null,
    removed              tinyint      not null,
    constraint training_sets_ibfk_1
        foreign key (project_id) references projects (project_id)
            on delete cascade,
    constraint training_sets_ibfk_2
        foreign key (training_set_type_id) references training_set_types (training_set_type_id)
)
    charset = utf8;

create index project_id
    on training_sets (project_id);

create index project_id_2
    on training_sets (project_id, name, removed);

create index training_set_type_id
    on training_sets (training_set_type_id);

create table if not exists uploads_processing
(
    upload_id   int unsigned auto_increment
        primary key,
    project_id  int unsigned                        not null,
    site_id     int unsigned                        not null,
    user_id     int unsigned                        null,
    upload_time timestamp default CURRENT_TIMESTAMP not null,
    filename    varchar(100)                        not null,
    state       varchar(45)                         not null,
    duration    float                               not null,
    datetime    datetime                            null,
    recorder    varchar(45)                         null,
    mic         varchar(45)                         null,
    software    varchar(45)                         null,
    remark      text                                null,
    constraint uploads_processing_ibfk_1
        foreign key (project_id) references projects (project_id)
            on update cascade on delete cascade,
    constraint uploads_processing_ibfk_2
        foreign key (site_id) references sites (site_id)
            on update cascade on delete cascade
)
    comment 'recording uploaded and being process' charset = utf8;

create index filename
    on uploads_processing (filename);

create index project_id
    on uploads_processing (project_id);

create index site_id
    on uploads_processing (site_id);

create index upload_time
    on uploads_processing (upload_time);

create index user_id
    on uploads_processing (user_id);

create table if not exists user_account_support_mobile_codes
(
    mobile_code_id     int unsigned auto_increment
        primary key,
    support_request_id bigint unsigned      not null,
    code               varchar(45)          not null,
    expires            timestamp            not null,
    timestamp          timestamp            not null,
    consumed           tinyint(1) default 0 not null,
    number             varchar(45)          not null
);

create table if not exists user_account_support_type
(
    account_support_type_id int unsigned auto_increment
        primary key,
    name                    varchar(255) not null,
    description             text         not null,
    max_lifetime            int          null comment 'maximum lifetime in seconds of this support type'
)
    charset = utf8;

create table if not exists users
(
    user_id        int(11) unsigned auto_increment
        primary key,
    login          varchar(32)                not null,
    password       varchar(64)                not null,
    firstname      varchar(255)               not null,
    lastname       varchar(255)               not null,
    email          varchar(255)               not null,
    last_login     datetime                   null,
    is_super       tinyint(1)       default 0 not null,
    project_limit  int unsigned     default 1 not null,
    created_on     datetime                   null,
    login_tries    tinyint unsigned default 0 not null,
    disabled_until datetime                   null,
    oauth_google   tinyint          default 0 not null,
    oauth_facebook tinyint          default 0 not null,
    constraint email
        unique (email),
    constraint login
        unique (login)
)
    charset = utf8;

create table if not exists addresses
(
    user_id      int unsigned not null
        primary key,
    name         varchar(45)  not null,
    line1        varchar(50)  not null,
    line2        varchar(50)  not null,
    city         varchar(20)  not null,
    state        varchar(10)  not null,
    country_code varchar(2)   not null,
    postal_code  varchar(20)  not null,
    telephone    varchar(20)  not null,
    constraint fk_addresses_1
        foreign key (user_id) references users (user_id)
            on update cascade on delete cascade
)
    charset = utf8;

create table if not exists jobs
(
    job_id           bigint unsigned auto_increment
        primary key,
    job_type_id      int unsigned                                                                                                           not null,
    date_created     datetime                                                                                                               not null,
    last_update      datetime                                                                                                               not null,
    project_id       int unsigned                                                                                                           not null,
    user_id          int unsigned                                                                                                           not null,
    uri              varchar(255)                                                                                                           not null,
    state            enum ('waiting', 'initializing', 'ready', 'processing', 'completed', 'error', 'canceled', 'stalled') default 'waiting' not null,
    cancel_requested int                                                                                                  default 0         not null,
    progress         double                                                                                               default 0         not null,
    completed        tinyint(1)                                                                                           default 0         not null,
    remarks          text                                                                                                                   not null,
    progress_steps   int                                                                                                  default 0         not null,
    hidden           tinyint                                                                                                                not null,
    ncpu             int                                                                                                  default 3         not null,
    constraint jobs_ibfk_1
        foreign key (job_type_id) references job_types (job_type_id),
    constraint jobs_ibfk_2
        foreign key (project_id) references projects (project_id)
            on delete cascade,
    constraint jobs_ibfk_3
        foreign key (user_id) references users (user_id)
)
    charset = utf8;

create table if not exists job_params_cnn
(
    job_id      bigint unsigned not null
        primary key,
    cnn_id      int unsigned    not null,
    playlist_id int unsigned    null,
    name        text            not null,
    timestamp   timestamp       not null,
    project_id  int unsigned    not null,
    deleted     tinyint(1)      not null,
    constraint job_params_cnn_ibfk_1
        foreign key (cnn_id) references cnn_models (cnn_id),
    constraint job_params_cnn_ibfk_2
        foreign key (playlist_id) references playlists (playlist_id)
            on delete set null,
    constraint job_params_cnn_ibfk_3
        foreign key (job_id) references jobs (job_id)
            on delete cascade
);

create index _idx
    on job_params_cnn (cnn_id);

create index job_params_cnn_ibfk_2_idx
    on job_params_cnn (playlist_id);

create table if not exists job_params_soundscape
(
    job_id                         bigint(11) unsigned                                              not null,
    playlist_id                    int unsigned                                                     null,
    max_hertz                      int                                                              not null,
    bin_size                       int                                                              not null,
    soundscape_aggregation_type_id int unsigned                                                     not null,
    name                           text                                                             not null,
    threshold                      float                                         default 0          not null,
    threshold_type                 enum ('absolute', 'relative-to-peak-maximum') default 'absolute' not null,
    frequency                      int                                           default 0          not null,
    normalize                      tinyint(1)                                    default 0          not null,
    constraint job_id
        unique (job_id),
    constraint job_params_soundscape_ibfk_1
        foreign key (soundscape_aggregation_type_id) references soundscape_aggregation_types (soundscape_aggregation_type_id),
    constraint job_params_soundscape_ibfk_2
        foreign key (job_id) references jobs (job_id)
            on delete cascade
)
    charset = utf8;

create index playlist_id
    on job_params_soundscape (playlist_id);

create index soundscape_aggregation_type_id
    on job_params_soundscape (soundscape_aggregation_type_id);

create table if not exists job_queue_enqueued_jobs
(
    enqueued_job_id bigint unsigned auto_increment
        primary key,
    job_queue_id    int                                 not null,
    job_id          bigint unsigned                     not null,
    timestamp       timestamp default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP,
    constraint job_id
        unique (job_id),
    constraint job_queue_enqueued_jobs_ibfk_1
        foreign key (job_queue_id) references job_queues (job_queue_id)
            on delete cascade,
    constraint job_queue_enqueued_jobs_ibfk_2
        foreign key (job_id) references jobs (job_id)
            on delete cascade
)
    charset = utf8;

create index job_queue_id
    on job_queue_enqueued_jobs (job_queue_id);

create table if not exists job_tasks
(
    task_id            bigint unsigned auto_increment
        primary key,
    job_id             bigint unsigned                                                             not null,
    step               int                                                                         not null,
    type_id            int                                                                         not null,
    dependency_counter int       default 0                                                         not null,
    status             enum ('waiting', 'assigned', 'processing', 'completed', 'error', 'stalled') not null,
    remark             text                                                                        null,
    timestamp          timestamp default CURRENT_TIMESTAMP                                         not null on update CURRENT_TIMESTAMP,
    args               text                                                                        null,
    constraint job_id
        foreign key (job_id) references jobs (job_id)
);

create table if not exists job_task_dependencies
(
    task_id       bigint unsigned      not null,
    dependency_id bigint unsigned      not null,
    satisfied     tinyint(1) default 0 not null,
    primary key (task_id, dependency_id),
    constraint dependency_id
        foreign key (dependency_id) references job_tasks (task_id)
            on delete cascade,
    constraint task_id
        foreign key (task_id) references job_tasks (task_id)
            on delete cascade
)
    charset = utf8;

create index dependency_id_idx
    on job_task_dependencies (dependency_id);

create index task_satisfied
    on job_task_dependencies (task_id, satisfied);

create index job_id_idx
    on job_tasks (job_id);

create index job_step_status
    on job_tasks (job_id, step, status);

create index status_dependecies
    on job_tasks (status, dependency_counter);

create index job_type_id
    on jobs (job_type_id);

create index project_id
    on jobs (project_id);

create index user_id
    on jobs (user_id);

create trigger jobs_BEFORE_UPDATE
    before update
    on jobs
    for each row
BEGIN
    IF (NEW.progress >= OLD.progress_steps)
    THEN
        SET NEW.state = "completed";

        IF (NEW.job_type_id = 6)
        THEN
            SELECT pattern_matching_id
            INTO @pattern_matching_id
            FROM `arbimon2`.`pattern_matchings`
            WHERE job_id = NEW.job_id;
            CALL pattern_matching_postprocess(@pattern_matching_id);
        END IF;

    END IF;
END;

create table if not exists models
(
    model_id          int unsigned auto_increment
        primary key,
    name              varchar(255)      not null,
    model_type_id     int unsigned      not null,
    uri               varchar(255)      not null,
    date_created      datetime          not null,
    project_id        int unsigned      not null,
    user_id           int unsigned      not null,
    training_set_id   bigint unsigned   not null,
    validation_set_id int               not null,
    deleted           tinyint default 0 not null,
    threshold         float             null,
    constraint models_ibfk_1
        foreign key (model_type_id) references model_types (model_type_id),
    constraint models_ibfk_2
        foreign key (user_id) references users (user_id),
    constraint models_ibfk_3
        foreign key (project_id) references projects (project_id)
)
    charset = utf8;

create table if not exists job_params_classification
(
    job_id      bigint unsigned not null
        primary key,
    model_id    int unsigned    not null,
    playlist_id int unsigned    null,
    name        text            not null,
    constraint job_params_classification_ibfk_1
        foreign key (model_id) references models (model_id),
    constraint job_params_classification_ibfk_2
        foreign key (playlist_id) references playlists (playlist_id)
            on delete set null,
    constraint job_params_classification_ibfk_3
        foreign key (job_id) references jobs (job_id)
            on delete cascade
)
    charset = utf8;

create index model_id
    on job_params_classification (model_id);

create index playlist_id
    on job_params_classification (playlist_id);

create table if not exists model_stats
(
    model_id   int unsigned not null,
    json_stats text         not null,
    constraint model_id
        unique (model_id),
    constraint model_stats_ibfk_1
        foreign key (model_id) references models (model_id)
)
    charset = utf8;

create index model_type_id
    on models (model_type_id);

create index project_id
    on models (project_id);

create index user_id
    on models (user_id);

create table if not exists orders
(
    order_id          varchar(36)  not null
        primary key,
    user_id           int unsigned not null,
    datetime          datetime     not null,
    status            varchar(20)  not null comment 'created,
approved,
canceled',
    action            varchar(45)  not null,
    data              text         not null comment 'order data in JSON format',
    paypal_payment_id varchar(50)  not null comment 'JSON object',
    payment_data      text         null,
    error             text         null,
    constraint fk_orders_2
        foreign key (user_id) references users (user_id)
)
    charset = utf8;

create index fk_orders_2_idx
    on orders (user_id);

create table if not exists plan_credits_use
(
    plan_credits_use_id int(11) unsigned auto_increment
        primary key,
    project_id          int unsigned    not null,
    job_id              bigint unsigned null,
    job_type_id         int unsigned    null,
    playlist_id         int unsigned    null,
    credits             int             not null,
    constraint fk_plan_use_job_id
        foreign key (job_id) references jobs (job_id),
    constraint fk_plan_use_job_type_id
        foreign key (job_type_id) references job_types (job_type_id),
    constraint fk_plan_use_playlist_id
        foreign key (playlist_id) references playlists (playlist_id),
    constraint fk_plan_use_project_id
        foreign key (project_id) references projects (project_id)
);

create index fk_plan_use_job_id_idx
    on plan_credits_use (job_id);

create index fk_plan_use_job_type_id_idx
    on plan_credits_use (job_type_id);

create index fk_plan_use_playlist_id_idx
    on plan_credits_use (playlist_id);

create index fk_plan_use_project_id_idx
    on plan_credits_use (project_id);

create table if not exists project_news
(
    news_feed_id bigint unsigned auto_increment
        primary key,
    user_id      int unsigned                        not null,
    project_id   int unsigned                        not null,
    timestamp    timestamp default CURRENT_TIMESTAMP not null,
    data         text                                not null,
    news_type_id int                                 not null,
    constraint project_news_ibfk_1
        foreign key (user_id) references users (user_id),
    constraint project_news_ibfk_2
        foreign key (project_id) references projects (project_id),
    constraint project_news_ibfk_3
        foreign key (news_type_id) references project_news_types (news_type_id)
)
    charset = utf8;

create index news_type_id
    on project_news (news_type_id);

create index project_id
    on project_news (project_id);

create index timestamp
    on project_news (timestamp);

create index user_id
    on project_news (user_id);

create table if not exists recording_tags
(
    recording_tag_id bigint unsigned auto_increment
        primary key,
    recording_id     bigint unsigned not null,
    tag_id           int unsigned    not null,
    user_id          int unsigned    not null,
    datetime         datetime        not null,
    t0               float           null,
    f0               float           null,
    t1               float           null,
    f1               float           null,
    constraint recording_id
        unique (recording_id, tag_id, user_id),
    constraint recording_tags_ibfk_1
        foreign key (tag_id) references tags (tag_id),
    constraint recording_tags_ibfk_2
        foreign key (user_id) references users (user_id)
)
    charset = utf8;

create index tag_id
    on recording_tags (tag_id);

create index user_id
    on recording_tags (user_id);

create table if not exists soundscape_region_tags
(
    soundscape_region_tag_id int unsigned auto_increment
        primary key,
    soundscape_region_id     int unsigned     not null,
    recording_id             bigint unsigned  not null,
    soundscape_tag_id        int(11) unsigned not null,
    user_id                  int(11) unsigned not null,
    timestamp                datetime         not null,
    constraint soundscape_region_id_2
        unique (soundscape_region_id, recording_id, soundscape_tag_id),
    constraint soundscape_region_tags_ibfk_1
        foreign key (soundscape_region_id) references soundscape_regions (soundscape_region_id)
            on delete cascade,
    constraint soundscape_region_tags_ibfk_2
        foreign key (recording_id) references recordings (recording_id)
            on delete cascade,
    constraint soundscape_region_tags_ibfk_3
        foreign key (soundscape_tag_id) references soundscape_tags (soundscape_tag_id),
    constraint soundscape_region_tags_ibfk_4
        foreign key (user_id) references users (user_id)
)
    charset = utf8;

create index recording_id
    on soundscape_region_tags (recording_id);

create index soundscape_region_id
    on soundscape_region_tags (soundscape_region_id);

create index soundscape_tag_id
    on soundscape_region_tags (soundscape_tag_id);

create index user_id
    on soundscape_region_tags (user_id);

create table if not exists species
(
    species_id      int auto_increment
        primary key,
    scientific_name varchar(100) not null,
    code_name       varchar(10)  null,
    taxon_id        int          not null,
    family_id       int          null,
    image           varchar(200) null,
    description     text         null,
    biotab_id       int          null,
    defined_by      int unsigned null,
    constraint scientific_name
        unique (scientific_name),
    constraint species_ibfk_1
        foreign key (taxon_id) references species_taxons (taxon_id)
            on update cascade on delete cascade,
    constraint species_ibfk_2
        foreign key (family_id) references species_families (family_id)
            on delete cascade,
    constraint species_ibfk_3
        foreign key (defined_by) references users (user_id)
)
    charset = utf8;

create table if not exists classification_results
(
    classification_result_id int unsigned auto_increment
        primary key,
    job_id                   int     not null,
    recording_id             int     not null,
    species_id               int     not null,
    songtype_id              int     not null,
    present                  tinyint not null,
    max_vector_value         float   null,
    min_vector_value         float   null,
    constraint job_id_2
        unique (job_id, recording_id),
    constraint classification_results_ibfk_1
        foreign key (species_id) references species (species_id),
    constraint classification_results_ibfk_2
        foreign key (songtype_id) references songtypes (songtype_id)
)
    charset = utf8;

create index job_id
    on classification_results (job_id);

create index job_rec
    on classification_results (job_id, recording_id);

create index recording_id
    on classification_results (recording_id);

create index songtype_id
    on classification_results (songtype_id);

create index species_id
    on classification_results (species_id);

create table if not exists cnn_model_species
(
    cnn_id      int(11) unsigned not null,
    species_id  int              not null,
    songtype_id int              not null,
    primary key (cnn_id, species_id, songtype_id),
    constraint cnn_model_species_ibfk_1
        foreign key (cnn_id) references cnn_models (cnn_id),
    constraint cnn_model_species_ibfk_2
        foreign key (species_id) references species (species_id),
    constraint cnn_model_species_ibfk_3
        foreign key (songtype_id) references songtypes (songtype_id)
);

create index cnn_model_species_ibfk_2_idx
    on cnn_model_species (species_id);

create index cnn_model_species_ibfk_3_idx
    on cnn_model_species (songtype_id);

create table if not exists cnn_results_rois
(
    cnn_result_roi_id int auto_increment
        primary key,
    job_id            bigint unsigned not null,
    recording_id      bigint unsigned not null,
    species_id        int             not null,
    songtype_id       int             not null,
    x1                float           not null,
    y1                float           not null,
    x2                float           not null,
    y2                float           not null,
    uri               text            not null,
    score             float           not null,
    validated         tinyint         null,
    constraint fk_cnn_results_rois_2
        foreign key (recording_id) references recordings (recording_id),
    constraint fk_cnn_results_rois_3
        foreign key (species_id) references species (species_id),
    constraint fk_cnn_results_rois_4
        foreign key (songtype_id) references songtypes (songtype_id)
);

create index fk_cnn_results_rois_2_idx
    on cnn_results_rois (recording_id);

create index fk_cnn_results_rois_3_idx
    on cnn_results_rois (species_id);

create index fk_cnn_results_rois_4_idx
    on cnn_results_rois (songtype_id);

create table if not exists model_classes
(
    model_id    int unsigned not null,
    species_id  int(10)      not null,
    songtype_id int          not null,
    primary key (model_id, species_id, songtype_id),
    constraint model_classes_ibfk_1
        foreign key (species_id) references species (species_id),
    constraint model_classes_ibfk_2
        foreign key (songtype_id) references songtypes (songtype_id),
    constraint model_classes_ibfk_3
        foreign key (model_id) references models (model_id)
)
    charset = utf8;

create index songtype_id
    on model_classes (songtype_id);

create index species_id
    on model_classes (species_id);

create table if not exists pattern_matching_user_statistics
(
    user_statistics_id int(11) unsigned auto_increment
        primary key,
    user_id            int unsigned  not null,
    project_id         int unsigned  not null,
    species_id         int(10)       not null,
    songtype_id        int(10)       not null,
    validated          int           not null,
    correct            int           not null,
    incorrect          int           not null,
    pending            int default 0 not null,
    confidence         float         not null,
    last_update        timestamp     not null,
    constraint uk_pattern_matching_user_statistics_1
        unique (user_id, project_id, species_id, songtype_id),
    constraint fk_pattern_matching_user_statistics_1
        foreign key (user_id) references users (user_id),
    constraint fk_pattern_matching_user_statistics_2
        foreign key (project_id) references projects (project_id),
    constraint fk_pattern_matching_user_statistics_3
        foreign key (species_id) references species (species_id),
    constraint fk_pattern_matching_user_statistics_4
        foreign key (songtype_id) references songtypes (songtype_id)
);

create table if not exists pattern_matchings
(
    pattern_matching_id int auto_increment
        primary key,
    name                varchar(255)         not null,
    project_id          int unsigned         not null,
    timestamp           timestamp            not null,
    species_id          int                  not null,
    songtype_id         int                  not null,
    parameters          text                 not null,
    playlist_id         int unsigned         not null,
    template_id         int                  null,
    completed           tinyint(1) default 0 not null,
    deleted             tinyint(1) default 0 not null,
    job_id              bigint unsigned      null,
    citizen_scientist   tinyint(1) default 0 not null,
    consensus_number    int        default 3 not null,
    cs_expert           tinyint(1) default 0 not null,
    constraint fk_pattern_matchings_1
        foreign key (species_id) references species (species_id),
    constraint fk_pattern_matchings_2
        foreign key (songtype_id) references songtypes (songtype_id),
    constraint fk_pattern_matchings_3
        foreign key (playlist_id) references playlists (playlist_id),
    constraint fk_pattern_matchings_5
        foreign key (project_id) references projects (project_id)
);

create table if not exists pattern_matching_rois
(
    pattern_matching_roi_id   int auto_increment
        primary key,
    pattern_matching_id       int             not null,
    recording_id              bigint unsigned not null,
    species_id                int             not null,
    songtype_id               int             not null,
    x1                        double          not null,
    y1                        double          not null,
    x2                        double          not null,
    y2                        double          not null,
    uri                       text            not null,
    score                     double          null,
    validated                 tinyint(1)      null,
    cs_val_present            int default 0   not null comment 'current count of cs present votes',
    cs_val_not_present        int default 0   not null comment 'current count of cs not present votes',
    consensus_validated       tinyint(1)      null,
    expert_validated          tinyint(1)      null,
    expert_validation_user_id int             null,
    denorm_site_id            int unsigned    null,
    denorm_recording_datetime datetime        null,
    denorm_recording_date     date            null,
    constraint fk_pattern_matching_matches_1
        foreign key (pattern_matching_id) references pattern_matchings (pattern_matching_id),
    constraint fk_pattern_matching_matches_2
        foreign key (recording_id) references recordings (recording_id),
    constraint fk_pattern_matching_matches_3
        foreign key (species_id) references species (species_id),
    constraint fk_pattern_matching_matches_4
        foreign key (songtype_id) references songtypes (songtype_id),
    constraint fk_pattern_matching_rois_1
        foreign key (denorm_site_id) references sites (site_id)
);

create index fk_pattern_matching_matches_1_idx
    on pattern_matching_rois (pattern_matching_id);

create index fk_pattern_matching_matches_2_idx
    on pattern_matching_rois (recording_id);

create index fk_pattern_matching_matches_3_idx
    on pattern_matching_rois (species_id);

create index fk_pattern_matching_matches_4_idx
    on pattern_matching_rois (songtype_id);

create index fk_pattern_matching_rois_1_idx
    on pattern_matching_rois (denorm_site_id);

create index pattern_matching_matches_recording_score_idx
    on pattern_matching_rois (recording_id, score);

create index pattern_matching_matches_site_datetime_score_idx
    on pattern_matching_rois (pattern_matching_id, denorm_site_id, denorm_recording_date, score);

create index pattern_matching_matches_site_score_idx
    on pattern_matching_rois (pattern_matching_id, denorm_site_id, score);

create table if not exists pattern_matching_validations
(
    validation_id           int auto_increment
        primary key,
    pattern_matching_roi_id int              not null,
    user_id                 int(11) unsigned not null,
    timestamp               timestamp        not null,
    validated               int              not null,
    constraint fk_pattern_matching_validations_3_unique
        unique (pattern_matching_roi_id, user_id),
    constraint fk_pattern_matching_validations_1
        foreign key (pattern_matching_roi_id) references pattern_matching_rois (pattern_matching_roi_id),
    constraint fk_pattern_matching_validations_2
        foreign key (user_id) references users (user_id)
);

create index fk_pattern_matching_validations_1_idx
    on pattern_matching_validations (pattern_matching_roi_id);

create index fk_pattern_matchings_1_idx
    on pattern_matchings (species_id);

create index fk_pattern_matchings_2_idx
    on pattern_matchings (songtype_id);

create index fk_pattern_matchings_3_idx
    on pattern_matchings (playlist_id);

create index fk_pattern_matchings_5_idx
    on pattern_matchings (project_id);

create table if not exists project_classes
(
    project_class_id int unsigned auto_increment
        primary key,
    project_id       int(11) unsigned not null,
    species_id       int              not null,
    songtype_id      int              not null,
    constraint project_id
        unique (project_id, species_id, songtype_id),
    constraint project_classes_ibfk_1
        foreign key (species_id) references species (species_id)
            on delete cascade,
    constraint project_classes_ibfk_2
        foreign key (songtype_id) references songtypes (songtype_id)
            on delete cascade,
    constraint project_classes_ibfk_3
        foreign key (project_id) references projects (project_id)
            on delete cascade
)
    charset = utf8;

create index songtype_id
    on project_classes (songtype_id);

create index species_id
    on project_classes (species_id);

create table if not exists recording_validations
(
    recording_validation_id bigint unsigned auto_increment
        primary key,
    recording_id            bigint unsigned not null,
    project_id              int unsigned    not null,
    user_id                 int unsigned    not null,
    species_id              int             not null,
    songtype_id             int             not null,
    present                 tinyint(1)      not null,
    constraint recording_id_2
        unique (recording_id, species_id, songtype_id),
    constraint recording_validations_ibfk_2
        foreign key (recording_id) references recordings (recording_id)
            on update cascade on delete cascade,
    constraint recording_validations_ibfk_5
        foreign key (user_id) references users (user_id),
    constraint recording_validations_ibfk_6
        foreign key (species_id) references species (species_id),
    constraint recording_validations_ibfk_7
        foreign key (songtype_id) references songtypes (songtype_id),
    constraint recording_validations_ibfk_8
        foreign key (project_id) references projects (project_id)
)
    charset = utf8;

create index project_id
    on recording_validations (project_id);

create index project_id_2
    on recording_validations (project_id);

create index recording_id
    on recording_validations (recording_id);

create index songtype_id
    on recording_validations (songtype_id);

create index species_id
    on recording_validations (species_id);

create index user_id
    on recording_validations (user_id);

create index biotab_id
    on species (biotab_id);

create index code_name
    on species (code_name);

create index defined_by
    on species (defined_by);

create index family_id
    on species (family_id);

create index taxon_id
    on species (taxon_id);

create table if not exists species_aliases
(
    alias_id   int auto_increment
        primary key,
    species_id int         not null,
    alias      varchar(50) not null,
    constraint species_aliases_ibfk_1
        foreign key (species_id) references species (species_id)
            on update cascade on delete cascade
)
    charset = utf8;

create index alias
    on species_aliases (alias);

create index species_id
    on species_aliases (species_id);

create table if not exists templates
(
    template_id  int auto_increment
        primary key,
    project_id   int unsigned         not null,
    recording_id bigint unsigned      not null,
    species_id   int                  not null,
    songtype_id  int                  not null,
    name         varchar(255)         not null,
    uri          varchar(255)         null,
    x1           double               not null,
    y1           double               not null,
    x2           double               not null,
    y2           double               not null,
    date_created timestamp            null,
    deleted      tinyint(1) default 0 null,
    constraint fk_templates_1
        foreign key (project_id) references projects (project_id),
    constraint fk_templates_2
        foreign key (recording_id) references recordings (recording_id),
    constraint fk_templates_3
        foreign key (species_id) references species (species_id),
    constraint fk_templates_4
        foreign key (songtype_id) references songtypes (songtype_id)
);

create table if not exists cnn_templates
(
    cnn_id      int unsigned not null,
    template_id int          not null,
    primary key (cnn_id, template_id),
    constraint cnn_templates_ibfk_1
        foreign key (cnn_id) references cnn_models (cnn_id),
    constraint cnn_templates_ibfk_2
        foreign key (template_id) references templates (template_id)
);

create index cnn_templates_ibfk_2_idx
    on cnn_templates (template_id);

create table if not exists job_params_pattern_matching
(
    job_id      bigint unsigned not null
        primary key,
    name        varchar(255)    not null,
    playlist_id int unsigned    not null,
    template_id int             not null,
    params      text            not null,
    constraint fk_job_params_pattern_matching_1
        foreign key (job_id) references jobs (job_id),
    constraint fk_job_params_pattern_matching_2
        foreign key (playlist_id) references playlists (playlist_id),
    constraint fk_job_params_pattern_matching_3
        foreign key (template_id) references templates (template_id)
);

create index fk_job_params_pattern_matching_2_idx
    on job_params_pattern_matching (playlist_id);

create index fk_job_params_pattern_matching_3_idx
    on job_params_pattern_matching (template_id);

create index fk_templates_1_idx
    on templates (project_id);

create index fk_templates_2_idx
    on templates (recording_id);

create index fk_templates_3_idx
    on templates (species_id);

create index fk_templates_4_idx
    on templates (songtype_id);

create table if not exists training_set_roi_set_data
(
    roi_set_data_id bigint unsigned auto_increment
        primary key,
    training_set_id bigint unsigned not null,
    recording_id    bigint unsigned not null,
    species_id      int             not null,
    songtype_id     int             not null,
    x1              double          not null comment 'initial time in seconds',
    y1              double          not null comment 'min frequency in hertz',
    x2              double          not null comment 'final time in seconds',
    y2              double          not null comment 'max frequency in hertz',
    uri             varchar(255)    not null,
    constraint training_set_roi_set_data_ibfk_1
        foreign key (training_set_id) references training_sets (training_set_id)
            on delete cascade,
    constraint training_set_roi_set_data_ibfk_2
        foreign key (recording_id) references recordings (recording_id)
            on update cascade on delete cascade,
    constraint training_set_roi_set_data_ibfk_3
        foreign key (species_id) references species (species_id),
    constraint training_set_roi_set_data_ibfk_4
        foreign key (songtype_id) references songtypes (songtype_id)
)
    charset = utf8;

create index recording_id
    on training_set_roi_set_data (recording_id);

create index songtype_id
    on training_set_roi_set_data (songtype_id);

create index species_id
    on training_set_roi_set_data (species_id);

create index training_set_id
    on training_set_roi_set_data (training_set_id);

create table if not exists training_sets_roi_set
(
    training_set_id bigint unsigned not null
        primary key,
    species_id      int             not null,
    songtype_id     int             not null,
    constraint training_sets_roi_set_ibfk_1
        foreign key (species_id) references species (species_id),
    constraint training_sets_roi_set_ibfk_2
        foreign key (songtype_id) references songtypes (songtype_id),
    constraint training_sets_roi_set_ibfk_3
        foreign key (training_set_id) references training_sets (training_set_id)
            on delete cascade
)
    charset = utf8;

create index songtype_id
    on training_sets_roi_set (songtype_id);

create index species_id
    on training_sets_roi_set (species_id);

create table if not exists user_account_support_request
(
    support_request_id bigint unsigned auto_increment
        primary key,
    user_id            int unsigned                             null,
    support_type_id    int unsigned                             not null,
    hash               varchar(64)                              not null,
    params             text                                     null,
    consumed           tinyint(1) default 0                     not null,
    timestamp          timestamp  default CURRENT_TIMESTAMP     not null on update CURRENT_TIMESTAMP,
    expires            timestamp  default '0000-00-00 00:00:00' not null,
    constraint hash
        unique (hash),
    constraint user_account_support_request_ibfk_1
        foreign key (user_id) references users (user_id)
            on delete cascade,
    constraint user_account_support_request_ibfk_2
        foreign key (support_type_id) references user_account_support_type (account_support_type_id)
            on delete cascade
)
    charset = utf8;

create index support_type_id
    on user_account_support_request (support_type_id);

create index user_id
    on user_account_support_request (user_id);

create table if not exists user_project_role
(
    user_id    int unsigned not null,
    project_id int unsigned not null,
    role_id    int unsigned not null,
    primary key (user_id, project_id),
    constraint user_project_role_ibfk_1
        foreign key (user_id) references users (user_id)
            on delete cascade,
    constraint user_project_role_ibfk_2
        foreign key (project_id) references projects (project_id)
            on delete cascade,
    constraint user_project_role_ibfk_3
        foreign key (role_id) references roles (role_id)
)
    charset = utf8;

create index project_id
    on user_project_role (project_id);

create index role_id
    on user_project_role (role_id);

create index user_id
    on user_project_role (user_id);

create table if not exists validation_set
(
    validation_set_id int unsigned auto_increment
        primary key,
    project_id        int unsigned    not null,
    user_id           int unsigned    not null,
    name              varchar(255)    not null,
    uri               varchar(255)    not null,
    params            text            not null,
    job_id            bigint unsigned not null,
    constraint validation_set_ibfk_1
        foreign key (job_id) references jobs (job_id)
)
    charset = utf8;

create table if not exists job_params_training
(
    job_id                       bigint unsigned not null
        primary key,
    model_type_id                int unsigned    not null,
    training_set_id              bigint unsigned null,
    validation_set_id            int unsigned    null,
    trained_model_id             int unsigned    null,
    use_in_training_present      int             not null,
    use_in_training_notpresent   int             not null,
    use_in_validation_present    int             not null,
    use_in_validation_notpresent int             not null,
    name                         text            not null,
    constraint job_params_training_ibfk_1
        foreign key (job_id) references jobs (job_id)
            on delete cascade,
    constraint job_params_training_ibfk_2
        foreign key (model_type_id) references model_types (model_type_id),
    constraint job_params_training_ibfk_3
        foreign key (training_set_id) references training_sets (training_set_id)
            on delete set null,
    constraint job_params_training_ibfk_4
        foreign key (validation_set_id) references validation_set (validation_set_id),
    constraint job_params_training_ibfk_5
        foreign key (trained_model_id) references models (model_id)
)
    charset = utf8;

create index model_type_id
    on job_params_training (model_type_id);

create index trained_model_id
    on job_params_training (trained_model_id);

create index training_set_id
    on job_params_training (training_set_id);

create index validation_set_id
    on job_params_training (validation_set_id);

create index job_id
    on validation_set (job_id);

create or replace view job_stats_by_month as
select cast(date_format(`arbimon2`.`jobs`.`date_created`, '%Y-%m-01') as date) AS `month_date`,
       count(0)                                                                AS `jobs`,
       `arbimon2`.`jobs`.`job_type_id`                                         AS `job_type_id`,
       `arbimon2`.`jobs`.`state`                                               AS `state`,
       sum(`arbimon2`.`jobs`.`progress`)                                       AS `job_steps`,
       sum(ceiling((timestampdiff(SECOND, `arbimon2`.`jobs`.`date_created`, `arbimon2`.`jobs`.`last_update`) /
                    3600)))                                                    AS `job_hours`
from `arbimon2`.`jobs`
group by year(`arbimon2`.`jobs`.`date_created`), month(`arbimon2`.`jobs`.`date_created`),
         `arbimon2`.`jobs`.`job_type_id`, `arbimon2`.`jobs`.`state`;

create or replace view project_plan_owner as
select `P`.`name`        AS `name`,
       `U`.`firstname`   AS `firstname`,
       `U`.`lastname`    AS `lastname`,
       `U`.`email`       AS `email`,
       `PP`.`created_on` AS `plan_date`,
       `PP`.`tier`       AS `tier`,
       `PP`.`storage`    AS `storage`,
       `PP`.`processing` AS `processing`
from (((`arbimon2`.`projects` `P` join `arbimon2`.`project_plans` `PP` on ((`P`.`current_plan` = `PP`.`plan_id`))) join `arbimon2`.`user_project_role` `UPR` on (((`UPR`.`project_id` = `P`.`project_id`) and (`UPR`.`role_id` = 4))))
         join `arbimon2`.`users` `U` on ((`U`.`user_id` = `UPR`.`user_id`)));
