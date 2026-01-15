#!/usr/bin/env python
import json
import os
import os.path


class Config(object):
    scache = {}

    def __init__(self, basepath=None):
        self.cache = {}

        self.basepath = basepath if basepath else "config"

        self.load('aws')
        self.load('aws_rfcx')
        self.load('db')
        self.load('spectrograms')

        self.is_prod = self.awsConfig.get('env') == 'prod'

    @classmethod
    def for_path(cls, basepath):
        if basepath not in cls.scache:
            cls.scache[basepath] = cls(basepath)
        return cls.scache[basepath]

    def data(self):
        aws = self.awsConfig if self.is_prod else self.aws_rfcxConfig
        return [
            self.dbConfig['host'],
            self.dbConfig['user'],
            self.dbConfig['password'],
            self.dbConfig['database'],
            aws['bucketName'],
            aws['accessKeyId'],
            aws['secretAccessKey'],
            self.spectrogramsConfig['spectrograms'],
            aws['region']
        ]

    def load(self, cfg):
        cfgbasepath = os.path.join(self.basepath, cfg)

        if os.path.isfile(cfgbasepath + '.local.json'):
            cfgpath = cfgbasepath + '.local.json'
        else:
            cfgpath = cfgbasepath + '.json'

        with open(cfgpath) as filedata:
            config = json.load(filedata)

        for key in config:
            env_key = '{0}_{1}'.format(cfg, key).upper()
            if env_key in os.environ:
                config[key] = os.environ[env_key]

        self.cache[cfg] = config
        return config

    def __getattr__(self, identifier):
        cfg, magic = identifier[:-6], identifier[-6:]
        if cfg and magic == "Config":
            if cfg not in self.cache:
                return self.load(cfg)
            else:
                return self.cache[cfg]
