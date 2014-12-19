from a2audio.rec import Rec
from pylab import *
import numpy
import time
from a2pyutils.config import Config
from skimage.measure import structural_similarity as ssim
import cPickle as pickle

class Recanalizer:
    
    def __init__(self, uri , speciesSurface ,low , high ,columns,tempFolder,logs=None , bucket = 'arbimon2'):
        start_time = time.time()
        self.low = float(low)
        self.high = float(high)
        self.columns = speciesSurface.shape[1]#int(columns)
        self.speciesSurface = speciesSurface
        self.logs = logs
        configuration = Config()
        config = configuration.data()
        if self.logs:
           self.logs.write(uri)    
        self.uri = uri
        if self.logs:
           self.logs.write(self.uri)    
        if self.logs :
            self.logs.write("configuration time --- seconds ---" + str(time.time() - start_time))
        start_time = time.time()
        self.rec = Rec(uri,tempFolder,config,bucket,logs)
        if self.logs:
            self.logs.write("retrieving recording from bucket --- seconds ---" + str(time.time() - start_time))
        if self.rec.status == 'HasAudioData':
            start_time = time.time()
            self.spectrogram()
            if self.logs:
                self.logs.write("spectrogrmam --- seconds ---" + str(time.time() - start_time))
            start_time = time.time()
            self.featureVector()
            if self.logs:
                self.logs.write("feature vector --- seconds ---" + str(time.time() - start_time))
            self.status = 'Processed'
        else:
            self.status = 'NoData'        
        self.tempFolder = tempFolder
        
    def getVector(self ):
        return self.distances
    
    def features(self):
        return [numpy.mean(self.distances), (max(self.distances)-min(self.distances)),
                max(self.distances), min(self.distances)
                , numpy.std(self.distances) , numpy.median(self.distances)]
        
    def featureVector(self):
        if self.logs:
           self.logs.write("featureVector start")
        if self.logs:
           self.logs.write(self.uri)    
        pieces = self.uri.split('/')
        filename = '/home/rafa/debugs_pickels/'+pieces[len(pieces)-1]+".pickle"
        self.distances = []
        currColumns = self.spec.shape[1]
        step = 4
        if self.logs:
           self.logs.write("featureVector in here")     
        self.matrixSurfacComp = numpy.copy(self.speciesSurface[self.lowIndex:self.highIndex,:])
        if self.logs:
           self.logs.write("featureVector write start")
           
        #with open(filename, 'wb') as output:
        #    pickler = pickle.Pickler(output, -1)
        #    pickle.dump([self.spec,self.matrixSurfacComp], output, -1)
        #    
        if self.logs:
           self.logs.write("featureVector write end")            
        spec = self.spec;
        for j in range(0,currColumns - self.columns,step): 
            self.distances.append(self.matrixDistance(numpy.copy(spec[: , j:(j+self.columns)])  , 2  ) )
        if self.logs:
           self.logs.write("featureVector end")
           
    def matrixDistance(self,a,stype=1):
        val = 0
        
        if stype == 1: #original from RAB thesis
            val = numpy.linalg.norm(a  - self.matrixSurfacComp)
        
        if stype == 2: # SSIM (structural similarity)
            val = ssim(a,self.matrixSurfacComp)
            if val < 0:
                val = 0
                
        return val
    
    def spectrogram(self):

        start_time = time.time()
        Pxx, freqs, bins = mlab.specgram(self.rec.original, NFFT=512, Fs=self.rec.sample_rate , noverlap=256)
        dims =  Pxx.shape
        if self.logs:
            self.logs.write("mlab.specgram --- seconds ---" + str(time.time() - start_time))

        i =0
        j = 0
        start_time = time.time()
        while freqs[i] < self.low:
            j = j + 1
            i = i + 1
        
        #calculate decibeles in the passband
        while freqs[i] < self.high:
            Pxx[i,:] =  10. * np.log10( Pxx[i,:].clip(min=0.0000000001))
            i = i + 1
 
        if i >= dims[0]:
            i = dims[0] - 1
            
        Z= Pxx[j:i,:]
        
        self.highIndex = dims[0]-j
        self.lowIndex = dims[0]-i
        
        if self.lowIndex < 0:
            self.lowIndex = 0
            
        if self.highIndex >= dims[0]:
            self.highIndex = dims[0] - 1
            
        Z = np.flipud(Z)
        if self.logs:
            self.logs.write('logs and flip ---' + str(time.time() - start_time))
        self.spec = Z
    
    def showVectAndSpec(self):
        ax1 = subplot(211)
        plot(self.distances)
        subplot(212, sharex=ax1)
        ax = gca()
        im = ax.imshow(self.spec, None)
        ax.axis('auto')
        show()
        close()
