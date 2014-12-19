from pylab import *
import numpy
import cPickle as pickle
import scipy

class Roiset:   

    def __init__(self, classId,setSRate):
        self.classId = classId
        self.roiCount = 0
        self.roi = [] 
        self.sampleLengths =[]
        self.rows = 0
        self.sampleRates = []
        self.setSampleRate = setSRate
        
    def addRoi(self,lowFreq,highFreq,sample_rate,spec,rows,columns):
        if self.setSampleRate == sample_rate:
            if len(self.sampleLengths) < 1:
                self.maxColumns = columns
                self.varlengthsIndeces = []
                self.maxIndeces = []
                self.maxrois = []
                self.varlengths = set()
                self.maxrois.append(spec)
                self.maxIndeces.append(self.roiCount)
                self.lowestFreq = lowFreq
                self.highestFreq = highFreq
                self.highestlowestFreq = lowFreq
                self.lowesthighestFreq = highFreq  
            else:
                if self.lowestFreq > lowFreq:
                    self.lowestFreq = lowFreq
                if self.highestFreq < highFreq:
                    self.highestFreq = highFreq
                if self.highestlowestFreq  < lowFreq:
                    self.highestlowestFreq  = lowFreq
                if self.lowesthighestFreq > highFreq:
                    self.lowesthighestFreq = highFreq
                if self.maxColumns < columns:
                    self.varlengths.add(self.maxColumns)
                    self.maxColumns = columns
                    for i in self.maxIndeces:
                        self.varlengthsIndeces.append(i)
                    self.maxIndeces = []
                    self.maxIndeces.append(self.roiCount)
                    self.maxrois = []
                    self.maxrois.append(spec)
                elif self.maxColumns == columns:
                    self.maxIndeces.append(self.roiCount)
                    self.maxrois.append(spec)
                else:
                    self.varlengthsIndeces.append(self.roiCount)
                    self.varlengths.add(columns)
                    
            self.sampleRates.append(sample_rate)    
            self.sampleLengths.append(columns)
            self.rows = rows
            self.roi.append(Roi(lowFreq,highFreq,sample_rate,spec)) 
            self.roiCount = self.roiCount + 1     

    def alignSamples(self):
        

        self.surface = numpy.sum(self.maxrois,axis=0)
        weights = numpy.ones(shape=(self.rows,self.maxColumns))
        freqs = [self.setSampleRate/2/(self.rows-1)*i for i in reversed(range(0,self.surface.shape[0]))]
        high_index = 0
        low_index = 0
        while freqs[high_index] >= self.highestFreq:
            high_index = high_index + 1
            low_index  = low_index  + 1
        while freqs[low_index ] >=  self.lowestFreq:
            low_index  = low_index  + 1
        
        weights[high_index:low_index ,:] = weights[high_index:low_index ,:]*len(self.maxrois)
        
        for i in self.varlengthsIndeces:
            distances = []
            currColumns = self.roi[i].spec.shape[1]
            for j in range(self.maxColumns -currColumns ): 
                subMatrix =  self.surface[:, j:(j+currColumns)]
                distances.append(numpy.linalg.norm(subMatrix  - self.roi[i].spec) )
            j = distances.index(min(distances))
            temp = numpy.zeros(shape=(self.rows,self.maxColumns))
            temp[:, j:(j+currColumns)] = self.roi[i].spec
            self.maxrois.append(temp)
            self.surface[:, j:(j+currColumns)] = (self.surface[:, j:(j+currColumns)] + self.roi[i].spec)
            
            high_index = 0
            low_index = 0
            while freqs[high_index] >= self.roi[i].highFreq:
                high_index = high_index + 1
                low_index  = low_index  + 1
            while freqs[low_index ] >=  self.roi[i].lowFreq:
                low_index  = low_index  + 1

            
            weights[high_index:low_index, j:(j+currColumns)] = weights[high_index:low_index, j:(j+currColumns)]  + 1
            
        #self.meanSurface = numpy.mean([self.maxrois[j] for j in range(self.roiCount)],axis=0)
        self.meanSurface = numpy.sum(self.maxrois,axis=0)
        self.meanSurface = numpy.divide(self.meanSurface,weights)
        self.stdSurface = numpy.std([self.maxrois[j] for j in range(self.roiCount)],axis=0)
        #
        #for i in reversed(range(0,self.maxColumns)):
        #    if weights[0,i] < self.roiCount:
        #        weights = scipy.delete(weights, i, 1)
        #        self.meanSurface = scipy.delete(self.meanSurface, i, 1)
        #        self.stdSurface = scipy.delete(self.stdSurface, i, 1)
        #        self.surface = scipy.delete(self.surface, i, 1)
        #        
        #self.maxColumns = self.surface.shape[1]
        #freqs = [self.setSampleRate/2/(self.surface.shape[0]-1)*i for i in reversed(range(0,self.surface.shape[0]))]
        #
        #i =0
        #while freqs[i] >= self.lowesthighestFreq:
        #    self.meanSurface[i,:] = 0
        #    self.stdSurface[i,:] = 0
        #    self.surface[i,:] = 0
        #    i = i + 1
        #while freqs[i] >=  self.highestlowestFreq:
        #    i = i + 1
        #while i <  self.rows:
        #    self.meanSurface[i,:] = 0
        #    self.stdSurface[i,:] = 0
        #    self.surface[i,:] = 0
        #    i = i + 1
            
    def showSurface(self):
        ax1 = subplot(111)
        im = ax1.imshow(self.surface, None)
        ax1.axis('auto')
        show()
        close()

    def showMeanSurface(self):
        ax1 = subplot(111)
        im = ax1.imshow(self.meanSurface, None)
        ax1.axis('auto')
        show()
        close()

    def showStdSurface(self):
        ax1 = subplot(111)
        im = ax1.imshow(self.stdSurface, None)
        ax1.axis('auto')
        show()
        close()

class Roi:

    def __init__(self,lowFreq,highFreq,sample_rate,spec):
        self.lowFreq = lowFreq
        self.highFreq = highFreq
        self.sample_rate = sample_rate
        self.spec = spec

    def showRoi(self):
        ax1 = subplot(111)
        im = ax1.imshow(self.spec, None)
        ax1.axis('auto')
        show()
        close()

