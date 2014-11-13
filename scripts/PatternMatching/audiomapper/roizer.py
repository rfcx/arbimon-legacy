from rec import Rec
from pylab import *
from matplotlib import *
import numpy
import math

class Roizer:

    def __init__(self, uri ,tempFolder,config ,iniSecs=5,endiSecs=15,lowFreq = 1000, highFreq = 2000,order = 6, bucket = 'arbimon2'):

        slicedrec = Rec(uri,tempFolder,config,bucket)

        if  'HasAudioData' in slicedrec.status:
            self.original = slicedrec.original
            self.sample_rate = slicedrec.sample_rate
            self.channs = slicedrec.channs
            self.samples = slicedrec.samples
            self.status = 'HasAudioData'
            self.iniT = iniSecs
            self.endT = endiSecs
            self.lowF = lowFreq
            self.highF = highFreq 
            self.uri = uri
        else:
            self.status = "NoAudio"
            return None
        
        self.spectrogram()

    def spectrogram(self):
        
        endSample = int(math.floor(float((self.endT)) * float((self.sample_rate))))
        if endSample >= len(self.original):
           endSample = len(self.original) - 1

        data = self.original[0:endSample]
        
        """
        if self.sample_rate != 44100:
            'resample?'
        """
        
        Pxx, freqs, bins = mlab.specgram(data, NFFT=512, Fs=self.sample_rate, noverlap=256)
        dims =  Pxx.shape
         
        #remove unwanted columns (cut in time)
        i = 0
        while bins[i] < self.iniT:
            Pxx = np.delete(Pxx, 0,1)
            i = i + 1
        
        #put zeros in unwanted frequencies (filter)
        i =0
        while freqs[i] < self.lowF:
            Pxx[i,:] = 0 
            i = i + 1
        #calculate decibeles in the passband
        while freqs[i] < self.highF:
            Pxx[i,:] =  10. * np.log10(Pxx[i,:].clip(min=0.0000000001))
            i = i + 1
        #put zeros in unwanted frequencies (filter)
        while i <  dims[0]:
            Pxx[i,:] = 0
            i = i + 1

        Z = np.flipud(Pxx)
        self.spec = Z
        