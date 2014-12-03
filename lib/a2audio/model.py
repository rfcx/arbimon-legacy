
from sklearn.ensemble import RandomForestClassifier
from sklearn import metrics
from sklearn.preprocessing import normalize
import numpy
import cPickle as pickle
from itertools import izip as zip, count
import random
import csv

class Model:

    def __init__(self,classid,speciesSpec,jobid):
        self.classid = classid
        self.speciesSpec = speciesSpec
        self.data  = numpy.zeros(shape=(0,6))
        self.classes = []
        self.uris = []
        self.minv = 9999999
        self.maxv = -9999999
        self.jobId = jobid
        
    def addSample(self,present,meanfeat,difffeat,maxfeat,minfeat,stdfeat,medfeat,uri):
        self.classes.append(present)
        self.uris.append(uri)
        if self.minv > minfeat:
            self.minv = minfeat
        if self.maxv < maxfeat:
            self.maxv = maxfeat
        row = [meanfeat,difffeat,maxfeat,minfeat,stdfeat,medfeat]
        self.data = numpy.vstack((self.data,row))
    
    def splitData(self,useTrainingPresent,useTrainingNotPresent,useValidationPresent,useValidationNotPresent):
        self.splitParams = [useTrainingPresent,useTrainingNotPresent,useValidationPresent,useValidationNotPresent]

        presentIndeces = [i for i, j in zip(count(), self.classes) if j == '1']
        notPresentIndices = [i for i, j in zip(count(), self.classes) if j == '0']
        
        if(len(presentIndeces) < (useTrainingPresent+useValidationPresent)):
            return False
        if(len(notPresentIndices) < (useTrainingNotPresent+useValidationNotPresent)):
            return False
          
        random.shuffle(presentIndeces)
        random.shuffle(notPresentIndices)
        
        self.trainDataIndices = presentIndeces[:useTrainingPresent] + notPresentIndices[:useTrainingNotPresent]
        self.validationDataIndices = presentIndeces[useTrainingPresent:] + notPresentIndices[useTrainingNotPresent:]
        
        return True
        
    def train(self):
        self.clf = RandomForestClassifier(n_estimators=1000,n_jobs=-1,oob_score=True) #min_samples_leaf
        
        classSubset = [self.classes[i] for i in self.trainDataIndices]
        self.clf.fit(self.data[self.trainDataIndices], classSubset)
        self.obbScore = self.clf.oob_score_
        
    def validate(self):
        classSubset = [self.classes[i] for i in self.validationDataIndices]
        self.outClasses = classSubset
        self.outuris = [self.uris[i] for i in self.validationDataIndices]
        predictions = self.clf.predict(self.data[self.validationDataIndices])
        self.validationpredictions = predictions;
        presentIndeces = [i for i, j in zip(count(), classSubset) if j == '1']
        notPresentIndices = [i for i, j in zip(count(), classSubset) if j == '0']
        
        self.tp = 0.0
        self.fp = 0.0
        self.tn = 0.0
        self.fn = 0.0
        self.precision_score = 0.0
        self.sensitivity_score = 0.0
        self.specificity_score  = 0.0
        
        truePositives =  [classSubset[i] for i in presentIndeces]
        truePosPredicted =  [predictions[i] for i in presentIndeces]
        for i in range(len(truePositives)):
            if truePositives[i] == truePosPredicted[i]:
                self.tp = self.tp + 1.0
            else:
                self.fn = self.fn + 1.0
               
        trueNegatives = [classSubset[i] for i in notPresentIndices]
        trueNegPrediceted = [predictions[i] for i in notPresentIndices]
        for i in range(len(trueNegatives )):
            if trueNegatives[i] == trueNegPrediceted[i]:
                self.tn = self.tn + 1.0
            else:
                self.fp = self.fp + 1.0
                
        self.accuracy_score = (self.tp +  self.tn)/(self.tp+self.fp+self.tn+self.fn)
        if (self.tp+self.fp) > 0:
            self.precision_score = self.tp/(self.tp+self.fp)
        if (self.tp+self.fn) > 0:
            self.sensitivity_score = self.tp/(self.tp+self.fn)
        if (self.tn+self.fp) > 0:
            self.specificity_score  = self.tn/(self.tn+self.fp)
        
    def modelStats(self):
        #smin = min([min((self.speciesSpec[i])) for i in range(self.speciesSpec.shape[0])])
        #smax = max([max((self.speciesSpec[i])) for i in range(self.speciesSpec.shape[0])])
        #x = 255*((self.speciesSpec - smin)/(smax-smin))
        return [self.accuracy_score,self.precision_score,self.sensitivity_score,self.obbScore,self.speciesSpec,self.specificity_score ,self.tp,self.fp,self.tn,self.fn,self.minv,self.maxv]
    
    def save(self,filename,l,h,c):
        with open(filename, 'wb') as output:
            pickler = pickle.Pickler(output, -1)
            pickle.dump([self.clf,self.speciesSpec,l,h,c], output, -1)
            
    def saveValidations(self,filename):
        with open(filename, 'wb') as csvfile:
            spamwriter = csv.writer(csvfile, delimiter=',')
            for i in range(0,len(self.outClasses)):
                spamwriter.writerow([self.outuris[i],self.outClasses[i],self.validationpredictions[i]])
                