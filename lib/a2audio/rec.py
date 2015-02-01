import boto
#import audiotools
import math
import os
import time
import sys
from boto.s3.connection import S3Connection
import warnings
from urllib2 import urlopen, URLError, HTTPError
with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    from scikits.audiolab import Sndfile, Format
from contextlib import closing
import numpy as np

class Rec:

    filename = ''
    samples = 0
    sample_rate = 0

    def __init__(self, uri, tempFolder, configData, bucket, logs=None, removeFile=True):
        self.logs = logs
        self.config = configData
        self.localFiles = tempFolder
        self.bucket = bucket    # bucket name
        self.uri = uri    # recording uri in bucket
        tempfilename = uri.split('/')
        self.filename = tempfilename[len(tempfilename)-1]
        
        #get file from bucket
        start_time = time.time()
        if not self.getAudioFromUri():
           self.status = 'KeyNotFound'
           return None  
        if self.logs :
            self.logs.write("getAudioFromUri:" + str(time.time() - start_time))
        
        start_time = time.time()
        #

         #   audiotools.open(self.localFiles+self.filename).convert(self.localFiles+self.filename+".wav",audiotools.WaveAudio)
          #  audiodata = audiotools.open(self.localFiles+self.filename+".wav")
        #else:
         #   audiodata = audiotools.open(self.localFiles+self.filename)
        sig = None
        
        try:
            with closing(Sndfile(self.localFiles+self.filename+self.seed)) as f:
                if self.logs :
                    self.logs.write("sampling rate = {} Hz, length = {} samples, channels = {}".format(f.samplerate, f.nframes, f.channels))
                self.bps = 16
                self.channs = f.channels
                self.samples = f.nframes
                self.sample_rate = f.samplerate       
                # default dtype: float64
                self.original = f.read_frames(f.nframes,dtype=np.dtype('int'+str(self.bps)))
                if self.logs :
                    self.logs.write(str(type(self.original)))
        except:
            if self.logs :
                self.logs.write("error opening : "+self.filename)
            self.status = 'CorruptedFile'
            return None
        
        self.localfilename = self.localFiles+self.filename+self.seed
        
        if 'flac' in self.filename: #if flac convert to wav
            if not removeFile:
                format = Format('wav')
                f = Sndfile(self.localfilename+".wav", 'w', format, self.channs, self.sample_rate)
                f.write_frames(self.original)
                f.close()
                os.remove(self.localfilename)
                self.localfilename = self.localfilename+".wav"
                
        if self.logs :
            self.logs.write("opened file:" + str(time.time() - start_time))
            

        if self.channs> 1:
            self.status = 'StereoNotSupported'
            return None
        
        if self.samples == 0:
            self.status = 'NoData'
            return None
        
        #data reads
        #start_time = time.time()
       # pcmData = audiodata.to_pcm()
        #if self.logs :
         #   self.logs.write("to pcm:" + str(time.time() - start_time))
            
        #start_time = time.time()
        #get original waveform
        # = self.getAudioFrames(pcmData)
        #if self.logs :
        #    self.logs.write("getAudioFrames:" + str(time.time() - start_time))
            
        #length of the original waveform
        
        #remove temporary file
        if removeFile:
            os.remove(self.localfilename)

        self.status = 'HasAudioData'
        if self.logs :
            self.logs.write("remove temporary file:" + str(time.time() - start_time))
            
    def getAudioFromUri(self): #function that copies file from amazon bucket to local machine
        #bucket = None
        #if type(self.bucket) is str:
        #start_time = time.time()
        awsKeyId = self.config[5]
        awsKeySecret = self.config[6]
        self.bucket = self.config[4]
        #conn = S3Connection(awsKeyId, awsKeySecret)
        #bucket = conn.get_bucket(self.bucket)
        #if self.logs :
        #    self.logs.write("bucket config:" + str(time.time() - start_time))
        #elif type(self.bucket) is boto.s3.bucket.Bucket:
        #    bucket = self.bucket
        #else:
        #    return False
            
        start_time = time.time()
        #key = bucket.get_key(self.uri)
        #if not key:
        #    return False       
        #key.get_contents_to_filename(self.localFiles+self.filename)
        #
        self.seed = "%.16f" % ((sys.maxint*np.random.rand(1)))
        f = None
        if self.logs :
            self.logs.write('https://s3.amazonaws.com/'+self.bucket+'/'+self.uri+ ' to '+self.localFiles+self.filename+self.seed)
        try:
            f = urlopen('https://s3.amazonaws.com/'+self.bucket+'/'+self.uri)
            if self.logs :
                self.logs.write('urlopen success')
            # Open our local file for writing
                
        #handle errors
        except HTTPError, e:
            if self.logs :
                self.logs.write("bucket http error:" + str(e.code ))
            return False
        except URLError, e:
            if self.logs :
                self.logs.write("bucket url error:" + str(e.reason ))
            return False
        
        
        while os.path.isfile(self.localFiles+self.filename+self.seed):
            self.seed = "%.16f" % ((sys.maxint*np.random.rand(1)))
            
        if f:
            try:
                with open(self.localFiles+self.filename+self.seed, "wb") as local_file:
                   local_file.write(f.read())
            except:
                self.logs.write('error f.read')
                return False
        else:
            return False
        
        if self.logs :
           self.logs.write('f.read success')
           
        if self.logs :
            self.logs.write("retrieve recording:" + str(time.time() - start_time))
        return True

    def getAudioFrames(self,pcmData): #function that reads audio from pcm buffer
        data = []
        
        endSample = self.samples
        index = 0;

        while(index < endSample):
            data.append(pcmData.read(1)[0])
            index = index + 1    
        
        return data    
    
    def getLocalFileLocation(self):
        if os.path.isfile(self.localfilename):
            return self.localfilename;
        else:
            return None;
