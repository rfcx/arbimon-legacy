import boto
import audiotools
import math
import os

class Rec:

    filename = ''
    samples = 0
    sample_rate = 0

    def __init__(self, uri , tempFolder,bucket = 'arbimon2'):
        self.localFiles = tempFolder
        self.bucket = bucket    # bucket name
        self.uri = uri    # recording uri in bucket
        tempfilename = uri.split('/')
        self.filename = tempfilename[len(tempfilename)-1]
        
        #get file from bucket
        if not self.getAudioFromUri():
           self.status = 'KeyNotFound'
           return None  
        
        if 'flac' in self.filename: #if flac convert to wav
            audiotools.open(self.localFiles+self.filename).convert(self.localFiles+self.filename+".wav",audiotools.WaveAudio)
            audiodata = audiotools.open(self.localFiles+self.filename+".wav")
        else:
            audiodata = audiotools.open(self.localFiles+self.filename)

        self.bps = audiodata.bits_per_sample()
        self.channs = audiodata.channels()
        self.samples = audiodata.total_frames()
        self.sample_rate = audiodata.sample_rate()
        if audiodata.channels()> 1:
            self.status = 'StereoNotSupported'
            return None

        #data reads
        pcmData = audiodata.to_pcm()

        #get original waveform
        self.original = self.getAudioFrames(pcmData)

        #length of the original waveform
        self.samples = len(self.original)
        pcmData.close()

        #remove temporary file
        os.remove(self.localFiles+self.filename)
        if 'flac' in self.filename:
             os.remove(self.localFiles+self.filename+".wav")
        self.status = 'HasAudioData'

    def getAudioFromUri(self): #function that copies file from amazon bucket to local machine
        conn = boto.connect_s3()
        bucket = conn.get_bucket(self.bucket)
        key = bucket.get_key(self.uri)
        if not key:
            return False       
        key.get_contents_to_filename(self.localFiles+self.filename)
        return True

    def getAudioFrames(self,pcmData): #function that reads audio from pcm buffer
        data = []
        
        endSample = self.samples
        index = 0;

        while(index < endSample):
            data.append(pcmData.read(1)[0])
            index = index + 1    
        
        return data    



