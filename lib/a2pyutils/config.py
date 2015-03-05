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
        self.load('db')
        self.load('spectrograms')
        
    @classmethod
    def for_path(cls, basepath):
        if basepath not in cls.scache:
            cls.scache[basepath] = cls(basepath)
        return cls.scache[basepath]

    def data(self):
        return [
            self.dbConfig['host'],
            self.dbConfig['user'],
            self.dbConfig['password'],
            self.dbConfig['database'],
            self.awsConfig['bucketName'],
            self.awsConfig['accessKeyId'],
            self.awsConfig['secretAccessKey'],
            self.spectrogramsConfig['spectrograms']
        ]

    def load(self, cfg):
        cfgbasepath = os.path.join(self.basepath, cfg)

        if os.path.isfile(cfgbasepath + '.local.json'):
            cfgpath = cfgbasepath + '.local.json'
        else:
            cfgpath = cfgbasepath + '.json'

        with open(cfgpath) as filedata:
            config = json.load(filedata)

        attr = cfg + "Config"
        self.cache[cfg] = config
        return config

    def __getattr__(self, identifier):
        cfg, magic = identifier[:-6], identifier[-6:]
        if cfg and magic == "Config":
            if cfg not in self.cache:
                return self.load(cfg)
            else:
                return self.cache[cfg]
