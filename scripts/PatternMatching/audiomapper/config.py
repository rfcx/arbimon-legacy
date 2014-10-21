#!/usr/bin/env python
import json

class Config:

    def __init__(self):
        aws_data=open('config/aws.json')
        self.awsConfig = json.load(aws_data)        
        db_data=open('config/db.local.json')
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
