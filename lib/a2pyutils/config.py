#!/usr/bin/env python
import json
import os

if os.path.isfile('config/db.local.json'):
    db_config_path = 'config/db.local.json'
else:
    db_config_path = 'config/db.json'

class Config:

    def __init__(self):
        aws_data=open('config/aws.json')
        self.awsConfig = json.load(aws_data)        
        db_data=open(db_config_path)
        self.dbConfig = json.load(db_data)
    
    def data(self):
        return [self.dbConfig['host'],
                self.dbConfig['user'],
                self.dbConfig['password'],
                self.dbConfig['database'],
                self.awsConfig['bucketName'],
                self.awsConfig['accessKeyId'],
                self.awsConfig['secretAccessKey']
                ]
